import React from "react";
import "./ThemeToggle.css";

function ThemeToggle({ theme, toggleTheme }) {
  const isDark = theme === "dark";
  return (
    <button
      className={`theme_toggle ${isDark ? "dark" : "light"}`}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme_toggle_track">
        <span className="theme_toggle_thumb">
          {isDark ? "🌙" : "☀️"}
        </span>
      </span>
    </button>
  );
}

export default ThemeToggle;
