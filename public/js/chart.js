/* ============================================================
   chart.js — Live latency line chart (pure Canvas API)
   Renders a rolling dual-line chart (src + dst latency)
   with smooth bezier curves, gradient fills, and time filter.
   ============================================================ */

// ─── Constants ────────────────────────────────────────────────
const PADDING = { top: 28, right: 20, bottom: 38, left: 52 };

// Time window options (in number of data points; 1 point = 6s)
const TIME_WINDOWS = {
  '1m':  10,   // ~1 min  (10 × 6s)
  '5m':  50,   // ~5 min
  '15m': 150,  // ~15 min
  '30m': 300,  // ~30 min
  'all': Infinity,
};

const MAX_HISTORY = 300; // store max 30 min of data per VPN

// ─── State ────────────────────────────────────────────────────
// Map<vpnId, { timestamps: string[], latSrc: number[], latDst: number[], statuses: string[] }>
const history = new Map();

let canvasEl      = null;
let ctx           = null;
let dpr           = 1;
let activeWindow  = '5m'; // default time window

// ─── Init ─────────────────────────────────────────────────────
export function initChart(canvas) {
  canvasEl = canvas;
  ctx      = canvas.getContext('2d');
  dpr      = window.devicePixelRatio || 1;

  resizeCanvas();

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (canvasEl._currentVpnId) renderChart(canvasEl._currentVpnId);
  });
}

// ─── Set active time window ───────────────────────────────────
export function setChartTimeWindow(windowKey) {
  if (TIME_WINDOWS[windowKey] !== undefined) {
    activeWindow = windowKey;
  }
  if (canvasEl?._currentVpnId) renderChart(canvasEl._currentVpnId);
}

export function getChartTimeWindows() {
  return Object.keys(TIME_WINDOWS);
}

// ─── Canvas resize (safe — resets transform before scaling) ───
function resizeCanvas() {
  if (!canvasEl) return;
  const wrap = canvasEl.parentElement;
  if (!wrap) return;

  // Use offsetWidth so we get the real rendered size even after layout
  const w = wrap.offsetWidth  || 0;
  const h = wrap.offsetHeight || 0;

  if (w < 10 || h < 10) return; // panel still hidden / zero-size — skip

  // Only resize the drawing buffer if dims actually changed
  const newW = Math.round(w * dpr);
  const newH = Math.round(h * dpr);
  if (canvasEl.width === newW && canvasEl.height === newH) return;

  canvasEl.width  = newW;
  canvasEl.height = newH;
  // NOTE: do NOT touch canvasEl.style.width/height — CSS handles that (width:100%)
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset accumulated scale
  ctx.scale(dpr, dpr);
}

// ─── Push a data point for a VPN ─────────────────────────────
export function pushDataPoint(vpnId, latSrc, latDst, status) {
  if (!history.has(vpnId)) {
    history.set(vpnId, { timestamps: [], latSrc: [], latDst: [], statuses: [] });
  }
  const h = history.get(vpnId);
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  h.timestamps.push(ts);
  h.latSrc.push(status === 'down' ? null : Math.max(0, latSrc || 0));
  h.latDst.push(status === 'down' ? null : Math.max(0, latDst || 0));
  h.statuses.push(status);

  // Trim to max history
  while (h.timestamps.length > MAX_HISTORY) {
    h.timestamps.shift();
    h.latSrc.shift();
    h.latDst.shift();
    h.statuses.shift();
  }
}

// ─── Clear canvas (on VPN deselect) ──────────────────────────
export function clearChart() {
  if (!canvasEl || !ctx) return;
  const w = canvasEl.parentElement?.offsetWidth  || canvasEl.width / dpr;
  const h = canvasEl.parentElement?.offsetHeight || canvasEl.height / dpr;
  ctx.clearRect(0, 0, w, h);
}

// ─── Main render ──────────────────────────────────────────────
export function renderChart(vpnId) {
  if (!canvasEl || !ctx) return;
  canvasEl._currentVpnId = vpnId;

  // Always resize first — panel may have been hidden during initChart()
  resizeCanvas();

  // Use the drawing buffer size (divided by DPR) as logical pixel dims
  const W = canvasEl.width  / dpr;
  const H = canvasEl.height / dpr;

  if (W < 10 || H < 10) return; // not yet laid out

  ctx.clearRect(0, 0, W, H);

  const full = history.get(vpnId);
  if (!full || full.timestamps.length < 2) {
    drawWaiting(W, H);
    return;
  }

  // Apply time window
  const maxPts  = TIME_WINDOWS[activeWindow] ?? Infinity;
  const sliceStart = maxPts === Infinity ? 0 : Math.max(0, full.timestamps.length - maxPts);
  const timestamps = full.timestamps.slice(sliceStart);
  const latSrc     = full.latSrc.slice(sliceStart);
  const latDst     = full.latDst.slice(sliceStart);

  if (timestamps.length < 2) { drawWaiting(W, H); return; }

  const pts   = timestamps.length;
  const plotW = W - PADDING.left - PADDING.right;
  const plotH = H - PADDING.top  - PADDING.bottom;

  if (plotW <= 0 || plotH <= 0) return;

  // Y range
  const allVals = [...latSrc, ...latDst].filter(v => v !== null && v > 0);
  const maxVal  = allVals.length ? Math.max(...allVals) : 10;
  const yMax    = Math.ceil(maxVal / 20) * 20 + 20;

  // Draw layers
  drawGrid(plotW, plotH, yMax);
  drawLine(latSrc, pts, plotW, plotH, yMax, '#00e5ff', true);
  drawLine(latDst, pts, plotW, plotH, yMax, '#7c4dff', false);
  drawXLabels(timestamps, pts, plotW, H, plotH);
  drawYLabels(plotH, yMax);
}

