import React, { useState } from "react";
import axios from "axios";
import "./Auth.css";
import ThemeToggle from "./ThemeToggle";

// ⚠️  Backend base URL — must match your backend
const API_BASE = import.meta.env.REACT_APP_API_URL || "http://localhost:9000";

function Auth({ mode, onNavigate, onLogin, theme, toggleTheme }) {
  const [isLogin, setIsLogin]     = useState(mode === "login");
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const switchMode = (m) => {
    setIsLogin(m === "login");
    setError("");
    setName("");
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (!isLogin && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/signup";
      const payload  = isLogin
        ? { email: email.trim(), password }
        : { name: name.trim(), email: email.trim(), password };

      const res = await axios.post(`${API_BASE}${endpoint}`, payload);
      // Store token and user info
      localStorage.setItem("ks_token", res.data.token);
      localStorage.setItem("ks_user",  JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="auth_page">
      {/* Orbs */}
      <div className="auth_orb orb1" />
      <div className="auth_orb orb2" />

      {/* Back to landing */}
      <div className="auth_top_bar">
        <button className="auth_back" onClick={() => onNavigate("landing")}>
          ← Back to KinSync
        </button>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>

      <div className="auth_card">
        {/* Logo */}
        <div className="auth_logo">
          <div className="auth_logo_icon">♥</div>
          <span>KinSync</span>
        </div>

        <h1 className="auth_title">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="auth_sub">
          {isLogin
            ? "Sign in to manage your reminders."
            : "Start remembering every special moment."}
        </p>

        {/* Tab switcher */}
        <div className="auth_tabs">
          <button
            className={`auth_tab ${isLogin ? "active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Log In
          </button>
          <button
            className={`auth_tab ${!isLogin ? "active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <div className="auth_form">
          {!isLogin && (
            <div className="auth_field">
              <label className="auth_label">Your Name</label>
              <input
                type="text"
                placeholder="e.g. Nandini Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus={!isLogin}
              />
            </div>
          )}

          <div className="auth_field">
            <label className="auth_label">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus={isLogin}
            />
          </div>

          <div className="auth_field">
            <label className="auth_label">Password</label>
            <div className="auth_pass_row">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                className="auth_eye"
                onClick={() => setShowPass(p => !p)}
                tabIndex={-1}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {error && <p className="auth_error">{error}</p>}

          <button
            className="auth_submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <span className="auth_spinner" />
              : (isLogin ? "Sign In →" : "Create Account →")
            }
          </button>
        </div>

        <p className="auth_switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => switchMode(isLogin ? "signup" : "login")}>
            {isLogin ? "Sign Up" : "Log In"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Auth;
