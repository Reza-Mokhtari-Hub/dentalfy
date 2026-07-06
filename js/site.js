/** اعمال شخصی‌سازی سایت روی صفحه اصلی */
function applySiteSettings() {
  const s = Store.getSite();

  document.documentElement.style.setProperty("--teal-700", s.primaryColor || "#0f8a85");
  document.documentElement.style.setProperty("--teal-800", s.primaryColor || "#0d6e6a");

  const map = {
    "[data-site-name]": s.siteName,
    "[data-site-name-bold]": s.siteNameBold,
    "[data-tagline]": s.tagline,
    "[data-hero-title]": s.heroTitle,
    "[data-hero-highlight]": s.heroHighlight,
    "[data-hero-lead]": s.heroLead,
    "[data-contact-email]": s.contactEmail,
    "[data-footer-text]": s.footerText,
    "[data-powered-by]": s.poweredBy,
    "[data-stat-courses]": s.statCourses,
    "[data-stat-posts]": s.statPosts,
    "[data-stat-members]": s.statMembers,
  };

  Object.entries(map).forEach(([sel, val]) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (sel === "[data-contact-email]" && el.tagName === "A") {
        el.href = `mailto:${val}`;
        el.textContent = val;
      } else {
        el.textContent = val;
      }
    });
  });

  const title = document.querySelector("title");
  if (title) title.textContent = `${s.siteName} ${s.siteNameBold} | یادگیری تخصصی دندانپزشکی`;

  const published = Store.getPublishedPosts();
  const statPostsEl = document.querySelector("[data-stat-posts]");
  if (statPostsEl && published.length > 0) {
    const count = published.length;
    statPostsEl.textContent = count >= 10 ? `${count}+` : String(count);
  }

  // راه‌اندازی پالت جستجوی هوشمند
  initSearchPalette();
  // راه‌اندازی سوئیچ تم شب و روز
  initThemeToggle();
}

