/**
 * CSRF Token Middleware
 * 
 * یک CSRF token تولید می‌کند و آن را در یک HTTP-only cookie ذخیره می‌کند.
 * فرانت‌اند باید این token را از cookie بخواند و در header ارسال کند.
 */

const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'dental_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

function generateCSRFToken() {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

function setCSRFToken(res) {
  const token = generateCSRFToken();
  const req = res.req;
  const isSecure = req && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // JavaScript can read
    secure: !!isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    path: '/',
    maxAge: 1000 * 60 * 60, // 1 hour
  });
  return token;
}

function verifyCSRFToken(req, res, next) {
  const tokenFromCookie = req.cookies[CSRF_COOKIE_NAME];
  const tokenFromHeader = req.headers[CSRF_HEADER_NAME];
  
  // اگر GET request باشد، نیاز نیست
  if (req.method === 'GET') {
    return next();
  }
  
  // اگر CSRF token نیست یا مطابقت ندارد
  if (!tokenFromCookie || !tokenFromHeader || tokenFromCookie !== tokenFromHeader) {
    return res.status(403).json({ ok: false, error: 'CSRF token نامعتبر است.' });
  }
  
  next();
}

module.exports = {
  generateCSRFToken,
  setCSRFToken,
  verifyCSRFToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
};
