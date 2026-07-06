/**
 * Two-Factor Authentication (TOTP) Implementation
 * 
 * Uses Time-based One-Time Password (TOTP) algorithm
 * Compatible with Google Authenticator, Microsoft Authenticator, etc.
 */

const crypto = require('crypto');

// Pure JS Base32 Implementation (RFC 4648)
const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buffer) {
  let length = buffer.length;
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += RFC4648_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input) {
  let cleaned = input.toUpperCase().replace(/=+$/, '');
  let length = cleaned.length;
  let bits = 0;
  let value = 0;
  let index = 0;
  let output = Buffer.alloc(((length * 5) / 8) | 0);
  for (let i = 0; i < length; i++) {
    value = (value << 5) | RFC4648_ALPHABET.indexOf(cleaned[i]);
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output;
}

const TOTP_WINDOW = 1; // Accept codes from -1 to +1 time window (30 seconds each)
const TOTP_TIME_STEP = 30; // Time step in seconds
const TOTP_DIGITS = 6; // Number of digits in OTP

/**
 * Generate a new TOTP secret
 */
function generateTOTPSecret(email, siteName = 'DentalAcademy') {
  const bytes = crypto.randomBytes(20);
  const secret = base32Encode(bytes);
  
  // Generate QR code URI for authenticator apps
  const otpauthUri = `otpauth://totp/${encodeURIComponent(`${siteName}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(siteName)}`;
  
  return {
    secret,
    otpauthUri,
  };
}

/**
 * Generate current TOTP code
 */
function generateTOTP(secret, timestamp = Date.now()) {
  const buffer = base32Decode(secret);
  const counter = Math.floor(timestamp / 1000 / TOTP_TIME_STEP);
  
  const hmac = crypto.createHmac('sha1', buffer);
  hmac.update(Buffer.alloc(8));
  
  // Write counter as big-endian
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter), 0);
  
  const hmacResult = crypto.createHmac('sha1', buffer);
  hmacResult.update(counterBuffer);
  const hash = hmacResult.digest();
  
  const offset = hash[hash.length - 1] & 0x0f;
  const otp = (hash.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, TOTP_DIGITS);
  
  return String(otp).padStart(TOTP_DIGITS, '0');
}

/**
 * Verify TOTP code
 */
function verifyTOTP(secret, code, timestamp = Date.now()) {
  const window = TOTP_WINDOW;
  
  // Check current and adjacent time windows
  for (let i = -window; i <= window; i++) {
    const testTime = timestamp + i * TOTP_TIME_STEP * 1000;
    const testCode = generateTOTP(secret, testTime);
    
    if (testCode === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * Middleware to require TOTP for sensitive operations
 */
function requireTOTP(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'ابتدا وارد شوید.' });
  }
  
  if (!req.user.totp_enabled) {
    // If TOTP is not enabled, skip
    return next();
  }
  
  const code = req.headers['x-totp-code'];
  
  if (!code) {
    return res.status(403).json({ ok: false, error: 'کد دو فاکتور مورد نیاز است.' });
  }
  
  if (!verifyTOTP(req.user.totp_secret, code)) {
    return res.status(403).json({ ok: false, error: 'کد دو فاکتور اشتباه است.' });
  }
  
  next();
}

module.exports = {
  generateTOTPSecret,
  generateTOTP,
  verifyTOTP,
  requireTOTP,
};
