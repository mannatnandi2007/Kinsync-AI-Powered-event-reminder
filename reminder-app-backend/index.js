require('dotenv').config()

const express  = require("express")
const mongoose = require("mongoose")
const cors     = require("cors")
const axios    = require("axios")
const bcrypt   = require("bcryptjs")
const jwt      = require("jsonwebtoken")

// App config
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

// DB config
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/reminderAppDB'

mongoose
    .connect(mongoUri)
    .then(() => console.log('DB connected'))
    .catch((err) => console.error('DB connection error:', err.message))

// ─── Schemas ──────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
    name:     { type: String, trim: true, default: '' },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
}, { timestamps: true })

const User = mongoose.model('user', userSchema)

// userId links each reminder to the user who created it
const reminderSchema = new mongoose.Schema({
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    personName:   { type: String, required: true, trim: true },
    occasionType: { type: String, enum: ['birthday', 'anniversary'], required: true },
    reminderMsg:  { type: String, default: '', trim: true },
    phoneNumber:  { type: String, default: '', trim: true },
    remindAt:     { type: Date, required: true },
    isReminded:   { type: Boolean, default: false },
    lastSentYear: { type: Number, default: null },
})

const Reminder = mongoose.model('reminder', reminderSchema)

// ─────────────────────────────────────────────────────────────────────────────
//    AUTH CONFIG
//    JWT_SECRET → set in .env
//    Example: JWT_SECRET=myS3cur3R4nd0mStr1ng!XYZ
// ─────────────────────────────────────────────────────────────────────────────
const JWT_SECRET     = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_ENV'
const JWT_EXPIRES_IN = '7d'

// ─────────────────────────────────────────────────────────────────────────────
//    BLAND AI CONFIG — set these in .env
//
//    BLAND_API_KEY          → app.bland.ai → Settings → API Keys
//    BLAND_VOICE_ID         → (optional) voice ID from app.bland.ai/voices
//                             Leave blank to use Bland's default voice
//    BLAND_FROM_NUMBER      → (optional) your purchased Bland number, e.g. +12025551234
//                             Leave blank to let Bland auto-assign a number
//    BLAND_MAX_DURATION     → max call duration in minutes (default: 2)
// ─────────────────────────────────────────────────────────────────────────────
const BLAND_API_KEY      = process.env.BLAND_API_KEY      || ''
const BLAND_VOICE_ID     = process.env.BLAND_VOICE_ID     || null
const BLAND_FROM_NUMBER  = process.env.BLAND_FROM_NUMBER  || null
const BLAND_MAX_DURATION = parseInt(process.env.BLAND_MAX_DURATION || '2', 10)

// ─────────────────────────────────────────────────────────────────────────────
//    GEMINI CONFIG
//    GEMINI_API_KEY → aistudio.google.com → Get API Key
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// ─── Auth middleware ───────────────────────────────────────────────────────────
// Decodes JWT from Authorization header and attaches user info to req.user
const authMiddleware = (req, res, next) => {
    const header = req.headers['authorization'] || ''
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null

    if (!token) return res.status(401).send({ message: 'Unauthorised — please log in' })

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded   // { userId, email }
        next()
    } catch {
        return res.status(401).send({ message: 'Session expired — please log in again' })
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizePhoneNumber = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits) return null
    if (digits.length === 10) return `91${digits}`
    return digits
}

const isDueToday = (dateValue, now) => {
    const date = new Date(dateValue)
    return date.getDate() === now.getDate() && date.getMonth() === now.getMonth()
}

const hasMessage = (message) => String(message || '').trim().length > 0

