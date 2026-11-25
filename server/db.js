const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const mockDbPath = path.join(__dirname, 'mock_db.json');

// --- LOCAL JSON FALLBACK SYSTEM ---
function initMockDb() {
  if (fs.existsSync(mockDbPath)) {
    try {
      return JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    } catch (e) {
      console.error('[Dentalfy DB] Error reading mock_db.json, recreating:', e);
    }
  }

  const defaultAdminPasswordHash = bcrypt.hashSync('rmo2026', 12);
  const data = {
    users: [
      {
        id: 'admin-rmo-uuid',
        email: 'admin@rmo.local',
        password_hash: defaultAdminPasswordHash,
        name: 'مدیر RMO',
        role: 'admin',
        active: true,
        avatar_url: '',
        expertise: null,
        university: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        totp_secret: null,
        totp_enabled: false,
        totp_verified_at: null,
        last_login_at: null,
        last_login_ip: null,
        password_changed_at: new Date().toISOString(),
        failed_login_count: 0,
        account_locked_until: null
      }
    ],
    site_settings: [
      {
        id: 1,
        site_name: 'اکادمی',
        site_name_bold: 'دندان',
        tagline: 'پلتفرم آموزشی تخصصی',
        hero_title: 'یادگیری دروس دندانپزشکی،',
        hero_highlight: 'دقیق و حرفه‌ای',
        hero_lead: 'منابع آموزشی ساختاریافته، خلاصهنویسیهای کاربردی و فضایی برای اشتراک تجربه — همه در یک اکادمی مدرن برای دانشجویان و فارغالتحصیلان دندانپزشکی.',
        contact_email: 'info@dental-academy.ir',
        footer_text: 'آموزش تخصصی دندانپزشکی برای نسل بعدی دندانپزشکان.',
        powered_by: 'RMO',
        stat_courses: '۲۴+',
        stat_posts: '۱۲۰+',
        stat_members: '۵۰۰+',
        primary_color: '#0f8a85',
        updated_at: new Date().toISOString()
      }
    ],
    posts: [
      {
        id: 'seed-1',
        author_id: 'admin-rmo-uuid',
        title: 'خلاصه آناتومی مولر اول بالا',
        excerpt: 'نقشه عصب‌ها، تاج و ریشه با نکات امتحانی عملی برای دانشجویان ترم ۳.',
        content: 'در این مطلب نقشه عصب‌ها، تاج و ریشه با نکات امتحانی عملی برای دانشجویان ترم ۳ مرور می‌شود.',
        category: 'anatomy',
        category_label: 'آناتومی',
        image_url: 'assets/images/post-anatomy.jpg',
        published: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    author_requests: [],
    feedback_messages: [],
    notifications: [],
    notification_reads: [],
    sessions: [],
    account_lockouts: [],
    login_attempts: [],
    audit_logs: [],
    recovery_codes: []
  };

  fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

let mockDb = initMockDb();

function saveMockDb() {
  try {
    fs.writeFileSync(mockDbPath, JSON.stringify(mockDb, null, 2), 'utf8');
  } catch (err) {
    console.error('[Dentalfy DB] Error writing mock_db.json:', err);
  }
}

// --- MONGODB SERVERLESS CONNECTOR WITH CONNECTION POOLING ---
let cachedClient = null;
let cachedDb = null;
let useMongo = false;

if (process.env.MONGODB_URI) {
  useMongo = true;
  console.log('[Dentalfy DB] MONGODB_URI environment variable detected. Integrating with MongoDB.');
} else {
  console.log('[Dentalfy DB] MONGODB_URI not set. Running with hybrid in-memory/JSON filesystem database.');
}

async function getMongoDb() {
  if (!useMongo) return null;
  if (cachedDb) return cachedDb;

  try {
    const client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10, // Optimize socket pool for high traffic and serverless execution
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });
    await client.connect();
    
    // Resolve DB Name from connection string or default to 'dentalfy'
    const dbName = new URL(process.env.MONGODB_URI).pathname.substring(1) || 'dentalfy';
    const db = client.db(dbName);
    
    cachedClient = client;
    cachedDb = db;
    
    // Pre-seed MongoDB if newly connected and empty
    await seedMongoDb(db);
    
    console.log(`[Dentalfy DB] Successfully established pooled connection to MongoDB database: "${dbName}"`);
    return db;
  } catch (err) {
    console.error('[Dentalfy DB] MongoDB connection failed, falling back to local JSON database:', err.message);
    useMongo = false;
    return null;
  }
}

// Ensure database is seeded with necessary records on first MongoDB load
async function seedMongoDb(db) {
  try {
    // 1. Seed site settings
    const siteSettings = db.collection('site_settings');
    const siteCount = await siteSettings.countDocuments();
    if (siteCount === 0) {
      await siteSettings.insertOne(mockDb.site_settings[0]);
      console.log('[Dentalfy DB] Seeded site_settings into MongoDB.');
    }

    // 2. Seed admin user
    const users = db.collection('users');
    const adminCount = await users.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      await users.insertOne(mockDb.users[0]);
      console.log('[Dentalfy DB] Seeded admin user into MongoDB.');
    }

    // 3. Seed sample post
    const posts = db.collection('posts');
    const postsCount = await posts.countDocuments();
    if (postsCount === 0) {
      await posts.insertOne(mockDb.posts[0]);
      console.log('[Dentalfy DB] Seeded initial post into MongoDB.');
    }
  } catch (err) {
    console.error('[Dentalfy DB] MongoDB seeding error:', err);
  }
}

