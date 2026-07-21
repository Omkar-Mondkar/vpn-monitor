/* ============================================================
   live-log.js — Real-time event log panel
   In-memory store of last 200 entries; supports VPN filter.
   ============================================================ */

const MAX_LOG_ENTRIES = 200;

let logContainer = null;
let filterVpnId  = 'all'; // 'all' or a specific VPN id

// In-memory log store: array of { id, type, vpnId, vpnName, message, time }
const logStore = [];
let logIdCounter = 0;

// Map<vpnId, vpnName> — updated whenever a VPN is seen
const vpnNameMap = new Map();

// Callback to notify app when vpnNameMap changes (to rebuild filter dropdown)
let onVpnListChange = null;

const TYPE_CONFIG = {
  healthy:  { icon: '●', cls: 'log-healthy',  label: 'HEALTHY'  },
  degraded: { icon: '▲', cls: 'log-degraded', label: 'DEGRADED' },
  down:     { icon: '✖', cls: 'log-down',     label: 'DOWN'     },
  info:     { icon: '◆', cls: 'log-info',     label: 'INFO'     },
  check:    { icon: '⟳', cls: 'log-check',    label: 'CHECK'    },
};

// ─── Init ─────────────────────────────────────────────────────
export function initLog(containerEl, vpnChangeCallback) {
  logContainer   = containerEl;
  onVpnListChange = vpnChangeCallback || null;
}

// ─── Set VPN filter ───────────────────────────────────────────
export function setLogVpnFilter(vpnId) {
  filterVpnId = vpnId || 'all';
  rerenderLog();
}

// ─── Get known VPN list (for building dropdown) ───────────────
export function getLogVpnList() {
  return Array.from(vpnNameMap.entries()).map(([id, name]) => ({ id, name }));
}

// ─── Push a new log entry ─────────────────────────────────────
/**
 * @param {string} type     - 'healthy' | 'degraded' | 'down' | 'info' | 'check'
 * @param {string} vpnName  - Display name of the VPN
 * @param {string} message  - Short description
 * @param {string} [vpnId]  - Optional VPN UUID (used for filtering)
 */
export function pushLog(type, vpnName, message, vpnId) {
  if (!logContainer) return;

  const now   = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = { id: ++logIdCounter, type, vpnId: vpnId || null, vpnName, message, time: now };

  logStore.push(entry);
  while (logStore.length > MAX_LOG_ENTRIES) logStore.shift();

  // Track VPN names for filter dropdown
  if (vpnId && vpnName && !vpnNameMap.has(vpnId)) {
    vpnNameMap.set(vpnId, vpnName);
    onVpnListChange?.(getLogVpnList());
  }

  // Only append to DOM if this entry passes the current filter
  if (filterVpnId === 'all' || filterVpnId === vpnId) {
    _appendEntry(entry, true /* animate */);
  }
}

// ─── Re-render entire log from store (on filter change) ───────
function rerenderLog() {
  if (!logContainer) return;

  logContainer.innerHTML = '';

  const filtered = filterVpnId === 'all'
    ? logStore
    : logStore.filter(e => e.vpnId === filterVpnId);

  if (filtered.length === 0) {
    _showEmpty();
    return;
  }

  // Batch-append without animation (already have data)
  filtered.forEach(entry => _appendEntry(entry, false));

  // Scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}

// ─── Append a single entry to the DOM ─────────────────────────
function _appendEntry(entry, animate) {
  // Remove placeholder on first real entry
  const emptyEl = logContainer.querySelector('.log-empty');
  if (emptyEl) emptyEl.remove();

  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.info;
  const el     = document.createElement('div');
  el.className = `log-entry ${config.cls}`;
  el.dataset.vpnId = entry.vpnId || '';
  el.setAttribute('role', 'listitem');

  el.innerHTML = `
    <span class="log-type-badge">${config.icon}</span>
    <div class="log-content">
      <span class="log-vpn-name">${escHtml(entry.vpnName)}</span>
      <span class="log-message">${escHtml(entry.message)}</span>
    </div>
    <span class="log-time">${entry.time}</span>
  `;

  if (animate) {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(-6px)';
  }

  logContainer.appendChild(el);

  if (animate) {
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 220ms ease, transform 220ms ease';
      el.style.opacity    = '1';
      el.style.transform  = 'translateY(0)';
    });
    // Auto-scroll only on new entries
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

// ─── Show empty placeholder ───────────────────────────────────
function _showEmpty() {
  const el = document.createElement('div');
  el.className = 'log-empty';
  el.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
    No events match the filter
  `;
  logContainer.appendChild(el);
}

// ─── HTML escape ──────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
