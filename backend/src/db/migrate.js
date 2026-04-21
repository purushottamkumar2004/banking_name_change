// backend/src/db/migrate.js
// Run: node src/db/migrate.js
// Creates all required tables in MySQL

require('dotenv').config();
const mysql = require('mysql2/promise');

const TABLES = {
  customers: `
    CREATE TABLE IF NOT EXISTS customers (
      customer_id   VARCHAR(50)   PRIMARY KEY,
      full_name     VARCHAR(255)  NOT NULL,
      date_of_birth DATE,
      account_no    VARCHAR(50),
      branch        VARCHAR(100),
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  verification_requests: `
    CREATE TABLE IF NOT EXISTS verification_requests (
      id                VARCHAR(36)   PRIMARY KEY,
      customer_id       VARCHAR(100)  NOT NULL,
      old_name          VARCHAR(255)  NOT NULL,
      new_name          VARCHAR(255)  NOT NULL,
      document_url      TEXT,
      extracted_json_url TEXT,
      score_card_json    JSON,
      status            ENUM(
        'PROCESSING',
        'AI_VERIFIED_PENDING_HUMAN',
        'APPROVED',
        'REJECTED',
        'FAILED'
      ) NOT NULL DEFAULT 'PROCESSING',
      overall_score     DECIMAL(5,2),
      fraud_score       DECIMAL(5,2),
      confidence_level  ENUM('LOW','MEDIUM','HIGH'),
      ai_summary        TEXT,
      recommendation    VARCHAR(50),
      action_by         VARCHAR(100),
      action_at         DATETIME,
      rejection_reason  TEXT,
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customer_id  (customer_id),
      INDEX idx_status       (status),
      INDEX idx_created_at   (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  field_scores: `
    CREATE TABLE IF NOT EXISTS field_scores (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      request_id    VARCHAR(36)   NOT NULL,
      field_name    VARCHAR(100)  NOT NULL,
      extracted_value TEXT,
      score         DECIMAL(5,2),
      status        ENUM('PASS','WARN','FAIL') NOT NULL DEFAULT 'WARN',
      reason        TEXT,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_request_id (request_id),
      FOREIGN KEY (request_id) REFERENCES verification_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  fraud_signals: `
    CREATE TABLE IF NOT EXISTS fraud_signals (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      request_id    VARCHAR(36)   NOT NULL,
      signal_type   VARCHAR(100)  NOT NULL,
      score         DECIMAL(5,2),
      severity      ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
      details       TEXT,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_request_id (request_id),
      FOREIGN KEY (request_id) REFERENCES verification_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  audit_logs: `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      request_id    VARCHAR(36)   NOT NULL,
      agent_name    VARCHAR(100)  NOT NULL,
      input_data    JSON,
      output_data   JSON,
      duration_ms   INT UNSIGNED,
      status        ENUM('SUCCESS','ERROR') NOT NULL DEFAULT 'SUCCESS',
      error_message TEXT,
      timestamp     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_request_id (request_id),
      INDEX idx_agent_name (agent_name),
      FOREIGN KEY (request_id) REFERENCES verification_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
};

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    // Create DB if not exists
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'name_change_db'}\``);
    await conn.query(`USE \`${process.env.DB_NAME || 'name_change_db'}\``);

    console.log('Running migrations...');
    for (const [name, sql] of Object.entries(TABLES)) {
      await conn.query(sql);
      console.log(`  ✓ ${name}`);
    }
    console.log('Migration complete.');
  } finally {
    await conn.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
