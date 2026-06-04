'use strict';
const mysql = require('mysql2/promise');

let _pool = null;

function getPool() {
  if (!_pool) {
    _pool = mysql.createPool({
      host:               process.env.MYSQL_HOST || 'localhost',
      port:               parseInt(process.env.MYSQL_PORT) || 3306,
      database:           process.env.MYSQL_DB   || 'prismo_db',
      user:               process.env.MYSQL_USER || 'root',
      password:           process.env.MYSQL_PASS || '',
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
      timezone:           '-06:00',
      connectTimeout:     10_000,
      enableKeepAlive:    true,
      keepAliveInitialDelay: 30_000,
    });

    _pool.getConnection()
      .then(conn => {
        console.log(`[DB] ✓ Conectado a ${process.env.MYSQL_HOST}/${process.env.MYSQL_DB}`);
        conn.release();
      })
      .catch(err => {
        console.error(`[DB] ✗ Error de conexión:`, err.message);
      });
  }
  return _pool;
}

/**
 * Execute a parameterized query.
 * Returns [rows, fields].
 */
async function query(sql, params = []) {
  return getPool().execute(sql, params);
}

/**
 * Get a connection from the pool for transactions.
 */
async function getConnection() {
  return getPool().getConnection();
}

module.exports = { getPool, query, getConnection };