// تزریق پالت جستجو و منطق ناوبری آن
function initSearchPalette() {
  // ۱. تزریق دکمه جستجو به هدر در صورت وجود
  const nav = document.querySelector(".nav.container");
  if (nav && !document.getElementById("navSearchTrigger")) {
    const trigger = document.createElement("button");
    trigger.id = "navSearchTrigger";
    trigger.className = "nav-search-btn";
    trigger.type = "button";
    trigger.innerHTML = '<span>🔍 جستجوی سریع...</span><kbd>Ctrl+K</kbd>';
    
    // قرار دادن دکمه قبل از لینک‌های ناوبری یا دکمه منو
    const navLinks = document.getElementById("navLinks");
    if (navLinks) {
      nav.insertBefore(trigger, navLinks);
    } else {
      nav.appendChild(trigger);
    }
  }

  // ۲. تزریق بدنه پالت جستجو به انتهای بادی
  if (!document.getElementById("cmdPalette")) {
    const paletteHtml = `
      <div class="cmd-palette hidden" id="cmdPalette" role="dialog" aria-modal="true">
        <div class="cmd-palette-backdrop"></div>
        <div class="cmd-palette-box">
          <div class="cmd-palette-input-wrap">
            <span class="cmd-palette-search-icon">🔍</span>
            <input type="text" id="cmdPaletteInput" placeholder="جستجوی سریع درس، مقاله، جزوه..." autocomplete="off" />
            <kbd class="cmd-palette-close-kbd">ESC</kbd>
          </div>
          <div class="cmd-palette-results" id="cmdPaletteResults"></div>
          <div class="cmd-palette-footer">
            <kbd>↑↓</kbd> <span>حرکت</span>
            <kbd>↵ Enter</kbd> <span>انتخاب</span>
            <kbd>ESC</kbd> <span>خروج</span>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement("div");
    div.innerHTML = paletteHtml;
    document.body.appendChild(div.firstElementChild);
  }

  // المان‌ها
  const palette = document.getElementById("cmdPalette");
  const backdrop = palette.querySelector(".cmd-palette-backdrop");
  const input = document.getElementById("cmdPaletteInput");
  const resultsContainer = document.getElementById("cmdPaletteResults");
  const trigger = document.getElementById("navSearchTrigger");

  if (!palette || !input || !resultsContainer) return;

  let activeIndex = -1;

  function openPalette() {
    palette.classList.remove("hidden");
    input.value = "";
    performSearch("");
    setTimeout(() => input.focus(), 50);
  }

  function closePalette() {
    palette.classList.add("hidden");
  }

  // باز کردن با کلیک دکمه هدر
  trigger?.addEventListener("click", openPalette);

  // بستن با کلیک بک‌دراپ
  backdrop.addEventListener("click", closePalette);

  // میانبر کیبورد Ctrl+K و ESC
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (palette.classList.contains("hidden")) openPalette();
      else closePalette();
    }
    if (e.key === "Escape" && !palette.classList.contains("hidden")) {
      closePalette();
    }
  });

  // انجام جستجو روی ورودی
  input.addEventListener("input", (e) => {
    performSearch(e.target.value);
  });

  // کلیدهای ناوبری
  input.addEventListener("keydown", (e) => {
    const items = resultsContainer.querySelectorAll(".cmd-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      highlightItem(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      highlightItem(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        items[activeIndex].click();
      }
    }
  });

  function highlightItem(items) {
    items.forEach((item, idx) => {
      item.classList.toggle("active", idx === activeIndex);
      if (idx === activeIndex) {
        item.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function bindHover() {
    const items = resultsContainer.querySelectorAll(".cmd-item");
    items.forEach((item, idx) => {
      item.addEventListener("mouseenter", () => {
        activeIndex = idx;
        highlightItem(items);
      });
    });
  }

  function performSearch(query) {
    activeIndex = -1;
    if (!query.trim()) {
      resultsContainer.innerHTML = `
        <div class="cmd-group">
          <div class="cmd-group-title">صفحات کلیدی</div>
          <a href="index.html" class="cmd-item" data-index="0">🏠 صفحه اصلی</a>
          <a href="index.html#courses" class="cmd-item" data-index="1">📚 لیست کامل دروس</a>
          <a href="index.html#request" class="cmd-item" data-index="2">✍️ درخواست اکانت نویسنده</a>
          <a href="panel/index.html" class="cmd-item" data-index="3">🔑 ورود به پنل مدیریت</a>
        </div>
      `;
      bindHover();
      return;
    }

    const q = query.toLowerCase().trim();
    let html = "";
    let itemIndex = 0;

    // ۱. دروس اصلی
    const matchingCourses = Object.values(COURSES).filter(c => 
      c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
    if (matchingCourses.length) {
      html += `<div class="cmd-group"><div class="cmd-group-title">دروس اصلی</div>`;
      matchingCourses.forEach(c => {
        html += `<a href="course.html?id=${c.id}" class="cmd-item" data-index="${itemIndex++}">📖 ${escapeHtml(c.title)} <span class="cmd-badge">${c.level}</span></a>`;
      });
      html += `</div>`;
    }

    // ۲. پست‌ها
    const matchingPosts = Api.getPublishedPosts().filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.excerpt.toLowerCase().includes(q) || 
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
    if (matchingPosts.length) {
      html += `<div class="cmd-group"><div class="cmd-group-title">مطالب آموزشی</div>`;
      matchingPosts.forEach(p => {
        html += `<a href="post.html?id=${p.id}" class="cmd-item" data-index="${itemIndex++}">📝 ${escapeHtml(p.title)} <span class="cmd-item-meta">${escapeHtml(p.categoryLabel)}</span></a>`;
      });
      html += `</div>`;
    }

    // ۳. فایل‌ها
    const matchingFiles = Api.getAllLibraryFiles().filter(f => 
      f.name.toLowerCase().includes(q) || f.postTitle.toLowerCase().includes(q)
    );
    if (matchingFiles.length) {
      html += `<div class="cmd-group"><div class="cmd-group-title">فایل‌ها و جزوات</div>`;
      matchingFiles.forEach(f => {
        html += `<a href="post.html?id=${f.postId}" class="cmd-item" data-index="${itemIndex++}">📎 ${escapeHtml(f.name)} <span class="cmd-item-meta">پیوست در: ${escapeHtml(f.postTitle)}</span></a>`;
      });
      html += `</div>`;
    }

    if (itemIndex === 0) {
      html = `<div class="cmd-no-results">نتیجه‌ای برای "${escapeHtml(query)}" پیدا نشد.</div>`;
    }

    resultsContainer.innerHTML = html;
    bindHover();
    if (itemIndex > 0) {
      activeIndex = 0;
      highlightItem(resultsContainer.querySelectorAll(".cmd-item"));
    }
  }
}

// مدیریت تم شب و روز با انیمیشن ریپل دایره‌ای و سوئیچ iOS-Style
function initThemeToggle() {
  const nav = document.querySelector(".nav.container");
  if (nav && !document.getElementById("themeSwitchWrapper")) {
    const wrapper = document.createElement("div");
    wrapper.id = "themeSwitchWrapper";
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.innerHTML = `
      <label class="theme-switch" aria-label="تغییر تم" title="تغییر حالت شب/روز">
        <input type="checkbox" id="themeSwitchInput" />
        <span class="theme-slider">
          <span class="theme-slider-icons">
            <span class="icon-sun">☀️</span>
            <span class="icon-moon">🌙</span>
          </span>
        </span>
      </label>
    `;
    
    const searchTrigger = document.getElementById("navSearchTrigger");
    if (searchTrigger) {
      nav.insertBefore(wrapper, searchTrigger);
    } else {
      const navLinks = document.getElementById("navLinks");
      if (navLinks) {
        nav.insertBefore(wrapper, navLinks);
      } else {
        nav.appendChild(wrapper);
      }
    }
  }

  const checkbox = document.getElementById("themeSwitchInput");
  if (!checkbox) return;

  const isDark = document.documentElement.classList.contains("dark");
  checkbox.checked = isDark;

  checkbox.addEventListener("change", (e) => {
    const clickX = e.clientX || window.innerWidth / 2;
    const clickY = e.clientY || window.innerHeight / 2;
    const targetDark = checkbox.checked;
    const currentDark = document.documentElement.classList.contains("dark");

    if (targetDark === currentDark) return;

    const overlay = document.createElement("div");
    overlay.className = "theme-ripple-overlay";
    overlay.style.setProperty("--click-x", clickX + "px");
    overlay.style.setProperty("--click-y", clickY + "px");
    overlay.style.backgroundColor = targetDark ? "#0b1114" : "#f8fafb";
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add("animating");
    });

    setTimeout(() => {
      document.documentElement.classList.toggle("dark", targetDark);
      localStorage.setItem("dental_theme", targetDark ? "dark" : "light");
    }, 150);

    setTimeout(() => {
      overlay.remove();
    }, 450);
  });
}
