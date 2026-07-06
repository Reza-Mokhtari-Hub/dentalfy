const KEYS = {
  site: "dental_site_settings",
  posts: "dental_posts",
  users: "dental_users",
  requests: "dental_author_requests",
  passwordResets: "dental_password_resets",
  feedback: "dental_feedback_messages",
  notifications: "dental_notifications",
  session: "dental_session",
  installKey: "dental_install_key",
  initialized: "dental_initialized_v2",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getInstallKey() {
  let key = localStorage.getItem(KEYS.installKey);
  if (!key) {
    key = uid();
    localStorage.setItem(KEYS.installKey, key);
  }
  return key;
}

function formatJalaliDate(iso) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString("fa-IR");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function generatePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

const RECOVERY_SALT = "dental-admin-recovery-v1";

async function hashRecoveryKey(key) {
  return `sha256:${await Crypto.hashPassword(String(key), RECOVERY_SALT)}`;
}

function buildSession(user) {
  const installKey = getInstallKey();
  return {
    userId: user.id,
    token: Crypto.sessionToken(user.id, user.passwordHash, installKey),
    loginAt: new Date().toISOString(),
  };
}

const Store = {
  init() {
    if (!localStorage.getItem(KEYS.initialized)) {
      write(KEYS.site, { ...DEFAULT_SITE });
      write(KEYS.posts, [...SEED_POSTS]);
      const salt = "init-admin";
      write(KEYS.users, [
        {
          id: "admin-rmo",
          email: DEFAULT_ADMIN.email,
          passwordHash: Crypto.legacyHash(DEFAULT_ADMIN.password),
          passwordSalt: null,
          name: DEFAULT_ADMIN.name,
          role: "admin",
          active: true,
          avatar: "",
          createdAt: new Date().toISOString(),
        },
      ]);
      write(KEYS.requests, []);
      write(KEYS.passwordResets, []);
      write(KEYS.feedback, []);
      write(KEYS.notifications, []);
      localStorage.setItem(KEYS.initialized, "1");
    }
    this.migratePasswords();
    this.upgradeSeedPosts();
    this.ensureRecoveryKeyHash();
  },

  async ensureRecoveryKeyHash() {
    const site = this.getSite();
    if (!site.adminRecoveryKeyHash) {
      site.adminRecoveryKeyHash = await hashRecoveryKey(DEFAULT_ADMIN_RECOVERY_KEY);
      write(KEYS.site, site);
    }
  },

  async verifyRecoveryKey(key) {
    await this.ensureRecoveryKeyHash();
    const site = this.getSite();
    const hash = await hashRecoveryKey(key);
    return hash === site.adminRecoveryKeyHash;
  },

  async setAdminRecoveryKey(newKey) {
    const site = this.getSite();
    site.adminRecoveryKeyHash = await hashRecoveryKey(newKey);
    write(KEYS.site, site);
    return site;
  },

  getPasswordResets() {
    return read(KEYS.passwordResets, []).sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    );
  },

  addPasswordResetRequest(email) {
    const user = this.getUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      return { ok: false, error: "ایمیل در سیستم ثبت نشده است." };
    }
    if (user.role === ROLES.ADMIN) {
      return {
        ok: false,
        error: "برای حساب مدیر از «کد بازیابی» در همین صفحه استفاده کنید.",
        isAdmin: true,
      };
    }
    if (user.active === false) {
      return { ok: false, error: "حساب شما غیرفعال است. با مدیر تماس بگیرید." };
    }
    const list = this.getPasswordResets();
    if (
      list.some(
        (r) =>
          r.userId === user.id && r.status === "pending"
      )
    ) {
      return { ok: false, error: "درخواست بازیابی قبلی در انتظار بررسی است." };
    }
    const item = {
      id: uid(),
      userId: user.id,
      email: user.email,
      name: user.name,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    list.unshift(item);
    write(KEYS.passwordResets, list);
    return { ok: true, item };
  },

  async approvePasswordReset(requestId) {
    const list = this.getPasswordResets();
    const req = list.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") {
      return { ok: false, error: "درخواست یافت نشد." };
    }
    const user = this.getUsers().find((u) => u.id === req.userId);
    if (!user) return { ok: false, error: "کاربر یافت نشد." };
    const password = generatePassword();
    await this.setUserPassword(user, password);
    req.status = "approved";
    req.resolvedAt = new Date().toISOString();
    write(KEYS.passwordResets, list);
    return { ok: true, password, user };
  },

  rejectPasswordReset(requestId) {
    const list = this.getPasswordResets();
    const req = list.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") return { ok: false };
    req.status = "rejected";
    req.resolvedAt = new Date().toISOString();
    write(KEYS.passwordResets, list);
    return { ok: true };
  },

  async recoverAdminPassword(email, recoveryKey, newPassword) {
    const user = this.getUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.role === ROLES.ADMIN
    );
    if (!user) {
      return { ok: false, error: "حساب مدیر با این ایمیل یافت نشد." };
    }
    const valid = await this.verifyRecoveryKey(recoveryKey);
    if (!valid) {
      return { ok: false, error: "کد بازیابی اشتباه است." };
    }
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, error: "رمز جدید باید حداقل ۶ کاراکتر باشد." };
    }
    await this.setUserPassword(user, newPassword);
    return { ok: true };
  },

  upgradeSeedPosts() {
    const posts = this.getPosts();
    let changed = false;
    SEED_POSTS.forEach((seed) => {
      const idx = posts.findIndex((p) => p.id === seed.id);
      if (idx >= 0 && seed.blocks?.length) {
        const cur = posts[idx];
        if (!cur.blocks?.length) {
          posts[idx] = { ...cur, ...seed, blocks: seed.blocks };
          changed = true;
        }
      }
    });
    if (changed) write(KEYS.posts, posts);
  },

  async migratePasswords() {
    const users = this.getUsers();
    let changed = false;
    for (const user of users) {
      if (!user.passwordSalt && user.passwordHash && !user.passwordHash.startsWith("sha256:")) {
        const salt = await Crypto.createSalt();
        const legacyPass = user.id === "admin-rmo" ? DEFAULT_ADMIN.password : null;
        if (legacyPass && Crypto.legacyVerify(legacyPass, user.passwordHash)) {
          user.passwordHash = `sha256:${await Crypto.hashPassword(legacyPass, salt)}`;
          user.passwordSalt = salt;
          changed = true;
        }
      }
    }
    if (changed) write(KEYS.users, users);
  },

  async setUserPassword(user, plainPassword) {
    const salt = await Crypto.createSalt();
    user.passwordSalt = salt;
    user.passwordHash = `sha256:${await Crypto.hashPassword(plainPassword, salt)}`;
    this.saveUser(user);
    return user;
  },

  async verifyUserPassword(user, plainPassword) {
    if (user.passwordSalt && user.passwordHash?.startsWith("sha256:")) {
      const hash = user.passwordHash.replace("sha256:", "");
      return Crypto.verifyPassword(plainPassword, user.passwordSalt, hash);
    }
    return Crypto.legacyVerify(plainPassword, user.passwordHash);
  },

  getSite() {
    return { ...DEFAULT_SITE, ...read(KEYS.site, {}) };
  },

  saveSite(settings) {
    const merged = { ...this.getSite(), ...settings };
    write(KEYS.site, merged);
    return merged;
  },

  getPosts() {
    return read(KEYS.posts, []);
  },

  getPublishedPosts() {
    return this.getPosts()
      .filter((p) => isPostPublic(migratePostStatus({ ...p })))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((p) => Content.normalizePost(p));
  },

  getPendingPosts() {
    return this.getPosts()
      .filter((p) => migratePostStatus({ ...p }).status === POST_STATUS.PENDING)
      .sort((a, b) => new Date(b.submittedAt || b.updatedAt) - new Date(a.submittedAt || a.updatedAt));
  },

  syncAuthorOnPosts(userId) {
    const user = this.getUsers().find((u) => u.id === userId);
    if (!user) return;
    const posts = this.getPosts();
    let changed = false;
    posts.forEach((p) => {
      if (p.authorId === userId) {
        p.author = user.name;
        p.authorAvatarMediaId = user.avatarMediaId || null;
        changed = true;
      }
    });
    if (changed) write(KEYS.posts, posts);
  },

  incrementViews(id) {
    const posts = this.getPosts();
    const p = posts.find((x) => x.id === id);
    if (!p) return;
    p.views = (p.views || 0) + 1;
    this.savePost(p);
  },

  savePost(post) {
    const posts = this.getPosts();
    const idx = posts.findIndex((p) => p.id === post.id);
    if (idx >= 0) posts[idx] = post;
    else posts.unshift(post);
    write(KEYS.posts, posts);
    return post;
  },

  deletePost(id) {
    write(KEYS.posts, this.getPosts().filter((p) => p.id !== id));
  },

  getPost(id) {
    return this.getPosts().find((p) => p.id === id);
  },

  getUsers() {
    return read(KEYS.users, []);
  },

  getUserByEmail(email) {
    return this.getUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.active !== false
    );
  },

  saveUser(user) {
    if (user.role === ROLES.ADMIN && user.id !== "admin-rmo") {
      throw new Error("نقش مدیر فقط برای حساب اصلی مجاز است.");
    }
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) users[idx] = user;
    else users.push(user);
    write(KEYS.users, users);
    return user;
  },

  getRequests() {
    return read(KEYS.requests, []).sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    );
  },

  addRequest(data) {
    const requests = this.getRequests();
    const dup = requests.some(
      (r) =>
        r.email?.toLowerCase() === data.email?.toLowerCase() && r.status === "pending"
    );
    if (dup) return { ok: false, error: "درخواست قبلی شما در انتظار بررسی است." };

    const item = {
      id: uid(),
      ...data,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    requests.unshift(item);
    write(KEYS.requests, requests);
    return { ok: true, item };
  },

  updateRequest(id, patch) {
    const requests = this.getRequests();
    const idx = requests.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    requests[idx] = { ...requests[idx], ...patch };
    write(KEYS.requests, requests);
    return requests[idx];
  },

  getFeedbackMessages() {
    return read(KEYS.feedback, []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  addFeedbackMessage(data) {
    const messages = this.getFeedbackMessages();
    const item = {
      id: uid(),
      name: String(data.name || '').trim(),
      email: String(data.email || '').trim().toLowerCase(),
      subject: String(data.subject || 'پیام جدید').trim(),
      message: String(data.message || '').trim(),
      status: 'new',
      response: '',
      responderId: null,
      createdAt: new Date().toISOString(),
      respondedAt: null,
    };
    messages.unshift(item);
    write(KEYS.feedback, messages);
    return { ok: true, item };
  },

  updateFeedbackMessage(id, patch) {
    const messages = this.getFeedbackMessages();
    const idx = messages.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    messages[idx] = { ...messages[idx], ...patch };
    write(KEYS.feedback, messages);
    return messages[idx];
  },

  getNotifications() {
    return read(KEYS.notifications, []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  addNotification({ title, body, targetRole = 'author', sentBy = null }) {
    const notifications = this.getNotifications();
    const item = {
      id: uid(),
      title: String(title || '').trim(),
      body: String(body || '').trim(),
      targetRole: ['admin', 'author', 'all'].includes(targetRole) ? targetRole : 'author',
      sentBy,
      readBy: [],
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(item);
    write(KEYS.notifications, notifications);
    return { ok: true, notification: item };
  },

  markNotificationRead(notificationId, userId) {
    const notifications = this.getNotifications();
    const idx = notifications.findIndex((n) => n.id === notificationId);
    if (idx < 0) return null;
    const note = notifications[idx];
    if (!note.readBy.includes(userId)) {
      note.readBy.push(userId);
      notifications[idx] = note;
      write(KEYS.notifications, notifications);
    }
    return note;
  },

  getNotificationsForUser(user) {
    if (!user) return [];
    const notifications = this.getNotifications();
    return notifications
      .filter((n) => n.targetRole === 'all' || n.targetRole === user.role)
      .map((n) => ({ ...n, read: n.readBy.includes(user.id) }));
  },

  getSession() {
    return read(KEYS.session, null);
  },

  setSession(session) {
    if (session) write(KEYS.session, session);
    else localStorage.removeItem(KEYS.session);
  },

 async login(email, password) {
    try {
        // اول CSRF token را دریافت کن
        if (!CSRFToken || !CSRFToken.getToken()) {
          if (CSRFToken && CSRFToken.initializeToken) {
            await CSRFToken.initializeToken();
          }
        }

        const headers = CSRFToken && CSRFToken.getHeaders 
          ? CSRFToken.getHeaders()
          : { 'Content-Type': 'application/json' };

        const response = await fetch(`${APP_CONFIG.apiBaseUrl}/auth/login`, {
            method: 'POST',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            return { ok: false, error: data.error || 'ایمیل یا رمز عبور اشتباه است.' };
        }

        // ذخیره کاربر - فقط ID و نقش (حداقل sensitive data)
        const safeUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role
        };
        localStorage.setItem("dental_user", JSON.stringify(safeUser));
        
        // ساخت سشن محلی برای راضی نگه‌داشتن کدهای فرانت‌اَند
        const fakeSession = { userId: data.user.id, token: "secure_server_session" };
        localStorage.setItem("dental_session", JSON.stringify(fakeSession));

        return { ok: true, user: data.user };
    } catch (error) {
        console.error('Login error:', error);
        return { ok: false, error: 'خطا در ارتباط با سرور.' };
    }
  },

  async logout() {
    try {
      const headers = CSRFToken && CSRFToken.getHeaders 
        ? CSRFToken.getHeaders()
        : { 'Content-Type': 'application/json' };

      // فراخوانی سرور برای پاک‌کردن کوکی
      await fetch(`${APP_CONFIG.apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: headers,
        credentials: 'include'
      });
    } catch (error) {
      console.error('Server logout error:', error);
    }
    
    // پاک‌کردن حافظه محلی
    localStorage.removeItem("dental_user");
    localStorage.removeItem("dental_session");
    this.setSession(null);
    window.location.href = "index.html";
  },

  getCurrentUser() {
    // ابتدا از localStorage بررسی می‌کنیم (برای سرورهای دارای کوکی مشکل‌دار)
    const localUser = localStorage.getItem("dental_user");
    if (localUser) {
      try {
        const user = JSON.parse(localUser);
        if (user && user.id) return user;
      } catch(e) {}
    }
    
    // اگر localStorage خالی بود، از session بررسی کنید
    const session = this.getSession();
    if (!session?.userId) return null;
    
    const user = this.getUsers().find((u) => u.id === session.userId);
    if (!user || !user.active) {
      this.logout();
      return null;
    }
    
    return user;
  },

  async approveRequest(requestId) {
    const req = this.getRequests().find((r) => r.id === requestId);
    if (!req || req.status !== "pending") {
      return { ok: false, error: "درخواست یافت نشد." };
    }

    if (this.getUserByEmail(req.email)) {
      return { ok: false, error: "کاربر با این ایمیل وجود دارد." };
    }

    const password = generatePassword();
    const user = {
      id: uid(),
      email: req.email,
      passwordHash: "",
      passwordSalt: null,
      name: req.fullName,
      role: ROLES.AUTHOR,
      active: true,
      avatar: "",
      expertise: req.expertise,
      university: req.university,
      createdAt: new Date().toISOString(),
    };
    await this.setUserPassword(user, password);
    this.updateRequest(requestId, {
      status: "approved",
      resolvedAt: new Date().toISOString(),
      userId: user.id,
    });

    return { ok: true, user, password };
  },

  rejectRequest(requestId) {
    this.updateRequest(requestId, {
      status: "rejected",
      resolvedAt: new Date().toISOString(),
    });
    return { ok: true };
  },

  async createAuthorManual({ name, email, password }) {
    if (this.getUserByEmail(email)) {
      return { ok: false, error: "این ایمیل قبلاً ثبت شده." };
    }
    const pass = password || generatePassword();
    const user = {
      id: uid(),
      email,
      passwordHash: "",
      passwordSalt: null,
      name,
      role: ROLES.AUTHOR,
      active: true,
      avatar: "",
      createdAt: new Date().toISOString(),
    };
    await this.setUserPassword(user, pass);
    return { ok: true, user, password: pass };
  },

  async resetUserPassword(userId) {
    const user = this.getUsers().find((u) => u.id === userId);
    if (!user || user.role === ROLES.ADMIN) return { ok: false };
    const password = generatePassword();
    await this.setUserPassword(user, password);
    return { ok: true, password };
  },

  toggleUserActive(userId) {
    const user = this.getUsers().find((u) => u.id === userId);
    if (!user || user.role === ROLES.ADMIN) return null;
    user.active = !user.active;
    this.saveUser(user);
    if (!user.active && this.getSession()?.userId === userId) {
      this.logout();
    }
    return user;
  },

  async updateAdminPassword(adminId, newPassword) {
    const user = this.getUsers().find((u) => u.id === adminId);
    if (!user || user.role !== ROLES.ADMIN) {
      return { ok: false, error: "فقط مدیر اصلی." };
    }
    await this.setUserPassword(user, newPassword);
    this.setSession(buildSession(user));
    return { ok: true };
  },

  addCategory(id, name) {
    let customCats = {};
    try {
      const raw = localStorage.getItem("dental_categories");
      if (raw) customCats = JSON.parse(raw);
    } catch (e) {}

    if (CATEGORIES[id] || customCats[id]) {
      return { ok: false, error: "این کد دسته از قبل وجود دارد." };
    }

    customCats[id] = name;
    localStorage.setItem("dental_categories", JSON.stringify(customCats));
    CATEGORIES[id] = name;

    let customCourses = {};
    try {
      const raw = localStorage.getItem("dental_courses");
      if (raw) customCourses = JSON.parse(raw);
    } catch (e) {}

    customCourses[id] = {
      id: id,
      title: name,
      level: "تخصصی",
      image: "assets/images/course-anatomy.jpg",
      description: `دوره آموزشی جامع درس ${name} — مباحث تئوری و نکات کلینیکی آزمون‌های کشوری.`,
      chapters: ["آشنایی با مبانی درس", "سرفصل‌های کاربردی", "آزمون و خودآزمایی"],
      outcomes: [`آشنایی و تسلط بر درس ${name}`, "آمادگی امتحانات تئوری و عملی"],
    };
    localStorage.setItem("dental_courses", JSON.stringify(customCourses));
    COURSES[id] = customCourses[id];

    return { ok: true };
  },
};

Store.init();
