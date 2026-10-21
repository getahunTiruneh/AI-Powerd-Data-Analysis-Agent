import { pool } from './db.js';

export async function logActivity(level, source, message, details = {}) {
  try {
    const logDetails = { ...details };
    
    // Capture IP address if not already present
    if (!logDetails.ip && logDetails.req) {
      let ip = logDetails.req.ip || logDetails.req.headers['x-forwarded-for'] || logDetails.req.connection.remoteAddress;
      // Normalize IPv6 loopback to IPv4
      if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1';
      }
      logDetails.ip = ip;
      delete logDetails.req;
    }
    
    await pool.query(
      `INSERT INTO logs (level, source, message, details) VALUES ($1, $2, $3, $4)`,
      [level, source, message, logDetails ? JSON.stringify(logDetails) : null]
    );
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export const LogSources = {
  AUTH: 'auth',
  DATA_MARTS: 'data_marts',
  CHAT: 'chat',
  ADMIN: 'admin',
  ASSIGNMENTS: 'assignments',
  NOTIFICATIONS: 'notifications',
};

export const LogLevels = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  DEBUG: 'debug',
};
