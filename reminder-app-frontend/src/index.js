import React, { useState, useEffect } from 'react';
import './index.css';
import LandingPage from './LandingPage';
import Auth from './Auth';
import App from './App';

function Root() {
  const savedUser = (() => {
    try { return JSON.parse(localStorage.getItem("ks_user")); }
    catch { return null; }
  })();

  const [theme, setTheme] = useState(
    () => localStorage.getItem("ks_theme") || "dark"
  );

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("ks_theme", next);
      return next;
    });
  };

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  const [page, setPage] = useState("landing");
  const [user, setUser] = useState(savedUser);

  const handleLogin = (userData) => {
    setUser(userData);
    setPage("app");
  };

  const handleLogout = () => {
    localStorage.removeItem("ks_token");
    localStorage.removeItem("ks_user");
    setUser(null);
    setPage("landing");
  };

  const handleContinue = () => {
    if (user) setPage("app");
    else setPage("login");
  };

  if (page === "app") {
    return <App user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />;
  }
  if (page === "login" || page === "signup") {
    return <Auth mode={page} onNavigate={setPage} onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />;
  }
  return (
    <LandingPage
      onNavigate={setPage}
      savedUser={savedUser}
      onContinue={handleContinue}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}

// ── Mount — works with both React 18 (createRoot) and React 17 (render) ──
const container = document.getElementById('root');

try {
  // React 18
  const { createRoot } = require('react-dom/client');
  createRoot(container).render(<Root />);
} catch (e) {
  // React 17 fallback
  const ReactDOM = require('react-dom');
  ReactDOM.render(<Root />, container);
}
