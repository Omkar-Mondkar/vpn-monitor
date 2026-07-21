/* ============================================================
   health.js — Simulated VPN health monitoring engine
   ============================================================ */

import { updateVPNStatus } from './api.js';
import { showToast } from './toast.js';

const CHECK_INTERVAL_MS = 6000; // every 6 seconds

// Per-VPN simulation state (not persisted)
const vpnState = new Map(); // id → { baseLatency, reliability, trend }

let timerId = null;
let vpnListRef = [];        // reference to current VPN list
let onUpdate = null;        // callback when any VPN status changes
let onLog    = null;        // callback(type, vpnName, message) for live log

/** Initialize simulation state for a VPN (idempotent) */
function ensureState(vpn) {
  if (vpnState.has(vpn.id)) return;
  vpnState.set(vpn.id, {
    baseLatencySrc: Math.floor(Math.random() * 30) + 5,   // 5–35ms
    baseLatencyDst: Math.floor(Math.random() * 25) + 3,   // 3–28ms
    reliability: 0.7 + Math.random() * 0.3,               // 70–100%
    trend: 'stable',   // 'stable' | 'degrading' | 'recovering'
    consecutiveBad: 0,
  });
}

/** Pick next status based on current status and reliability */
function nextStatus(current, state) {
  const { reliability, consecutiveBad } = state;
  const r = Math.random();

  if (current === 'healthy') {
    if (r > reliability) {
      state.consecutiveBad = 1;
      return 'degraded';
    }
    return 'healthy';
  }

  if (current === 'degraded') {
    state.consecutiveBad++;
    if (state.consecutiveBad >= 3 && r < 0.35) return 'down';
    if (r > 0.5) { state.consecutiveBad = 0; return 'healthy'; }
    return 'degraded';
  }

  if (current === 'down') {
    if (r > 0.7) { state.consecutiveBad = 0; return 'degraded'; }
    return 'down';
  }

  // unknown → start a check
  return Math.random() > 0.4 ? 'healthy' : 'degraded';
}

/** Simulate latency for a VPN */
function simulateLatency(vpn, newStatus, state) {
  if (newStatus === 'down') return { latency_source: 0, latency_dest: 0 };

  const jitter = () => Math.floor((Math.random() - 0.5) * 20);
  const multiplier = newStatus === 'degraded' ? 3 + Math.random() * 4 : 1;

  return {
    latency_source: Math.max(1, Math.floor((state.baseLatencySrc + jitter()) * multiplier)),
    latency_dest:   vpn.monitor_type === 'infrastructure' ? 0 : Math.max(1, Math.floor((state.baseLatencyDst + jitter()) * multiplier)),
  };
}

/** Run one health check cycle for all VPNs */
async function runCheckCycle() {
  if (!vpnListRef.length) return;

  for (const vpn of vpnListRef) {
    ensureState(vpn);
    const state = vpnState.get(vpn.id);
    const prevStatus = vpn.status || 'unknown';
    const newStatus  = nextStatus(prevStatus, state);
    const { latency_source, latency_dest } = simulateLatency(vpn, newStatus, state);

    // Update uptime — small degradation when not healthy
    const uptimeDelta = newStatus === 'healthy' ? 0.01 : newStatus === 'degraded' ? -0.05 : -0.3;
    const newUptime = Math.min(100, Math.max(0, (vpn.uptime ?? 100) + uptimeDelta));

    const payload = {
      status:         newStatus,
      latency_source,
      latency_dest,
      uptime: parseFloat(newUptime.toFixed(2)),
    };

    try {
      const updated = await updateVPNStatus(vpn.id, payload);

      // Mutate reference in list
      Object.assign(vpn, updated);

      // Toast on status change
      if (newStatus !== prevStatus && prevStatus !== 'unknown') {
        const toastType = newStatus === 'healthy' ? 'success'
          : newStatus === 'degraded' ? 'warning' : 'error';
        showToast(toastType, vpn.name,
          `Status changed: ${prevStatus} → ${newStatus}`);
      }

      // Live log entry
      const latMsg = newStatus === 'down'
        ? 'Connection lost'
        : `Latency: ${latency_source}ms → VPN${vpn.monitor_type !== 'infrastructure' ? ` → ${latency_dest}ms` : ''}`;
      if (newStatus !== prevStatus && prevStatus !== 'unknown') {
        onLog?.(newStatus, vpn.name, `Status changed: ${prevStatus} → ${newStatus}. ${latMsg}`, vpn.id);
      } else {
        onLog?.('check', vpn.name, latMsg, vpn.id);
      }
    } catch {
      // Silently skip — network error already toasted by api.js
    }
  }

  // Notify app to re-render
  onUpdate?.();
}

/** Start the health monitor */
export function startHealthMonitor(vpns, updateCallback, logCallback) {
  vpnListRef = vpns;
  onUpdate   = updateCallback;
  onLog      = logCallback || null;
  stopHealthMonitor();
  timerId = setInterval(runCheckCycle, CHECK_INTERVAL_MS);
  console.log('[Health] Monitor started — interval:', CHECK_INTERVAL_MS, 'ms');
}

/** Stop the health monitor */
export function stopHealthMonitor() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

/** Update the VPN list reference (call when list is refreshed) */
export function updateVPNList(vpns) {
  vpnListRef = vpns;
}

/** Trigger an immediate check for a single VPN (used by "Check Now" button) */
export async function checkNow(vpn, updateCallback) {
  ensureState(vpn);
  const state = vpnState.get(vpn.id);
  const prevStatus = vpn.status || 'unknown';
  const newStatus  = nextStatus(prevStatus, state);
  const { latency_source, latency_dest } = simulateLatency(vpn, newStatus, state);
  const newUptime = Math.min(100, Math.max(0, (vpn.uptime ?? 100) + (newStatus === 'healthy' ? 0.01 : -0.1)));

  const payload = { status: newStatus, latency_source, latency_dest, uptime: parseFloat(newUptime.toFixed(2)) };

  try {
    const updated = await updateVPNStatus(vpn.id, payload);
    Object.assign(vpn, updated);

    const toastType = newStatus === 'healthy' ? 'success' : newStatus === 'degraded' ? 'warning' : 'error';
    showToast(toastType, vpn.name, `Manual check: ${newStatus}`);

    updateCallback?.();
    return updated;
  } catch {
    // Error toasted in api.js
    return null;
  }
}