// ─── Gemini AI message generation ─────────────────────────────────────────────
const generateMessageWithGemini = async (personName, occasionType, senderName) => {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set in .env')

    const senderLine = senderName
        ? `End the message by clearly stating that this wish is from ${senderName}.`
        : `End the message by clearly stating the sender's name if available.`

    const prompt = occasionType === 'birthday'
        ? `Write a warm, personalised, heartfelt phone call message wishing someone named ${personName} a happy birthday. Keep it under 3 sentences. Be sincere and friendly, not overly formal. Do not use emojis. ${senderLine}`
        : `Write a warm, personalised, heartfelt phone call message congratulating someone named ${personName} on their anniversary. Keep it under 3 sentences. Be sincere and friendly, not overly formal. Do not use emojis. ${senderLine}`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

    const response = await axios.post(url,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' } }
    )

    return (response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
}

// ─── Bland AI phone call sender ───────────────────────────────────────────────
//
//  Makes an outbound phone call via Bland AI and speaks the reminder message
//  to the recipient using a conversational AI voice.
//
const sendCallViaBland = async (reminder) => {
    if (!BLAND_API_KEY) {
        throw new Error('Missing BLAND_API_KEY in .env')
    }

    const to = normalizePhoneNumber(reminder.phoneNumber)
    if (!to) throw new Error('Invalid phone number')

    // Bland expects E.164 format: +<countrycode><number>
    const e164 = `+${to}`

    const task = `You are a friendly reminder assistant named Remsie. Call the person and deliver this message warmly and naturally: "${reminder.reminderMsg.trim()}". After delivering the message, wish them well and end the call politely. Keep the call under ${BLAND_MAX_DURATION} minutes.`

    const payload = {
        phone_number:  e164,
        task,
        voice:         BLAND_VOICE_ID  || undefined,
        from:          BLAND_FROM_NUMBER || undefined,
        max_duration:  BLAND_MAX_DURATION,
        reduce_latency: true,
        record:        false,
    }

    // Remove undefined keys so Bland doesn't reject the payload
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    await axios.post('https://api.bland.ai/v1/calls', payload, {
        headers: {
            authorization: BLAND_API_KEY,
            'Content-Type': 'application/json',
        },
    })
}

// ─── Scheduler: sends once per year on matching day/month ─────────────────────
setInterval(async () => {
    const now         = new Date()
    const currentYear = now.getFullYear()
    try {
        const reminders = await Reminder.find({})
        for (const reminder of reminders) {
            if (!reminder.phoneNumber)                 continue
            if (!hasMessage(reminder.reminderMsg))     continue
            if (!isDueToday(reminder.remindAt, now))   continue
            if (reminder.lastSentYear === currentYear) continue
            try {
                await sendCallViaBland(reminder)
                await Reminder.findByIdAndUpdate(reminder._id, { isReminded: true, lastSentYear: currentYear })
                console.log(`Bland AI call initiated for reminder ${reminder._id}`)
            } catch (err) {
                console.error(`Bland AI call failed for ${reminder._id}:`, err.response?.data || err.message)
            }
        }
    } catch (err) {
        console.error('Scheduler error:', err.message)
    }
}, 60 * 1000)

// ─── Auth Routes ──────────────────────────────────────────────────────────────

// Sign Up
app.post('/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body
        if (!email || !password) return res.status(400).send({ message: 'Email and password are required' })
        if (password.length < 6)  return res.status(400).send({ message: 'Password must be at least 6 characters' })

        const existing = await User.findOne({ email: email.toLowerCase().trim() })
        if (existing) return res.status(409).send({ message: 'An account with this email already exists' })

        const hashed = await bcrypt.hash(password, 10)
        const user   = await User.create({ name: name?.trim() || '', email: email.toLowerCase().trim(), password: hashed })

        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
        return res.status(201).send({ token, user: { id: user._id, name: user.name, email: user.email } })
    } catch (err) {
        console.error('Signup error:', err.message)
        return res.status(500).send({ message: 'Signup failed. Please try again.' })
    }
})

// Log In
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) return res.status(400).send({ message: 'Email and password are required' })

        const user = await User.findOne({ email: email.toLowerCase().trim() })
        if (!user) return res.status(401).send({ message: 'No account found with this email' })

        const match = await bcrypt.compare(password, user.password)
        if (!match) return res.status(401).send({ message: 'Incorrect password' })

        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
        return res.send({ token, user: { id: user._id, name: user.name, email: user.email } })
    } catch (err) {
        console.error('Login error:', err.message)
        return res.status(500).send({ message: 'Login failed. Please try again.' })
    }
})

// ─── Reminder Routes (all protected by authMiddleware) ────────────────────────

// 1. Get reminders for the logged-in user only
app.get("/getAllReminder", authMiddleware, (req, res) => {
    Reminder.find({ userId: req.user.userId })
        .then(list => res.send(list))
        .catch(err => { console.error("Error fetching reminders:", err); res.status(500).send(err) })
})

