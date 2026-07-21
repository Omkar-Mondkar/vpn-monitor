/* ============================================================
   mailer.js — Email alert service for VPN failures
   Uses Nodemailer with Microsoft Outlook / Office 365 SMTP.

   SETUP:
   1. Use your full Outlook / Microsoft 365 email as SENDER_EMAIL.
   2. Use your account password (or an App Password if MFA is enabled).
      - For Microsoft 365 with MFA: create an App Password at
        https://mysignins.microsoft.com/security-info
      - For personal @outlook.com / @hotmail.com: use your normal
        password, or enable SMTP AUTH in account settings.
   ============================================================ */

const nodemailer = require('nodemailer');
const logger = require('./logger');

// ─── Hardcoded Mail Config ─────────────────────────────────────────────
const SENDER_EMAIL    = 'vpnmonitor@edelweiss.com';    // <-- Your Outlook / M365 address
const SENDER_PASSWORD = 'your-outlook-password-here';  // <-- Password or App Password
const RECEIVER_EMAIL  = 'admin@edelweiss.com';         // <-- Alert recipient

// ─── Alert cooldown (per VPN id) — 5 minutes ─────────────────────────────────
const COOLDOWN_MS = 5 * 60 * 1000;
const lastAlertMap = new Map(); // vpnId → timestamp of last alert

// ─── Transporter (Microsoft Outlook / Office 365) ──────────────────────────
const transporter = nodemailer.createTransport({
  host:   'smtp.office365.com', // Works for @outlook.com, @hotmail.com, and M365
  port:   587,
  secure: false,                // STARTTLS — Office 365 requires port 587 + STARTTLS
  auth: {
    user: SENDER_EMAIL,
    pass: SENDER_PASSWORD,
  },
  tls: {
    ciphers:            'SSLv3',
    rejectUnauthorized: false,  // Allow self-signed certs common in corp environments
  },
});

// ─── Status emoji helper ──────────────────────────────────────────────────────
function statusEmoji(status) {
  if (status === 'down')     return '🔴';
  if (status === 'degraded') return '🟡';
  return '✅';
}

/**
 * Send a failure alert email for a VPN.
 * @param {string} vpnId    - VPN UUID (used for cooldown keying)
 * @param {string} vpnName  - Human-readable VPN name
 * @param {string} status   - New status: 'down' | 'degraded'
 * @param {object} details  - { latency_source, latency_dest, uptime, vpn_server_ip }
 */
async function sendFailureAlert(vpnId, vpnName, status, details = {}) {
  // Only alert on failure states
  if (status !== 'down' && status !== 'degraded') return;

  // Cooldown check
  const last = lastAlertMap.get(vpnId);
  if (last && Date.now() - last < COOLDOWN_MS) {
    logger.info(`[Mailer] Skipping alert for "${vpnName}" — cooldown active (${Math.round((COOLDOWN_MS - (Date.now() - last)) / 1000)}s remaining)`);
    return;
  }

  lastAlertMap.set(vpnId, Date.now());

  const emoji = statusEmoji(status);
  const now   = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const latSrc = details.latency_source ?? 'N/A';
  const latDst = details.latency_dest   ?? 'N/A';
  const uptime  = details.uptime != null ? `${Number(details.uptime).toFixed(1)}%` : 'N/A';
  const serverIp = details.vpn_server_ip || 'N/A';

  const subject = `${emoji} VPN Alert: "${vpnName}" is ${status.toUpperCase()}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #080c18; color: #e8eaf6; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #0d1224; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
    .header { background: linear-gradient(135deg, #00e5ff 0%, #7c4dff 100%); padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 1.4rem; color: #fff; font-weight: 700; }
    .header p  { margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 0.9rem; }
    .body { padding: 28px 32px; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 0.9rem; letter-spacing: 0.05em; margin-bottom: 20px; }
    .status-down     { background: rgba(255,82,82,0.2);   color: #ff5252; border: 1px solid rgba(255,82,82,0.4); }
    .status-degraded { background: rgba(255,171,64,0.2);  color: #ffab40; border: 1px solid rgba(255,171,64,0.4); }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.875rem; }
    td:first-child { color: #546080; width: 140px; }
    td:last-child  { color: #e8eaf6; font-family: 'Courier New', monospace; font-weight: 600; }
    .footer { padding: 16px 32px; background: rgba(255,255,255,0.02); text-align: center; font-size: 0.75rem; color: #546080; border-top: 1px solid rgba(255,255,255,0.06); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ VPN Monitor Alert</h1>
      <p>Automated notification from VPN Monitor</p>
    </div>
    <div class="body">
      <div class="status-badge status-${status}">${emoji} ${status.toUpperCase()}</div>
      <table>
        <tr><td>VPN Name</td><td>${vpnName}</td></tr>
        <tr><td>Status</td><td>${status.charAt(0).toUpperCase() + status.slice(1)}</td></tr>
        <tr><td>Server IP</td><td>${serverIp}</td></tr>
        <tr><td>Latency (Src)</td><td>${latSrc}ms</td></tr>
        <tr><td>Latency (Dst)</td><td>${latDst}ms</td></tr>
        <tr><td>Uptime</td><td>${uptime}</td></tr>
        <tr><td>Detected At</td><td>${now}</td></tr>
      </table>
    </div>
    <div class="footer">
      VPN Monitor — Automated Alert System &nbsp;·&nbsp; Cooldown: 5 min per VPN
    </div>
  </div>
</body>
</html>`;

  const text = `VPN Alert: "${vpnName}" is ${status.toUpperCase()}\n\nServer IP: ${serverIp}\nLatency Src: ${latSrc}ms | Dst: ${latDst}ms\nUptime: ${uptime}\nDetected At: ${now}`;

  try {
    await transporter.sendMail({
      from: `"VPN Monitor" <${SENDER_EMAIL}>`,
      to:   RECEIVER_EMAIL,
      subject,
      html,
      text,
    });
    logger.info(`[Mailer] Alert sent for "${vpnName}" → ${status} (to: ${RECEIVER_EMAIL})`);
  } catch (err) {
    logger.error(`[Mailer] Failed to send alert for "${vpnName}": ${err.message}`);
  }
}

module.exports = { sendFailureAlert };
