const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { sendAuthCookie, clearAuthCookie, requireAuth } = require('../middleware/auth');
const { checkRateLimit, recordFailedLogin, recordSuccessfulLogin } = require('../middleware/rate-limiter');
const { setCSRFToken } = require('../middleware/csrf');
const { logLogin, logPasswordChange, getClientIP } = require('../middleware/audit');
const { isAccountLocked, recordFailedAttempt, recordSuccessfulAttempt, checkAndLockAccount, getAccountLockStatus } = require('../middleware/account-lockout');
const { validatePasswordStrength } = require('../middleware/password-validator');
const { generateTOTPSecret, verifyTOTP } = require('../middleware/totp');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { getUserSessions, invalidateSession, invalidateUserSessions } = require('../middleware/session-manager');

const router = express.Router();

// ساده‌تر پیام برای جلوگیری از user enumeration
const AUTH_ERROR_MSG = 'اطلاعات وارد‌شده صحیح نیست';

// CSRF token endpoint (GET - no CSRF needed)
router.get('/csrf-init', (req, res) => {
  setCSRFToken(res);
  res.json({ ok: true });
});

router.post('/login', checkRateLimit, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const ip = getClientIP(req);
    
    // بررسی ورودی
    if (!email || !password) {
      recordFailedLogin(req);
      return res.status(400).json({ ok: false, error: 'ایمیل و رمز عبور لازم است.' });
    }
    
    // Validation email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      recordFailedLogin(req);
      return res.status(400).json({ ok: false, error: AUTH_ERROR_MSG });
    }
    
    // Validation password length (بدون افشای حداقل طول)
    if (password.length < 6) {
      recordFailedLogin(req);
      return res.status(400).json({ ok: false, error: AUTH_ERROR_MSG });
    }
    
    // بررسی اگر حساب قفل است
    const locked = await isAccountLocked(email);
    if (locked) {
      const lockStatus = await getAccountLockStatus(email);
      recordFailedAttempt(email);
      return res.status(423).json({ 
        ok: false, 
        error: `حساب قفل شده است. لطفاً ${lockStatus.remainingMinutes} دقیقه بعد دوباره سعی کنید.`,
        lockedUntil: lockStatus.lockedUntil
      });
    }

    const result = await query(
      'SELECT id, email, password_hash, name, role, active, avatar_url, expertise, university FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    
    // بدون افشای user وجود دارد یا نه
    if (!user || !user.active) {
      // Delay برای جلوگیری از timing attack
      await new Promise(r => setTimeout(r, 100));
      recordFailedLogin(req);
      recordFailedAttempt(email);
      
      // Check and lock if needed
      await checkAndLockAccount(email);
      
      logLogin(req, null, email, false);
      return res.status(401).json({ ok: false, error: AUTH_ERROR_MSG });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Delay برای جلوگیری از timing attack
      await new Promise(r => setTimeout(r, 100));
      recordFailedLogin(req);
      recordFailedAttempt(email);
      
      // Check and lock if needed
      await checkAndLockAccount(email);
      
      logLogin(req, user.id, email, false);
      return res.status(401).json({ ok: false, error: AUTH_ERROR_MSG });
    }

    // موفق - reset failed attempts و audit log
    recordSuccessfulLogin(req);
    recordSuccessfulAttempt(email);
    logLogin(req, user.id, email, true);
    
    sendAuthCookie(res, user);
    return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatar_url, expertise: user.expertise, university: user.university } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ ok: false, error: 'خطای سرور' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    // اگر user authenticated بود، audit log کن
    if (req.user) {
      const { logLogout } = require('../middleware/audit');
      logLogout(req, req.user.id, req.user.email);
    }
    
    // Logout doesn't require valid auth - just clear the cookie regardless
    clearAuthCookie(res);
    res.json({ ok: true });
  } catch (error) {
    console.error('Logout error:', error);
    clearAuthCookie(res);
    res.json({ ok: true });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = req.user;
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatar_url, expertise: user.expertise, university: user.university } });
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;
    const email = req.user.email;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ ok: false, error: 'تمام فیلدها لازم است.' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ ok: false, error: 'رمزهای عبور مطابقت ندارند.' });
    }
    
    const { valid, errors } = validatePasswordStrength(newPassword);
    if (!valid) {
      return res.status(400).json({ ok: false, error: errors[0] });
    }
    
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    
    const currentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentValid) {
      logPasswordChange(req, userId, email, false);
      return res.status(401).json({ ok: false, error: 'رمز عبور فعلی صحیح نیست.' });
    }
    
    const newHash = await bcrypt.hash(newPassword, 12);
    
    await query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [newHash, userId]
    );
    
    await invalidateUserSessions(userId);
    
    logPasswordChange(req, userId, email, true);
    
    res.json({ ok: true, message: 'رمز عبور با موفقیت تغییر یافت.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ ok: false, error: 'خطای سرور' });
  }
});

