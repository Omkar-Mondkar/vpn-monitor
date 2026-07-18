/* ============================================================
   topology.js — SVG connectivity flow rendering & animation
   ============================================================ */

import { escapeHtml } from './utils.js';

const NS = 'http://www.w3.org/2000/svg';

// Track the last VPN that was fully rendered to avoid unnecessary re-renders
let _lastRenderedId = null;
let _lastRenderedType = null;

function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) { if (c) e.appendChild(c); }
  return e;
}

function text(tag, str, attrs = {}) {
  const e = el(tag, attrs);
  e.textContent = str;
  return e;
}

/** Render grid pattern lines */
function renderGrid(W, H, step = 40) {
  const g = el('g', { class: 'topo-grid' });
  for (let x = 0; x <= W; x += step) {
    g.appendChild(el('line', { class: 'topo-grid-line', x1: x, y1: 0, x2: x, y2: H }));
  }
  for (let y = 0; y <= H; y += step) {
    g.appendChild(el('line', { class: 'topo-grid-line', x1: 0, y1: y, x2: W, y2: y }));
  }
  return g;
}

/**
 * Render a node box.
 * @param {number} cx  Center X
 * @param {number} cy  Center Y
 * @param {string} icon
 * @param {string} label  Main label (name)
 * @param {string} ip
 * @param {string} sublabel  e.g. "Source" / "VPN" / "Destination"
 * @param {boolean} isVPN   Whether to draw the accent ring
 * @param {string} status
 * @param {number} delay  Animation delay in ms
 */
function renderNode(cx, cy, icon, label, ip, sublabel, isVPN, status, delay = 0, isInitial = true) {
  const W = 120, H = 80;
  const x = cx - W / 2;
  const y = cy - H / 2;

  const g = el('g', {
    class: `topo-node-group ${isInitial ? 'animate-entry' : ''}`,
    'data-status': status,
    style: `animation-delay: ${delay}ms`,
  });

  // Remove the entry animation class once it finishes so CSS transitions
  // (colour changes via data-status) work cleanly afterwards.
  if (isInitial) {
    g.addEventListener('animationend', () => g.classList.remove('animate-entry'), { once: true });
  }

  // Glow filter id
  const filterId = `glow-${sublabel.replace(/\s+/g, '-').toLowerCase()}`;

  // Background rect
  const bg = el('rect', {
    class: 'topo-node-bg',
    x, y, width: W, height: H, rx: 14, ry: 14,
  });
  g.appendChild(bg);

  // VPN ring (accent)
  if (isVPN) {
    const ringR = 50;
    g.appendChild(el('ellipse', {
      class: 'topo-vpn-ring',
      cx, cy: cy - 10,
      rx: ringR, ry: ringR * 0.3,
      fill: 'none', opacity: 0.3,
      'stroke-dasharray': '4 4',
      style: 'animation: flowDash 3s linear infinite',
    }));

    // Pulse ring
    const pR = 62;
    const pulseRing = el('circle', {
      class: 'topo-pulse-ring',
      cx, cy,
      r: pR,
      fill: 'none',
      style: `animation: ripple 2.5s ease-out infinite; transform-origin: ${cx}px ${cy}px;`,
    });
    g.appendChild(pulseRing);
  }

  // Icon SVG
  const iconSvg = el('svg', {
    x: cx - 12, y: cy - 28,
    width: 24, height: 24,
    viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: 'topo-node-icon'
  });
  iconSvg.innerHTML = icon;
  g.appendChild(iconSvg);

  // Label
  g.appendChild(text('text', escapeHtml(label.length > 14 ? label.slice(0, 13) + '…' : label), {
    class: 'topo-node-label',
    x: cx, y: cy + 14,
  }));

  // IP
  g.appendChild(text('text', ip, {
    class: 'topo-node-ip',
    x: cx, y: cy + 28,
  }));

  // Sub-label
  g.appendChild(text('text', sublabel.toUpperCase(), {
    class: 'topo-node-sublabel',
    x: cx, y: y + H + 8,
    opacity: 0.75,
    'font-weight': 600,
    'letter-spacing': '0.08em',
  }));

  return g;
}