// --- TRANSPARENT SQL QUERY TO MONGODB INTERPRETER ---
async function query(text, params = []) {
  const sql = text.trim();
  const sqlLower = sql.toLowerCase();
  
  // Identify the target table / collection
  let table = '';
  if (sqlLower.includes('site_settings')) table = 'site_settings';
  else if (sqlLower.includes('users')) table = 'users';
  else if (sqlLower.includes('posts')) table = 'posts';
  else if (sqlLower.includes('author_requests')) table = 'author_requests';
  else if (sqlLower.includes('feedback_messages')) table = 'feedback_messages';
  else if (sqlLower.includes('sessions')) table = 'sessions';
  else if (sqlLower.includes('account_lockouts')) table = 'account_lockouts';
  else if (sqlLower.includes('login_attempts')) table = 'login_attempts';
  else if (sqlLower.includes('audit_logs')) table = 'audit_logs';
  else if (sqlLower.includes('recovery_codes')) table = 'recovery_codes';

  const db = await getMongoDb();

  // 1. SELECT QUERIES
  if (sqlLower.startsWith('select')) {
    if (!table) {
      // Schema queries (e.g., SELECT table_name ...) - returns empty array
      return { rows: [], rowCount: 0 };
    }

    // Parse filter conditions
    let filter = {};
    if (sqlLower.includes('where')) {
      if (sqlLower.includes('email = $')) {
        filter.email = String(params[0]).toLowerCase();
      }
      if (sqlLower.includes('id = $') || sqlLower.includes('id=$')) {
        const match = sqlLower.match(/id\s*=\s*\$(\d+)/);
        if (match) {
          filter.id = params[parseInt(match[1]) - 1];
        }
      }
      if (sqlLower.includes('id = 1')) {
        filter.id = 1;
      }
      if (sqlLower.includes('role = $')) {
        const match = sqlLower.match(/role\s*=\s*\$(\d+)/);
        if (match) {
          filter.role = params[parseInt(match[1]) - 1];
        }
      }
      if (sqlLower.includes('author_id = $')) {
        const match = sqlLower.match(/author_id\s*=\s*\$(\d+)/);
        if (match) {
          filter.author_id = params[parseInt(match[1]) - 1];
        }
      }
      if (sqlLower.includes('session_id = $')) {
        const match = sqlLower.match(/session_id\s*=\s*\$(\d+)/);
        if (match) {
          filter.session_id = params[parseInt(match[1]) - 1];
        }
      }
      if (sqlLower.includes('user_id = $')) {
        const match = sqlLower.match(/user_id\s*=\s*\$(\d+)/);
        if (match) {
          filter.user_id = params[parseInt(match[1]) - 1];
        }
      }
      if (sqlLower.includes('refresh_token = $')) {
        const match = sqlLower.match(/refresh_token\s*=\s*\$(\d+)/);
        if (match) {
          filter.refresh_token = params[parseInt(match[1]) - 1];
        }
      }
      if (sqlLower.includes('published = true')) {
        filter.published = true;
      }
      if (sqlLower.includes('locked_until > now()')) {
        filter.locked_until = { $gt: new Date().toISOString() };
      }
      if (sqlLower.includes('expires_at > now()')) {
        filter.expires_at = { $gt: new Date().toISOString() };
      }
      if (sqlLower.includes('attempt_at > now()')) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        filter.attempt_at = { $gt: twentyFourHoursAgo };
      }
      if (sqlLower.includes('success = false')) {
        filter.success = false;
      }
      if (sqlLower.includes('success = true')) {
        filter.success = true;
      }
      if (sqlLower.includes('ip_address = $')) {
        const match = sqlLower.match(/ip_address\s*=\s*\$(\d+)/);
        if (match) {
          filter.ip_address = params[parseInt(match[1]) - 1];
        }
      }
    }

    // Parse sort order
    let sort = {};
    if (sqlLower.includes('created_at desc') || sqlLower.includes('order by created_at desc')) {
      sort.created_at = -1;
    } else if (sqlLower.includes('submitted_at desc')) {
      sort.submitted_at = -1;
    }

    // Parse limits
    let limitValue = 0;
    if (sqlLower.includes('limit 1')) {
      limitValue = 1;
    }

    if (db) {
      let cursor = db.collection(table).find(filter);
      if (Object.keys(sort).length > 0) {
        cursor = cursor.sort(sort);
      }
      if (limitValue > 0) {
        cursor = cursor.limit(limitValue);
      }
      const rows = await cursor.toArray();
      rows.forEach(r => {
        if (r._id && !r.id) {
          r.id = r._id.toString();
        }
      });
      
      // If it's count query, map output
      if (sqlLower.includes('count(*) as count') || sqlLower.includes('count(*)')) {
        return { rows: [{ count: rows.length }], rowCount: 1 };
      }
      return { rows, rowCount: rows.length };
    } else {
      // Local Fallback JSON DB Select
      let filtered = [...mockDb[table]];
      
      // Filter logic
      for (const k in filter) {
        if (typeof filter[k] === 'object' && filter[k] !== null) {
          if (filter[k].$gt) {
            filtered = filtered.filter(row => new Date(row[k]) > new Date(filter[k].$gt));
          }
        } else {
          filtered = filtered.filter(row => row[k] === filter[k]);
        }
      }

      // Sort logic
      if (sort.created_at) {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } else if (sort.submitted_at) {
        filtered.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
      }

      // Limit logic
      if (limitValue > 0) {
        filtered = filtered.slice(0, limitValue);
      }

      if (sqlLower.includes('count(*) as count') || sqlLower.includes('count(*)')) {
        return { rows: [{ count: filtered.length }], rowCount: 1 };
      }
      return { rows: filtered, rowCount: filtered.length };
    }
  }

  // 2. INSERT QUERIES
  if (sqlLower.startsWith('insert')) {
    if (!table) return { rows: [], rowCount: 0 };

    const newRow = {};
    const colsMatch = sql.match(/\(([^)]+)\)/);
    
    if (table === 'login_attempts') {
      newRow.email = params[0] ? String(params[0]).toLowerCase() : '';
      newRow.success = sqlLower.includes('true');
      newRow.attempt_at = new Date().toISOString();
    } else if (table === 'account_lockouts') {
      newRow.email = params[0] ? String(params[0]).toLowerCase() : '';
      newRow.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      newRow.locked_at = new Date().toISOString();
      newRow.reason = 'Too many failed login attempts';
    } else if (colsMatch) {
      const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
      cols.forEach((col, idx) => {
        let val = params[idx];
        if (sqlLower.includes("now() + interval '30 minutes'") && col === 'expires_at') {
          val = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        }
        newRow[col] = val;
      });
    }

    if (!newRow.id) {
      newRow.id = `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    newRow.created_at = newRow.created_at || new Date().toISOString();
    newRow.updated_at = newRow.updated_at || new Date().toISOString();

    if (db) {
      await db.collection(table).insertOne(newRow);
      return { rows: [newRow], rowCount: 1 };
    } else {
      mockDb[table].push(newRow);
      saveMockDb();
      return { rows: [newRow], rowCount: 1 };
    }
  }

  // 3. UPDATE QUERIES
  if (sqlLower.startsWith('update')) {
    if (!table) return { rows: [], rowCount: 0 };

    let whereFilter = {};
    const matchId = sql.match(/where\s+(\w+)\s*=\s*\$(\d+)/i);
    if (matchId) {
      const idCol = matchId[1].toLowerCase();
      const paramIdx = parseInt(matchId[2]) - 1;
      const targetVal = params[paramIdx];
      whereFilter[idCol] = targetVal;
    } else if (table === 'site_settings') {
      whereFilter.id = 1;
    }

    const updateDoc = { $set: {} };
    const setIndex = sqlLower.indexOf('set');
    const whereIndex = sqlLower.indexOf('where');
    const setPart = sql.substring(setIndex + 3, whereIndex > -1 ? whereIndex : sql.length).trim();
    const assignments = setPart.split(',').map(a => a.trim());
    
    assignments.forEach(assign => {
      const parts = assign.split('=');
      if (parts.length === 2) {
        const colName = parts[0].trim().toLowerCase();
        const rightHand = parts[1].trim();
        const paramMatch = rightHand.match(/\$(\d+)/);
        if (paramMatch) {
          const pIdx = parseInt(paramMatch[1]) - 1;
          updateDoc.$set[colName] = params[pIdx];
        } else if (rightHand.toLowerCase() === 'now()') {
          updateDoc.$set[colName] = new Date().toISOString();
        } else if (rightHand.toLowerCase() === 'true') {
          updateDoc.$set[colName] = true;
        } else if (rightHand.toLowerCase() === 'false') {
          updateDoc.$set[colName] = false;
        } else if (rightHand.toLowerCase() === 'null') {
          updateDoc.$set[colName] = null;
        } else if (rightHand.includes("now() + interval '30 minutes'")) {
          updateDoc.$set[colName] = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        }
      }
    });

    updateDoc.$set.updated_at = new Date().toISOString();

    if (db) {
      await db.collection(table).updateOne(whereFilter, updateDoc, { upsert: true });
      const updatedRow = await db.collection(table).findOne(whereFilter);
      if (updatedRow && updatedRow._id) {
        updatedRow.id = updatedRow._id.toString();
      }
      return { rows: [updatedRow], rowCount: 1 };
    } else {
      let updatedRows = [];
      mockDb[table] = mockDb[table].map(row => {
        let isMatch = true;
        for (const k in whereFilter) {
          if (row[k] !== whereFilter[k]) isMatch = false;
        }
        if (isMatch) {
          Object.assign(row, updateDoc.$set);
          updatedRows.push(row);
        }
        return row;
      });
      saveMockDb();
      return { rows: updatedRows, rowCount: updatedRows.length };
    }
  }

  // 4. DELETE QUERIES
  if (sqlLower.startsWith('delete')) {
    if (!table) return { rowCount: 0 };

    let whereFilter = {};
    const matchId = sql.match(/where\s+(\w+)\s*=\s*\$(\d+)/i);
    if (matchId) {
      const idCol = matchId[1].toLowerCase();
      const paramIdx = parseInt(matchId[2]) - 1;
      const targetVal = params[paramIdx];
      whereFilter[idCol] = targetVal;
    }

    if (db) {
      const deleteResult = await db.collection(table).deleteMany(whereFilter);
      return { rowCount: deleteResult.deletedCount };
    } else {
      const initialLength = mockDb[table].length;
      mockDb[table] = mockDb[table].filter(row => {
        let isMatch = true;
        for (const k in whereFilter) {
          if (row[k] !== whereFilter[k]) isMatch = false;
        }
        return !isMatch;
      });
      saveMockDb();
      return { rowCount: initialLength - mockDb[table].length };
    }
  }

  return { rows: [], rowCount: 0 };
}

async function getClient() {
  const db = await getMongoDb();
  if (db) {
    return {
      query,
      release: () => {}
    };
  }
  return {
    query,
    release: () => {}
  };
}

module.exports = {
  query,
  getClient,
};
