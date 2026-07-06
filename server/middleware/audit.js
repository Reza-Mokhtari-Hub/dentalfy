/**
 * Audit Logger - ثبت تمام فعالیت‌های حساس
 * Session login/logout, password changes, account modifications
 */

const fs = require('fs');
const path = require('path');

const AUDIT_LOG_FILE = path.join(__dirname, '../../audit.log');

function getTimestamp() {
  return new Date().toISOString();
}

function formatLog(action, userId, email, ip, details = {}) {
  return JSON.stringify({
    timestamp: getTimestamp(),
    action,
    userId,
    email,
    ip,
    details,
  });
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.socket.remoteAddress || 
         req.connection.remoteAddress;
}

function logLogin(req, userId, email, success = true) {
  const log = formatLog(
    success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE',
    userId,
    email,
    getClientIP(req),
    { success }
  );
  
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, log + '\n', 'utf-8');
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

function logLogout(req, userId, email) {
  const log = formatLog(
    'LOGOUT',
    userId,
    email,
    getClientIP(req)
  );
  
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, log + '\n', 'utf-8');
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

function logPasswordChange(req, userId, email, changed = true) {
  const log = formatLog(
    'PASSWORD_CHANGE',
    userId,
    email,
    getClientIP(req),
    { changed }
  );
  
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, log + '\n', 'utf-8');
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

function logAccountAction(req, action, userId, email, targetUserId = null) {
  const log = formatLog(
    action, // ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, ACCOUNT_DISABLED, etc.
    userId,
    email,
    getClientIP(req),
    { targetUserId }
  );
  
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, log + '\n', 'utf-8');
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

module.exports = {
  logLogin,
  logLogout,
  logPasswordChange,
  logAccountAction,
  getClientIP,
};