/**
 * Render a flow path between two X positions.
 * @param {number} x1 Start X
 * @param {number} x2 End X
 * @param {number} cy Y center
 * @param {string} status
 * @param {number} latencyMs
 * @param {string} pathLabel  "source" | "dest"
 * @param {number} delay
 */
function renderPath(x1, x2, cy, status, latencyMs, pathLabel, delay = 0) {
  const g = el('g', {
    class: `topo-path-group topo-path-${pathLabel}`,
    'data-status': status
  });

  const midX = (x1 + x2) / 2;

  // ─── Base line ──────────────────
  g.appendChild(el('line', {
    class: `topo-path-base`,
    x1, y1: cy, x2, y2: cy,
  }));

  // ─── Normal flow group ──────────
  const normalGroup = el('g', { class: 'topo-path-normal' });

  const flowLine = el('line', {
    class: `topo-path-flow normal-flow`,
    x1, y1: cy, x2, y2: cy,
    style: `animation-delay: ${delay}ms`,
  });
  normalGroup.appendChild(flowLine);

  const arrowX = x2 - 4;
  const arrow = el('polygon', {
    class: 'topo-path-arrow',
    points: `${arrowX},${cy - 5} ${x2 + 4},${cy} ${arrowX},${cy + 5}`,
    opacity: 0.8,
  });
  normalGroup.appendChild(arrow);

  const dot = el('circle', {
    class: 'topo-path-dot',
    r: 4,
    style: `
      animation: particleFlow 2s ease-in-out infinite;
      animation-delay: ${delay}ms;
      offset-path: path('M ${x1} ${cy} L ${x2} ${cy}');
    `,
  });
  normalGroup.appendChild(dot);
  g.appendChild(normalGroup);

  // ─── Error flow group ───────────
  const errorGroup = el('g', { class: 'topo-path-error' });
  
  const breakX = midX - 15;
  errorGroup.appendChild(el('line', {
    class: `topo-path-flow broken`,
    x1, y1: cy, x2: breakX, y2: cy,
  }));

  const xText = el('text', { class: 'topo-error-x', x: midX, y: cy });
  xText.textContent = '✕';
  errorGroup.appendChild(xText);

  const errLabel = el('text', {
    class: 'topo-error-text',
    x: midX, y: cy + 16,
  });
  errLabel.textContent = 'Connection Lost';
  errorGroup.appendChild(errLabel);

  errorGroup.appendChild(el('line', {
    class: `topo-path-flow broken`,
    x1: midX + 15, y1: cy, x2, y2: cy,
  }));
  g.appendChild(errorGroup);

  // ─── Latency label ──────────────────────
  const latencyGroup = el('g', { class: 'topo-latency-group' });
  const labelW = 50, labelH = 20;
  const lx = midX - labelW / 2;
  const ly = cy - labelH - 8;

  const lbg = el('rect', {
    class: 'topo-latency-bg',
    x: lx, y: ly, width: labelW, height: labelH,
    opacity: 0.15, 'stroke-width': 1,
    rx: 6, ry: 6,
  });
  latencyGroup.appendChild(lbg);

  const ltxt = el('text', {
    class: 'topo-latency-text',
    x: midX, y: ly + labelH / 2,
  });
  ltxt.textContent = `${Math.max(latencyMs, 0)}ms`;
  latencyGroup.appendChild(ltxt);
  g.appendChild(latencyGroup);

  return g;
}

/**
 * Render status badge under VPN node.
 * @param {number} cx
 * @param {number} y   Top y of badge
 * @param {string} status
 */
function renderStatusBadge(cx, y, status) {
  const labels = { healthy: 'Secure', degraded: 'Degraded', down: 'Down', unknown: 'Unknown' };
  const label = labels[status] ?? 'Unknown';
  const W = 76, H = 22;

  const g = el('g', {
    class: 'topo-status-group',
    'data-status': status
  });

  g.appendChild(el('rect', {
    class: 'topo-status-badge-bg',
    x: cx - W / 2, y,
    width: W, height: H,
    opacity: 0.15,
    'stroke-width': 1,
    rx: 10, ry: 10,
  }));

  const t = el('text', {
    class: 'topo-status-badge-text',
    x: cx, y: y + H / 2,
  });
  t.textContent = label.toUpperCase();
  g.appendChild(t);

  return g;
}

