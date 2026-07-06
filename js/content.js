/** بلوک‌های محتوا — رندر و نرمال‌سازی پست */
const Content = {
  BLOCK_TYPES: {
    paragraph: "متن",
    heading: "عنوان",
    image: "تصویر",
    video: "ویدیو",
    file: "فایل",
    quote: "نقل‌قول",
    list: "لیست",
    divider: "جداکننده",
  },

  normalizePost(post) {
    if (!post) return post;
    const p = { ...post };
    if (!Array.isArray(p.blocks) || p.blocks.length === 0) {
      const parts = [];
      if (p.content && String(p.content).trim()) {
        parts.push({ type: "paragraph", text: String(p.content).trim() });
      }
      if (!parts.length && p.excerpt) {
        parts.push({ type: "paragraph", text: p.excerpt });
      }
      p.blocks = parts;
    }
    if (!p.tags) p.tags = [];
    if (!p.views) p.views = 0;
    migratePostStatus(p);
    return p;
  },

  statusLabel(status) {
    return POST_STATUS_LABEL[status] || status;
  },

  statusClass(status) {
    return `status-${status || "draft"}`;
  },

  parseVideoUrl(url) {
    if (!url) return null;
    const u = url.trim();
    let m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i);
    if (m) return { source: "youtube", embed: `https://www.youtube.com/embed/${m[1]}`, url: u };
    m = u.match(/aparat\.com\/v\/([^/?]+)/i);
    if (m) return { source: "aparat", embed: `https://www.aparat.com/video/video/embed/videohash/${m[1]}/vt/frame`, url: u };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u) || u.startsWith("blob:")) {
      return { source: "file", embed: u, url: u };
    }
    if (u.startsWith("http")) return { source: "url", embed: u, url: u };
    return null;
  },

  getPostMediaIds(blocks) {
    const ids = [];
    (blocks || []).forEach((b) => {
      if (b.mediaId) ids.push(b.mediaId);
      if (b.type === "image" && b.mediaId) ids.push(b.mediaId);
    });
    return [...new Set(ids)];
  },

  getPostBadges(post) {
    const p = this.normalizePost(post);
    const badges = [];
    (p.blocks || []).forEach((b) => {
      if (b.type === "video" && !badges.includes("ویدیو")) badges.push("ویدیو");
      if (b.type === "file" && !badges.includes("فایل")) badges.push("فایل");
      if (b.type === "image" && !badges.includes("تصویر")) badges.push("تصویر");
    });
    return badges;
  },

  readingTimeMinutes(blocks) {
    const text = (blocks || [])
      .map((b) => {
        if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") return b.text || "";
        if (b.type === "list") return (b.items || []).join(" ");
        return "";
      })
      .join(" ");
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 180));
  },

  escapeAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  },

  renderBlocks(blocks, options = {}) {
    const { forEditor = false } = options;
    if (!blocks?.length) {
      return '<p class="content-empty">محتوای تکمیلی ثبت نشده است.</p>';
    }

    return blocks
      .map((block, i) => this.renderBlock(block, i, forEditor))
      .join("");
  },

  renderBlock(block, index, forEditor) {
    const id = `block-${index}`;
    switch (block.type) {
      case "heading": {
        const lvl = block.level === 3 ? 3 : 2;
        return `<h${lvl} class="content-heading" id="${id}">${escapeHtml(block.text)}</h${lvl}>`;
      }
      case "paragraph":
        return `<p class="content-p" id="${id}">${escapeHtml(block.text).replace(/\n/g, "<br>")}</p>`;
      case "quote":
        return `<blockquote class="content-quote" id="${id}"><p>${escapeHtml(block.text)}</p>${block.author ? `<cite>— ${escapeHtml(block.author)}</cite>` : ""}</blockquote>`;
      case "list": {
        const tag = block.ordered ? "ol" : "ul";
        const items = (block.items || []).map((it) => `<li>${escapeHtml(it)}</li>`).join("");
        return `<${tag} class="content-list" id="${id}">${items}</${tag}>`;
      }
      case "divider":
        return `<hr class="content-divider" id="${id}" />`;
      case "image":
        return `<figure class="content-figure" id="${id}">
          <img src="${this.escapeAttr(block.url || "")}" alt="${this.escapeAttr(block.caption || "")}" loading="lazy" data-media-id="${block.mediaId || ""}" />
          ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
        </figure>`;
      case "video": {
        const parsed = block.embedUrl
          ? { embed: block.embedUrl, source: block.source || "url" }
          : this.parseVideoUrl(block.url);
        if (!parsed) {
          return `<p class="content-error" id="${id}">لینک ویدیو نامعتبر است.</p>`;
        }
        if (parsed.source === "file" || parsed.source === "url") {
          const src = block.mediaId ? `data-media-video="${block.mediaId}"` : `src="${this.escapeAttr(parsed.embed)}"`;
          return `<figure class="content-video-wrap" id="${id}">
            <video class="content-video-native" controls playsinline ${block.mediaId ? `data-media-id="${block.mediaId}"` : `src="${this.escapeAttr(parsed.embed)}"`}></video>
            ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
          </figure>`;
        }
        return `<figure class="content-video-wrap" id="${id}">
          <div class="video-embed"><iframe src="${this.escapeAttr(parsed.embed)}" title="ویدیو" allowfullscreen loading="lazy"></iframe></div>
          ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
        </figure>`;
      }
      case "file": {
        const isPdf = (block.name && block.name.toLowerCase().endsWith(".pdf")) || 
                      (block.mime && block.mime === "application/pdf") || 
                      (block.url && block.url.toLowerCase().endsWith(".pdf"));
        const previewBtn = isPdf 
          ? `<button type="button" class="btn btn-sm btn-outline btn-preview-pdf" data-url="${this.escapeAttr(block.url || "")}" data-media-id="${block.mediaId || ""}" data-name="${this.escapeAttr(block.name || "جزوه")}">📖 مطالعه همزمان</button>` 
          : "";

        if (block.url && !block.mediaId) {
          return `<div class="content-file" id="${id}">
            <span class="file-icon">📎</span>
            <div class="file-meta"><strong>${escapeHtml(block.name || "فایل")}</strong></div>
            <div class="file-actions" style="display:flex;gap:0.5rem">
              <a href="${this.escapeAttr(block.url)}" class="btn btn-sm btn-primary" target="_blank" rel="noopener">دانلود</a>
              ${previewBtn}
            </div>
          </div>`;
        }
        return `<div class="content-file" id="${id}" data-media-id="${block.mediaId || ""}">
          <span class="file-icon">📎</span>
          <div class="file-meta">
            <strong>${escapeHtml(block.name || "فایل پیوست")}</strong>
            <span>${block.size ? this.formatSize(block.size) : ""} ${block.mime ? "· " + block.mime : ""}</span>
          </div>
          <div class="file-actions" style="display:flex;gap:0.5rem">
            <a href="#" class="btn btn-sm btn-primary content-file-dl" data-media-id="${block.mediaId || ""}">دانلود</a>
            ${previewBtn}
          </div>
        </div>`;
      }
      default:
        return "";
    }
  },

  formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  },

  /** پس از رندر HTML — لینک فایل/ویدیو از IndexedDB */
  async hydrateMedia(root) {
    if (!root) return;
    const files = root.querySelectorAll("[data-media-id]");
    for (const el of files) {
      const mid = el.getAttribute("data-media-id");
      if (!mid) continue;
      if (el.tagName === "VIDEO" || el.classList.contains("content-video-native")) {
        const url = await MediaStore.getBlobUrl(mid);
        if (url) el.src = url;
      }
      if (el.classList.contains("content-file-dl")) {
        el.addEventListener("click", async (e) => {
          e.preventDefault();
          const rec = await MediaStore.getRecord(mid);
          if (!rec) return;
          const url = await MediaStore.getBlobUrl(mid);
          const a = document.createElement("a");
          a.href = url;
          a.download = rec.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        });
      }
    }
    root.querySelectorAll("video[data-media-id]").forEach(async (v) => {
      const mid = v.getAttribute("data-media-id");
      if (mid && !v.src) {
        const url = await MediaStore.getBlobUrl(mid);
        if (url) v.src = url;
      }
    });
  },
};
