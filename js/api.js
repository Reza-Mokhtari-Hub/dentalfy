/**
 * API امن — تنها راه دسترسی پنل به داده‌ها.
 * storageMode: 'local' → localStorage | 'remote' → سرور (آینده)
 */
const Api = {
  // ——— عمومی (بدون ورود) ———
  getPublishedPosts() {
    return Store.getPublishedPosts().map((p) => Content.normalizePost(p));
  },

  getPublicPost(id) {
    const post = Store.getPost(id);
    if (!post || !isPostPublic(migratePostStatus({ ...post }))) {
      return { ok: false, error: "پست یافت نشد یا هنوز منتشر نشده است." };
    }
    Store.incrementViews(id);
    return { ok: true, post: Content.normalizePost(post) };
  },

  getPostsByCategory(category) {
    return this.getPublishedPosts().filter((p) => p.category === category);
  },

  getAllLibraryFiles() {
    const files = [];
    this.getPublishedPosts().forEach((post) => {
      (post.blocks || []).forEach((b) => {
        if (b.type === "file") {
          files.push({
            postId: post.id,
            postTitle: post.title,
            category: post.categoryLabel,
            ...b,
          });
        }
      });
    });
    return files;
  },

  getSite() {
    return Store.getSite();
  },

  addAuthorRequest(data) {
    return Store.addRequest(data);
  },

  sendFeedback(data) {
    return Store.addFeedbackMessage(data);
  },

  async login(email, password) {
    return Store.login(email, password);
  },

  async logout() {
    await Store.logout();
    return { ok: true };
  },

  getSessionUser() {
    return Auth.getUser();
  },

  // ——— پنل: پست‌ها ———
  listPostsForPanel() {
    const check = Auth.assertLoggedIn();
    if (!check.ok) return check;

    const all = Store.getPosts();
    if (Auth.isAdmin(check.user)) {
      return { ok: true, posts: all };
    }
    return {
      ok: true,
      posts: all.filter((p) => p.authorId === check.user.id),
    };
  },

  getPost(id) {
    const post = Store.getPost(id);
    if (!post) {
      return { ok: false, code: AUTH_ERRORS.NOT_FOUND, error: "پست یافت نشد." };
    }
    const normalized = Content.normalizePost(post);
    return Auth.assertCanManagePost(normalized).ok
      ? { ok: true, post: normalized }
      : {
          ok: false,
          code: AUTH_ERRORS.FORBIDDEN,
          error: "شما فقط به پست‌های خودتان دسترسی دارید.",
        };
  },

  async savePost(payload) {
    const check = Auth.assertLoggedIn();
    if (!check.ok) return check;
    const user = check.user;
    const now = new Date().toISOString();

    let post;
    if (payload.id) {
      post = Store.getPost(payload.id);
      if (!post) {
        return { ok: false, code: AUTH_ERRORS.NOT_FOUND, error: "پست یافت نشد." };
      }
      const perm = Auth.assertCanManagePost(post);
      if (!perm.ok) return perm;
    } else {
      post = {
        id: uid(),
        createdAt: now,
      };
    }

    const action = payload.action || "draft";

    if (Auth.isAdmin(user)) {
      post.authorId = payload.authorId || post.authorId || user.id;
      const authorUser = Store.getUsers().find((u) => u.id === post.authorId);
      post.author = payload.author || authorUser?.name || post.author || user.name;
      post.authorAvatarMediaId = authorUser?.avatarMediaId || post.authorAvatarMediaId;
      if (action === "publish") {
        post.status = POST_STATUS.PUBLISHED;
        post.publishedAt = now;
        post.rejectionNote = "";
      } else if (payload.status) {
        post.status = payload.status;
        if (post.status === POST_STATUS.PUBLISHED) {
          post.publishedAt = now;
          post.rejectionNote = "";
        }
      } else if (action === "draft") {
        post.status = POST_STATUS.DRAFT;
      }
    } else {
      post.authorId = user.id;
      post.author = user.name;
      post.authorAvatarMediaId = user.avatarMediaId || null;
      if (action === "submit") {
        post.status = POST_STATUS.PENDING;
        post.submittedAt = now;
        post.rejectionNote = "";
      } else {
        post.status = POST_STATUS.DRAFT;
      }
    }

    post.title = String(payload.title || "").trim();
    post.excerpt = String(payload.excerpt || "").trim();
    post.content = String(payload.content || "").trim();
    post.blocks = Array.isArray(payload.blocks) ? payload.blocks : post.blocks || [];
    post.tags = Array.isArray(payload.tags)
      ? payload.tags.map((t) => String(t).trim()).filter(Boolean)
      : post.tags || [];
    post.category = payload.category;
    post.categoryLabel = CATEGORIES[payload.category] || payload.category;
    post.published = post.status === POST_STATUS.PUBLISHED;
    post.readMinutes = Content.readingTimeMinutes(post.blocks);

    const firstImage = post.blocks.find((b) => b.type === "image" && b.url);
    post.image =
      String(payload.image || "").trim() ||
      firstImage?.url ||
      post.image ||
      "assets/images/post-anatomy.jpg";
    post.date = formatJalaliDate(post.createdAt || now);
    post.updatedAt = now;

    if (!post.title || !post.excerpt || !post.category) {
      return { ok: false, error: "عنوان، خلاصه و دسته الزامی است." };
    }

    const parsed = Content.normalizePost(post);
    Store.savePost(parsed);
    return { ok: true, post: parsed };
  },

  async deletePost(id) {
    const post = Store.getPost(id);
    if (!post) {
      return { ok: false, code: AUTH_ERRORS.NOT_FOUND, error: "پست یافت نشد." };
    }
    const perm = Auth.assertCanManagePost(post);
    if (!perm.ok) return perm;
    const mediaIds = Content.getPostMediaIds(Content.normalizePost(post).blocks);
    Store.deletePost(id);
    await MediaStore.deleteMany(mediaIds);
    return { ok: true };
  },

  // ——— فقط مدیر اصلی ———
  getDashboardStats() {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    const posts = Store.getPosts();
    const authors = Store.getUsers().filter((u) => u.role === ROLES.AUTHOR);
    const pending = Store.getRequests().filter((r) => r.status === "pending").length;
    const pendingPosts = Store.getPendingPosts().length;
    const pendingPasswordResets = Store.getPasswordResets().filter(
      (r) => r.status === "pending"
    ).length;
    return {
      ok: true,
      stats: {
        totalPosts: posts.length,
        publishedPosts: posts.filter((p) => isPostPublic(migratePostStatus({ ...p }))).length,
        pendingPosts,
        authors: authors.length,
        pendingRequests: pending,
        pendingPasswordResets,
      },
    };
  },

  listPendingPosts() {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return {
      ok: true,
      posts: Store.getPendingPosts().map((p) => Content.normalizePost(p)),
    };
  },

  approvePost(postId) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    const post = Store.getPost(postId);
    if (!post) return { ok: false, error: "پست یافت نشد." };
    post.status = POST_STATUS.PUBLISHED;
    post.published = true;
    post.publishedAt = new Date().toISOString();
    post.rejectionNote = "";
    post.reviewedAt = post.publishedAt;
    post.reviewedBy = check.user.id;
    Store.savePost(Content.normalizePost(post));
    return { ok: true, post };
  },

  rejectPost(postId, note) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    const post = Store.getPost(postId);
    if (!post) return { ok: false, error: "پست یافت نشد." };
    post.status = POST_STATUS.REJECTED;
    post.published = false;
    post.rejectionNote = String(note || "").trim() || "نیاز به ویرایش و ارسال مجدد.";
    post.reviewedAt = new Date().toISOString();
    post.reviewedBy = check.user.id;
    Store.savePost(Content.normalizePost(post));
    return { ok: true, post };
  },

  async updateProfile({ name, bio, avatarFile, removeAvatar }) {
    const check = Auth.assertLoggedIn();
    if (!check.ok) return check;
    const user = { ...check.user };

    if (name && String(name).trim()) user.name = String(name).trim();
    if (bio !== undefined) user.bio = String(bio).trim();

    if (removeAvatar && user.avatarMediaId) {
      await MediaStore.deleteFile(user.avatarMediaId);
      user.avatarMediaId = null;
    }

    if (avatarFile) {
      if (user.avatarMediaId) await MediaStore.deleteFile(user.avatarMediaId);
      const meta = await MediaStore.saveFile(avatarFile);
      user.avatarMediaId = meta.id;
    }

    Store.saveUser(user);
    Store.syncAuthorOnPosts(user.id);

    const session = Store.getSession();
    if (session) {
      Store.setSession(buildSession(user));
    }

    return { ok: true, user: Store.getUsers().find((u) => u.id === user.id) };
  },

  listRequests() {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return { ok: true, requests: Store.getRequests() };
  },

  async approveRequest(requestId) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return Store.approveRequest(requestId);
  },

  rejectRequest(requestId) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    Store.rejectRequest(requestId);
    return { ok: true };
  },

  listAuthors() {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return {
      ok: true,
      authors: Store.getUsers().filter((u) => u.role === ROLES.AUTHOR),
    };
  },

  listFeedback() {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return { ok: true, feedback: Store.getFeedbackMessages() };
  },

  async replyFeedback(id, response) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    const message = Store.updateFeedbackMessage(id, {
      status: response ? 'responded' : 'closed',
      response: String(response || '').trim(),
      responderId: check.user.id,
      respondedAt: new Date().toISOString(),
    });
    if (!message) {
      return { ok: false, error: 'پیام یافت نشد.' };
    }
    return { ok: true, message };
  },

  listNotifications() {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return { ok: true, notifications: Store.getNotifications() };
  },

  async sendNotification({ title, body, targetRole }) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    if (!title || !body) {
      return { ok: false, error: 'عنوان و متن اعلان الزامی است.' };
    }
    return Store.addNotification({ title, body, targetRole, sentBy: check.user.id });
  },

  getMyNotifications() {
    const check = Auth.assertLoggedIn();
    if (!check.ok) return check;
    return { ok: true, notifications: Store.getNotificationsForUser(check.user) };
  },

  markNotificationRead(notificationId) {
    const check = Auth.assertLoggedIn();
    if (!check.ok) return check;
    const notification = Store.markNotificationRead(notificationId, check.user.id);
    if (!notification) {
      return { ok: false, error: 'اعلان یافت نشد.' };
    }
    return { ok: true, notification };
  },

  async createAuthor(data) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return Store.createAuthorManual(data);
  },

  async resetAuthorPassword(userId) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    const target = Store.getUsers().find((u) => u.id === userId);
    if (!target || target.role === ROLES.ADMIN) {
      return { ok: false, error: "امکان تغییر رمز مدیر اصلی وجود ندارد." };
    }
    return Store.resetUserPassword(userId);
  },

  toggleAuthorActive(userId) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    const target = Store.getUsers().find((u) => u.id === userId);
    if (!target || target.role === ROLES.ADMIN) {
      return { ok: false, error: "عملیات روی مدیر اصلی مجاز نیست." };
    }
    Store.toggleUserActive(userId);
    return { ok: true };
  },

  async saveSiteSettings(settings, passwordChange, recoveryKeyChange) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;

    Store.saveSite(settings);

    const admin = check.user;

    if (passwordChange?.currentPassword && passwordChange?.newPassword) {
      const valid = await Store.verifyUserPassword(
        admin,
        passwordChange.currentPassword
      );
      if (!valid) {
        return { ok: false, error: "رمز فعلی اشتباه است." };
      }
      const r = await Store.updateAdminPassword(admin.id, passwordChange.newPassword);
      if (!r.ok) return r;
    }

    if (recoveryKeyChange?.newKey) {
      if (!recoveryKeyChange.currentPassword) {
        return { ok: false, error: "برای تغییر کد بازیابی، رمز فعلی مدیر لازم است." };
      }
      const valid = await Store.verifyUserPassword(
        admin,
        recoveryKeyChange.currentPassword
      );
      if (!valid) {
        return { ok: false, error: "رمز فعلی اشتباه است." };
      }
      await Store.setAdminRecoveryKey(recoveryKeyChange.newKey);
    }

    return { ok: true };
  },

  requestPasswordReset(email) {
    return Store.addPasswordResetRequest(String(email || "").trim());
  },

  async recoverAdminPassword({ email, recoveryKey, newPassword, confirmPassword }) {
    if (newPassword !== confirmPassword) {
      return { ok: false, error: "رمز جدید و تکرار آن یکسان نیست." };
    }
    return Store.recoverAdminPassword(email, recoveryKey, newPassword);
  },

  listPasswordResets() {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return { ok: true, requests: Store.getPasswordResets() };
  },

  async approvePasswordReset(requestId) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return Store.approvePasswordReset(requestId);
  },

  rejectPasswordReset(requestId) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    Store.rejectPasswordReset(requestId);
    return { ok: true };
  },

  isAdminEmail(email) {
    const user = Store.getUsers().find(
      (u) => u.email.toLowerCase() === String(email || "").trim().toLowerCase()
    );
    return user?.role === ROLES.ADMIN;
  },

  addCategory(id, name) {
    const check = Auth.assertAdmin();
    if (!check.ok) return check;
    return Store.addCategory(id, name);
  },
};