/**
 * Main render function — draws the full topology for a VPN.
 * @param {HTMLElement} container  The #topology-container element
 * @param {object|null} vpn       Selected VPN data (null = show placeholder)
 */
export function renderTopology(container, vpn) {
  container.innerHTML = '';

  if (!vpn) {
    const ph = document.createElement('div');
    ph.className = 'topo-placeholder';
    ph.innerHTML = `
      <div class="topo-placeholder-icon">🛡️</div>
      <h3>No VPN Selected</h3>
      <p>Select a VPN from the list to visualize its connectivity flow and health status.</p>
    `;
    container.appendChild(ph);
    document.getElementById('topo-monitor-method').style.display = 'none';
    return;
  }

  // ─── SVG dimensions ─────────────────────
  const W = container.clientWidth  || 700;
  const H = container.clientHeight || 440;

  const svg = el('svg', {
    class: 'topology-svg',
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'xMidYMid meet',
  });

  // Grid background
  svg.appendChild(renderGrid(W, H));

  // ─── Node positions ──────────────────────
  const midY   = H / 2 - 10;
  const isInfra = vpn.monitor_type === 'infrastructure';
  
  let srcX, vpnX, dstX;
  if (isInfra) {
    srcX = W * 0.3;
    vpnX = W * 0.7;
  } else {
    srcX = W * 0.16;
    vpnX = W * 0.5;
    dstX = W * 0.84;
  }

  // Gap between node edge and path start/end
  const nodeHalfW = 62;
  const { status, latency_source, latency_dest } = vpn;
  const seg1Status = status === 'down' ? 'down' : status;

  if (isInfra) {
    // 2-Node Layout
    const p1x1 = srcX + nodeHalfW;
    const p1x2 = vpnX - nodeHalfW;
    svg.appendChild(renderPath(p1x1, p1x2, midY, seg1Status, latency_source || 0, 'source', 0));
    
    const ICON_MONITOR = '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
    const ICON_VPN = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
    const ICON_DEST = '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>';

    svg.appendChild(renderNode(srcX, midY, ICON_MONITOR, 'Monitoring Node', 'Local', 'Source', false, status, 0, true));
    svg.appendChild(renderNode(vpnX, midY, ICON_VPN, vpn.name, vpn.vpn_server_ip, 'VPN Server', true, status, 100, true));
    svg.appendChild(renderStatusBadge(vpnX, midY + 55, status));
  } else {
    // 3-Node Layout
    const p1x1 = srcX + nodeHalfW;
    const p1x2 = vpnX - nodeHalfW;
    const p2x1 = vpnX + nodeHalfW;
    const p2x2 = dstX - nodeHalfW;
    const seg2Status = status;

    svg.appendChild(renderPath(p1x1, p1x2, midY, seg1Status, latency_source || 0, 'source', 0));
    svg.appendChild(renderPath(p2x1, p2x2, midY, seg2Status, latency_dest   || 0, 'dest',   200));

    const ICON_SRC = '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
    const ICON_VPN = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
    const ICON_DEST = '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>';

    svg.appendChild(renderNode(srcX, midY, ICON_SRC, vpn.source_ip,      vpn.source_ip,      'Source',      false, status, 0, true));
    svg.appendChild(renderNode(vpnX, midY, ICON_VPN, vpn.name,           vpn.vpn_server_ip,  'VPN Server',  true,  status, 100, true));
    svg.appendChild(renderNode(dstX, midY, ICON_DEST, vpn.destination_ip, vpn.destination_ip, 'Destination', false, status, 200, true));
    svg.appendChild(renderStatusBadge(vpnX, midY + 55, status));
  }

  // ─── Protocol / Port badge (top-center) ──
  if (vpn.protocol) {
    const proto = `${vpn.protocol}  :${vpn.port}`;
    const bW = proto.length * 7 + 24;
    const bx = W / 2 - bW / 2;
    const by = 20;

    svg.appendChild(el('rect', {
      x: bx, y: by, width: bW, height: 22, rx: 6, ry: 6,
      fill: 'var(--accent-1-dim)', stroke: 'var(--accent-1)', 'stroke-width': 1,
    }));

    const pt = el('text', {
      x: W / 2, y: by + 11,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: 'var(--accent-1)',
      'font-family': 'var(--font-mono)',
      'font-size': '10', 'font-weight': '600',
    });
    pt.textContent = proto;
    svg.appendChild(pt);
  }

  container.appendChild(svg);

  // Record what we just fully rendered
  _lastRenderedId   = vpn.id;
  _lastRenderedType = vpn.monitor_type;

  // Update header chip and subtitle
  const methodChip = document.getElementById('topo-monitor-method');
  const subtitle   = document.getElementById('topo-monitor-subtitle');
  const flowChip   = document.getElementById('topo-flow-chip');
  if (isInfra) {
    const hasPort = !!vpn.port;
    if (methodChip) {
      methodChip.style.display = 'inline-block';
      methodChip.textContent   = hasPort ? 'Port Probe' : 'ICMP Ping';
    }
    if (subtitle) {
      subtitle.style.display  = 'block';
      subtitle.textContent    = hasPort
        ? `Probing port ${vpn.port} — checks if the VPN daemon is actively listening for connections.`
        : 'ICMP Ping — checks if the VPN server is reachable online. Add a port number to also verify the VPN service is running.';
    }
    if (flowChip) flowChip.textContent = 'Monitor → VPN Server';
  } else {
    if (methodChip) methodChip.style.display = 'none';
    if (subtitle)   subtitle.style.display   = 'none';
    if (flowChip)   flowChip.textContent      = 'Source → VPN → Destination';
  }
}

