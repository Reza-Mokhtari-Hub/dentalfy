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
const port = process.env.PORT || 4000;
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: function (reqOrigin, callback) {
      if (!reqOrigin || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1') || reqOrigin === origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
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

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Dental Academy API is running.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal server error.' });
});

async function start() {
  await initializeSchema();
  await ensureSiteSettings();
  await ensureAdminUser();
  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
    console.log(`Allowed origin: ${origin}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
