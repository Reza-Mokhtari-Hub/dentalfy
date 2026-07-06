/**
 * Account Lockout Management
 * 
 * Lock accounts after multiple failed login attempts
 * Automatic unlock after cooldown period
 * Manual unlock by admin
 */

const { query } = require('../db');

const FAILED_ATTEMPTS_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_RESET_AFTER = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Record failed login attempt
 */
async function recordFailedAttempt(email) {
  await query(
    `INSERT INTO login_attempts (email, success, attempt_at)
     VALUES ($1, FALSE, NOW())`,
    [email.toLowerCase()]
  );
}

/**
 * Record successful login
 */
async function recordSuccessfulAttempt(email) {
  await query(
    `INSERT INTO login_attempts (email, success, attempt_at)
     VALUES ($1, TRUE, NOW())
     ON CONFLICT DO NOTHING`,
    [email.toLowerCase()]
  );
  
  // Clear lockout if exists
  await query(
    `DELETE FROM account_lockouts WHERE email = $1`,
    [email.toLowerCase()]
  );
}

/**
 * Check if account is locked
 */
async function isAccountLocked(email) {
  const result = await query(
    `SELECT * FROM account_lockouts 
     WHERE email = $1 AND locked_until > NOW()`,
    [email.toLowerCase()]
  );
  
  return result.rows.length > 0;
}

/**
 * Check failed attempts and lock if needed
 */
async function checkAndLockAccount(email) {
  const email_lower = email.toLowerCase();
  
  // Get recent failed attempts (last 24 hours)
  const result = await query(
    `SELECT COUNT(*) as count FROM login_attempts 
     WHERE email = $1 AND success = FALSE AND attempt_at > NOW() - INTERVAL '24 hours'`,
    [email_lower]
  );
  
  const failedAttempts = parseInt(result.rows[0].count);
  
  if (failedAttempts >= FAILED_ATTEMPTS_THRESHOLD) {
    // Check if already locked
    const locked = await query(
      `SELECT * FROM account_lockouts WHERE email = $1`,
      [email_lower]
    );
    
    if (locked.rows.length === 0) {
      // Lock account
      await query(
        `INSERT INTO account_lockouts (email, locked_until, locked_at, reason)
         VALUES ($1, NOW() + INTERVAL '15 minutes', NOW(), 'Too many failed login attempts')`,
        [email_lower]
      );
    }
    
    return true;
  }
  
  return false;
}

/**
 * Unlock account (admin action)
 */
async function unlockAccount(email) {
  await query(
    `DELETE FROM account_lockouts WHERE email = $1`,
    [email.toLowerCase()]
  );
}

/**
 * Get account lock status with remaining time
 */
async function getAccountLockStatus(email) {
  const result = await query(
    `SELECT locked_until, EXTRACT(EPOCH FROM (locked_until - NOW())) as remaining_seconds
     FROM account_lockouts 
     WHERE email = $1 AND locked_until > NOW()`,
    [email.toLowerCase()]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const remaining = Math.ceil(result.rows[0].remaining_seconds);
  return {
    lockedUntil: result.rows[0].locked_until,
    remainingSeconds: remaining,
    remainingMinutes: Math.ceil(remaining / 60),
  };
}

module.exports = {
  recordFailedAttempt,
  recordSuccessfulAttempt,
  isAccountLocked,
  checkAndLockAccount,
  unlockAccount,
  getAccountLockStatus,
  FAILED_ATTEMPTS_THRESHOLD,
  LOCKOUT_DURATION,
};