/** Update topology without full re-render (just update colors/labels) */
export function updateTopologyStatus(container, vpn) {
  if (!vpn) {
    renderTopology(container, vpn);
    return;
  }

  const svg = container.querySelector('svg.topology-svg');
  
  // Full re-render only if: no SVG yet, or the VPN itself changed identity
  const identityChanged = !svg || vpn.id !== _lastRenderedId || vpn.monitor_type !== _lastRenderedType;
  if (identityChanged) {
    renderTopology(container, vpn);
    return;
  }

  const { status, latency_source, latency_dest } = vpn;
  const seg1Status = status === 'down' ? 'down' : status;
  const seg2Status = status;

  // Update Paths
  const srcPath = svg.querySelector('.topo-path-source');
  if (srcPath) {
    srcPath.setAttribute('data-status', seg1Status);
    const ltxt = srcPath.querySelector('.topo-latency-text');
    if (ltxt) ltxt.textContent = `${Math.max(latency_source || 0, 0)}ms`;
  }
  
  const destPath = svg.querySelector('.topo-path-dest');
  if (destPath) {
    destPath.setAttribute('data-status', seg2Status);
    const ltxt = destPath.querySelector('.topo-latency-text');
    if (ltxt) ltxt.textContent = `${Math.max(latency_dest || 0, 0)}ms`;
  }

  // Update Nodes
  const nodes = svg.querySelectorAll('.topo-node-group');
  nodes.forEach(n => n.setAttribute('data-status', status));

  // Update Status Badge
  const badge = svg.querySelector('.topo-status-group');
  if (badge) {
    badge.setAttribute('data-status', status);
    const btext = badge.querySelector('.topo-status-badge-text');
    if (btext) {
      const labels = { healthy: 'Secure', degraded: 'Degraded', down: 'Down', unknown: 'Unknown' };
      btext.textContent = (labels[status] ?? 'Unknown').toUpperCase();
    }
  }

  // Update Protocol Color (if present)
  const protoBadge = svg.querySelector('rect[fill="var(--accent-1-dim)"]');
  // It stays accent-colored regardless of status, no update needed here
}
