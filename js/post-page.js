(function () {
  applySiteSettings();
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const article = document.getElementById("postArticle");

  if (!id) {
    article.innerHTML = `<p class="error-state">پستی انتخاب نشده. <a href="index.html#posts">بازگشت</a></p>`;
    return;
  }

  const result = Api.getPublicPost(id);
  if (!result.ok) {
    article.innerHTML = `<p class="error-state">${result.error} <a href="index.html#posts">بازگشت</a></p>`;
    return;
  }

  const post = result.post;
  const badges = Content.getPostBadges(post);
  const course = COURSES[post.category];

  article.innerHTML = `
    <header class="post-header">
      <div class="post-meta-row">
        <a href="course.html?id=${post.category}" class="post-tag">${escapeHtml(post.categoryLabel)}</a>
        <span class="post-date">${escapeHtml(post.date)}</span>
        <span class="post-read">${post.readMinutes || Content.readingTimeMinutes(post.blocks)} دقیقه مطالعه</span>
        <span class="post-views">${post.views || 0} بازدید</span>
      </div>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="post-excerpt-lead">${escapeHtml(post.excerpt)}</p>
      ${badges.length ? `<div class="post-badges">${badges.map((b) => `<span class="media-badge">${b}</span>`).join("")}</div>` : ""}
      ${(post.tags || []).length ? `<div class="post-tags">${post.tags.map((t) => `<span>#${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      <div class="post-author-row">
        ${AuthorDisplay.avatarImgHtml(post, 56, "post-author-avatar")}
        <div>
          <strong>${escapeHtml(AuthorDisplay.getName(post))}</strong>
          ${AuthorDisplay.getBio(post) ? `<p class="author-bio">${escapeHtml(AuthorDisplay.getBio(post))}</p>` : ""}
          ${course ? `<span>· <a href="course.html?id=${post.category}">${escapeHtml(course.title)}</a></span>` : ""}
        </div>
      </div>
    </header>
    ${post.image ? `<div class="post-cover"><img src="${escapeHtml(post.image)}" alt="" /></div>` : ""}
    <div class="post-content content-body" id="postContent"></div>
    <footer class="post-footer-actions">
      <a href="index.html#posts" class="btn btn-outline">همه پست‌ها</a>
      ${course ? `<a href="course.html?id=${post.category}" class="btn btn-primary">پست‌های این درس</a>` : ""}
    </footer>
  `;

  const contentEl = document.getElementById("postContent");
  contentEl.innerHTML = Content.renderBlocks(post.blocks);
  Content.hydrateMedia(contentEl);
  AuthorDisplay.hydrateAvatars(article);

  document.title = `${post.title} | اکادمی دندان`;

  const related = Api.getPublishedPosts()
    .filter((p) => p.id !== post.id && p.category === post.category)
    .slice(0, 3);
  if (related.length) {
    const sec = document.getElementById("relatedSection");
    sec.classList.remove("hidden");
    document.getElementById("relatedPosts").innerHTML = related
      .map(
        (p) => `
      <a href="post.html?id=${p.id}" class="post-card post-card-link">
        <div class="post-thumb"><img src="${escapeHtml(p.image)}" alt="" loading="lazy" /></div>
        <div class="post-body">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.excerpt)}</p>
        </div>
      </a>`
      )
      .join("");
  }

  // مدیریت پیش‌نمایش فایل PDF به صورت تقسیم صفحه
  article.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-preview-pdf");
    if (!btn) return;
    e.preventDefault();

    const url = btn.getAttribute("data-url");
    const mid = btn.getAttribute("data-media-id");
    const name = btn.getAttribute("data-name");

    let pdfUrl = url;
    if (mid) {
      pdfUrl = await MediaStore.getBlobUrl(mid);
    }

    if (pdfUrl) {
      const pane = document.getElementById("pdfPane");
      const iframe = document.getElementById("pdfIframe");
      const title = pane?.querySelector(".pdf-pane-title");
      const container = document.querySelector(".post-layout-container");

      if (pane && iframe && container) {
        iframe.src = pdfUrl;
        if (title) title.textContent = `📖 پیش‌نمایش: ${name}`;
        pane.classList.remove("hidden");
        container.classList.add("split-mode");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  });

  document.getElementById("closePdfPane")?.addEventListener("click", () => {
    const pane = document.getElementById("pdfPane");
    const iframe = document.getElementById("pdfIframe");
    const container = document.querySelector(".post-layout-container");

    if (pane && iframe && container) {
      iframe.src = "";
      pane.classList.add("hidden");
      container.classList.remove("split-mode");
    }
  });
})();
