/** نمایش نام و عکس نویسنده — همیشه از پروفایل به‌روز */
const AuthorDisplay = {
  DEFAULT_AVATAR: "assets/images/avatar-default.svg",

  getUser(authorId) {
    if (!authorId || authorId === "seed") return null;
    return Store.getUsers().find((u) => u.id === authorId);
  },

  getName(post) {
    const u = this.getUser(post.authorId);
    return u?.name || post.author || "نویسنده";
  },

  getBio(post) {
    const u = this.getUser(post.authorId);
    return u?.bio || "";
  },

  getAvatarMediaId(post) {
    const u = this.getUser(post.authorId);
    return u?.avatarMediaId || post.authorAvatarMediaId || null;
  },

  avatarImgHtml(post, size = 36, className = "author-avatar") {
    const name = escapeHtml(this.getName(post));
    const mid = this.getAvatarMediaId(post);
    if (mid) {
      return `<img class="${className}" data-avatar-media="${mid}" alt="${name}" width="${size}" height="${size}" />`;
    }
    return `<img class="${className}" src="${this.DEFAULT_AVATAR}" alt="${name}" width="${size}" height="${size}" />`;
  },

  async hydrateAvatars(root) {
    if (!root) return;
    const imgs = root.querySelectorAll("[data-avatar-media]");
    await Promise.all(
      [...imgs].map(async (img) => {
        const url = await MediaStore.getBlobUrl(img.dataset.avatarMedia);
        if (url) img.src = url;
        else img.src = this.DEFAULT_AVATAR;
      })
    );
  },
};
