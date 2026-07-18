require('dotenv').config();
const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  logger.error(`[DB] Unexpected error on idle client: ${err.message}`, { stack: err.stack });
});

/**
 * Run a parameterized query against the pool.
 * @param {string} text - SQL query string
 * @param {Array}  params - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      logger.info(`[DB] query(${duration}ms): ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
    }
    return res;
  } catch (err) {
    logger.error(`[DB] Query error: ${err.message}`, { sql: text, stack: err.stack });
    throw err;
  }
}

/**
 * Initialize schema — creates tables if they don't exist.
 */
async function initSchema() {
  const sql = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS vpns (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name            VARCHAR(100) NOT NULL,
      protocol        VARCHAR(20)  NOT NULL CHECK (protocol IN ('WireGuard', 'OpenVPN', 'IPSec', 'L2TP')),
      source_ip       VARCHAR(45),
      vpn_server_ip   VARCHAR(45)  NOT NULL,
      destination_ip  VARCHAR(45),
      monitor_type    VARCHAR(20)  NOT NULL DEFAULT 'end-to-end' CHECK (monitor_type IN ('end-to-end', 'infrastructure')),
      port            INTEGER      CHECK (port BETWEEN 1 AND 65535),
      location        VARCHAR(100),
      description     TEXT,
      status          VARCHAR(20)  NOT NULL DEFAULT 'unknown'
                          CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
      latency_source  INTEGER      DEFAULT 0,
      latency_dest    INTEGER      DEFAULT 0,
      uptime          REAL         DEFAULT 100.0,
      last_checked    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS set_updated_at ON vpns;
    CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON vpns
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        
    -- Migration for existing databases
    DO $$ 
    BEGIN
        -- Add monitor_type column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vpns' AND column_name='monitor_type') THEN
            ALTER TABLE vpns ADD COLUMN monitor_type VARCHAR(20) NOT NULL DEFAULT 'end-to-end' CHECK (monitor_type IN ('end-to-end', 'infrastructure'));
        END IF;
        
        -- Drop NOT NULL from source_ip
        ALTER TABLE vpns ALTER COLUMN source_ip DROP NOT NULL;
        
        -- Drop NOT NULL from destination_ip
        ALTER TABLE vpns ALTER COLUMN destination_ip DROP NOT NULL;
        
        -- Drop NOT NULL from port
        ALTER TABLE vpns ALTER COLUMN port DROP NOT NULL;
    END $$;
  `;
  await query(sql);
  logger.info('[DB] Schema initialized.');
}

module.exports = { query, initSchema, pool };
