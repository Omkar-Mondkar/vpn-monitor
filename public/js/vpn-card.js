/* ============================================================
   vpn-card.js — VPN card rendering and list management
   ============================================================ */

import { escapeHtml, timeAgo, latencyClass, latencyPercent, protocolClass, statusIcon } from './utils.js';

/** Build one VPN card DOM element */
export function buildVPNCard(vpn) {
  const card = document.createElement('div');
  card.className = 'vpn-card';
  card.dataset.id = vpn.id;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `VPN: ${vpn.name}`);

  const status = vpn.status || 'unknown';
  const latSrc  = vpn.latency_source ?? 0;
  const latDst  = vpn.latency_dest   ?? 0;
  const uptime  = vpn.uptime ?? 100;

  // Uptime ring circumference (r=14)
  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ - (uptime / 100) * circ;
  const uptimeColor = uptime >= 99 ? 'var(--status-healthy)' : uptime >= 95 ? 'var(--status-degraded)' : 'var(--status-down)';

  card.innerHTML = `
    <div class="vpn-card-top">
      <div class="vpn-card-meta">
        <div class="vpn-card-name-row">
          <div class="status-dot ${status}"></div>
          <span class="vpn-card-name" title="${escapeHtml(vpn.name)}">${escapeHtml(vpn.name)}</span>
        </div>
        <div class="vpn-card-badges">
          <span class="badge badge-${status}">${statusIcon(status)} ${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          <span class="badge ${vpn.monitor_type === 'infrastructure' && !vpn.port ? 'badge-unknown' : protocolClass(vpn.protocol)}">
            ${vpn.monitor_type === 'infrastructure' && !vpn.port ? 'ICMP Ping' : escapeHtml(vpn.protocol)}
          </span>
        </div>
        ${vpn.location ? `<div class="vpn-card-location">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escapeHtml(vpn.location)}
        </div>` : ''}
      </div>
      <div class="vpn-card-actions">
        <button class="btn-icon btn-primary-icon check-btn"
          data-id="${vpn.id}" data-tooltip="Check Now" aria-label="Run health check" title="Check Now">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
        </button>
        <button class="btn-icon edit-btn"
          data-id="${vpn.id}" data-tooltip="Edit" aria-label="Edit VPN" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon btn-danger-icon delete-btn"
          data-id="${vpn.id}" data-tooltip="Delete" aria-label="Delete VPN" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>

    <div class="vpn-card-ip-flow">
      <div class="vpn-card-ip">
        <span>Source</span>
        <span class="ip-value">${escapeHtml(vpn.source_ip)}</span>
      </div>
      <span class="vpn-card-ip-arrow">→</span>
      <div class="vpn-card-ip">
        <span>VPN</span>
        <span class="ip-value vpn-ip">${escapeHtml(vpn.vpn_server_ip)}</span>
      </div>
      <span class="vpn-card-ip-arrow">→</span>
      <div class="vpn-card-ip">
        <span>Dest</span>
        <span class="ip-value">${vpn.monitor_type === 'infrastructure' ? 'N/A' : escapeHtml(vpn.destination_ip)}</span>
      </div>
    </div>

    <div class="vpn-card-metrics">
      <div class="latency-bar-group">
        <div class="latency-bar-label">
          <span>Src→VPN</span>
          <span class="latency-bar-value">${latSrc ? latSrc + 'ms' : '--'}</span>
        </div>
        <div class="latency-bar-track">
          <div class="latency-bar-fill ${latencyClass(latSrc)}"
               style="width: ${latencyPercent(latSrc)}%"></div>
        </div>
      </div>
      <div class="latency-bar-group">
        <div class="latency-bar-label">
          <span>VPN→Dst</span>
          <span class="latency-bar-value">${vpn.monitor_type === 'infrastructure' ? 'N/A' : (latDst ? latDst + 'ms' : '--')}</span>
        </div>
        <div class="latency-bar-track">
          <div class="latency-bar-fill ${latencyClass(latDst)}"
               style="width: ${latencyPercent(latDst)}%"></div>
        </div>
      </div>
    </div>

    <div class="vpn-card-footer">
      <div class="vpn-card-uptime">
        <svg class="uptime-ring" viewBox="0 0 40 40" aria-label="Uptime ${uptime}%">
          <circle class="track" cx="20" cy="20" r="${r}"/>
          <circle class="fill" cx="20" cy="20" r="${r}"
            stroke="${uptimeColor}"
            stroke-dasharray="${circ}"
            stroke-dashoffset="${offset}"/>
        </svg>
        <span class="uptime-label">Uptime</span>
        <span class="uptime-value" style="color:${uptimeColor}">${uptime.toFixed(1)}%</span>
      </div>
      <span class="vpn-card-last-check">
        ${vpn.last_checked 
          ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + timeAgo(vpn.last_checked) 
          : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;vertical-align:middle;opacity:0.5"><circle cx="12" cy="12" r="10"/></svg> Not checked'}
      </span>
    </div>
  `;

  // Keyboard: Enter/Space activates the card
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });

  return card;
}

