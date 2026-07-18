/* ============================================================
   app.js — Entry point: bootstraps everything
   ============================================================ */

import { initTheme, bindThemeToggle } from './theme.js';
import { getVPNs, checkVPN }          from './api.js';
import { renderVPNList, updateVPNCardDOM, setCardChecking } from './vpn-card.js';
import { renderTopology, updateTopologyStatus }              from './topology.js';
import { initVPNManager, onVPNChange, openEditModal, openDeleteModal } from './vpn-manager.js';
import { startHealthMonitor, updateVPNList, checkNow } from './health.js';
import { showToast }                   from './toast.js';
import { debounce, formatTime, latencyClass, latencyPercent, escapeHtml } from './utils.js';

// ─── App state ────────────────────────────────────────────────
let vpns        = [];
let selectedVPN = null;
let filterStatus = 'all';
let searchText   = '';

// ─── DOM refs ─────────────────────────────────────────────────
const vpnListEl      = document.getElementById('vpn-list');
const topoContainer  = document.getElementById('topology-container');
const topoVPNName    = document.getElementById('topo-vpn-name');
const topoDetails    = document.getElementById('topo-details');
const statsTotal     = document.getElementById('stat-total');
const statsHealthy   = document.getElementById('stat-healthy');
const statsDegraded  = document.getElementById('stat-degraded');
const statsDown      = document.getElementById('stat-down');
const lastCheckedEl  = document.getElementById('last-checked-time');
const searchInput    = document.getElementById('search-input');
const filterSelect   = document.getElementById('filter-select');

// ─── Stats update ─────────────────────────────────────────────
function updateStats() {
  const total    = vpns.length;
  const healthy  = vpns.filter(v => v.status === 'healthy').length;
  const degraded = vpns.filter(v => v.status === 'degraded').length;
  const down     = vpns.filter(v => v.status === 'down').length;

  animateStat(statsTotal,    total);
  animateStat(statsHealthy,  healthy);
  animateStat(statsDegraded, degraded);
  animateStat(statsDown,     down);
}

function animateStat(el, value) {
  if (!el) return;
  if (el.textContent === String(value)) return;
  el.style.animation = 'none';
  el.textContent = value;
  requestAnimationFrame(() => {
    el.style.animation = 'countUp 300ms ease both';
  });
}

