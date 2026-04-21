// backend/src/db/pool.js
// Exports a shared MySQL connection pool used across the app

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'name_change_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
});

// Verify connectivity on startup
pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL connected');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] MySQL connection failed:', err.message);
  });

module.exports = pool;
