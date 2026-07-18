/* ============================================================
   utils.js — Shared helper functions
   ============================================================ */

/** Validate an IPv4 or simplified IPv6 address string */
export function validateIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(ip)) {
    return ip.split('.').every(n => parseInt(n, 10) >= 0 && parseInt(n, 10) <= 255);
  }
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6.test(ip);
}

/** Validate port number */
export function validatePort(port) {
  const n = parseInt(port, 10);
  return !isNaN(n) && n >= 1 && n <= 65535;
}

/** Format a Date or ISO string as a relative time label */
export function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5)   return 'Just now';
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

/** Format an ISO string as HH:MM:SS */
export function formatTime(dateStr) {
  if (!dateStr) return '--:--:--';
  const d = new Date(dateStr);
  return d.toLocaleTimeString();
}

/** Debounce a function by `wait` ms */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Clamp a number between min and max */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/** Get latency quality class */
export function latencyClass(ms) {
  if (ms === 0 || ms === null) return 'bad';
  if (ms < 30) return 'good';
  if (ms < 80) return 'medium';
  return 'bad';
}

/** Get latency bar width % (max 200ms = 100%) */
export function latencyPercent(ms) {
  if (!ms) return 0;
  return clamp((ms / 200) * 100, 2, 100);
}

/** Escape HTML entities */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Get status icon SVG */
export function statusIcon(status) {
  const colors = {
    healthy: 'var(--status-healthy)',
    degraded: 'var(--status-degraded)',
    down: 'var(--status-down)',
    unknown: 'var(--status-unknown)'
  };
  const color = colors[status] || colors.unknown;
  return `<svg width="10" height="10" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="2" style="margin-right:2px;vertical-align:middle"><circle cx="12" cy="12" r="8"/></svg>`;
}

/** Protocol badge CSS class */
export function protocolClass(protocol) {
  return `badge-${(protocol || 'unknown').toLowerCase()}`;
}

/** Get SVG color for status */
export function statusColor(status) {
  const map = {
    healthy:  'var(--topo-path-healthy)',
    degraded: 'var(--topo-path-degraded)',
    down:     'var(--topo-path-down)',
    unknown:  'var(--topo-path-unknown)',
  };
  return map[status] ?? map.unknown;
}
