import "./App.css";
import React, { useState, useEffect } from "react";
import axios from "axios";
import ThemeToggle from "./ThemeToggle";

//   Backend base URL — update if your backend runs on a different port/host
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:9000";

// Reads the JWT token saved at login and adds it to every request
const authHeaders = () => {
  const token = localStorage.getItem("ks_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function App({ user, onLogout, theme, toggleTheme }) {
  const [personName,        setPersonName]        = useState("");
  const [callEnabled,   setCallEnabled]   = useState(false);
  const [phoneNumber,       setPhoneNumber]       = useState("");
  const [occasionType,      setOccasionType]      = useState("birthday");
  const [reminderMsg,       setReminderMsg]       = useState("");
  const [remindMonth,       setRemindMonth]       = useState("");
  const [remindDay,         setRemindDay]         = useState("");
  const [reminderList,      setReminderList]      = useState([]);
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [editedMessage,     setEditedMessage]     = useState("");
  const [aiLoading,         setAiLoading]         = useState(false);
  const [addingLoading,     setAddingLoading]     = useState(false);
  // Track which reminder is currently placing a call — keyed by reminder._id
  const [sendingCall,         setSendingCall]         = useState({});

  const today = new Date();

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  useEffect(() => {
    axios
      .get(`${API_BASE}/getAllReminder`, { headers: authHeaders() })
      .then((res) => setReminderList(res.data))
      .catch((err) => {
        console.error("Failed to load reminders", err);
        setReminderList([]);
      });
  }, []);

  // ── AI message generation ──────────────────────────────────────────────────
  const generateAIMessage = async () => {
    if (!personName.trim()) {
      alert("Please enter the person's name first so the AI can personalise the message.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/generateMessage`, {
        personName: personName.trim(),
        occasionType,
      }, { headers: authHeaders() });
      setReminderMsg(res.data.message || "");
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      alert(`AI generation failed: ${errMsg}`);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Send call now ────────────────────────────────────────────────────────────
  const sendCallNow = async (reminder) => {
    if (!reminder.phoneNumber) {
      alert("This reminder has no phone number.");
      return;
    }
    if (!reminder.reminderMsg?.trim()) {
      alert("This reminder has no message. Please add a message before sending.");
      return;
    }
    setSendingCall(prev => ({ ...prev, [reminder._id]: true }));
    try {
      await axios.post(`${API_BASE}/sendReminderNow`, { id: reminder._id }, { headers: authHeaders() });
      alert(`Call initiated to ${reminder.phoneNumber} ✓`);
      // Refresh list so lastSentYear / isReminded updates
      const res = await axios.get(`${API_BASE}/getAllReminder`, { headers: authHeaders() });
      setReminderList(res.data);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      alert(`Call failed: ${errMsg}`);
    } finally {
      setSendingCall(prev => ({ ...prev, [reminder._id]: false }));
    }
  };

  // ── Add reminder ───────────────────────────────────────────────────────────
  const addReminder = () => {
    if (!personName.trim() || !remindMonth || !remindDay) {
      alert("Please enter the person's name and choose a day & month.");
      return;
    }
    if (callEnabled && !phoneNumber.trim()) {
      alert("Please enter a phone number or turn off phone call notification.");
      return;
    }
    if (callEnabled && !reminderMsg.trim()) {
      alert("Please enter a message when phone call notification is enabled.");
      return;
    }

    const currentYear = today.getFullYear();
    const monthNum    = Number(remindMonth);
    const dayNum      = Number(remindDay);
    const remindAt    = `${currentYear}-${String(monthNum).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
    const parsedDate  = new Date(remindAt);

    if (Number.isNaN(parsedDate.getTime())) {
      alert("Please choose a valid day and month.");
      return;
    }
    if (parsedDate.getMonth() + 1 !== monthNum || parsedDate.getDate() !== dayNum) {
      alert("This day is not valid for the selected month.");
      return;
    }

    setAddingLoading(true);
    axios
      .post(`${API_BASE}/addReminder`, {
        personName:   personName.trim(),
        phoneNumber:  callEnabled ? phoneNumber : "",
        occasionType,
        reminderMsg:  reminderMsg.trim(),
        remindAt,
      }, { headers: authHeaders() })
      .then((res) => {
        setReminderList(res.data);
        setPersonName("");
        setCallEnabled(false);
        setPhoneNumber("");
        setOccasionType("birthday");
        setReminderMsg("");
        setRemindMonth("");
        setRemindDay("");
      })
      .catch((err) => console.error("Failed to add reminder", err))
      .finally(() => setAddingLoading(false));
  };

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const isEditLocked = (reminder) => {
    const hasCall = String(reminder.phoneNumber || "").trim().length > 0;
    return hasCall && isToday(reminder.remindAt) && reminder.lastSentYear === today.getFullYear();
  };

  const openEdit = (reminder) => {
    if (isEditLocked(reminder)) {
      alert("Message cannot be edited after today's call reminder is already sent.");
      return;
    }
    setEditingReminderId(reminder._id);
    setEditedMessage(reminder.reminderMsg || "");
  };

  const cancelEdit = () => {
    setEditingReminderId(null);
    setEditedMessage("");
  };

  const saveEditedMessage = (reminder) => {
    if (isEditLocked(reminder)) {
      alert("Message cannot be edited after today's call reminder is already sent.");
      setEditingReminderId(null);
      setEditedMessage("");
      return;
    }
    const nextMessage = editedMessage.trim();
    if (reminder.phoneNumber && !nextMessage) {
      alert("Message is required when phone call notification is enabled.");
      return;
    }
    axios
      .post(`${API_BASE}/updateReminder`, { id: reminder._id, reminderMsg: nextMessage }, { headers: authHeaders() })
      .then((res) => {
        setReminderList(res.data);
        setEditingReminderId(null);
        setEditedMessage("");
      })
      .catch((err) => console.error("Failed to update reminder", err));
  };

  const deleteReminder = (id) => {
    axios
      .post(`${API_BASE}/deleteReminder`, { id }, { headers: authHeaders() })
      .then((res) => setReminderList(res.data))
      .catch((err) => console.error("Failed to delete reminder", err));
  };

  // ── Date helpers ───────────────────────────────────────────────────────────
  const isToday = (dateValue) => {
    const date = new Date(dateValue);
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
  };

  const getNextOccurrence = (dateValue) => {
    const date       = new Date(dateValue);
    const thisYear   = new Date(today.getFullYear(), date.getMonth(), date.getDate(), 0,0,0,0);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0,0,0,0);
    if (thisYear < todayStart) thisYear.setFullYear(today.getFullYear() + 1);
    return thisYear;
  };

  const daysUntil = (dateValue) => {
    const next       = getNextOccurrence(dateValue);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0,0,0,0);
    return Math.round((next - todayStart) / (1000 * 60 * 60 * 24));
  };

  const formatDayMonth = (dateValue) => {
    const date = new Date(dateValue);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const sortByUpcoming = (a, b) =>
    getNextOccurrence(a.remindAt) - getNextOccurrence(b.remindAt);

  // ── Derived lists ──────────────────────────────────────────────────────────
  const todayBirthdays        = reminderList.filter(i => i.occasionType === "birthday"    && isToday(i.remindAt)).sort(sortByUpcoming);
  const todayAnniversaries    = reminderList.filter(i => i.occasionType === "anniversary" && isToday(i.remindAt)).sort(sortByUpcoming);
  const upcomingBirthdays     = reminderList.filter(i => i.occasionType === "birthday"    && !isToday(i.remindAt)).sort(sortByUpcoming);
  const upcomingAnniversaries = reminderList.filter(i => i.occasionType === "anniversary" && !isToday(i.remindAt)).sort(sortByUpcoming);
  const allUpcoming           = reminderList.filter(i => !isToday(i.remindAt)).sort(sortByUpcoming).slice(0, 6);

  // ── Call Now button renderer (reused in cards + sidebar) ───────────────────
  const SendCallButton = ({ reminder }) => {
    const hasPhone   = !!String(reminder.phoneNumber || "").trim();
    const hasMsg     = !!String(reminder.reminderMsg || "").trim();
    const isSending  = !!sendingCall[reminder._id];

    if (!hasPhone) return null;

    return (
      <button
        className={`button call_send_btn ${!hasMsg ? "disabled_call" : ""}`}
        onClick={() => sendCallNow(reminder)}
        disabled={isSending}
        title={!hasMsg ? "Add a message first" : `Call ${reminder.phoneNumber}`}
      >
        {isSending
          ? <span className="ai_spinner" style={{ borderTopColor: "#4ade80" }} />
          : "📞"
        }
        {isSending ? " Calling…" : " Call Now"}
      </button>
    );
  };

  return (
    <div className="App">
      {/* ── Header ── */}
      <header className="app_header">
        <div className="app_logo">
          <div className="app_logo_icon">♥</div>
          <div>
            <h1>KinSync</h1>
            <p>Never miss a moment</p>
          </div>
        </div>
        <div className="header_right">
          {user && (
            <span className="header_user">👋 {user.name || user.email}</span>
          )}
          <button
            type="button"
            className={`call_toggle ${callEnabled ? "enabled" : ""}`}
            onClick={() => setCallEnabled(prev => !prev)}
            aria-pressed={callEnabled}
          >
            Phone Call {callEnabled ? "On ✓" : "Off"}
          </button>
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          {onLogout && (
            <button className="logout_btn" onClick={onLogout}>
              Log Out
            </button>
          )}
        </div>
      </header>

      <div className="app_shell">
        {/* ── Left — Add + Cards ── */}
        <section>
          <div className="panel">
            <p className="panel_title">Add Occasion</p>
            <p className="panel_sub">Birthdays, anniversaries — remembered forever.</p>

            <div className="form_stack">
              <div className="form_field">
                <label className="form_label">Person's Name</label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                />
              </div>

              {callEnabled && (
                <div className="form_field">
                  <label className="form_label">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 77150 33745"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              )}

              <div className="form_field">
                <label className="form_label">Occasion Type</label>
                <select value={occasionType} onChange={(e) => setOccasionType(e.target.value)}>
                  <option value="birthday">🎂 Birthday</option>
                  <option value="anniversary">💍 Anniversary</option>
                </select>
              </div>

              <div className="form_field">
                <label className="form_label">
                  Message {callEnabled ? "(required)" : "(optional)"}
                </label>
                <div className="msg_row">
                  <input
                    type="text"
                    placeholder={callEnabled ? "Type a message or use AI ✨" : "Personal note (optional)"}
                    value={reminderMsg}
                    onChange={(e) => setReminderMsg(e.target.value)}
                  />
                  {/* ✨ AI generate button — requires GEMINI_API_KEY in backend .env */}
                  <button
                    type="button"
                    className="button ai_btn"
                    onClick={generateAIMessage}
                    disabled={aiLoading}
                    title="Generate a personalised message with Gemini AI"
                  >
                    {aiLoading ? <span className="ai_spinner" /> : "✨"} AI
                  </button>
                </div>
              </div>

              <div className="form_field">
                <label className="form_label">Date</label>
                <div className="date_row">
                  <select value={remindDay} onChange={(e) => setRemindDay(e.target.value)}>
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{String(d).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <select value={remindMonth} onChange={(e) => setRemindMonth(e.target.value)}>
                    <option value="">Month</option>
                    {monthNames.map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                className="button primary full_width"
                onClick={addReminder}
                disabled={addingLoading}
              >
                {addingLoading ? "Adding…" : "+ Add Occasion"}
              </button>
            </div>
          </div>

          {/* ── Upcoming events strip ── */}
          {allUpcoming.length > 0 && (
            <div className="upcoming_section">
              <p className="section_heading">
                Upcoming Events
                <span className="reminder_count_badge">{allUpcoming.length}</span>
              </p>
              <div className="upcoming_list">
                {allUpcoming.map(item => {
                  const days = daysUntil(item.remindAt);
                  return (
                    <div className="upcoming_item" key={item._id}>
                      <div className={`upcoming_dot ${item.occasionType}`} />
                      <div className="upcoming_info">
                        <strong>{item.personName}</strong>
                        <span>
                          {item.occasionType === "birthday" ? "🎂" : "💍"}{" "}
                          {item.occasionType} · {formatDayMonth(item.remindAt)}
                        </span>
                      </div>
                      <span className={`upcoming_days ${days <= 7 ? "soon" : ""}`}>
                        {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── All reminder cards ── */}
          <p className="section_heading" style={{ marginTop: "2rem" }}>
            All Reminders
            <span className="reminder_count_badge">{reminderList.length}</span>
          </p>
          <div className="reminder_grid">
            {reminderList.length === 0 && (
              <div className="empty_state">
                <p style={{ fontSize: "1.6rem" }}>🌸</p>
                <p>No occasions added yet.</p>
                <p>Use the form above to get started.</p>
              </div>
            )}

            {reminderList.map(reminder => {
              const editLocked = isEditLocked(reminder);
              return (
                <article className="reminder_card" key={reminder._id}>
                  <span className={`card_type_badge ${reminder.occasionType}`}>
                    {reminder.occasionType === "birthday" ? "🎂 Birthday" : "💍 Anniversary"}
                  </span>

                  <p className="card_name">{reminder.personName}</p>
                  <p className="card_date">📅 {formatDayMonth(reminder.remindAt)}</p>

                  {editingReminderId === reminder._id ? (
                    <>
                      <input
                        type="text"
                        value={editedMessage}
                        onChange={(e) => setEditedMessage(e.target.value)}
                        placeholder="Edit message…"
                        autoFocus
                      />
                      <div className="inline_actions">
                        <button className="button primary" onClick={() => saveEditedMessage(reminder)}>Save</button>
                        <button className="button secondary" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      {reminder.reminderMsg
                        ? <p className="card_msg">"{reminder.reminderMsg}"</p>
                        : <p className="card_msg" style={{ opacity: 0.4 }}>No message</p>
                      }
                      {editLocked
                        ? <p className="locked_note">✓ Call initiated today</p>
                        : (
                          <button
                            className="button secondary"
                            style={{ fontSize: "0.78rem", padding: "0.4rem 0.75rem" }}
                            onClick={() => openEdit(reminder)}
                          >
                            Edit Message
                          </button>
                        )
                      }
                    </>
                  )}

                  {reminder.phoneNumber
                    ? <p className="card_phone">📱 {reminder.phoneNumber}</p>
                    : <p className="card_phone" style={{ opacity: 0.35 }}>Call off</p>
                  }

                  <div className="card_actions">
                    {/* ── Call Now button ── */}
                    <SendCallButton reminder={reminder} />
                    <button className="button danger" onClick={() => deleteReminder(reminder._id)}>
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Right — Today & Upcoming sidebar ── */}
        <aside className="right_panel_stack">
          {/* Today's events */}
          <div className="panel occasion_panel">
            <p className="panel_title">Today</p>
            <p className="panel_sub" style={{ marginBottom: "1rem" }}>
              {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>

            <div className="occasion_group">
              <p className="group_label">Birthdays</p>
              {todayBirthdays.length === 0 && <p className="empty_text">None today</p>}
              {todayBirthdays.map(item => (
                <div className="person" key={item._id}>
                  <div className="avatar">{(item.personName?.[0] || "B").toUpperCase()}</div>
                  <div className="person_info">
                    <h4>{item.personName}</h4>
                    <p>{formatDayMonth(item.remindAt)}</p>
                    <span className="today_tag">Today 🎉</span>
                    {/* Call Now button in sidebar Today panel */}
                    <SendCallButton reminder={item} />
                  </div>
                </div>
              ))}
            </div>

            <div className="occasion_group split_top">
              <p className="group_label">Anniversaries</p>
              {todayAnniversaries.length === 0 && <p className="empty_text">None today</p>}
              {todayAnniversaries.map(item => (
                <div className="person" key={item._id}>
                  <div className="avatar anniversary">{(item.personName?.[0] || "A").toUpperCase()}</div>
                  <div className="person_info">
                    <h4>{item.personName}</h4>
                    <p>{formatDayMonth(item.remindAt)}</p>
                    <span className="today_tag">Today 💍</span>
                    {/* Call Now button in sidebar Today panel */}
                    <SendCallButton reminder={item} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming events sidebar */}
          <div className="panel occasion_panel">
            <p className="panel_title">Coming Up</p>
            <p className="panel_sub" style={{ marginBottom: "1rem" }}>Next birthdays & anniversaries</p>

            <div className="occasion_group">
              <p className="group_label">Birthdays</p>
              {upcomingBirthdays.length === 0 && <p className="empty_text">Nothing upcoming</p>}
              {upcomingBirthdays.slice(0, 5).map(item => {
                const days = daysUntil(item.remindAt);
                return (
                  <div className="person" key={item._id}>
                    <div className="avatar">{(item.personName?.[0] || "B").toUpperCase()}</div>
                    <div className="person_info">
                      <h4>{item.personName}</h4>
                      <p>{formatDayMonth(getNextOccurrence(item.remindAt))}</p>
                      {/* Call Now button in sidebar Upcoming panel */}
                      <SendCallButton reminder={item} />
                    </div>
                    <div className="days_away">
                      <span className={`upcoming_days ${days <= 7 ? "soon" : ""}`}>
                        {days === 1 ? "Tomorrow" : `${days}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="occasion_group split_top">
              <p className="group_label">Anniversaries</p>
              {upcomingAnniversaries.length === 0 && <p className="empty_text">Nothing upcoming</p>}
              {upcomingAnniversaries.slice(0, 5).map(item => {
                const days = daysUntil(item.remindAt);
                return (
                  <div className="person" key={item._id}>
                    <div className="avatar anniversary">{(item.personName?.[0] || "A").toUpperCase()}</div>
                    <div className="person_info">
                      <h4>{item.personName}</h4>
                      <p>{formatDayMonth(getNextOccurrence(item.remindAt))}</p>
                      {/* Call Now button in sidebar Upcoming panel */}
                      <SendCallButton reminder={item} />
                    </div>
                    <div className="days_away">
                      <span className={`upcoming_days ${days <= 7 ? "soon" : ""}`}>
                        {days === 1 ? "Tomorrow" : `${days}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
