/**
 * Session Management with Refresh Tokens
 * 
 * Keeps track of active sessions
 * Supports refresh token rotation
 * Stores session metadata (IP, User-Agent, etc.)
 */

const crypto = require('crypto');
const { query } = require('../db');

const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
const REFRESH_TOKEN_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Create session record in database
 */
async function createSession(userId, ipAddress, userAgent) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const refreshToken = crypto.randomBytes(32).toString('hex');
  
  const result = await query(
    `INSERT INTO sessions (user_id, session_id, refresh_token, ip_address, user_agent, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 minutes', NOW())
     RETURNING session_id, refresh_token, expires_at`,
    [userId, sessionId, refreshToken, ipAddress, userAgent]
  );
  
  return result.rows[0];
}

/**
 * Verify session is still valid
 */
async function verifySession(sessionId, userId, ipAddress) {
  const result = await query(
    `SELECT * FROM sessions 
     WHERE session_id = $1 AND user_id = $2 AND ip_address = $3 AND expires_at > NOW()`,
    [sessionId, userId, ipAddress]
  );
  
  return result.rows.length > 0;
}

/**
 * Refresh session - extend token and optionally rotate refresh token
 */
async function refreshSession(refreshToken, userId) {
  const result = await query(
    `UPDATE sessions 
     SET expires_at = NOW() + INTERVAL '30 minutes',
         refresh_token = $1,
         refreshed_at = NOW()
     WHERE refresh_token = $2 AND user_id = $3 AND expires_at > NOW()
     RETURNING session_id, refresh_token, expires_at`,
    [crypto.randomBytes(32).toString('hex'), refreshToken, userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Invalid or expired refresh token');
  }
  
  return result.rows[0];
}

/**
 * Invalidate all sessions for a user (e.g., after password change)
 */
async function invalidateUserSessions(userId) {
  await query(
    `DELETE FROM sessions WHERE user_id = $1`,
    [userId]
  );
}

/**
 * Invalidate specific session
 */
async function invalidateSession(sessionId, userId) {
  await query(
    `DELETE FROM sessions WHERE session_id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
}

/**
 * Get all active sessions for a user
 */
async function getUserSessions(userId) {
  const result = await query(
    `SELECT session_id, ip_address, user_agent, created_at, last_activity_at 
     FROM sessions 
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  
  return result.rows;
}

module.exports = {
  createSession,
  verifySession,
  refreshSession,
  invalidateUserSessions,
  invalidateSession,
  getUserSessions,
};
