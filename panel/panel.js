(function () {
  // هک هوشمند برای خواندن مستقیم از حافظه محلی در صورت اختلال در سشن آفلاین
  let user = Api.getSessionUser();
  if (!user) {
    const localUser = localStorage.getItem("dental_user");
    if (localUser) {
      try { user = JSON.parse(localUser); } catch(e) { user = null; }
    }
  }

  if (!user) {
    window.location.href = "index.html";
    return;
  }
  let currentUser = Api.getSessionUser();
  const isAdmin = Auth.isAdmin(currentUser);
  const ADMIN_VIEWS = [
    "overview",
    "requests",
    "messages",
    "users",
    "pending-posts",
    "password-resets",
    "all-posts",
    "settings",
  ];

  let activeView = isAdmin ? "overview" : "my-posts";
  let editingPostId = null;
  let postSubmitAction = "draft";

  function refreshHeaderUser() {
    let user = Api.getSessionUser();
    if (!user) {
      const localUser = localStorage.getItem("dental_user");
      if (localUser) {
        try { user = JSON.parse(localUser); } catch(e) { user = null; }
      }
    }
    
    currentUser = user;

    if (!currentUser) {
      window.location.href = "index.html";
      return;
    }

    document.getElementById("userName").textContent = currentUser.name;
    const av = document.getElementById("headerAvatar");
    if (av) {
      av.innerHTML = AuthorDisplay.avatarImgHtml(
        { authorId: currentUser.id, author: currentUser.name },
        40,
        "header-avatar-img"
      );
      AuthorDisplay.hydrateAvatars(av);
    }
  }
  refreshHeaderUser();
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await Api.logout();
    window.location.href = "index.html";
  });

  const sidebar = document.getElementById("sidebar");
  const main = document.getElementById("panelMain");
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");

  function showModal(html) {
    modalContent.innerHTML = html;
    modal.classList.remove("hidden");
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
    modalContent.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", closeModal);
    });
  }

  function closeModal() {
    modal.classList.add("hidden");
    modalContent.innerHTML = "";
  }

  function guardView() {
    if (!isAdmin && ADMIN_VIEWS.includes(activeView)) {
      activeView = "my-posts";
    }
  }

  function pendingRequestCount() {
    if (!isAdmin) return 0;
    const r = Api.listRequests();
    return r.ok ? r.requests.filter((x) => x.status === "pending").length : 0;
  }

  function pendingPostCount() {
    if (!isAdmin) return 0;
    const r = Api.listPendingPosts();
    return r.ok ? r.posts.length : 0;
  }

  function pendingPasswordResetCount() {
    if (!isAdmin) return 0;
    const r = Api.listPasswordResets();
    return r.ok ? r.requests.filter((x) => x.status === "pending").length : 0;
  }

  function showToast(msg, type = "success") {
    let t = document.getElementById("panelToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "panelToast";
      t.className = "panel-toast";
      document.body.appendChild(t);
    }
    t.className = `panel-toast panel-toast-${type} show`;
    t.textContent = msg;
    setTimeout(() => t.classList.remove("show"), 3200);
  }

  function renderSidebar() {
    guardView();
    const pendingReq = pendingRequestCount();
    const pendingPost = pendingPostCount();
    const pendingPwd = pendingPasswordResetCount();
    if (isAdmin) {
      sidebar.innerHTML = `
        <button class="panel-nav-btn" data-view="overview">📊 داشبورد</button>
        <button class="panel-nav-btn" data-view="pending-posts">✅ تأیید پست‌ها ${pendingPost ? `<span class="badge-count">${pendingPost}</span>` : ""}</button>
        <button class="panel-nav-btn" data-view="password-resets">🔑 فراموشی رمز ${pendingPwd ? `<span class="badge-count">${pendingPwd}</span>` : ""}</button>
        <button class="panel-nav-btn" data-view="requests">📥 درخواست اکانت ${pendingReq ? `<span class="badge-count">${pendingReq}</span>` : ""}</button>
        <button class="panel-nav-btn" data-view="messages">📩 پیام‌ها</button>
        <button class="panel-nav-btn" data-view="users">👤 نویسندگان</button>
        <button class="panel-nav-btn" data-view="all-posts">📝 همه پست‌ها</button>
        <button class="panel-nav-btn" data-view="notifications">🔔 اعلان‌ها</button>
        <button class="panel-nav-btn" data-view="new-post">➕ پست جدید</button>
        <button class="panel-nav-btn" data-view="settings">⚙️ تنظیمات سایت</button>
        <button class="panel-nav-btn" data-view="profile">🖼️ پروفایل من</button>
      `;
    } else {
      sidebar.innerHTML = `
        <button class="panel-nav-btn" data-view="my-posts">📝 پست‌های من</button>
        <button class="panel-nav-btn" data-view="notifications">🔔 اعلان‌ها</button>
        <button class="panel-nav-btn" data-view="new-post">➕ پست جدید</button>
        <button class="panel-nav-btn" data-view="profile">🖼️ تنظیمات / عکس من</button>
      `;
    }
    sidebar.querySelectorAll(".panel-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === activeView);
      btn.addEventListener("click", () => {
        activeView = btn.dataset.view;
        editingPostId = null;
        render();
      });
    });
  }

  function postFormHtml(post = null) {
    const p = Content.normalizePost(post || {});
    const cats = Object.entries(CATEGORIES)
      .map(
        ([k, v]) =>
          `<option value="${k}" ${p.category === k ? "selected" : ""}>${v}</option>`
      )
      .join("");
    return `
      <div class="panel-card">
        <h2>${post ? "ویرایش پست" : "پست جدید — ویرایشگر کامل"}</h2>
        ${!isAdmin ? '<p class="form-hint" style="margin-bottom:1rem">پس از «ارسال برای تأیید»، مدیر (RMO) پست را بررسی و منتشر می‌کند.</p>' : '<p class="form-hint" style="margin-bottom:1rem">مدیر می‌تواند مستقیم منتشر کند یا در صف تأیید بگذارد.</p>'}
        ${p.status === POST_STATUS.REJECTED && p.rejectionNote ? `<div class="alert-reject"><strong>دلیل رد:</strong> ${escapeHtml(p.rejectionNote)}</div>` : ""}
        <form id="postForm">
          <input type="hidden" name="id" value="${escapeHtml(p.id || "")}" />
          <div class="form-grid-2">
            <div class="form-row">
              <label>عنوان *</label>
              <input type="text" name="title" required value="${escapeHtml(p.title || "")}" />
            </div>
            <div class="form-row">
              <label>برچسب‌ها (با کاما)</label>
              <input type="text" name="tags" value="${escapeHtml((p.tags || []).join("، "))}" placeholder="آناتومی، امتحان" />
            </div>
          </div>
          <div class="form-row">
            <label>خلاصه (کارت لیست) *</label>
            <textarea name="excerpt" rows="2" required>${escapeHtml(p.excerpt || "")}</textarea>
          </div>
          <div class="form-grid-2">
            <div class="form-row">
              <label>دسته *</label>
              <select name="category" required>${cats}</select>
            </div>
            ${isAdmin ? `<div class="form-row">
              <label>وضعیت فعلی</label>
              <select name="adminStatus">
                <option value="${POST_STATUS.DRAFT}" ${p.status === POST_STATUS.DRAFT ? "selected" : ""}>پیش‌نویس</option>
                <option value="${POST_STATUS.PENDING}" ${p.status === POST_STATUS.PENDING ? "selected" : ""}>در انتظار</option>
                <option value="${POST_STATUS.PUBLISHED}" ${p.status === POST_STATUS.PUBLISHED ? "selected" : ""}>منتشر شده</option>
                <option value="${POST_STATUS.REJECTED}" ${p.status === POST_STATUS.REJECTED ? "selected" : ""}>رد شده</option>
              </select>
            </div>` : `<div class="form-row"><label>وضعیت</label><p class="status-pill ${Content.statusClass(p.status)}">${POST_STATUS_LABEL[p.status] || p.status}</p></div>`}
          </div>
          <div class="form-row">
            <label>تصویر شاخص (اختیاری — اگر خالی بماند از اولین تصویر بلوک استفاده می‌شود)</label>
            <input type="url" name="image" dir="ltr" value="${escapeHtml(p.image || "")}" placeholder="https://..." />
          </div>
          <div class="editor-tabs">
            <button type="button" class="editor-tab active" data-tab="edit">ویرایش محتوا</button>
            <button type="button" class="editor-tab" data-tab="preview">پیش‌نمایش</button>
          </div>
          <div id="editorTabEdit">
            <div id="postEditorMount"></div>
          </div>
          <div id="editorTabPreview" class="hidden">
            <div class="editor-preview-wrap content-body" id="postPreview"></div>
          </div>
          <div class="form-actions-row">
            <button type="button" class="btn btn-outline" data-action="draft">💾 ذخیره پیش‌نویس</button>
            ${isAdmin
              ? `<button type="button" class="btn btn-primary" data-action="publish">🚀 انتشار فوری</button>`
              : `<button type="button" class="btn btn-primary" data-action="submit">📤 ارسال برای تأیید مدیر</button>`}
            ${post && p.status === POST_STATUS.PUBLISHED ? `<a href="../post.html?id=${p.id}" target="_blank" class="btn btn-outline">مشاهده در سایت</a>` : ""}
            ${post ? `<button type="button" class="btn btn-outline" id="cancelEdit">انصراف</button>` : ""}
          </div>
          <p class="form-hint" id="postFormFeedback"></p>
        </form>
      </div>
    `;
  }

  function bindPostForm(initialPost) {
    const form = document.getElementById("postForm");
    if (!form) return;

    const p = Content.normalizePost(initialPost || {});
    PostEditor.init(document.getElementById("postEditorMount"), p.blocks || []);

    document.querySelectorAll(".editor-tab").forEach((tab) => {
      tab.addEventListener("click", async () => {
        document.querySelectorAll(".editor-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const isPreview = tab.dataset.tab === "preview";
        document.getElementById("editorTabEdit").classList.toggle("hidden", isPreview);
        document.getElementById("editorTabPreview").classList.toggle("hidden", !isPreview);
        if (isPreview) {
          const prev = document.getElementById("postPreview");
          prev.innerHTML = Content.renderBlocks(PostEditor.getBlocks());
          await Content.hydrateMedia(prev);
        }
      });
    });

    document.getElementById("cancelEdit")?.addEventListener("click", () => {
      editingPostId = null;
      activeView = isAdmin ? "all-posts" : "my-posts";
      render();
    });

    form.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        postSubmitAction = btn.dataset.action;
        form.requestSubmit();
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fb = document.getElementById("postFormFeedback");
      const fd = new FormData(form);
      const tags = String(fd.get("tags") || "")
        .split(/[,،]/)
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        id: fd.get("id") || undefined,
        title: fd.get("title"),
        excerpt: fd.get("excerpt"),
        category: fd.get("category"),
        image: fd.get("image"),
        tags,
        blocks: PostEditor.getBlocks(),
        action: postSubmitAction,
      };

      if (isAdmin && fd.get("adminStatus")) {
        payload.status = fd.get("adminStatus");
        if (payload.status === POST_STATUS.PUBLISHED) payload.action = "publish";
      }

      const result = await Api.savePost(payload);

      if (!result.ok) {
        fb.className = "form-hint error";
        fb.textContent = result.error;
        return;
      }

      const msg =
        postSubmitAction === "submit"
          ? "ارسال شد — منتظر تأیید مدیر بمانید."
          : postSubmitAction === "publish"
            ? "پست منتشر شد."
            : "پیش‌نویس ذخیره شد.";
      fb.className = "form-hint success";
      fb.textContent = msg;
      showToast(msg);
      editingPostId = null;
      setTimeout(() => {
        activeView = isAdmin ? "all-posts" : "my-posts";
        render();
      }, 600);
    });
  }

  function renderOverview() {
    const data = Api.getDashboardStats();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }
    const s = data.stats;
    main.innerHTML = `
      <div class="panel-stats">
        <div class="stat-box"><strong>${s.totalPosts}</strong><span>کل پست‌ها</span></div>
        <div class="stat-box"><strong>${s.publishedPosts}</strong><span>منتشر شده</span></div>
        <div class="stat-box"><strong>${s.authors}</strong><span>نویسنده</span></div>
        <div class="stat-box"><strong>${s.pendingPosts}</strong><span>پست در انتظار تأیید</span></div>
        <div class="stat-box"><strong>${s.pendingRequests}</strong><span>درخواست اکانت</span></div>
        <div class="stat-box"><strong>${s.pendingPasswordResets || 0}</strong><span>فراموشی رمز</span></div>
      </div>
      <div class="panel-card">
        <h2>گردش کار انتشار</h2>
        <ul style="padding-right:1.25rem;color:var(--gray-500)">
          <li>نویسنده → <strong>ارسال برای تأیید</strong></li>
          <li>شما → بخش <strong>تأیید پست‌ها</strong> → تأیید یا رد</li>
          <li>فقط پست‌های <strong>منتشر شده</strong> روی سایت دیده می‌شوند</li>
          <li>عکس پروفایل نویسندگان از «تنظیمات / عکس من»</li>
        </ul>
        ${s.pendingPosts > 0 ? `<a href="#" class="btn btn-primary" data-goto-pending style="margin-top:1rem">مشاهده ${s.pendingPosts} پست در انتظار</a>` : ""}
      </div>
    `;
    main.querySelector("[data-goto-pending]")?.addEventListener("click", (e) => {
      e.preventDefault();
      activeView = "pending-posts";
      render();
    });
  }

  function renderPendingPosts() {
    const data = Api.listPendingPosts();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }
    const posts = data.posts;
    if (!posts.length) {
      main.innerHTML = `<div class="panel-card"><h2>تأیید پست‌ها</h2><p class="empty-state">پستی در انتظار تأیید نیست 🎉</p></div>`;
      return;
    }

    main.innerHTML = `
      <div class="panel-card">
        <h2>پست‌های در انتظار تأیید (${posts.length})</h2>
        <p class="form-hint">پیش از انتشار در سایت، محتوا را بررسی کنید.</p>
      </div>
      ${posts
        .map(
          (p) => `
        <div class="panel-card pending-post-card">
          <div class="pending-post-head">
            <div class="pending-author">
              ${AuthorDisplay.avatarImgHtml(p, 48)}
              <div>
                <strong>${escapeHtml(AuthorDisplay.getName(p))}</strong>
                <span>${escapeHtml(p.categoryLabel)} · ${escapeHtml(p.date)}</span>
              </div>
            </div>
            <span class="status-pill status-pending">در انتظار</span>
          </div>
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.excerpt)}</p>
          <div class="table-actions" style="margin-top:1rem">
            <button class="btn-xs primary" data-approve-post="${p.id}">✓ تأیید و انتشار</button>
            <button class="btn-xs danger" data-reject-post="${p.id}">✕ رد</button>
            <button class="btn-xs" data-edit-pending="${p.id}">ویرایش</button>
            <a class="btn-xs" href="../post.html?id=${p.id}" target="_blank" style="opacity:0.5;pointer-events:none" title="بعد از تأیید">پیش‌نمایش سایت</a>
          </div>
        </div>`
        )
        .join("")}
    `;

    AuthorDisplay.hydrateAvatars(main);

    main.querySelectorAll("[data-approve-post]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = Api.approvePost(btn.dataset.approvePost);
        if (!r.ok) alert(r.error);
        else {
          showToast("پست منتشر شد.");
          render();
        }
      });
    });

    main.querySelectorAll("[data-reject-post]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const note = prompt("دلیل رد (به نویسنده نمایش داده می‌شود):", "لطفاً مطابق استاندارد اکادمی ویرایش کنید.");
        if (note === null) return;
        const r = Api.rejectPost(btn.dataset.rejectPost, note);
        if (!r.ok) alert(r.error);
        else {
          showToast("پست رد شد.", "warn");
          render();
        }
      });
    });

    main.querySelectorAll("[data-edit-pending]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingPostId = btn.dataset.editPending;
        activeView = "new-post";
        render();
      });
    });
  }

  function renderPasswordResets() {
    const data = Api.listPasswordResets();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }
    const rows = data.requests;
    main.innerHTML = `
      <div class="panel-card">
        <h2>درخواست‌های فراموشی رمز</h2>
        <p class="form-hint">نویسندگان از صفحه <a href="forgot-password.html" target="_blank">فراموشی رمز</a> درخواست می‌دهند. پس از تأیید، رمز موقت نمایش داده می‌شود.</p>
        <div class="table-wrap" style="margin-top:1rem">
          <table class="data-table">
            <thead><tr><th>نام / ایمیل</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => {
                const actions = r.status === "pending"
                  ? `<button class="btn-xs primary" data-approve-pwd="${r.id}">تأیید و رمز جدید</button>
                     <button class="btn-xs danger" data-reject-pwd="${r.id}">رد</button>`
                  : "—";
                return `<tr>
                  <td>${escapeHtml(r.name)}<br><small dir="ltr">${escapeHtml(r.email)}</small></td>
                  <td>${new Date(r.submittedAt).toLocaleDateString("fa-IR")}</td>
                  <td><span class="status-pill status-${r.status}">${r.status === "pending" ? "در انتظار" : r.status === "approved" ? "تأیید" : "رد"}</span></td>
                  <td class="table-actions">${actions}</td>
                </tr>`;
              }).join("") : `<tr><td colspan="4" class="empty-state">درخواستی نیست</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    main.querySelectorAll("[data-approve-pwd]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const r = await Api.approvePasswordReset(btn.dataset.approvePwd);
        if (!r.ok) {
          alert(r.error);
          return;
        }
        showModal(`
          <h3>رمز جدید نویسنده</h3>
          <div class="cred-box">
            <p><strong>${escapeHtml(r.user.name)}</strong></p>
            <p dir="ltr">${escapeHtml(r.user.email)}</p>
            <p>رمز: <code dir="ltr">${r.password}</code></p>
          </div>
          <button class="btn btn-primary" data-close>بستن</button>
        `);
        render();
      });
    });

    main.querySelectorAll("[data-reject-pwd]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("درخواست بازیابی رد شود؟")) {
          Api.rejectPasswordReset(btn.dataset.rejectPwd);
          showToast("رد شد.", "warn");
          render();
        }
      });
    });
  }

  function renderRequests() {
    const data = Api.listRequests();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }
    const requests = data.requests;
    const rows =
      requests.length === 0
        ? `<tr><td colspan="5" class="empty-state">درخواستی نیست</td></tr>`
        : requests
            .map((r) => {
              const actions =
                r.status === "pending"
                  ? `<button class="btn-xs primary" data-approve="${r.id}">تأیید</button>
                     <button class="btn-xs danger" data-reject="${r.id}">رد</button>`
                  : "—";
              return `<tr>
                <td>${escapeHtml(r.fullName)}<br><small dir="ltr">${escapeHtml(r.email)}</small></td>
                <td>${escapeHtml(r.university || "")}</td>
                <td>${CATEGORIES[r.expertise] || r.expertise}</td>
                <td><span class="status-pill status-${r.status}">${r.status === "pending" ? "در انتظار" : r.status === "approved" ? "تأیید" : "رد"}</span></td>
                <td class="table-actions">${actions}</td>
              </tr>`;
            })
            .join("");

    main.innerHTML = `
      <div class="panel-card">
        <h2>درخواست‌های اکانت نویسنده</h2>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>نام / ایمیل</th><th>دانشگاه</th><th>تخصص</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    main.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const result = await Api.approveRequest(btn.dataset.approve);
        if (!result.ok) {
          alert(result.error);
          return;
        }
        showModal(`
          <h3>اکانت نویسنده ساخته شد</h3>
          <div class="cred-box">
            <p><strong>نام:</strong> ${escapeHtml(result.user.name)}</p>
            <p><strong>ایمیل:</strong> <span dir="ltr">${escapeHtml(result.user.email)}</span></p>
            <p><strong>رمز موقت:</strong> <code dir="ltr">${result.password}</code></p>
          </div>
          <p style="font-size:0.85rem;color:var(--gray-500)">نویسنده فقط پست‌های خودش را می‌بیند.</p>
          <button class="btn btn-primary" data-close>بستن</button>
        `);
        render();
      });
    });

    main.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("درخواست رد شود؟")) {
          Api.rejectRequest(btn.dataset.reject);
          render();
        }
      });
    });
  }

  function renderMessages() {
    const data = Api.listFeedback();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }

    const rows = data.feedback.length
      ? data.feedback
          .map((m) => {
            const statusLabel = m.status === 'new' ? 'جدید' : m.status === 'responded' ? 'پاسخ داده شده' : 'بسته شده';
            return `
              <tr>
                <td>${escapeHtml(m.name)}<br><small dir="ltr">${escapeHtml(m.email)}</small></td>
                <td>${escapeHtml(m.subject)}</td>
                <td>${new Date(m.createdAt).toLocaleDateString('fa-IR')}</td>
                <td><span class="status-pill status-${m.status}">${statusLabel}</span></td>
                <td class="table-actions">
                  <button class="btn-xs" data-view-msg="${m.id}">مشاهده</button>
                  <button class="btn-xs primary" data-reply-msg="${m.id}">پاسخ</button>
                  <button class="btn-xs danger" data-close-msg="${m.id}">بستن</button>
                </td>
              </tr>`;
          })
          .join('')
      : `<tr><td colspan="5" class="empty-state">هیچ پیامی دریافت نشده است.</td></tr>`;

    main.innerHTML = `
      <div class="panel-card">
        <h2>سوال‌ها و انتقادها</h2>
        <p class="form-hint">پیام‌های کاربران را ببینید و به‌سرعت پاسخ دهید یا آنها را بایگانی کنید.</p>
        <div class="table-wrap" style="margin-top:1rem">
          <table class="data-table">
            <thead><tr><th>نام / ایمیل</th><th>موضوع</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    main.querySelectorAll('[data-view-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msg = data.feedback.find((m) => m.id === btn.dataset.viewMsg);
        if (!msg) return;
        showModal(`
          <div class="panel-card">
            <h2>جزئیات پیام</h2>
            <p><strong>نام:</strong> ${escapeHtml(msg.name)}</p>
            <p><strong>ایمیل:</strong> <span dir="ltr">${escapeHtml(msg.email)}</span></p>
            <p><strong>موضوع:</strong> ${escapeHtml(msg.subject)}</p>
            <p><strong>متن پیام:</strong></p>
            <div class="content-body" style="padding:1rem;background:var(--gray-50);border-radius:var(--radius-sm);margin-bottom:1rem">${escapeHtml(msg.message).replace(/\n/g, '<br>')}</div>
            ${msg.response ? `<div class="alert-success"><strong>پاسخ قبلی:</strong><p>${escapeHtml(msg.response)}</p></div>` : ''}
            <button class="btn btn-primary" data-close>بستن</button>
          </div>
        `);
      });
    });

    main.querySelectorAll('[data-reply-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msg = data.feedback.find((m) => m.id === btn.dataset.replyMsg);
        if (!msg) return;
        showModal(`
          <div class="panel-card">
            <h2>پاسخ به پیام</h2>
            <p><strong>${escapeHtml(msg.subject)}</strong></p>
            <p><strong>از:</strong> ${escapeHtml(msg.name)} — <span dir="ltr">${escapeHtml(msg.email)}</span></p>
            <textarea id="messageReplyText" rows="6" placeholder="پاسخ خود را اینجا بنویسید"></textarea>
            <div style="margin-top:1rem;display:flex;gap:0.75rem;flex-wrap:wrap">
              <button class="btn btn-primary" id="sendReplyBtn">ارسال پاسخ</button>
              <button class="btn btn-outline" data-close>انصراف</button>
            </div>
          </div>
        `);
        document.getElementById('sendReplyBtn').addEventListener('click', async () => {
          const response = document.getElementById('messageReplyText').value.trim();
          const result = await Api.replyFeedback(msg.id, response);
          if (!result.ok) {
            alert(result.error || 'خطا در ارسال پاسخ.');
            return;
          }
          showToast('پاسخ ثبت شد.');
          closeModal();
          render();
        });
      });
    });

    main.querySelectorAll('[data-close-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('این پیام بسته شود؟')) return;
        const result = Api.replyFeedback(btn.dataset.closeMsg, '');
        if (!result.ok) {
          alert(result.error || 'خطا');
          return;
        }
        showToast('پیام بسته شد.', 'warn');
        render();
      });
    });
  }

  function renderNotifications() {
    if (isAdmin) {
      const data = Api.listNotifications();
      if (!data.ok) {
        main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
        return;
      }

      const rows = data.notifications.length
        ? data.notifications
            .map((n) => `
              <tr>
                <td>${escapeHtml(n.title)}</td>
                <td>${escapeHtml(n.targetRole)}</td>
                <td>${new Date(n.createdAt).toLocaleDateString('fa-IR')}</td>
                <td>${n.readBy.length}</td>
              </tr>`)
            .join('')
        : `<tr><td colspan="4" class="empty-state">اعلانی ارسال نشده است.</td></tr>`;

      main.innerHTML = `
        <div class="panel-card">
          <h2>ارسال اعلان</h2>
          <form id="notificationForm">
            <div class="form-row"><label>عنوان اعلان</label><input name="title" required /></div>
            <div class="form-row"><label>متن اعلان</label><textarea name="body" rows="4" required></textarea></div>
            <div class="form-row"><label>مخاطب</label>
              <select name="targetRole">
                <option value="author">نویسندگان</option>
                <option value="admin">مدیر</option>
                <option value="all">همه</option>
              </select>
            </div>
            <button class="btn btn-primary">ارسال اعلان</button>
            <p class="form-hint" id="notificationFeedback"></p>
          </form>
        </div>
        <div class="panel-card" style="margin-top:1.5rem">
          <h2>اعلان‌های ارسال شده</h2>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>عنوان</th><th>مخاطب</th><th>تاریخ</th><th>خوانده شده</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('notificationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fb = document.getElementById('notificationFeedback');
        const fd = new FormData(e.target);
        const result = await Api.sendNotification({
          title: fd.get('title'),
          body: fd.get('body'),
          targetRole: fd.get('targetRole') || 'author',
        });
        fb.className = result.ok ? 'form-hint success' : 'form-hint error';
        fb.textContent = result.ok ? 'اعلان ارسال شد.' : result.error;
        if (result.ok) {
          showToast('اعلان ارسال شد.');
          e.target.reset();
          setTimeout(render, 400);
        }
      });
      return;
    }

    const data = Api.getMyNotifications();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }
    const notifications = data.notifications;
    const rows = notifications.length
      ? notifications
          .map((n) => `
            <div class="panel-card notification-card ${n.read ? 'notification-read' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">
                <div>
                  <h3>${escapeHtml(n.title)}</h3>
                  <p>${escapeHtml(n.body)}</p>
                  <p class="form-hint" style="margin-top:0.5rem">${new Date(n.createdAt).toLocaleDateString('fa-IR')}</p>
                </div>
                ${n.read ? '' : `<button class="btn-xs primary" data-mark-read="${n.id}">خواندم</button>`}
              </div>
            </div>`)
          .join('')
      : '<p class="empty-state">اعلانی برای شما نیست.</p>';

    main.innerHTML = `
      <div class="panel-card">
        <h2>اعلان‌های من</h2>
        ${rows}
      </div>
    `;

    main.querySelectorAll('[data-mark-read]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const result = await Api.markNotificationRead(btn.dataset.markRead);
        if (!result.ok) {
          alert(result.error || 'خطا');
          return;
        }
        showToast('اعلان علامت‌گذاری شد.');
        render();
      });
    });
  }

  function renderUsers() {
    const data = Api.listAuthors();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }
    const authors = data.authors;

    main.innerHTML = `
      <div class="panel-card">
        <h2>افزودن نویسنده دستی</h2>
        <form id="addAuthorForm" class="form-grid-2" style="align-items:end">
          <div class="form-row"><label>نام</label><input name="name" required /></div>
          <div class="form-row"><label>ایمیل</label><input name="email" type="email" required dir="ltr" /></div>
          <div class="form-row"><label>رمز (خالی = خودکار)</label><input name="password" type="text" dir="ltr" /></div>
          <button type="submit" class="btn btn-primary">ایجاد</button>
        </form>
        <p class="form-hint" id="addAuthorFeedback"></p>
      </div>
      <div class="panel-card">
        <h2>لیست نویسندگان</h2>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>نام</th><th>ایمیل</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody>
              ${authors.length ? authors.map((u) => `
                <tr>
                  <td>${escapeHtml(u.name)}</td>
                  <td dir="ltr">${escapeHtml(u.email)}</td>
                  <td>${u.active !== false ? "فعال" : "غیرفعال"}</td>
                  <td class="table-actions">
                    <button class="btn-xs" data-reset="${u.id}">رمز جدید</button>
                    <button class="btn-xs" data-toggle="${u.id}">${u.active !== false ? "غیرفعال" : "فعال"}</button>
                  </td>
                </tr>`).join("") : `<tr><td colspan="4" class="empty-state">نویسنده‌ای نیست</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("addAuthorForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const result = await Api.createAuthor({
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password") || undefined,
      });
      const fb = document.getElementById("addAuthorFeedback");
      if (!result.ok) {
        fb.className = "form-hint error";
        fb.textContent = result.error;
        return;
      }
      showModal(`
        <h3>نویسنده ایجاد شد</h3>
        <div class="cred-box">
          <p><strong>ایمیل:</strong> <span dir="ltr">${escapeHtml(result.user.email)}</span></p>
          <p><strong>رمز:</strong> <code dir="ltr">${result.password}</code></p>
        </div>
        <button class="btn btn-primary" data-close>بستن</button>
      `);
      e.target.reset();
      render();
    });

    main.querySelectorAll("[data-reset]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const r = await Api.resetAuthorPassword(btn.dataset.reset);
        if (r.ok) {
          showModal(`
            <h3>رمز جدید</h3>
            <div class="cred-box"><code dir="ltr">${r.password}</code></div>
            <button class="btn btn-primary" data-close>بستن</button>
          `);
        } else alert(r.error || "خطا");
      });
    });

    main.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = Api.toggleAuthorActive(btn.dataset.toggle);
        if (!r.ok) alert(r.error);
        render();
      });
    });
  }

  function postsTable(posts) {
    if (!posts.length) return `<p class="empty-state">پستی نیست.</p>`;
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>عنوان</th><th>دسته</th>${isAdmin ? "<th>نویسنده</th>" : ""}<th>وضعیت</th><th>عملیات</th></tr></thead>
          <tbody>
            ${posts.map((p) => `
              <tr>
                <td>${escapeHtml(p.title)}</td>
                <td>${escapeHtml(p.categoryLabel)}</td>
                ${isAdmin ? `<td>${escapeHtml(p.author)}</td>` : ""}
                <td><span class="status-pill ${Content.statusClass(p.status)}">${POST_STATUS_LABEL[p.status] || p.status}</span></td>
                <td class="table-actions">
                  ${isPostPublic(p) ? `<a class="btn-xs" href="../post.html?id=${p.id}" target="_blank">مشاهده</a>` : ""}
                  <button class="btn-xs" data-edit="${p.id}">ویرایش</button>
                  <button class="btn-xs danger" data-delete="${p.id}">حذف</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function bindPostsTable() {
    main.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const got = Api.getPost(btn.dataset.edit);
        if (!got.ok) {
          alert(got.error);
          return;
        }
        editingPostId = btn.dataset.edit;
        activeView = "new-post";
        render();
      });
    });
    main.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("پست حذف شود؟")) return;
        const r = await Api.deletePost(btn.dataset.delete);
        if (!r.ok) alert(r.error);
        else render();
      });
    });
  }

  function renderAllPosts() {
    const data = Api.listPostsForPanel();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }
    main.innerHTML = `<div class="panel-card"><h2>همه پست‌ها</h2>${postsTable(data.posts)}</div>`;
    bindPostsTable();
  }

  function renderMyPosts() {
    const data = Api.listPostsForPanel();
    if (!data.ok) {
      main.innerHTML = `<p class="form-hint error">${data.error}</p>`;
      return;
    }
    const noAvatar = !currentUser.avatarMediaId;
    main.innerHTML = `
      ${noAvatar ? `<div class="panel-card" style="background:var(--mint-100);border-color:var(--mint-300)"><p>🖼️ برای نمایش <strong>عکس کنار نام</strong> در سایت، از منوی <a href="#" data-goto-profile>تنظیمات / عکس من</a> عکس پروفایل آپلود کنید.</p></div>` : ""}
      <div class="panel-card"><h2>پست‌های من</h2>${postsTable(data.posts)}</div>`;
  main.querySelector("[data-goto-profile]")?.addEventListener("click", (e) => {
      e.preventDefault();
      activeView = "profile";
      render();
    });
    bindPostsTable();
  }

  function renderNewPost() {
    let post = null;
    if (editingPostId) {
      const got = Api.getPost(editingPostId);
      if (!got.ok) {
        alert(got.error);
        activeView = "my-posts";
        editingPostId = null;
        render();
        return;
      }
      post = got.post;
    }
    main.innerHTML = postFormHtml(post);
    bindPostForm(post);
  }

  function renderSettings() {
    const s = Api.getSite();
    main.innerHTML = `
      <div class="panel-card">
        <h2>شخصی‌سازی سایت (فقط مدیر)</h2>
        <form id="settingsForm">
          <div class="form-grid-2">
            <div class="form-row"><label>نام سایت</label><input name="siteName" value="${escapeHtml(s.siteName)}" /></div>
            <div class="form-row"><label>نام برجسته</label><input name="siteNameBold" value="${escapeHtml(s.siteNameBold)}" /></div>
          </div>
          <div class="form-row"><label>شعار Hero</label><input name="tagline" value="${escapeHtml(s.tagline)}" /></div>
          <div class="form-row"><label>عنوان Hero</label><input name="heroTitle" value="${escapeHtml(s.heroTitle)}" /></div>
          <div class="form-row"><label>بخش رنگی</label><input name="heroHighlight" value="${escapeHtml(s.heroHighlight)}" /></div>
          <div class="form-row"><label>توضیح Hero</label><textarea name="heroLead" rows="3">${escapeHtml(s.heroLead)}</textarea></div>
          <div class="form-row"><label>ایمیل تماس</label><input name="contactEmail" dir="ltr" value="${escapeHtml(s.contactEmail)}" /></div>
          <div class="form-row"><label>متن فوتر</label><input name="footerText" value="${escapeHtml(s.footerText)}" /></div>
          <div class="form-row"><label>Powered by</label><input name="poweredBy" value="${escapeHtml(s.poweredBy)}" /></div>
          <div class="form-grid-2">
            <div class="form-row"><label>آمار دروس</label><input name="statCourses" value="${escapeHtml(s.statCourses)}" /></div>
            <div class="form-row"><label>آمار اعضا</label><input name="statMembers" value="${escapeHtml(s.statMembers)}" /></div>
          </div>
          <div class="form-row"><label>رنگ اصلی</label><input type="color" name="primaryColor" value="${s.primaryColor || "#0f8a85"}" /></div>
          <hr style="margin:1.5rem 0;border:none;border-top:1px solid var(--gray-100)" />
          <h3>تغییر رمز مدیر اصلی</h3>
          <div class="form-grid-2">
            <div class="form-row"><label>رمز فعلی</label><input type="password" name="currentPassword" autocomplete="current-password" /></div>
            <div class="form-row"><label>رمز جدید</label><input type="password" name="newPassword" autocomplete="new-password" /></div>
          </div>
          <hr style="margin:1.5rem 0;border:none;border-top:1px solid var(--gray-100)" />
          <h3>کد بازیابی مدیر (فراموشی رمز)</h3>
          <p class="form-hint">برای بازیابی در <a href="forgot-password.html" target="_blank">صفحه فراموشی رمز</a>. پیش‌فرض: <code dir="ltr">rmo-recover-2026</code></p>
          <div class="form-row">
            <label>کد بازیابی جدید (خالی = بدون تغییر)</label>
            <input type="text" name="newRecoveryKey" dir="ltr" autocomplete="off" />
          </div>
          <div class="form-row">
            <label>رمز فعلی مدیر (برای تغییر کد بازیابی)</label>
            <input type="password" name="recoveryCurrentPassword" autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:1rem">ذخیره</button>
          <p class="form-hint" id="settingsFeedback"></p>
        </form>
      </div>

      <div class="panel-card" style="margin-top:2rem">
        <h2>مدیریت دسته‌بندی‌ها و دروس</h2>
        <p class="form-hint" style="margin-bottom:1rem">با افزودن دسته‌بندی جدید، درس متناظر آن به فیلترهای صفحه اصلی، فرم درخواست نویسنده، پالت جستجو و منوی پست‌گذاری اضافه می‌شود.</p>
        
        <div style="margin-bottom:1.5rem">
          <table class="data-table">
            <thead>
              <tr>
                <th>کد انگلیسی دسته</th>
                <th>نام فارسی</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(CATEGORIES).map(([key, val]) => `
                <tr>
                  <td><code dir="ltr">${escapeHtml(key)}</code></td>
                  <td>${escapeHtml(val)}</td>
                  <td><span class="status-pill status-published">فعال</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <form id="addCategoryForm" style="display:flex; gap:1rem; align-items:flex-end; background:var(--gray-50); padding:1.25rem; border-radius:var(--radius-sm); border:1px solid var(--gray-200);">
          <div class="form-row" style="margin:0; flex:1;">
            <label style="font-size:0.85rem">کد دسته (حروف انگلیسی کوچک، بدون خط فاصله)</label>
            <input type="text" name="catKey" placeholder="مثال: ortho" required pattern="[a-z0-9_-]+" title="فقط حروف کوچک انگلیسی و اعداد" style="padding:0.5rem" />
          </div>
          <div class="form-row" style="margin:0; flex:1;">
            <label style="font-size:0.85rem">نام فارسی دسته</label>
            <input type="text" name="catName" placeholder="مثال: ارتودنسی" required style="padding:0.5rem" />
          </div>
          <button type="submit" class="btn btn-primary" style="height:42px; padding: 0 1.5rem">＋ افزودن</button>
        </form>
        <p class="form-hint" id="addCategoryFeedback" style="margin-top:0.5rem"></p>
      </div>
    `;

    document.getElementById("settingsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fb = document.getElementById("settingsFeedback");
      const fd = new FormData(e.target);
      const result = await Api.saveSiteSettings(
        {
          siteName: fd.get("siteName"),
          siteNameBold: fd.get("siteNameBold"),
          tagline: fd.get("tagline"),
          heroTitle: fd.get("heroTitle"),
          heroHighlight: fd.get("heroHighlight"),
          heroLead: fd.get("heroLead"),
          contactEmail: fd.get("contactEmail"),
          footerText: fd.get("footerText"),
          poweredBy: fd.get("poweredBy"),
          statCourses: fd.get("statCourses"),
          statMembers: fd.get("statMembers"),
          primaryColor: fd.get("primaryColor"),
        },
        {
          currentPassword: fd.get("currentPassword"),
          newPassword: fd.get("newPassword"),
        },
        {
          newKey: fd.get("newRecoveryKey"),
          currentPassword: fd.get("recoveryCurrentPassword"),
        }
      );
      fb.className = result.ok ? "form-hint success" : "form-hint error";
      fb.textContent = result.ok ? "ذخیره شد." : result.error;
    });

    const addCatForm = document.getElementById("addCategoryForm");
    if (addCatForm) {
      addCatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(addCatForm);
        const key = fd.get("catKey").trim().toLowerCase();
        const name = fd.get("catName").trim();
        const fb = document.getElementById("addCategoryFeedback");
        
        const result = await Api.addCategory(key, name);
        if (!result.ok) {
          fb.className = "form-hint error";
          fb.textContent = result.error;
        } else {
          fb.className = "form-hint success";
          fb.textContent = "دسته‌بندی و درس جدید با موفقیت ایجاد شد.";
          showToast("دسته‌بندی و درس جدید اضافه شد.");
          addCatForm.reset();
          setTimeout(() => {
            renderSettings();
          }, 1000);
        }
      });
    }
  }

  async function renderProfile() {
    const u = Api.getSessionUser();
    main.innerHTML = `
      <div class="panel-card profile-settings-card">
        <h2>${isAdmin ? "پروفایل مدیر" : "تنظیمات و عکس پروفایل"}</h2>
        <p class="form-hint">این عکس و نام کنار همه پست‌های شما در سایت نمایش داده می‌شود.</p>
        <form id="profileForm">
          <div class="profile-avatar-row">
            <div class="profile-avatar-preview" id="profileAvatarPreview">
              ${AuthorDisplay.avatarImgHtml({ authorId: u.id, author: u.name }, 96, "profile-avatar-lg")}
            </div>
            <div>
              <label>عکس پروفایل</label>
              <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" />
              <label style="margin-top:0.5rem;display:flex;align-items:center;gap:0.35rem">
                <input type="checkbox" name="removeAvatar" /> حذف عکس فعلی
              </label>
            </div>
          </div>
          <div class="form-row">
            <label>نام نمایشی *</label>
            <input name="name" required value="${escapeHtml(u.name)}" />
          </div>
          <div class="form-row">
            <label>بیو کوتاه (اختیاری)</label>
            <textarea name="bio" rows="2" placeholder="مثلاً: دانشجوی دکتری — علاقه‌مند به اندو">${escapeHtml(u.bio || "")}</textarea>
          </div>
          <p><strong>ایمیل:</strong> <span dir="ltr">${escapeHtml(u.email)}</span></p>
          ${!isAdmin ? `<p class="form-hint">پست‌ها بعد از تأیید RMO منتشر می‌شوند.</p>` : ""}
          <button type="submit" class="btn btn-primary">ذخیره پروفایل</button>
          <p class="form-hint" id="profileFeedback"></p>
        </form>
      </div>
    `;

    await AuthorDisplay.hydrateAvatars(main);

    document.getElementById("profileForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fb = document.getElementById("profileFeedback");
      const fd = new FormData(e.target);
      const file = fd.get("avatar");
      const result = await Api.updateProfile({
        name: fd.get("name"),
        bio: fd.get("bio"),
        avatarFile: file?.size ? file : null,
        removeAvatar: fd.get("removeAvatar") === "on",
      });
      if (!result.ok) {
        fb.className = "form-hint error";
        fb.textContent = result.error;
        return;
      }
      fb.className = "form-hint success";
      fb.textContent = "پروفایل ذخیره شد — عکس در پست‌های شما به‌روز می‌شود.";
      showToast("پروفایل به‌روز شد.");
      refreshHeaderUser();
      render();
    });
  }

  function render() {
    renderSidebar();
    switch (activeView) {
      case "overview":
        renderOverview();
        break;
      case "pending-posts":
        renderPendingPosts();
        break;
      case "password-resets":
        renderPasswordResets();
        break;
      case "requests":
        renderRequests();
        break;
      case "messages":
        renderMessages();
        break;
      case "users":
        renderUsers();
        break;
      case "all-posts":
        renderAllPosts();
        break;
      case "notifications":
        renderNotifications();
        break;
      case "my-posts":
        renderMyPosts();
        break;
      case "new-post":
        renderNewPost();
        break;
      case "settings":
        renderSettings();
        break;
      case "profile":
        renderProfile();
        break;
      default:
        isAdmin ? renderOverview() : renderMyPosts();
    }
  }

  render();
})();
