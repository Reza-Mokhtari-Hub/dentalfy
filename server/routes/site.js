const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM site_settings WHERE id = 1');
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'تنظیمات سایت یافت نشد.' });
    }
    res.json({ ok: true, site: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const fields = ['site_name', 'site_name_bold', 'tagline', 'hero_title', 'hero_highlight', 'hero_lead', 'contact_email', 'footer_text', 'powered_by', 'stat_courses', 'stat_posts', 'stat_members', 'primary_color'];
    const updates = [];
    const values = [];
    let idx = 1;

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(String(req.body[field]).trim());
        idx += 1;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'هیچ داده‌ای برای بروزرسانی ارسال نشده است.' });
    }

    values.push(1);
    await query(`UPDATE site_settings SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, values);
    const result = await query('SELECT * FROM site_settings WHERE id = 1');
    res.json({ ok: true, site: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