/**
 * Render the VPN list into #vpn-list.
 * @param {Array}  vpns
 * @param {string|null} selectedId
 * @param {Function} onSelect (vpn) => void
 * @param {Function} onEdit   (vpn) => void
 * @param {Function} onDelete (vpn) => void
 * @param {Function} onCheck  (vpn) => void
 */
export function renderVPNList(vpns, selectedId, { onSelect, onEdit, onDelete, onCheck }) {
  const list = document.getElementById('vpn-list');
  if (!list) return;

  list.innerHTML = '';

  if (!vpns || vpns.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛡️</div>
        <h3>No VPNs Found</h3>
        <p>Add your first VPN to start monitoring connectivity and health.</p>
      </div>
    `;
    return;
  }

  vpns.forEach((vpn, i) => {
    const card = buildVPNCard(vpn);
    card.style.animationDelay = `${i * 40}ms`;

    if (vpn.id === selectedId) card.classList.add('selected');

    // Card click → select
    card.addEventListener('click', (e) => {
      if (e.target.closest('.vpn-card-actions button')) return;
      onSelect(vpn);
    });

    // Action buttons
    card.querySelector('.check-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onCheck(vpn);
    });
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onEdit(vpn);
    });
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(vpn);
    });

    list.appendChild(card);
  });
}

/** Update a specific VPN card DOM in-place without re-rendering the whole card */
export function updateVPNCardDOM(vpn) {
  const card = document.querySelector(`.vpn-card[data-id="${vpn.id}"]`);
  if (!card) return;

  const status = vpn.status || 'unknown';
  const latSrc  = vpn.latency_source ?? 0;
  const latDst  = vpn.latency_dest   ?? 0;
  const uptime  = vpn.uptime ?? 100;

  // 1. Status dot
  const dot = card.querySelector('.status-dot');
  if (dot) {
    dot.className = `status-dot ${status}`;
  }

  // 2. Status badge
  const badges = card.querySelector('.vpn-card-badges');
  if (badges) {
    const statusBadge = badges.firstElementChild;
    if (statusBadge) {
      statusBadge.className = `badge badge-${status}`;
      statusBadge.innerHTML = `${statusIcon(status)} ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    }
  }

  // 3. Latency bars
  const latValues = card.querySelectorAll('.latency-bar-value');
  const latFills = card.querySelectorAll('.latency-bar-fill');
  if (latValues.length === 2 && latFills.length === 2) {
    latValues[0].textContent = latSrc ? latSrc + 'ms' : '--';
    latValues[1].textContent = vpn.monitor_type === 'infrastructure' ? 'N/A' : (latDst ? latDst + 'ms' : '--');

    latFills[0].className = `latency-bar-fill ${latencyClass(latSrc)}`;
    latFills[0].style.width = `${latencyPercent(latSrc)}%`;

    latFills[1].className = `latency-bar-fill ${latencyClass(latDst)}`;
    latFills[1].style.width = `${latencyPercent(latDst)}%`;
  }

  // 4. Uptime
  const uptimeFill = card.querySelector('.uptime-ring .fill');
  const uptimeValue = card.querySelector('.uptime-value');
  if (uptimeFill && uptimeValue) {
    const r = 14;
    const circ = 2 * Math.PI * r;
    const offset = circ - (uptime / 100) * circ;
    const uptimeColor = uptime >= 99 ? 'var(--status-healthy)' : uptime >= 95 ? 'var(--status-degraded)' : 'var(--status-down)';

    uptimeFill.setAttribute('stroke', uptimeColor);
    uptimeFill.setAttribute('stroke-dashoffset', offset);
    uptimeValue.style.color = uptimeColor;
    uptimeValue.textContent = uptime.toFixed(1) + '%';
  }

  // 5. Last check
  const lastCheck = card.querySelector('.vpn-card-last-check');
  if (lastCheck) {
    lastCheck.innerHTML = vpn.last_checked 
      ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + timeAgo(vpn.last_checked) 
      : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;vertical-align:middle;opacity:0.5"><circle cx="12" cy="12" r="10"/></svg> Not checked';
  }
}

/** Mark a card as "checking" (loading state) */
export function setCardChecking(id, checking) {
  const card = document.querySelector(`.vpn-card[data-id="${id}"]`);
  if (!card) return;
  card.classList.toggle('checking', checking);
  const btn = card.querySelector('.check-btn');
  if (btn) {
    btn.disabled = checking;
    if (checking) {
      btn.innerHTML = '<div class="spinner" style="border-color:rgba(255,255,255,0.2);border-top-color:var(--accent-1)"></div>';
    } else {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>`;
    }
  }
}
