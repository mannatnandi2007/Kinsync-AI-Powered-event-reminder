import React from "react";
import "./LandingPage.css";
import ThemeToggle from "./ThemeToggle";

function LandingPage({ onNavigate, savedUser, onContinue, theme, toggleTheme }) {
  const features = [
    {
      icon: "🎂",
      title: "Birthday Reminders",
      desc: "Never forget a birthday again. Add your loved ones once and KinSync remembers forever.",
    },
    {
      icon: "💍",
      title: "Anniversary Alerts",
      desc: "Celebrate milestones with the people who matter most — automatically, every year.",
    },
    {
      icon: "📞",
      title: "Phone Call Reminders",
      desc: "Receive a warm AI-voiced phone call on the special day — delivered automatically via Bland AI.",
    },
    {
      icon: "✨",
      title: "AI-Personalised Messages",
      desc: "Gemini AI crafts a heartfelt, personalised message for each person and occasion.",
    },
    {
      icon: "📅",
      title: "Upcoming Events Dashboard",
      desc: "See all upcoming birthdays and anniversaries in one clean, beautiful dashboard.",
    },
    {
      icon: "🔔",
      title: "Annual Auto-Send",
      desc: "Messages are sent automatically once per year — set it once, never worry again.",
    },
  ];

  return (
    <div className="landing">

      {/* ── Returning user banner ── */}
      {savedUser && (
        <div className="returning_banner">
          <span>👋 Welcome back, <strong>{savedUser.name || savedUser.email}</strong></span>
          <button className="landing_btn solid" style={{ padding: "0.35rem 1rem", fontSize: "0.82rem" }} onClick={onContinue}>
            Continue to Dashboard →
          </button>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="landing_nav">
        <div className="landing_logo">
          <div className="landing_logo_icon">♥</div>
          <span>KinSync</span>
        </div>
        <div className="landing_nav_actions">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          <button className="landing_btn outline" onClick={() => onNavigate("login")}>
            Log In
          </button>
          <button className="landing_btn solid" onClick={() => onNavigate("signup")}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero_badge">✦ Never miss a moment</div>
        <h1 className="hero_title">
          Remember Every<br />
          <span className="hero_accent">Special Moment</span>
        </h1>
        <p className="hero_sub">
          KinSync keeps track of birthdays and anniversaries for everyone you love —
          and makes a personalised AI phone call automatically on the day.
        </p>
        <div className="hero_actions">
          <button className="landing_btn solid hero_cta" onClick={() => onNavigate("signup")}>
            Start for Free →
          </button>
          <button className="landing_btn ghost" onClick={() => onNavigate("login")}>
            I already have an account
          </button>
        </div>

        <div className="hero_orb orb1" />
        <div className="hero_orb orb2" />
      </section>

      {/* ── Features ── */}
      <section className="features_section">
        <p className="section_label">What KinSync does</p>
        <h2 className="features_title">Everything you need,<br />nothing you don't</h2>
        <div className="features_grid">
          {features.map((f, i) => (
            <div className="feature_card" key={i} style={{ animationDelay: `${i * 80}ms` }}>
              <div className="feature_icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="how_section">
        <p className="section_label">Simple by design</p>
        <h2 className="features_title">Up and running in minutes</h2>
        <div className="steps_row">
          {[
            { num: "01", title: "Create an account",       desc: "Sign up in seconds — no credit card required." },
            { num: "02", title: "Add your people",          desc: "Enter names, occasions, dates and optional phone numbers for call reminders." },
            { num: "03", title: "Let AI write the message", desc: "Hit the ✨ AI button and Gemini writes a personalised message instantly." },
            { num: "04", title: "Relax",                    desc: "KinSync makes an AI phone call automatically on the right day, every year." },
          ].map((s, i) => (
            <div className="step" key={i}>
              <div className="step_num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta_section">
        <div className="cta_card">
          <h2>Ready to never forget again?</h2>
          <p>Join KinSync today and make every person in your life feel remembered.</p>
          <button className="landing_btn solid hero_cta" onClick={() => onNavigate("signup")}>
            Create Free Account →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing_footer">
        <div className="landing_logo">
          <div className="landing_logo_icon" style={{ width: 28, height: 28, fontSize: "0.85rem" }}>♥</div>
          <span>KinSync</span>
        </div>
        <p>Made with love · Never miss a moment</p>
      </footer>
    </div>
  );
}

export default LandingPage;
