-- VPN Monitor Database Schema
-- Run this file against your vpn_monitor database to initialize the schema.

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

-- Auto-update updated_at on row change
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
