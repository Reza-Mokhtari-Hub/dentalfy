const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.get('/posts', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, author_id, title, excerpt, content, category, category_label, image_url, published, created_at, updated_at FROM posts WHERE published = TRUE ORDER BY created_at DESC'
    );
    res.json({ ok: true, posts: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/posts/:id', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, author_id, title, excerpt, content, category, category_label, image_url, published, created_at, updated_at FROM posts WHERE id = $1 AND published = TRUE',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'پست یافت نشد.' });
    }
    res.json({ ok: true, post: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/author-requests', async (req, res, next) => {
  try {
    const { fullName, email, university, expertise, message } = req.body;
    if (!fullName || !email) {
      return res.status(400).json({ ok: false, error: 'نام و ایمیل الزامی است.' });
    }
    await query(
      'INSERT INTO author_requests (full_name, email, university, expertise, message) VALUES ($1, $2, $3, $4, $5)',
      [String(fullName).trim(), String(email).trim().toLowerCase(), String(university || '').trim(), String(expertise || '').trim(), String(message || '').trim()]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/feedback', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ ok: false, error: 'نام، ایمیل، موضوع و پیام الزامی است.' });
    }
    await query(
      'INSERT INTO feedback_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)',
      [String(name).trim(), String(email).trim().toLowerCase(), String(subject).trim(), String(message).trim()]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
