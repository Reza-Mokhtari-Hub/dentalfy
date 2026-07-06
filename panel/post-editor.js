/** ویرایشگر بلوکی پست — متن، تصویر، ویدیو، فایل */
const PostEditor = {
  blocks: [],
  container: null,

  init(container, initialBlocks = []) {
    this.container = container;
    this.blocks = JSON.parse(JSON.stringify(initialBlocks.length ? initialBlocks : [{ type: "paragraph", text: "" }]));
    this.render();
  },

  getBlocks() {
    return this.blocks.map((b) => {
      const c = { ...b };
      delete c._key;
      return c;
    });
  },

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="editor-toolbar">
        <span class="editor-label">افزودن بلوک:</span>
        ${Object.entries(Content.BLOCK_TYPES)
          .map(
            ([k, label]) =>
              `<button type="button" class="btn-xs" data-add="${k}">+ ${label}</button>`
          )
          .join("")}
      </div>
      <div class="editor-blocks" id="editorBlocks"></div>
      <p class="form-hint">حداکثر حجم آپلود فایل/ویدیو: ۲۵ مگابایت. برای ویدیو می‌توانید لینک یوتیوب یا آپارات هم بگذارید.</p>
    `;

    const list = this.container.querySelector("#editorBlocks");
    list.innerHTML = this.blocks
      .map((block, i) => this.blockEditorHtml(block, i))
      .join("");

    this.container.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => this.addBlock(btn.dataset.add));
    });

    list.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => this.removeBlock(+btn.dataset.remove));
    });
    list.querySelectorAll("[data-up]").forEach((btn) => {
      btn.addEventListener("click", () => this.moveBlock(+btn.dataset.up, -1));
    });
    list.querySelectorAll("[data-down]").forEach((btn) => {
      btn.addEventListener("click", () => this.moveBlock(+btn.dataset.down, 1));
    });

    this.bindBlockInputs(list);
  },

  defaultBlock(type) {
    const map = {
      paragraph: { type: "paragraph", text: "" },
      heading: { type: "heading", level: 2, text: "" },
      image: { type: "image", url: "", caption: "" },
      video: { type: "video", url: "", caption: "" },
      file: { type: "file", name: "", mediaId: "", url: "" },
      quote: { type: "quote", text: "", author: "" },
      list: { type: "list", ordered: false, items: [""] },
      divider: { type: "divider" },
    };
    return { ...(map[type] || map.paragraph) };
  },

  addBlock(type) {
    this.blocks.push(this.defaultBlock(type));
    this.render();
  },

  removeBlock(i) {
    this.blocks.splice(i, 1);
    if (!this.blocks.length) this.blocks.push(this.defaultBlock("paragraph"));
    this.render();
  },

  moveBlock(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= this.blocks.length) return;
    [this.blocks[i], this.blocks[j]] = [this.blocks[j], this.blocks[i]];
    this.render();
  },

  blockEditorHtml(block, i) {
    const label = Content.BLOCK_TYPES[block.type] || block.type;
    let inner = "";

    switch (block.type) {
      case "paragraph":
        inner = `<textarea data-field="text" rows="4" placeholder="متن پاراگراف...">${escapeHtml(block.text || "")}</textarea>`;
        break;
      case "heading":
        inner = `
          <select data-field="level"><option value="2" ${block.level !== 3 ? "selected" : ""}>H2</option><option value="3" ${block.level === 3 ? "selected" : ""}>H3</option></select>
          <input data-field="text" value="${escapeHtml(block.text || "")}" placeholder="عنوان" />`;
        break;
      case "image":
        inner = `
          <input data-field="url" dir="ltr" value="${escapeHtml(block.url || "")}" placeholder="لینک تصویر یا آپلود زیر" />
          <input type="file" accept="image/*" data-upload="image" data-index="${i}" />
          ${block.mediaId ? `<span class="upload-ok">✓ تصویر آپلود شد</span>` : ""}
          <input data-field="caption" value="${escapeHtml(block.caption || "")}" placeholder="توضیح تصویر (اختیاری)" />`;
        break;
      case "video":
        inner = `
          <input data-field="url" dir="ltr" value="${escapeHtml(block.url || "")}" placeholder="لینک YouTube / Aparat / mp4" />
          <input type="file" accept="video/mp4,video/webm" data-upload="video" data-index="${i}" />
          ${block.mediaId ? `<span class="upload-ok">✓ ویدیو آپلود شد</span>` : ""}
          <input data-field="caption" value="${escapeHtml(block.caption || "")}" placeholder="توضیح ویدیو" />`;
        break;
      case "file":
        inner = `
          <input data-field="name" value="${escapeHtml(block.name || "")}" placeholder="نام فایل" />
          <input data-field="url" dir="ltr" value="${escapeHtml(block.url || "")}" placeholder="لینک مستقیم (اختیاری)" />
          <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.mp4,.png,.jpg" data-upload="file" data-index="${i}" />
          ${block.mediaId ? `<span class="upload-ok">✓ ${escapeHtml(block.name || "فایل")} — ${Content.formatSize(block.size || 0)}</span>` : ""}`;
        break;
      case "quote":
        inner = `
          <textarea data-field="text" rows="2">${escapeHtml(block.text || "")}</textarea>
          <input data-field="author" value="${escapeHtml(block.author || "")}" placeholder="نویسنده نقل‌قول" />`;
        break;
      case "list":
        inner = `
          <label><input type="checkbox" data-field="ordered" ${block.ordered ? "checked" : ""} /> شماره‌دار</label>
          <div class="list-items" data-list="${i}">
            ${(block.items || [""]).map((it, j) => `<input data-list-item="${j}" value="${escapeHtml(it)}" placeholder="آیتم ${j + 1}" />`).join("")}
          </div>
          <button type="button" class="btn-xs" data-add-list-item="${i}">+ آیتم</button>`;
        break;
      case "divider":
        inner = `<p class="form-hint">خط جداکننده</p>`;
        break;
      default:
        inner = "";
    }

    return `
      <div class="editor-block" data-block-index="${i}">
        <div class="editor-block-head">
          <strong>${label}</strong>
          <div class="editor-block-actions">
            <button type="button" class="btn-xs" data-up="${i}" title="بالا">↑</button>
            <button type="button" class="btn-xs" data-down="${i}" title="پایین">↓</button>
            <button type="button" class="btn-xs danger" data-remove="${i}">حذف</button>
          </div>
        </div>
        <div class="editor-block-body">${inner}</div>
      </div>`;
  },

  bindBlockInputs(list) {
    list.querySelectorAll("[data-field]").forEach((el) => {
      const i = +el.closest("[data-block-index]").dataset.blockIndex;
      const field = el.dataset.field;
      const evt = el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
      el.addEventListener(evt, () => {
        if (field === "ordered") this.blocks[i].ordered = el.checked;
        else if (field === "level") this.blocks[i].level = +el.value;
        else this.blocks[i][field] = el.value;
      });
    });

    list.querySelectorAll("[data-list-item]").forEach((el) => {
      const wrap = el.closest("[data-list]");
      const i = +wrap.dataset.list;
      const j = +el.dataset.listItem;
      el.addEventListener("input", () => {
        if (!this.blocks[i].items) this.blocks[i].items = [];
        this.blocks[i].items[j] = el.value;
      });
    });

    list.querySelectorAll("[data-add-list-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = +btn.dataset.addListItem;
        if (!this.blocks[i].items) this.blocks[i].items = [];
        this.blocks[i].items.push("");
        this.render();
      });
    });

    list.querySelectorAll("[data-upload]").forEach((input) => {
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        const i = +input.dataset.index;
        const kind = input.dataset.upload;
        const status = input.parentElement.querySelector(".upload-ok") || document.createElement("span");
        try {
          input.disabled = true;
          if (kind === "image") {
            const meta = await MediaStore.saveFile(file);
            const url = await MediaStore.getBlobUrl(meta.id);
            this.blocks[i].mediaId = meta.id;
            this.blocks[i].url = url;
          } else {
            const meta = await MediaStore.saveFile(file);
            this.blocks[i].mediaId = meta.id;
            this.blocks[i].name = meta.name;
            this.blocks[i].mime = meta.mime;
            this.blocks[i].size = meta.size;
            if (kind === "video") {
              this.blocks[i].source = "file";
              const url = await MediaStore.getBlobUrl(meta.id);
              this.blocks[i].url = url;
            }
          }
          this.render();
        } catch (err) {
          alert(err.message || "خطا در آپلود");
        } finally {
          input.disabled = false;
        }
      });
    });
  },
};
