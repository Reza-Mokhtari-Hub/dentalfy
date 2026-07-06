const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function normalizePostRow(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    categoryLabel: row.category_label,
    imageUrl: row.image_url,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/posts', async (req, res, next) => {
  try {
    const sql = req.user.role === 'admin'
      ? 'SELECT * FROM posts ORDER BY created_at DESC'
      : 'SELECT * FROM posts WHERE author_id = $1 ORDER BY created_at DESC';
    const values = req.user.role === 'admin' ? [] : [req.user.id];
    const result = await query(sql, values);
    res.json({ ok: true, posts: result.rows.map(normalizePostRow) });
  } catch (error) {
    next(error);
  }
});

router.get('/posts/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    const post = result.rows[0];
    if (!post) {
      return res.status(404).json({ ok: false, error: 'پست یافت نشد.' });
    }
    if (req.user.role !== 'admin' && post.author_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'به این پست دسترسی ندارید.' });
    }
    res.json({ ok: true, post: normalizePostRow(post) });
  } catch (error) {
    next(error);
  }
});

router.post('/posts', async (req, res, next) => {
  try {
    const { title, excerpt, content, category, categoryLabel, imageUrl, published } = req.body;
    if (!title || !excerpt || !category) {
      return res.status(400).json({ ok: false, error: 'عنوان، خلاصه و دسته‌بندی الزامی است.' });
    }
    const thePublished = req.user.role === 'admin' ? Boolean(published) : false;
    const result = await query(
      `INSERT INTO posts (author_id, title, excerpt, content, category, category_label, image_url, published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [req.user.id, String(title).trim(), String(excerpt).trim(), String(content || '').trim(), String(category).trim(), String(categoryLabel || category).trim(), String(imageUrl || '').trim(), thePublished]
    );
    res.json({ ok: true, post: normalizePostRow(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.patch('/posts/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    const post = result.rows[0];
    if (!post) {
      return res.status(404).json({ ok: false, error: 'پست یافت نشد.' });
    }
    if (req.user.role !== 'admin' && post.author_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'به این پست دسترسی ندارید.' });
    }
    const title = req.body.title ? String(req.body.title).trim() : post.title;
    const excerpt = req.body.excerpt ? String(req.body.excerpt).trim() : post.excerpt;
    const content = req.body.content !== undefined ? String(req.body.content).trim() : post.content;
    const category = req.body.category ? String(req.body.category).trim() : post.category;
    const categoryLabel = req.body.categoryLabel ? String(req.body.categoryLabel).trim() : post.category_label;
    const imageUrl = req.body.imageUrl !== undefined ? String(req.body.imageUrl).trim() : post.image_url;
    const published = req.user.role === 'admin' ? Boolean(req.body.published ?? post.published) : post.published;

    const update = await query(
      `UPDATE posts SET title = $1, excerpt = $2, content = $3, category = $4, category_label = $5, image_url = $6, published = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [title, excerpt, content, category, categoryLabel, imageUrl, published, req.params.id]
    );
    res.json({ ok: true, post: normalizePostRow(update.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.delete('/posts/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    const post = result.rows[0];
    if (!post) {
      return res.status(404).json({ ok: false, error: 'پست یافت نشد.' });
    }
    if (req.user.role !== 'admin' && post.author_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'به این پست دسترسی ندارید.' });
    }
    await query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/requests', requireAdmin, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM author_requests ORDER BY submitted_at DESC');
    res.json({ ok: true, requests: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const requestResult = await query('SELECT * FROM author_requests WHERE id = $1', [requestId]);
    const request = requestResult.rows[0];
    if (!request) {
      return res.status(404).json({ ok: false, error: 'درخواست یافت نشد.' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, error: 'این درخواست قبلاً بررسی شده است.' });
    }

    const password = Math.random().toString(36).slice(2, 10) + 'A1';
    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await query(
      'INSERT INTO users (email, password_hash, name, role, active, university, expertise) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, name, role, active',
      [request.email.toLowerCase(), passwordHash, request.full_name, 'author', true, request.university, request.expertise]
    );

    await query('UPDATE author_requests SET status = $1, resolved_by = $2, user_id = $3, resolved_at = NOW() WHERE id = $4', [
      'approved', req.user.id, userResult.rows[0].id, requestId,
    ]);

    res.json({ ok: true, author: userResult.rows[0], password });
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const note = String(req.body.note || 'درخواست رد شد.');
    const requestResult = await query('SELECT id, status FROM author_requests WHERE id = $1', [requestId]);
    if (requestResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'درخواست یافت نشد.' });
    }
    if (requestResult.rows[0].status !== 'pending') {
      return res.status(400).json({ ok: false, error: 'این درخواست قبلاً بررسی شده است.' });
    }
    await query('UPDATE author_requests SET status = $1, resolved_by = $2, resolved_at = NOW(), message = $3 WHERE id = $4', [
      'rejected', req.user.id, note, requestId,
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/feedback', requireAdmin, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM feedback_messages ORDER BY created_at DESC');
    res.json({ ok: true, feedback: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/feedback/:id/reply', requireAdmin, async (req, res, next) => {
  try {
    const messageId = req.params.id;
    const { response } = req.body;
    const result = await query('SELECT id FROM feedback_messages WHERE id = $1', [messageId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'پیام یافت نشد.' });
    }
    await query(
      'UPDATE feedback_messages SET status = $1, response = $2, responder_id = $3, responded_at = NOW() WHERE id = $4',
      [response ? 'responded' : 'closed', String(response || '').trim(), req.user.id, messageId]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications', requireAdmin, async (req, res, next) => {
  try {
    const { title, body, targetRole } = req.body;
    if (!title || !body) {
      return res.status(400).json({ ok: false, error: 'عنوان و متن اعلان لازم است.' });
    }
    const role = ['admin', 'author', 'all'].includes(targetRole) ? targetRole : 'author';
    await query(
      'INSERT INTO notifications (title, body, target_role, sent_by) VALUES ($1, $2, $3, $4)',
      [String(title).trim(), String(body).trim(), role, req.user.id]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      const result = await query('SELECT * FROM notifications ORDER BY created_at DESC');
      return res.json({ ok: true, notifications: result.rows });
    }
    const result = await query('SELECT n.*, COALESCE(r.read_at IS NOT NULL, false) AS read FROM notifications n LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = $1 WHERE n.target_role IN ($2, $3) ORDER BY n.created_at DESC', [req.user.id, req.user.role, 'all']);
    res.json({ ok: true, notifications: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    await query(
      'INSERT INTO notification_reads (notification_id, user_id, read_at) VALUES ($1, $2, NOW()) ON CONFLICT (notification_id, user_id) DO NOTHING',
      [notificationId, req.user.id]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/authors', requireAdmin, async (req, res, next) => {
  try {
    const result = await query('SELECT id, email, name, active, university, expertise, created_at FROM users WHERE role = $1 ORDER BY created_at DESC', ['author']);
    res.json({ ok: true, authors: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
