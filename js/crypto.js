/** هش رمز — آماده برای جایگزینی با bcrypt سمت سرور */
const Crypto = {
  async createSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  },

  async hashPassword(password, salt) {
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  },

  async verifyPassword(password, salt, hash) {
    const computed = await this.hashPassword(password, salt);
    return computed === hash;
  },

  /** سازگاری با نسخه قبلی */
  legacyHash(password) {
    return btoa(unescape(encodeURIComponent(`rmo:${password}`)));
  },

  legacyVerify(password, hash) {
    return this.legacyHash(password) === hash;
  },

  sessionToken(userId, passwordHash, installKey) {
    return this.legacyHash(`${installKey}:${userId}:${passwordHash}`);
  },
};
