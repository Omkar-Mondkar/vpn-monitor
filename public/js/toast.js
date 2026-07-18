/* ============================================================
   toast.js — Slide-in toast notification system
   ============================================================ */

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 4500;

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

const ICONS = {
  success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  error:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
};

const COLORS = {
  success: 'var(--status-healthy)',
  error:   'var(--status-down)',
  warning: 'var(--status-degraded)',
  info:    'var(--accent-1)',
};

/**
 * Show a toast notification.
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} title
 * @param {string} [message]
 * @param {number} [duration] ms before auto-dismiss (0 = persistent)
 */
export function showToast(type = 'info', title = '', message = '', duration = AUTO_DISMISS_MS) {
  const c = ensureContainer();

  // Enforce max stack
  while (c.children.length >= MAX_TOASTS) {
    dismissToast(c.firstElementChild);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.style.cssText = `
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    margin-bottom: 8px;
    background: var(--bg-modal);
    border: 1px solid ${COLORS[type]};
    border-left: 4px solid ${COLORS[type]};
    border-radius: var(--radius-lg);
    box-shadow: var(--glass-shadow-lg);
    backdrop-filter: blur(var(--blur-lg));
    max-width: 340px;
    min-width: 260px;
    animation: toastSlideIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    cursor: pointer;
    user-select: none;
    position: relative;
    overflow: hidden;
  `;

  const iconEl = document.createElement('span');
  iconEl.innerHTML = ICONS[type] ?? ICONS.info;
  iconEl.style.cssText = 'font-size: 1rem; flex-shrink: 0; margin-top: 1px;';

  const body = document.createElement('div');
  body.style.cssText = 'flex: 1; min-width: 0;';

  const titleEl = document.createElement('div');
  titleEl.style.cssText = `font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-bottom: ${message ? '2px' : '0'};`;
  titleEl.textContent = title;

  body.appendChild(titleEl);

  if (message) {
    const msgEl = document.createElement('div');
    msgEl.style.cssText = 'font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;';
    msgEl.textContent = message;
    body.appendChild(msgEl);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none; border: none; cursor: pointer; color: var(--text-muted);
    font-size: 1.2rem; line-height: 1; padding: 0; flex-shrink: 0; margin-top: -2px;
    transition: color 150ms ease !important;
  `;
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = 'var(--text-primary)');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = 'var(--text-muted)');
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); dismissToast(toast); });

  // Progress bar
  if (duration > 0) {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: absolute; bottom: 0; left: 0;
      height: 2px;
      background: ${COLORS[type]};
      width: 100%;
      transform-origin: left;
      animation: none;
    `;
    toast.appendChild(bar);
    // Animate shrink
    requestAnimationFrame(() => {
      bar.style.transition = `transform ${duration}ms linear`;
      bar.style.transform = 'scaleX(0)';
    });
  }

  toast.appendChild(iconEl);
  toast.appendChild(body);
  toast.appendChild(closeBtn);

  toast.addEventListener('click', () => dismissToast(toast));

  c.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }

  return toast;
}

function dismissToast(toast) {
  if (!toast || toast._dismissing) return;
  toast._dismissing = true;
  toast.style.animation = 'toastSlideOut 280ms ease forwards';
  setTimeout(() => toast.remove(), 280);
}
