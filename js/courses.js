const COURSES = {
  anatomy: {
    id: "anatomy",
    title: "آناتومی دهان و دندان",
    level: "پایه",
    image: "assets/images/course-anatomy.jpg",
    description:
      "ساختار دندان، عصب‌ها، عروق، عضلات و روابط آناتومیک — پایه تمام درمان‌های دندانپزشکی.",
    chapters: [
      "ساختار تاج و ریشه",
      "عصب‌دهی و vascular supply",
      "تمپورومندیبولار",
      "آناتومی لثه و بافت همبند",
    ],
    outcomes: ["تشخیص آناتومیک دقیق", "برنامه‌ریزی درمان ایمن", "آمادگی امتحان عملی"],
  },
  pathology: {
    id: "pathology",
    title: "پاتولوژی دهان",
    level: "بالینی",
    image: "assets/images/course-pathology.jpg",
    description: "ضایعات بافت نرم و سخت، تشخیص افتراقی و پاتولوژی بالینی.",
    chapters: ["ضایعات سفید", "ضایعات قرمز", "تومورها", "بیوپسی و گزارش"],
    outcomes: ["تشخیص افتراقی", "ارجاع به موقع", "خواندن اسلاید"],
  },
  prostho: {
    id: "prostho",
    title: "پروتز دندانی",
    level: "عملی",
    image: "assets/images/course-prostho.jpg",
    description: "پروتز ثابت و متحرک، مواد، لابراتوار و تکنیک‌های کلینیکی.",
    chapters: ["روکش و بریج", "دنچر", "ایمپلنت پروتز", "Occlusion"],
    outcomes: ["طراحی درمان", "ارتباط با لاب", "کیفیت نهایی"],
  },
  endo: {
    id: "endo",
    title: "اندودنتیکس",
    level: "تخصصی",
    image: "assets/images/course-endo.jpg",
    description: "درمان ریشه، دستگاه روتاری، ایریگاسیون و obturation.",
    chapters: ["دسترسی", "شکل‌دهی", "ریشه‌پرکردن", "بازدرمانی"],
    outcomes: ["ورک‌فلو استاندارد", "کنترل درد", "موفقیت طولانی‌مدت"],
  },
  perio: {
    id: "perio",
    title: "پریودنتولوژی",
    level: "بالینی",
    image: "assets/images/course-perio.jpg",
    description: "بیماری‌های لثه، جراحی پریو و نگهداری.",
    chapters: ["معاینه پریو", "SRP", "جراحی", "نگهداری"],
    outcomes: ["ثبت شاخص‌ها", "فاز درمان", "پیشگیری"],
  },
  ortho: {
    id: "ortho",
    title: "ارتودنسی",
    level: "تخصصی",
    image: "assets/images/course-ortho.jpg",
    description: "تشخیص ناهنجاری، سفالومتری و بیومکانیک.",
    chapters: ["رشد و نمو", "سفالومتری", "براکت", "الاینر"],
    outcomes: ["تشخیص", "پلن درمان", "Retention"],
  },
};

// همگام‌سازی دروس ذخیره شده در مرورگر با لیست دروس اصلی
try {
  const storedCourses = localStorage.getItem("dental_courses");
  if (storedCourses) {
    Object.assign(COURSES, JSON.parse(storedCourses));
  }
} catch (e) {
  console.error("Failed to load courses from localStorage", e);
}
