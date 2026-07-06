let activeFilter = "all";

function renderPosts() {
  const grid = document.getElementById("postsGrid");
  if (!grid) return;

  const posts = Api.getPublishedPosts();
  const query = (document.getElementById("postSearch")?.value || "").trim().toLowerCase();

  const filtered = posts.filter((post) => {
    const matchFilter = activeFilter === "all" || post.category === activeFilter;
    const matchSearch =
      !query ||
      post.title.toLowerCase().includes(query) ||
      post.excerpt.toLowerCase().includes(query) ||
      (post.categoryLabel || "").toLowerCase().includes(query) ||
      (post.tags || []).some((t) => t.toLowerCase().includes(query));
    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML =
      '<p class="posts-note" style="grid-column:1/-1">پستی یافت نشد.</p>';
    return;
  }

  grid.innerHTML = filtered
    .map((post) => {
      const badges = Content.getPostBadges(post);
      return `
    <a href="post.html?id=${post.id}" class="post-card post-card-link">
      <div class="post-thumb">
        <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" onerror="this.style.opacity='0.3'" />
        ${badges.length ? `<div class="thumb-badges">${badges.map((b) => `<span>${b}</span>`).join("")}</div>` : ""}
      </div>
      <div class="post-body">
        <div class="post-meta">
          <span class="post-tag">${escapeHtml(post.categoryLabel)}</span>
          <span class="post-date">${escapeHtml(post.date)}</span>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="post-author">
          ${AuthorDisplay.avatarImgHtml(post, 36)}
          <span>${escapeHtml(AuthorDisplay.getName(post))}</span>
          <span class="post-read-mini">${post.readMinutes || 1} دقیقه</span>
        </div>
      </div>
    </a>
  `;
    })
    .join("");

  AuthorDisplay.hydrateAvatars(grid);
}

function renderLibrary() {
  const list = document.getElementById("libraryList");
  if (!list) return;
  const files = Api.getAllLibraryFiles();
  if (!files.length) {
    list.innerHTML = '<p class="empty-state">فایلی منتشر نشده — در پست‌ها فایل PDF یا ZIP اضافه کنید.</p>';
    return;
  }
  list.innerHTML = files
    .map(
      (f) => `
    <div class="library-item">
      <div>
        <strong>${escapeHtml(f.name || "فایل")}</strong>
        <span style="display:block;font-size:0.85rem;color:var(--gray-500)">${escapeHtml(f.postTitle)} · ${escapeHtml(f.category)}</span>
      </div>
      <a href="post.html?id=${f.postId}" class="btn btn-sm btn-primary">مشاهده پست</a>
    </div>`
    )
    .join("");
}

function initFaq() {
  document.querySelectorAll(".faq-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
}

function initNav() {
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initFilters() {
  document.querySelectorAll(".chip[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      renderPosts();
    });
  });

  document.getElementById("postSearch")?.addEventListener("input", () => renderPosts());
}

function initRequestForm() {
  const form = document.getElementById("requestForm");
  const feedback = document.getElementById("formFeedback");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    feedback.className = "form-hint";
    feedback.textContent = "";

    if (!form.checkValidity()) {
      feedback.className = "form-hint error";
      feedback.textContent = "لطفاً همه فیلدهای الزامی را پر کنید.";
      form.reportValidity();
      return;
    }

    const result = Api.addAuthorRequest(Object.fromEntries(new FormData(form)));

    if (!result.ok) {
      feedback.className = "form-hint error";
      feedback.textContent = result.error;
      return;
    }

    feedback.className = "form-hint success";
    feedback.textContent =
      "درخواست شما ثبت شد. پس از بررسی توسط RMO، از طریق ایمیل با شما تماس گرفته می‌شود.";
    form.reset();
  });
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  const feedback = document.getElementById('contactFeedback');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.className = 'form-hint';
    feedback.textContent = '';

    if (!form.checkValidity()) {
      feedback.className = 'form-hint error';
      feedback.textContent = 'لطفاً همه فیلدهای الزامی را پر کنید.';
      form.reportValidity();
      return;
    }

    const result = await Api.sendFeedback(Object.fromEntries(new FormData(form)));
    if (!result.ok) {
      feedback.className = 'form-hint error';
      feedback.textContent = result.error || 'خطا در ارسال پیام.';
      return;
    }

    feedback.className = 'form-hint success';
    feedback.textContent = 'پیام شما ارسال شد. به زودی بررسی خواهد شد.';
    form.reset();
  });
}

function initFooterYear() {
  const el = document.getElementById("footerYear");
  if (el) el.textContent = `© ${new Date().getFullYear()}`;
  const powered = document.querySelector(".footer-powered strong[data-powered-by]");
  if (powered) powered.textContent = Store.getSite().poweredBy || "RMO";
}

function renderCourses() {
  const grid = document.querySelector(".course-grid");
  if (!grid) return;
  grid.innerHTML = Object.values(COURSES)
    .map(c => `
      <article class="course-card">
        <div class="course-thumb">
          <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)}" loading="lazy" onerror="this.style.opacity='0.3'" />
          <span class="course-level">${escapeHtml(c.level)}</span>
        </div>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description)}</p>
        <a href="course.html?id=${c.id}" class="course-link">ورود به درس ←</a>
      </article>
    `).join("");
}

function renderFilterChips() {
  const container = document.querySelector(".filter-chips");
  if (!container) return;
  let html = '<button type="button" class="chip active" data-filter="all">همه</button>';
  Object.entries(CATEGORIES).forEach(([key, val]) => {
    html += `<button type="button" class="chip" data-filter="${key}">${val}</button>`;
  });
  container.innerHTML = html;
}

function renderRequestExpertiseDropdown() {
  const select = document.getElementById("expertise");
  if (!select) return;
  let html = '<option value="">انتخاب کنید</option>';
  Object.entries(CATEGORIES).forEach(([key, val]) => {
    html += `<option value="${key}">${val}</option>`;
  });
  select.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  applySiteSettings();
  renderCourses();
  renderFilterChips();
  renderRequestExpertiseDropdown();
  renderPosts();
  renderLibrary();
  initFaq();
  initNav();
  initFilters();
  initRequestForm();
  initContactForm();
  initFooterYear();
});
