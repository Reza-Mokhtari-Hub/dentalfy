/**
 * Password Strength Validation
 * 
 * Requirements:
 * - Minimum 8 characters (preferably 12)
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character (!@#$%^&*)
 */

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*',
};

/**
 * Validate password strength
 * Returns { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
  const errors = [];
  
  if (!password || password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`حداقل ${PASSWORD_REQUIREMENTS.minLength} کاراکتر مورد نیاز است.`);
  }
  
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('حداقل یک حرف بزرگ مورد نیاز است.');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('حداقل یک حرف کوچک مورد نیاز است.');
  }
  
  if (PASSWORD_REQUIREMENTS.requireDigit && !/\d/.test(password)) {
    errors.push('حداقل یک عدد مورد نیاز است.');
  }
  
  if (PASSWORD_REQUIREMENTS.requireSpecial) {
    const specialPattern = new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
    if (!specialPattern.test(password)) {
      errors.push(`حداقل یک کاراکتر خاص (${PASSWORD_REQUIREMENTS.specialChars}) مورد نیاز است.`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    strength: calculateStrength(password),
  };
}

/**
 * Calculate password strength: weak, medium, strong
 */
function calculateStrength(password) {
  if (!password) return 'weak';
  
  let score = 0;
  
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*]/.test(password)) score += 1;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

/**
 * Generate strong random password
 */
function generateStrongPassword(length = 12) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  
  const all = lowercase + uppercase + digits + special;
  
  let password = '';
  
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

module.exports = {
  validatePasswordStrength,
  calculateStrength,
  generateStrongPassword,
  PASSWORD_REQUIREMENTS,
};
