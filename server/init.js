const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { query } = require('./db');

async function initializeSchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await query(schemaSql);
    console.log('Database schema synchronized successfully.');
  } catch (error) {
    console.error('Error synchronizing database schema:', error);
  }
}

async function ensureSiteSettings() {
  const result = await query('SELECT id FROM site_settings WHERE id = 1');
  if (result.rowCount === 0) {
    await query(
      `INSERT INTO site_settings (
        id, site_name, site_name_bold, tagline, hero_title, hero_highlight,
        hero_lead, contact_email, footer_text, powered_by, stat_courses,
        stat_posts, stat_members, primary_color
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        1,
        'اکادمی',
        'دندان',
        'پلتفرم آموزشی تخصصی',
        'یادگیری دروس دندانپزشکی،',
        'دقیق و حرفه‌ای',
        'منابع آموزشی ساختاریافته، خلاصه‌نویسی‌های کاربردی و فضایی برای اشتراک تجربه — همه در یک اکادمی مدرن برای دانشجویان و فارغ‌التحصیلان دندانپزشکی.',
        process.env.CONTACT_EMAIL || 'info@dental-academy.ir',
        'آموزش تخصصی دندانپزشکی برای نسل بعدی دندانپزشکان.',
        process.env.POWERED_BY || 'RMO',
        '۲۴+',
        '۱۲۰+',
        '۵۰۰+',
        '#0f8a85',
      ]
    );
  }
}

async function ensureAdminUser() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@rmo.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'rmo2026';
  const result = await query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
  if (result.rowCount === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await query(
      'INSERT INTO users (email, password_hash, name, role, active) VALUES ($1, $2, $3, $4, $5)',
      [adminEmail, passwordHash, 'مدیر RMO', 'admin', true]
    );
    console.log(`Admin account created: ${adminEmail}`);
  }
}

module.exports = {
  initializeSchema,
  ensureSiteSettings,
  ensureAdminUser,
};
