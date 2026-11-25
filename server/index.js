require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const panelRoutes = require('./routes/panel');
const siteRoutes = require('./routes/site');
const { initializeSchema, ensureSiteSettings, ensureAdminUser } = require('./init');
const { verifyCSRFToken } = require('./middleware/csrf');

const app = express();
const port = process.env.PORT || 3000;
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';

app.use(helmet({
  contentSecurityPolicy: false // Disable CSP so local scripts and iframe previews load correctly
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: function (reqOrigin, callback) {
      if (!reqOrigin || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1') || reqOrigin.includes('run.app') || reqOrigin === origin) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// CSRF protection برای POST/PATCH/DELETE endpoints
app.use('/api/v1/auth', verifyCSRFToken);
app.use('/api/v1/panel', verifyCSRFToken);
app.use('/api/v1/site', verifyCSRFToken);

app.use('/api/v1', publicRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/panel', panelRoutes);
app.use('/api/v1/site', siteRoutes);

const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal server error.' });
});

async function start() {
  await initializeSchema();
  await ensureSiteSettings();
  await ensureAdminUser();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is listening on port ${port}`);
    console.log(`Allowed origin: ${origin}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
