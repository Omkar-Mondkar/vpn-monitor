/* ============================================================
   theme.js — Light/Dark mode toggle
   ============================================================ */

const STORAGE_KEY = 'vpn-monitor-theme';
const DARK  = 'dark';
const LIGHT = 'light';

const SVG_SUN  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;

const SVG_MOON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

let currentTheme = DARK;

/** Apply a theme to <html> and persist it */
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = theme === DARK ? SVG_SUN : SVG_MOON;
    btn.setAttribute('aria-label', theme === DARK ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title',      theme === DARK ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

/** Toggle between dark and light */
function toggleTheme() {
  applyTheme(currentTheme === DARK ? LIGHT : DARK);
}

/** Initialize theme from localStorage or OS preference */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === LIGHT || saved === DARK) {
    applyTheme(saved);
    return;
  }
  // Respect OS preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? DARK : LIGHT);
}

/** Bind the toggle button */
export function bindThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', toggleTheme);
}

export function getTheme() { return currentTheme; }