// ─── Filtered VPN list ────────────────────────────────────────
function getFilteredVPNs() {
  return vpns.filter(v => {
    const matchStatus = filterStatus === 'all' || v.status === filterStatus;
    const q = searchText.toLowerCase();
    const matchSearch = !q || [v.name, v.source_ip, v.vpn_server_ip, v.destination_ip, v.location]
      .some(f => f && f.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });
}

// ─── Render ───────────────────────────────────────────────────
function renderList() {
  const filtered = getFilteredVPNs();
  renderVPNList(filtered, selectedVPN?.id, {
    onSelect: selectVPN,
    onEdit:   openEditModal,
    onDelete: openDeleteModal,
    onCheck:  handleManualCheck,
  });
}

function renderTopo() {
  renderTopology(topoContainer, selectedVPN);
  if (topoVPNName) {
    topoVPNName.textContent = selectedVPN ? selectedVPN.name : '\u2014 Select a VPN \u2014';
  }
  renderTopoDetails(selectedVPN);
}

/** Render the detail strip below the topology SVG */
function renderTopoDetails(vpn) {
  if (!topoDetails) return;
  if (!vpn) {
    topoDetails.style.display = 'none';
    topoDetails.innerHTML = '';
    return;
  }

  topoDetails.style.display = 'grid';

  const isInfra  = vpn.monitor_type === 'infrastructure';
  const status   = vpn.status || 'unknown';
  const uptime   = typeof vpn.uptime_percent === 'number' ? vpn.uptime_percent : 100;
  const latSrc   = vpn.latency_source || 0;
  const latDst   = vpn.latency_dest   || 0;
  const r = 17; // uptime ring radius
  const circ = 2 * Math.PI * r;
  const offset = circ - (uptime / 100) * circ;
  const uptimeColor = uptime >= 99 ? 'var(--status-healthy)' : uptime >= 95 ? 'var(--status-degraded)' : 'var(--status-down)';

  // Status label
  const statusLabels = { healthy: 'Secure', degraded: 'Degraded', down: 'Down', unknown: 'Unknown' };
  const statusCls    = status;

  // Latency bars
  function latBar(ms) {
    const cls = latencyClass(ms);
    const pct = latencyPercent(ms);
    return `
      <div class="topo-detail-bar-track">
        <div class="topo-detail-bar-fill ${cls}" style="width:${pct}%"></div>
      </div>`;
  }

  // Arrow SVG
  const arrowSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  // IP flow tile (full width)
  let ipFlowHTML;
  if (isInfra) {
    ipFlowHTML = `
      <div class="topo-detail-tile wide">
        <div class="topo-detail-ip-seg">
          <span class="topo-detail-ip-label">Monitor</span>
          <span class="topo-detail-ip-value">Local</span>
        </div>
        <div class="topo-detail-arrow">${arrowSvg}</div>
        <div class="topo-detail-ip-seg">
          <span class="topo-detail-ip-label">VPN Server</span>
          <span class="topo-detail-ip-value vpn-ip">${escapeHtml(vpn.vpn_server_ip || '—')}</span>
        </div>
      </div>`;
  } else {
    ipFlowHTML = `
      <div class="topo-detail-tile wide">
        <div class="topo-detail-ip-seg">
          <span class="topo-detail-ip-label">Source</span>
          <span class="topo-detail-ip-value">${escapeHtml(vpn.source_ip || 'null')}</span>
        </div>
        <div class="topo-detail-arrow">${arrowSvg}</div>
        <div class="topo-detail-ip-seg">
          <span class="topo-detail-ip-label">VPN</span>
          <span class="topo-detail-ip-value vpn-ip">${escapeHtml(vpn.vpn_server_ip || '—')}</span>
        </div>
        <div class="topo-detail-arrow">${arrowSvg}</div>
        <div class="topo-detail-ip-seg">
          <span class="topo-detail-ip-label">Destination</span>
          <span class="topo-detail-ip-value">${escapeHtml(vpn.destination_ip || 'N/A')}</span>
        </div>
      </div>`;
  }

  // Latency tiles
  const latSrcLabel = isInfra ? 'Ping Latency' : 'Src \u2192 VPN';
  const latDstLabel = 'VPN \u2192 Dst';

  let latencyTiles = `
    <div class="topo-detail-tile">
      <span class="topo-detail-tile-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        ${latSrcLabel}
      </span>
      <span class="topo-detail-tile-value ${latencyClass(latSrc) === 'good' ? 'healthy' : latencyClass(latSrc) === 'medium' ? 'degraded' : 'down'}">${latSrc}ms</span>
      ${latBar(latSrc)}
    </div>`;

  if (!isInfra) {
    latencyTiles += `
    <div class="topo-detail-tile">
      <span class="topo-detail-tile-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        ${latDstLabel}
      </span>
      <span class="topo-detail-tile-value ${latencyClass(latDst) === 'good' ? 'healthy' : latencyClass(latDst) === 'medium' ? 'degraded' : 'down'}">${latDst}ms</span>
      ${latBar(latDst)}
    </div>`;
  }

  const protocolLabel = (isInfra && !vpn.port) ? 'ICMP Ping' : escapeHtml(vpn.protocol || '—');

  topoDetails.innerHTML = `
    ${ipFlowHTML}

    <!-- Status -->
    <div class="topo-detail-tile">
      <span class="topo-detail-tile-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Status
      </span>
      <span class="topo-detail-tile-value ${statusCls}">${statusLabels[status] ?? 'Unknown'}</span>
    </div>

    <!-- Uptime -->
    <div class="topo-detail-tile topo-uptime-tile">
      <svg class="topo-uptime-ring" viewBox="0 0 40 40">
        <circle class="track" cx="20" cy="20" r="${r}"/>
        <circle class="fill" cx="20" cy="20" r="${r}"
          stroke="${uptimeColor}"
          stroke-dasharray="${circ.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"/>
      </svg>
      <div>
        <span class="topo-detail-tile-label">Uptime</span>
        <span class="topo-detail-tile-value" style="color:${uptimeColor}">${uptime.toFixed(1)}%</span>
      </div>
    </div>

    ${latencyTiles}

    <!-- Protocol -->
    <div class="topo-detail-tile">
      <span class="topo-detail-tile-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h2a2 2 0 0 1 2 2v2"/><path d="M8 3H6a2 2 0 0 0-2 2v2"/></svg>
        Protocol
      </span>
      <span class="topo-detail-tile-value accent">${protocolLabel}</span>
    </div>

    ${vpn.port ? `
    <!-- Port -->
    <div class="topo-detail-tile">
      <span class="topo-detail-tile-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
        Port
      </span>
      <span class="topo-detail-tile-value">${escapeHtml(String(vpn.port))}</span>
    </div>` : ''}

    ${vpn.location ? `
    <!-- Location -->
    <div class="topo-detail-tile">
      <span class="topo-detail-tile-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Location
      </span>
      <span class="topo-detail-tile-value">${escapeHtml(vpn.location)}</span>
    </div>` : ''}

    ${vpn.description ? `
    <!-- Description -->
    <div class="topo-detail-tile" style="grid-column: 1/-1;">
      <span class="topo-detail-tile-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Notes
      </span>
      <span class="topo-detail-tile-value" style="white-space:normal;font-size:0.78rem;font-weight:400;color:var(--text-secondary);font-family:var(--font-ui)">${escapeHtml(vpn.description)}</span>
    </div>` : ''}

    <!-- Last Checked -->
    <div class="topo-detail-tile">
      <span class="topo-detail-tile-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Last Check
      </span>
      <span class="topo-detail-tile-value" style="font-size:0.75rem;">${vpn.last_checked ? new Date(vpn.last_checked).toLocaleTimeString() : 'Never'}</span>
    </div>
  `;
}

function renderAll() {
  updateStats();
  renderList();
  renderTopo();
  if (lastCheckedEl) {
    lastCheckedEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
  }
}

// ─── Select VPN ───────────────────────────────────────────────
function selectVPN(vpn) {
  selectedVPN = vpn;
  renderList(); // re-render to update selected state
  renderTopo();
}

// ─── Manual health check ──────────────────────────────────────
async function handleManualCheck(vpn) {
  setCardChecking(vpn.id, true);
  await checkNow(vpn, () => {
    // If this VPN is selected, update topology
    if (selectedVPN?.id === vpn.id) {
      selectedVPN = vpn;
      renderTopo();
    }
    updateStats();
    renderList();
  });
  setCardChecking(vpn.id, false);
}

// ─── Load VPNs from API ───────────────────────────────────────
async function loadVPNs() {
  try {
    vpns = await getVPNs();

    // Restore selected VPN reference from fresh data
    if (selectedVPN) {
      selectedVPN = vpns.find(v => v.id === selectedVPN.id) || null;
    }

    updateVPNList(vpns);
    renderAll();
  } catch {
    // Network error toast shown by api.js
    renderAll();
  }
}

// ─── Health monitor callback ──────────────────────────────────
function onHealthUpdate() {
  // Update selected VPN reference from mutated list
  if (selectedVPN) {
    const fresh = vpns.find(v => v.id === selectedVPN.id);
    if (fresh) selectedVPN = fresh;
  }
  
  updateStats();
  
  // Selectively update cards in the DOM instead of a full re-render
  vpns.forEach(vpn => updateVPNCardDOM(vpn));

  // Update topology without re-rendering SVG
  updateTopologyStatus(topoContainer, selectedVPN);

  // Update details strip in-place (lightweight)
  renderTopoDetails(selectedVPN);

  if (lastCheckedEl) {
    lastCheckedEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
  }
}

// ─── Search & filter ──────────────────────────────────────────
const debouncedSearch = debounce((q) => {
  searchText = q;
  renderList();
}, 250);

// ─── Initialize ───────────────────────────────────────────────
async function init() {
  // Theme (must be first to avoid flash)
  initTheme();
  bindThemeToggle();

  // VPN CRUD manager
  initVPNManager();

  // When any VPN changes, reload from server
  onVPNChange(loadVPNs);

  // Search input
  searchInput?.addEventListener('input', (e) => debouncedSearch(e.target.value));

  // Filter select
  filterSelect?.addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderList();
  });

  // Load initial data
  await loadVPNs();

  // Start health monitor after initial data is loaded
  startHealthMonitor(vpns, onHealthUpdate);

  // Topology resize observer — ONLY rescale the existing SVG, never re-render
  if (topoContainer && window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      const svg = topoContainer.querySelector('svg.topology-svg');
      if (svg) {
        // Just update the viewBox dimensions, don't touch the DOM structure
        const W = topoContainer.clientWidth  || 700;
        const H = topoContainer.clientHeight || 440;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      } else if (selectedVPN) {
        // No SVG at all yet (e.g., first load) — do a one-time render
        renderTopo();
      }
    });
    ro.observe(topoContainer);
  }

  // Keyboard: Delete key deletes selected VPN
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && selectedVPN) {
      const focused = document.activeElement;
      if (!['INPUT','TEXTAREA','SELECT'].includes(focused.tagName)) {
        openDeleteModal(selectedVPN);
      }
    }
  });

  console.log('🛡️ VPN Monitor initialized.');
}

// ─── Boot ──────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
