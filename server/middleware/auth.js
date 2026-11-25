const jwt = require('jsonwebtoken');
const { query } = require('../db');

const AUTH_COOKIE_NAME = 'dental_auth';

function clearAuthCookie(res) {
  const req = res.req;
  const isSecure = req && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: !!isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    path: '/',
  });
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1800s',
  });
}

function sendAuthCookie(res, user) {
  const token = signToken({ id: user.id, role: user.role });
  const req = res.req;
  const isSecure = req && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: !!isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    path: '/',
    maxAge: 1000 * 60 * 30,
  });
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[AUTH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ ok: false, error: 'لطفاً ابتدا وارد شوید.' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, email, name, role, active, avatar_url, expertise, university FROM users WHERE id = $1',
      [payload.id]
    );
    const user = result.rows[0];
    if (!user || !user.active) {
      clearAuthCookie(res);
      return res.status(401).json({ ok: false, error: 'دسترسی نامعتبر یا منقضی شده است.' });
    }
    req.user = user;
    next();
  } catch (error) {
    clearAuthCookie(res);
    return res.status(401).json({ ok: false, error: 'توکن نامعتبر است.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'فقط مدیر اجازه دارد.' });
  }
  next();
}

function requireAuthorOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'لطفاً ابتدا وارد شوید.' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'author') {
    return res.status(403).json({ ok: false, error: 'دسترسی پیدا نشد.' });
  }
  next();
}

module.exports = {
  clearAuthCookie,
  sendAuthCookie,
  requireAuth,
  requireAdmin,
  requireAuthorOrAdmin,
};
