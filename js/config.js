/** تنظیمات پیش‌فرض — از پنل مدیریت قابل تغییر است */
const DEFAULT_SITE = {
  siteName: "اکادمی",
  siteNameBold: "دندان",
  tagline: "پلتفرم آموزشی تخصصی",
  heroTitle: "یادگیری دروس دندانپزشکی،",
  heroHighlight: "دقیق و حرفه‌ای",
  heroLead:
    "منابع آموزشی ساختاریافته، خلاصه‌نویسی‌های کاربردی و فضایی برای اشتراک تجربه — همه در یک اکادمی مدرن برای دانشجویان و فارغ‌التحصیلان دندانپزشکی.",
  contactEmail: "info@dental-academy.ir",
  footerText: "آموزش تخصصی دندانپزشکی برای نسل بعدی دندانپزشکان.",
  poweredBy: "RMO",
  statCourses: "۲۴+",
  statPosts: "۱۲۰+",
  statMembers: "۵۰۰+",
  primaryColor: "#0f8a85",
};

/** کد بازیابی اولیه مدیر — بعد از ورود در تنظیمات سایت حتماً عوض کنید! 
 * در production باید به صورت دستی تغییر دهید و هرگز در کد قرار ندهید */
const DEFAULT_ADMIN_RECOVERY_KEY = null; // Null = باید مدیر آن را تولید کند

const DEFAULT_ADMIN = {
  email: "admin@rmo.local",
  password: "rmo2026",
  name: "مدیر RMO",
};


 
const APP_CONFIG = {
  storageMode: "remote",
  apiBaseUrl: "/api/v1",
};

const CATEGORIES = {
  anatomy: "آناتومی",
  pathology: "پاتولوژی",
  prostho: "پروتز",
  endo: "اندو",
  perio: "پریو",
  ortho: "ارتودنسی",
  other: "سایر",
};

const SEED_POSTS = [
  {
    id: "seed-1",
    title: "خلاصه آناتومی مولر اول بالا",
    excerpt: "نقشه عصب‌ها، تاج و ریشه با نکات امتحانی عملی برای دانشجویان ترم ۳.",
    content: "",
    blocks: [
      { type: "heading", level: 2, text: "آناتومی مولر اول بالا" },
      {
        type: "paragraph",
        text: "در این مطلب نقشه عصب‌ها، تاج و ریشه با نکات امتحانی عملی برای دانشجویان ترم ۳ مرور می‌شود.",
      },
      {
        type: "video",
        url: "https://www.youtube.com/watch?v=5vqVW1YLqvs",
        caption: "ویدیو آموزشی آناتومی مولر (نمونه)",
      },
      {
        type: "file",
        name: "خلاصه PDF مولر",
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      },
      { type: "quote", text: "آناتومی دقیق، پایه درمان ایمن است.", author: "اکادمی دندان" },
    ],
    tags: ["آناتومی", "مولر", "امتحان"],
    category: "anatomy",
    categoryLabel: "آناتومی",
    date: "۱۴۰۴/۰۳/۱۲",
    author: "دکتر احمدی",
    authorId: "seed",
    authorAvatar: "assets/images/avatar-1.jpg",
    image: "assets/images/post-anatomy.jpg",
    published: true,
    readMinutes: 4,
    views: 128,
    createdAt: "2025-06-01T00:00:00.000Z",
  },
  {
    id: "seed-2",
    title: "تشخیص افتراقی ضایعات سفید لثه",
    excerpt: "جدول مقایسه‌ای لکوپلاکیا، کاندیدiasis و خطوط سفید فریکشن.",
    content: "",
    category: "pathology",
    categoryLabel: "پاتولوژی",
    date: "۱۴۰۴/۰۳/۰۸",
    author: "دکتر رضایی",
    authorId: "seed",
    authorAvatar: "assets/images/avatar-2.jpg",
    image: "assets/images/post-pathology.jpg",
    published: true,
    createdAt: "2025-06-01T00:00:00.000Z",
  },
  {
    id: "seed-3",
    title: "مراحل آماده‌سازی کالج برای روکش PFM",
    excerpt: "کاهش ضخامت، مارژین و نکات لابراتواری برای نتیجه بهتر.",
    content: "",
    category: "prostho",
    categoryLabel: "پروتز",
    date: "۱۴۰۴/۰۲/۲۸",
    author: "دکتر کریمی",
    authorId: "seed",
    authorAvatar: "assets/images/avatar-3.jpg",
    image: "assets/images/post-prostho.jpg",
    published: true,
    createdAt: "2025-06-01T00:00:00.000Z",
  },
  {
    id: "seed-4",
    title: "ورک‌فلو درمان ریشه با روتاری",
    excerpt: "انتخاب فایل، ایریگاسیون و obturation — چک‌لیست گام‌به‌گام.",
    content: "",
    category: "endo",
    categoryLabel: "اندو",
    date: "۱۴۰۴/۰۲/۲۰",
    author: "دکتر موسوی",
    authorId: "seed",
    authorAvatar: "assets/images/avatar-4.jpg",
    image: "assets/images/post-endo.jpg",
    published: true,
    createdAt: "2025-06-01T00:00:00.000Z",
  },
  {
    id: "seed-5",
    title: "شاخص‌های پریودنتال در معاینه اولیه",
    excerpt: "PD، CAL و BOP — ثبت استاندارد برای پیگیری درمان.",
    content: "",
    category: "perio",
    categoryLabel: "پریو",
    date: "۱۴۰۴/۰۲/۱۵",
    author: "دکتر نوری",
    authorId: "seed",
    authorAvatar: "assets/images/avatar-2.jpg",
    image: "assets/images/post-perio.jpg",
    published: true,
    createdAt: "2025-06-01T00:00:00.000Z",
  },
  {
    id: "seed-6",
    title: "تحلیل سفالومتری برای ارتودنسی",
    excerpt: "نقاط آناتومیک Steiner و Downs با مثال تصویری.",
    content: "",
    category: "ortho",
    categoryLabel: "ارتودنسی",
    date: "۱۴۰۴/۰۲/۰۱",
    author: "دکتر صادقی",
    authorId: "seed",
    authorAvatar: "assets/images/avatar-1.jpg",
    image: "assets/images/post-ortho.jpg",
    published: true,
    createdAt: "2025-06-01T00:00:00.000Z",
  },
];


