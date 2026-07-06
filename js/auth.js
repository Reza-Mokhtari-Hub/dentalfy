/** کنترل دسترسی — نقش همیشه از رکورد کاربر خوانده می‌شود، نه از session */
const ROLES = {
  ADMIN: "admin",
  AUTHOR: "author",
};

const AUTH_ERRORS = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
};

const Auth = {
 
  isAdmin(user = this.getUser()) {
    return user?.role === ROLES.ADMIN;
  },

  isAuthor(user = this.getUser()) {
    return user?.role === ROLES.AUTHOR;
  },

  /** آیا کاربر می‌تواند این پست را ببیند/ویرایش/حذف کند؟ */
  canManagePost(user, post) {
    if (!user || !post) return false;
    if (this.isAdmin(user)) return true;
    if (this.isAuthor(user) && post.authorId === user.id) return true;
    return false;
  },
getUser() {
    // استفاده از Store.getCurrentUser برای یک نقطه واحد درسترسی
    return Store.getCurrentUser();
  },

  assertLoggedIn() {
    const user = this.getUser();
    if (!user) {
      return { ok: false, code: AUTH_ERRORS.UNAUTHORIZED, error: "لطفاً وارد شوید." };
    }
    return { ok: true, user };
  },

  assertAdmin() {
    const user = this.getUser();
    if (!user || user.role !== 'admin') {
      return { ok: false, code: AUTH_ERRORS.FORBIDDEN, error: "دسترسی غیرمجاز. فقط مدیران دسترسی دارند." };
    }
    return { ok: true, user };
  },
  /** نویسنده فقط پست‌های خودش را در لیست می‌بیند */
  canViewPostInPanel(user, post) {
    return this.canManagePost(user, post);
  },


  assertAdminView(viewName) {
    const adminOnly = [
      "overview",
      "requests",
      "users",
      "all-posts",
      "settings",
    ];
    if (!adminOnly.includes(viewName)) return { ok: true };
    return this.assertAdmin();
  },

  assertCanManagePost(post) {
    const check = this.assertLoggedIn();
    if (!check.ok) return check;
    if (!this.canManagePost(check.user, post)) {
      return {
        ok: false,
        code: AUTH_ERRORS.FORBIDDEN,
        error: "شما فقط به پست‌های خودتان دسترسی دارید.",
      };
    }
    return { ok: true, user: check.user };
  },
};