router.post('/totp/setup', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    
    const secret = generateTOTPSecret(email, 'Dental App');
    
    const qrCodeUri = secret.otpauthUri;
    const qrCode = await QRCode.toDataURL(qrCodeUri);
    
    if (!req.session) req.session = {};
    req.session.pendingTOTPSecret = secret.secret;
    req.session.pendingTOTPEmail = email;
    
    res.json({
      ok: true,
      qrCode: qrCode,
      secret: secret.secret,
      message: 'Scan with Google Authenticator or similar app'
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    res.status(500).json({ ok: false, error: 'خطای سرور' });
  }
});

router.post('/totp/verify', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;
    const email = req.user.email;
    
    if (!code || !/^\\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'کد ۶ رقمی لازم است.' });
    }
    
    const secret = req.session && req.session.pendingTOTPSecret;
    if (!secret) {
      return res.status(400).json({ ok: false, error: 'ابتدا setup کنید.' });
    }
    
    const valid = verifyTOTP(secret, code);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'کد نادرست است.' });
    }
    
    await query(
      'UPDATE users SET totp_secret = $1, totp_enabled = TRUE, totp_verified_at = NOW() WHERE id = $2',
      [secret, userId]
    );
    
    const recoveryCodes = [];
    for (let i = 0; i < 5; i++) {
      const recoveryCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const hash = await bcrypt.hash(recoveryCode, 12);
      
      await query(
        'INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)',
        [userId, hash]
      );
      
      recoveryCodes.push(recoveryCode);
    }
    
    delete req.session.pendingTOTPSecret;
    delete req.session.pendingTOTPEmail;
    
    logPasswordChange(req, userId, email, true);
    
    res.json({
      ok: true,
      message: '2FA فعال شد.',
      recoveryCodes: recoveryCodes
    });
  } catch (error) {
    console.error('TOTP verify error:', error);
    res.status(500).json({ ok: false, error: 'خطای سرور' });
  }
});

router.post('/totp/disable', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    
    await query(
      'UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = $1',
      [userId]
    );
    
    await query('DELETE FROM recovery_codes WHERE user_id = $1', [userId]);
    
    logPasswordChange(req, userId, email, true);
    
    res.json({ ok: true, message: '2FA غیرفعال شد.' });
  } catch (error) {
    console.error('TOTP disable error:', error);
    res.status(500).json({ ok: false, error: 'خطای سرور' });
  }
});

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = await getUserSessions(userId);
    
    res.json({
      ok: true,
      sessions: sessions.map(s => ({
        id: s.session_id,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        createdAt: s.created_at,
        lastActivity: s.last_activity_at,
        isCurrent: req.sessionId === s.session_id
      }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ ok: false, error: 'خطای سرور' });
  }
});

router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.sessionId;
    
    await invalidateSession(sessionId, userId);
    
    res.json({ ok: true, message: 'سشن بسته شد.' });
  } catch (error) {
    console.error('Logout session error:', error);
    res.status(500).json({ ok: false, error: 'خطای سرور' });
  }
});

module.exports = router;
