const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { sendFailureAlert } = require('../mailer');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

function validateVPN(body) {
  const errors = [];
  if (!body.name || body.name.trim().length < 2)
    errors.push('Name must be at least 2 characters.');
  if (!['WireGuard', 'OpenVPN', 'IPSec', 'L2TP'].includes(body.protocol))
    errors.push('Protocol must be one of: WireGuard, OpenVPN, IPSec, L2TP.');
  
  if (!body.vpn_server_ip || !IP_REGEX.test(body.vpn_server_ip))
    errors.push('vpn_server_ip must be a valid IP address.');

  const monitorType = body.monitor_type || 'end-to-end';
  if (!['end-to-end', 'infrastructure'].includes(monitorType)) {
    errors.push('monitor_type must be end-to-end or infrastructure.');
  }

  if (monitorType === 'end-to-end') {
    if (!body.source_ip || !IP_REGEX.test(body.source_ip))
      errors.push('source_ip must be a valid IP address for end-to-end monitoring.');
    if (!body.destination_ip || !IP_REGEX.test(body.destination_ip))
      errors.push('destination_ip must be a valid IP address for end-to-end monitoring.');
  }

  if (monitorType === 'end-to-end' || body.port) {
    const port = parseInt(body.port, 10);
    if (isNaN(port) || port < 1 || port > 65535)
      errors.push('Port must be between 1 and 65535.');
  }
  return errors;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/vpns  — list all, optional ?status=healthy&search=text
router.get('/', async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.query.status && req.query.status !== 'all') {
      conditions.push(`status = $${idx++}`);
      params.push(req.query.status);
    }
    if (req.query.search) {
      conditions.push(`(name ILIKE $${idx} OR source_ip ILIKE $${idx} OR vpn_server_ip ILIKE $${idx} OR destination_ip ILIKE $${idx})`);
      params.push(`%${req.query.search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM vpns ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch VPNs.', detail: err.message });
  }
});

// GET /api/vpns/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vpns WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'VPN not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch VPN.', detail: err.message });
  }
});

// POST /api/vpns — create
router.post('/', async (req, res) => {
  const errors = validateVPN(req.body);
  if (errors.length) return res.status(400).json({ errors });

  try {
    const { name, protocol, source_ip, vpn_server_ip, destination_ip, monitor_type, port, location, description } = req.body;
    const mt = monitor_type || 'end-to-end';
    const result = await query(
      `INSERT INTO vpns (name, protocol, source_ip, vpn_server_ip, destination_ip, monitor_type, port, location, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name.trim(), protocol, 
        mt === 'end-to-end' ? source_ip.trim() : null, 
        vpn_server_ip.trim(), 
        mt === 'end-to-end' ? destination_ip.trim() : null, 
        mt,
        port ? parseInt(port, 10) : null, (location || '').trim() || null, (description || '').trim() || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create VPN.', detail: err.message });
  }
});

// PUT /api/vpns/:id — update
router.put('/:id', async (req, res) => {
  const errors = validateVPN(req.body);
  if (errors.length) return res.status(400).json({ errors });

  try {
    const { name, protocol, source_ip, vpn_server_ip, destination_ip, monitor_type, port, location, description } = req.body;
    const mt = monitor_type || 'end-to-end';
    const result = await query(
      `UPDATE vpns
       SET name=$1, protocol=$2, source_ip=$3, vpn_server_ip=$4, destination_ip=$5,
           monitor_type=$6, port=$7, location=$8, description=$9
       WHERE id=$10
       RETURNING *`,
      [
        name.trim(), protocol, 
        mt === 'end-to-end' ? source_ip.trim() : null, 
        vpn_server_ip.trim(), 
        mt === 'end-to-end' ? destination_ip.trim() : null, 
        mt,
        port ? parseInt(port, 10) : null, (location || '').trim() || null, (description || '').trim() || null,
        req.params.id
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'VPN not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update VPN.', detail: err.message });
  }
});

// DELETE /api/vpns/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM vpns WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'VPN not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete VPN.', detail: err.message });
  }
});

// POST /api/vpns/:id/check — trigger manual health check simulation
router.post('/:id/check', async (req, res) => {
  try {
    const existing = await query('SELECT * FROM vpns WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'VPN not found.' });

    // Simulate a health check
    const statuses = ['healthy', 'healthy', 'healthy', 'degraded', 'down'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const latencySource = Math.floor(Math.random() * 80) + 5;
    const latencyDest = Math.floor(Math.random() * 60) + 3;
    const uptime = parseFloat((95 + Math.random() * 5).toFixed(2));

    const result = await query(
      `UPDATE vpns
       SET status=$1, latency_source=$2, latency_dest=$3, uptime=$4, last_checked=NOW()
       WHERE id=$5
       RETURNING *`,
      [status, latencySource, latencyDest, uptime, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to run health check.', detail: err.message });
  }
});

// PATCH /api/vpns/:id/status — update health status fields from the monitor engine
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, latency_source, latency_dest, uptime } = req.body;
    const result = await query(
      `UPDATE vpns
       SET status=COALESCE($1, status),
           latency_source=COALESCE($2, latency_source),
           latency_dest=COALESCE($3, latency_dest),
           uptime=COALESCE($4, uptime),
           last_checked=NOW()
       WHERE id=$5
       RETURNING *`,
      [status || null, latency_source ?? null, latency_dest ?? null, uptime ?? null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'VPN not found.' });
    const vpn = result.rows[0];

    // ─── Mail alert on failure ─────────────────────────────────────────────
    if (status === 'down' || status === 'degraded') {
      sendFailureAlert(vpn.id, vpn.name, status, {
        latency_source: vpn.latency_source,
        latency_dest:   vpn.latency_dest,
        uptime:         vpn.uptime,
        vpn_server_ip:  vpn.vpn_server_ip,
      }).catch(() => {}); // fire-and-forget
    }

    res.json(vpn);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status.', detail: err.message });
  }
});

module.exports = router;