// 2. Add a reminder — always linked to the logged-in user
app.post("/addReminder", authMiddleware, (req, res) => {
    const { personName, occasionType, reminderMsg, remindAt, phoneNumber } = req.body
    const normalizedPhone   = String(phoneNumber || '').trim()
    const normalizedMessage = String(reminderMsg || '').trim()
    const isCallEnabled       = normalizedPhone.length > 0

    if (!personName || !occasionType || !remindAt)
        return res.status(400).send({ message: 'personName, occasionType and remindAt are required' })
    if (isCallEnabled && !normalizedMessage)
        return res.status(400).send({ message: 'message is required when phone call notification is enabled' })
    if (!["birthday", "anniversary"].includes(occasionType))
        return res.status(400).send({ message: 'occasionType must be birthday or anniversary' })

    new Reminder({
        userId: req.user.userId,
        personName, occasionType,
        reminderMsg: normalizedMessage,
        phoneNumber: normalizedPhone,
        remindAt, isReminded: false, lastSentYear: null,
    })
        .save()
        .then(() => Reminder.find({ userId: req.user.userId }))
        .then(list => res.send(list))
        .catch(err => { console.error("Error saving reminder:", err); res.status(500).send(err) })
})

// 3. Update reminder message — only owner can edit
app.post("/updateReminder", authMiddleware, async (req, res) => {
    try {
        const { id, reminderMsg } = req.body
        if (!id) return res.status(400).send({ message: 'id is required' })

        const reminder = await Reminder.findOne({ _id: id, userId: req.user.userId })
        if (!reminder) return res.status(404).send({ message: 'Reminder not found' })

        const normalizedMessage     = String(reminderMsg || '').trim()
        const isCallEnabled           = String(reminder.phoneNumber || '').trim().length > 0
        const now                   = new Date()
        const isTodayReminder       = isDueToday(reminder.remindAt, now)
        const isAlreadySentThisYear = reminder.lastSentYear === now.getFullYear()

        if (isCallEnabled && isTodayReminder && isAlreadySentThisYear)
            return res.status(409).send({ message: "Message cannot be edited after today's call reminder is already sent" })
        if (isCallEnabled && !normalizedMessage)
            return res.status(400).send({ message: 'message is required when phone call notification is enabled' })

        await Reminder.findByIdAndUpdate(id, { reminderMsg: normalizedMessage })
        return res.send(await Reminder.find({ userId: req.user.userId }))
    } catch (err) {
        console.error("Error updating reminder:", err)
        return res.status(500).send(err)
    }
})

// 4. Delete — only owner can delete
app.post("/deleteReminder", authMiddleware, (req, res) => {
    Reminder.deleteOne({ _id: req.body.id, userId: req.user.userId })
        .then(() => Reminder.find({ userId: req.user.userId }))
        .then(list => res.send(list))
        .catch(err => { console.error("Error deleting reminder:", err); res.status(500).send(err) })
})

// 5. Manual call trigger
app.post('/sendReminderNow', authMiddleware, async (req, res) => {
    try {
        const { id } = req.body
        if (!id) return res.status(400).send({ message: 'id is required' })

        const reminder = await Reminder.findOne({ _id: id, userId: req.user.userId })
        if (!reminder) return res.status(404).send({ message: 'Reminder not found' })
        if (!String(reminder.reminderMsg || '').trim())
            return res.status(400).send({ message: 'Message is empty for this reminder' })

        await sendCallViaBland(reminder)
        return res.send({ message: 'Bland AI call initiated successfully' })
    } catch (err) {
        console.error('Manual call error:', err.response?.data || err.message)
        return res.status(500).send({
            message: 'Bland AI call failed',
            error: err.response?.data || err.message,
        })
    }
})

// 6. AI message generation via Gemini
app.post('/generateMessage', authMiddleware, async (req, res) => {
    try {
        const { personName, occasionType } = req.body
        if (!personName || !occasionType)
            return res.status(400).send({ message: 'personName and occasionType are required' })
        if (!GEMINI_API_KEY)
            return res.status(500).send({ message: 'Gemini API key not configured. Add GEMINI_API_KEY to .env' })

        const sender  = await User.findById(req.user.userId).select('name').lean()
        const message = await generateMessageWithGemini(personName, occasionType, sender?.name || '')
        return res.send({ message })
    } catch (err) {
        console.error('Gemini error:', err.response?.data || err.message)
        return res.status(500).send({ message: 'Failed to generate message', error: err.response?.data || err.message })
    }
})

app.listen(9000, () => console.log('BE Started on port 9000'))