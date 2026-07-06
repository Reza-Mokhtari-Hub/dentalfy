/** ذخیره فایل‌ها در IndexedDB — تا زمان اتصال سرور */
const MediaStore = {
  DB_NAME: "dental_academy_media",
  STORE: "files",
  MAX_BYTES: 25 * 1024 * 1024,

  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        this._db = req.result;
        resolve(this._db);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async saveFile(file) {
    if (file.size > this.MAX_BYTES) {
      throw new Error(`حداکثر حجم فایل ${this.MAX_BYTES / 1024 / 1024} مگابایت است.`);
    }
    const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const buffer = await file.arrayBuffer();
    const record = {
      id,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      createdAt: new Date().toISOString(),
      data: buffer,
    };
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readwrite");
      tx.objectStore(this.STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return { id, name: record.name, mime: record.mime, size: record.size };
  },

  async getRecord(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readonly");
      const req = tx.objectStore(this.STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getBlobUrl(id) {
    const rec = await this.getRecord(id);
    if (!rec) return null;
    const blob = new Blob([rec.data], { type: rec.mime });
    return URL.createObjectURL(blob);
  },

  async deleteFile(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readwrite");
      tx.objectStore(this.STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteMany(ids) {
    for (const id of ids) {
      try {
        await this.deleteFile(id);
      } catch {
        /* ignore */
      }
    }
  },
};
