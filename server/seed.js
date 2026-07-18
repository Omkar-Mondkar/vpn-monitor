require('dotenv').config();
const { query, initSchema, pool } = require('./db');

const SAMPLE_VPNS = [
  {
    name: 'US East Production',
    protocol: 'WireGuard',
    source_ip: '192.168.1.100',
    vpn_server_ip: '45.33.22.11',
    destination_ip: '10.0.0.50',
    port: 51820,
    location: 'US-East (Virginia)',
    description: 'Primary production VPN for US East datacenter',
    status: 'healthy',
    latency_source: 12,
    latency_dest: 8,
    uptime: 99.8,
  },
  {
    name: 'EU West Gateway',
    protocol: 'OpenVPN',
    source_ip: '172.16.0.5',
    vpn_server_ip: '185.220.101.42',
    destination_ip: '10.10.1.20',
    port: 1194,
    location: 'EU-West (Frankfurt)',
    description: 'European gateway for GDPR-compliant traffic routing',
    status: 'degraded',
    latency_source: 45,
    latency_dest: 38,
    uptime: 97.2,
  },
  {
    name: 'APAC Secure Link',
    protocol: 'IPSec',
    source_ip: '10.50.0.1',
    vpn_server_ip: '103.86.96.100',
    destination_ip: '192.168.100.10',
    port: 500,
    location: 'APAC (Singapore)',
    description: 'Secure link for Asia-Pacific office connectivity',
    status: 'down',
    latency_source: 0,
    latency_dest: 0,
    uptime: 88.5,
  },
];

async function seed() {
  try {
    await initSchema();
    console.log('\n🌱 Seeding sample VPN data...\n');

    for (const vpn of SAMPLE_VPNS) {
      // Check if a VPN with the same name already exists
      const existing = await query('SELECT id FROM vpns WHERE name = $1', [vpn.name]);
      if (existing.rows.length) {
        console.log(`  ⏭️  Skipping "${vpn.name}" (already exists)`);
        continue;
      }

      await query(
        `INSERT INTO vpns
           (name, protocol, source_ip, vpn_server_ip, destination_ip, port, location, description,
            status, latency_source, latency_dest, uptime, last_checked)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
        [vpn.name, vpn.protocol, vpn.source_ip, vpn.vpn_server_ip, vpn.destination_ip,
         vpn.port, vpn.location, vpn.description,
         vpn.status, vpn.latency_source, vpn.latency_dest, vpn.uptime]
      );
      console.log(`  ✅ Created "${vpn.name}" (${vpn.protocol} — ${vpn.status})`);
    }

    console.log('\n✨ Seed complete! Open http://localhost:3000 to view the dashboard.\n');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    console.error('   Ensure PostgreSQL is running and DATABASE_URL is set in .env\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