// ─── Grid ─────────────────────────────────────────────────────
function drawGrid(plotW, plotH, yMax) {
  const gridLines = 4;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([3, 5]);

  for (let i = 0; i <= gridLines; i++) {
    const y = PADDING.top + (plotH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(PADDING.left + plotW, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Line + gradient fill ─────────────────────────────────────
function drawLine(data, pts, plotW, plotH, yMax, color, withFill) {
  const points = data.map((v, i) => ({
    x: PADDING.left + (pts > 1 ? (i / (pts - 1)) : 0.5) * plotW,
    y: v === null ? null : PADDING.top + plotH - Math.min((v / yMax) * plotH, plotH),
    isNull: v === null,
  }));

  const nonNull = points.filter(p => !p.isNull);
  if (nonNull.length < 1) return;

  // Gradient fill under the src line only
  if (withFill && nonNull.length >= 2) {
    const gradient = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + plotH);
    gradient.addColorStop(0, hexToRgba(color, 0.22));
    gradient.addColorStop(1, hexToRgba(color, 0.01));

    ctx.save();
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < points.length; i++) {
      if (points[i].isNull) continue;
      if (!started) { ctx.moveTo(points[i].x, points[i].y); started = true; }
      else bezierTo(points, i);
    }
    const lastNonNull  = nonNull[nonNull.length - 1];
    const firstNonNull = nonNull[0];
    ctx.lineTo(lastNonNull.x, PADDING.top + plotH);
    ctx.lineTo(firstNonNull.x, PADDING.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }

  // Line stroke
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur  = 5;
  ctx.setLineDash([]);

  let started = false;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (points[i].isNull) { started = false; continue; }
    if (!started) { ctx.moveTo(points[i].x, points[i].y); started = true; }
    else bezierTo(points, i);
  }
  ctx.stroke();

  // Dots
  ctx.shadowBlur = 0;
  nonNull.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.restore();
}

// ─── Bezier curve helper ──────────────────────────────────────
function bezierTo(points, i) {
  let prev = null;
  for (let j = i - 1; j >= 0; j--) {
    if (!points[j].isNull) { prev = points[j]; break; }
  }
  if (!prev) { ctx.lineTo(points[i].x, points[i].y); return; }
  const cpx = (prev.x + points[i].x) / 2;
  ctx.bezierCurveTo(cpx, prev.y, cpx, points[i].y, points[i].x, points[i].y);
}

// ─── X axis labels ────────────────────────────────────────────
function drawXLabels(timestamps, pts, plotW, H, plotH) {
  const yLabel = PADDING.top + plotH + 16;
  ctx.save();
  ctx.font      = '9px "Fira Code", "Courier New", monospace';
  ctx.fillStyle = 'rgba(84,96,128,0.9)';
  ctx.textAlign = 'center';

  const maxLabels = 6;
  const step = Math.max(1, Math.ceil(pts / maxLabels));
  for (let i = 0; i < pts; i += step) {
    const x = PADDING.left + (pts > 1 ? (i / (pts - 1)) : 0.5) * plotW;
    // Show last 8 chars of time string (HH:MM:SS)
    const label = timestamps[i].length > 8 ? timestamps[i].slice(-8) : timestamps[i];
    ctx.fillText(label, x, yLabel);
  }
  // Also label the last point if not already included
  const lastI = pts - 1;
  if (lastI % step !== 0) {
    const x = PADDING.left + plotW;
    ctx.fillText(timestamps[lastI].length > 8 ? timestamps[lastI].slice(-8) : timestamps[lastI], x, yLabel);
  }
  ctx.restore();
}

// ─── Y axis labels ────────────────────────────────────────────
function drawYLabels(plotH, yMax) {
  ctx.save();
  ctx.font      = '9px "Fira Code", "Courier New", monospace';
  ctx.fillStyle = 'rgba(84,96,128,0.9)';
  ctx.textAlign = 'right';

  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const val = Math.round((yMax / gridLines) * (gridLines - i));
    const y   = PADDING.top + (plotH / gridLines) * i;
    ctx.fillText(`${val}ms`, PADDING.left - 6, y + 4);
  }
  ctx.restore();
}

// ─── Waiting message ──────────────────────────────────────────
function drawWaiting(W, H) {
  ctx.save();
  ctx.font         = '11px "Fira Code", "Courier New", monospace';
  ctx.fillStyle    = 'rgba(84,96,128,0.6)';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Collecting data…', W / 2, H / 2);
  ctx.restore();
}

// ─── Hex → rgba ───────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
