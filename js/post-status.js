/** وضعیت انتشار پست */
const POST_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  PUBLISHED: "published",
  REJECTED: "rejected",
};

const POST_STATUS_LABEL = {
  draft: "پیش‌نویس",
  pending: "در انتظار تأیید",
  published: "منتشر شده",
  rejected: "رد شده — نیاز به ویرایش",
};

function isPostPublic(post) {
  const s = post.status || (post.published !== false ? POST_STATUS.PUBLISHED : POST_STATUS.DRAFT);
  return s === POST_STATUS.PUBLISHED;
}

function migratePostStatus(post) {
  if (!post) return post;
  if (!post.status) {
    post.status =
      post.published === false ? POST_STATUS.DRAFT : POST_STATUS.PUBLISHED;
  }
  post.published = post.status === POST_STATUS.PUBLISHED;
  return post;
}
