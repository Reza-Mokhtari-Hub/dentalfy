# راه‌اندازی سرور و دیتابیس (آینده)

## معماری پیشنهادی

```
مرورگر → API (Node.js / Express) → PostgreSQL
         ↑ JWT HttpOnly Cookie
```

- **مدیر (`admin`)**: دسترسی کامل — همه پست‌ها، کاربران، تنظیمات
- **نویسنده (`author`)**: فقط `posts` با `author_id = user.id`
- رمز: **bcrypt** در سرور (نه localStorage)
- Session: **JWT** در کوکی `HttpOnly` + `Secure`

## فایل‌ها

| فایل | کاربرد |
|------|--------|
| `schema.sql` | جداول PostgreSQL و نمونه RLS |
| `package.json` | تعریف وابستگی‌های Node.js |
| `index.js` | نقطه ورود Express API |
| `db.js` | اتصال به PostgreSQL |
| `routes/auth.js` | ورود، خروج و بررسی session |
| `routes/public.js` | دریافت پست‌های عمومی و ثبت درخواست نویسنده |
| `routes/panel.js` | مدیریت پست‌ها، درخواست‌ها و نویسندگان |
| `routes/site.js` | خواندن و به‌روزرسانی تنظیمات سایت |
| `middleware/auth.js` | JWT HttpOnly cookie و نقش‌ها |
| `.env.example` | نمونه متغیرهای محیطی |

## راه‌اندازی محلی

1. وارد پوشه `server/` شوید:

```bash
cd server
```

2. وابستگی‌ها را نصب کنید:

```bash
npm install
```

3. فایل `.env` را از `.env.example` کپی و مقادیر را تنظیم کنید:

```bash
copy .env.example .env
```

4. دیتابیس PostgreSQL را آماده کنید:
   - یک پایگاه داده به نام `dental_academy` بسازید
   - `server/schema.sql` را اجرا کنید

5. سرور را اجرا کنید:

```bash
npm start
```

6. اگر هنوز admin ندارید، سرور در شروع اولین حساب admin را با `ADMIN_EMAIL` و `ADMIN_PASSWORD` می‌سازد.

## نقاط ورود API

| Method | Path | شرح |
|--------|------|------|
| POST | `/api/v1/auth/login` | ورود کاربر |
| POST | `/api/v1/auth/logout` | خروج |
| GET | `/api/v1/auth/me` | کاربر فعلی |
| GET | `/api/v1/posts` | پست‌های منتشر شده عمومی |
| GET | `/api/v1/posts/:id` | دریافت یک پست منتشر شده |
| POST | `/api/v1/author-requests` | ثبت درخواست اکانت نویسنده |
| POST | `/api/v1/feedback` | ارسال پیام، سوال یا انتقاد |
| GET | `/api/v1/panel/posts` | لیست پست‌های پنل |
| GET | `/api/v1/panel/posts/:id` | دریافت پست برای ویرایش |
| POST | `/api/v1/panel/posts` | ایجاد پست جدید |
| PATCH | `/api/v1/panel/posts/:id` | ویرایش پست |
| DELETE | `/api/v1/panel/posts/:id` | حذف پست |
| GET | `/api/v1/panel/requests` | لیست درخواست‌های نویسنده (admin) |
| POST | `/api/v1/panel/requests/:id/approve` | تایید درخواست نویسنده (admin) |
| POST | `/api/v1/panel/requests/:id/reject` | رد درخواست نویسنده (admin) |
| GET | `/api/v1/panel/feedback` | لیست پیام‌های کاربران (admin) |
| POST | `/api/v1/panel/feedback/:id/reply` | پاسخ یا بستن پیام (admin) |
| POST | `/api/v1/panel/notifications` | ارسال اعلان (admin) |
| GET | `/api/v1/panel/notifications` | دریافت اعلان‌ها |
| POST | `/api/v1/panel/notifications/:id/read` | علامت‌گذاری اعلان به‌عنوان خوانده شده |
| GET | `/api/v1/panel/authors` | لیست نویسندگان ثبت‌شده (admin) |
| GET | `/api/v1/site` | خواندن تنظیمات سایت |
| PATCH | `/api/v1/site` | بروزرسانی تنظیمات سایت (admin) |

## اتصال کلاینت به API

1. اگر سایت را با `index.html` و `panel/dashboard.html` از فایل محلی اجرا می‌کنید، بهتر است از یک web server محلی استفاده کنید (مثلاً `npx serve .`).
2. در `js/config.js` مقدار `APP_CONFIG.apiBaseUrl` را به آدرس سرور خود تغییر دهید، مثلاً:

```js
const APP_CONFIG = {
  storageMode: 'remote',
  apiBaseUrl: 'https://your-domain.com/api/v1',
};
```

3. برای اینکه کوکی‌ها در سمت مرورگر ارسال شوند، دامنهٔ frontend باید با `APP_ORIGIN` مطابقت داشته باشد.
4. پس از راه‌اندازی backend، باید `js/api.js` یا یک adapter جدید (`js/api-remote.js`) را بنویسید تا به جای `Store` از این API فراخوانی کند.

## استقرار روی VPS

1. یک VPS لینوکسی با Ubuntu تهیه کنید.
2. Node.js LTS و PostgreSQL نصب کنید.
3. `server/` را روی VPS کپی کنید.
4. فایل `.env` را با اطلاعات واقعی `DATABASE_URL` و `JWT_SECRET` بسازید.
5. دیتابیس را ایجاد کنید و `schema.sql` را اجرا کنید.
6. سرویس Node را با `pm2` یا `systemd` راه‌اندازی کنید.
7. با Nginx فقط ترافیک HTTPS را به پورت Node هدایت کنید.

## نکته امنیتی

- همیشه از HTTPS استفاده کنید.
- کوکی session باید `HttpOnly`, `Secure`, `SameSite=Strict` باشد.
- نقش‌ها باید فقط در سرور بررسی شوند.
- برای ورود و درخواست‌ها می‌توانید بعداً rate limit اضافه کنید.
