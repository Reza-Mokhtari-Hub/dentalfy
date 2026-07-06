/**
 * Simple in-memory rate limiter for login endpoint
 * در production باید Redis استفاده شود
 */

const loginAttempts = new Map(); // IP -> { count: number, resetTime: number }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 دقیقه

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.socket.remoteAddress || 
         req.connection.remoteAddress;
}

function checkRateLimit(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();
  
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 0, resetTime: now + LOCKOUT_DURATION });
  }
  
  const attempt = loginAttempts.get(ip);
  
  // اگر زمان قفل تمام شده، reset کن
  if (now >= attempt.resetTime) {
    attempt.count = 0;
    attempt.resetTime = now + LOCKOUT_DURATION;
  }
  
  // اگر بیش از حد تلاش شد، block کن
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    const remainingTime = Math.ceil((attempt.resetTime - now) / 1000);
    return res.status(429).json({ 
      ok: false, 
      error: `بیش از حد تلاش کردید. لطفاً ${Math.ceil(remainingTime / 60)} دقیقه بعد دوبارہ سعی کنید.`
    });
  }
  
  // Store reference برای increment در صورت login failure
  req.loginAttempt = attempt;
  req.clientIP = ip;
  
  next();
}

function recordFailedLogin(req) {
  if (req.loginAttempt) {
    req.loginAttempt.count++;
  }
}

function recordSuccessfulLogin(req) {
  const ip = req.clientIP;
  if (ip && loginAttempts.has(ip)) {
    loginAttempts.delete(ip);
  }
}

module.exports = {
  checkRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin,
};
