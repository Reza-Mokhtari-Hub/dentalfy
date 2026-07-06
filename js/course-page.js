(function () {
  applySiteSettings();
  const id = new URLSearchParams(location.search).get("id");
  const main = document.getElementById("courseMain");
  const course = COURSES[id];

  if (!course) {
    main.innerHTML = `<p class="container error-state">درس یافت نشد. <a href="index.html#courses">بازگشت</a></p>`;
    return;
  }

  const posts = Api.getPostsByCategory(id);

  main.innerHTML = `
    <section class="course-hero container">
      <div class="course-hero-grid">
        <div>
          <span class="course-level-pill">${escapeHtml(course.level)}</span>
          <h1>${escapeHtml(course.title)}</h1>
          <p>${escapeHtml(course.description)}</p>
        </div>
        <img src="${escapeHtml(course.image)}" alt="" class="course-hero-img" />
      </div>
    </section>
    <section class="container course-detail-grid">
      <div class="panel-card">
        <h2>سرفصل‌ها</h2>
        <ol class="course-chapters">${course.chapters.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ol>
      </div>
      <div class="panel-card">
        <h2>خروجی یادگیری</h2>
        <ul class="course-outcomes">${course.outcomes.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>
      </div>
    </section>
    <section class="container section-posts-inline">
      <h2>پست‌های این درس (${posts.length})</h2>
      <div class="posts-grid" id="coursePosts"></div>
    </section>
  `;

  document.title = `${course.title} | اکادمی دندان`;

  const grid = document.getElementById("coursePosts");
  if (!posts.length) {
    grid.innerHTML = `<p class="empty-state">هنوز پستی برای این درس منتشر نشده.</p>`;
    return;
  }

  grid.innerHTML = posts
    .map((p) => {
      const badges = Content.getPostBadges(p);
      return `
    <a href="post.html?id=${p.id}" class="post-card post-card-link">
      <div class="post-thumb"><img src="${escapeHtml(p.image)}" alt="" loading="lazy" /></div>
      <div class="post-body">
        <div class="post-meta">
          <span class="post-date">${escapeHtml(p.date)}</span>
          ${badges.map((b) => `<span class="media-badge sm">${b}</span>`).join("")}
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.excerpt)}</p>
        <div class="post-author">
          ${AuthorDisplay.avatarImgHtml(p, 32)}
          <span>${escapeHtml(AuthorDisplay.getName(p))}</span>
        </div>
      </div>
    </a>`;
    })
    .join("");

  AuthorDisplay.hydrateAvatars(grid);
})();
