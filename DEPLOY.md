# نشر الموقع على الويب

هذا المشروع هو موقع ثابت (HTML/CSS/JS) ويمكن نشره بسهولة على خدمات الاستضافة المجانية. فيما يلي ثلاثة خيارات عملية:

## 1) GitHub Pages (موصى به)

- المتطلبات:
  - حساب GitHub.
  - أنشئ مستودعًا جديدًا (مثال: `pms-ar`).

- خطوات سريعة باستخدام الطرفية (PowerShell) داخل مجلد المشروع:
  1. تهيئة المستودع محليًا:
     - `git init`
     - `git add index.html script.js style.css dev-server.ps1 DEPLOY.md`
     - `git commit -m "Initial deploy"`
     - `git branch -M main`
  2. اربط المستودع البعيد:
     - `git remote add origin https://github.com/<USERNAME>/<REPO>.git`
     - `git push -u origin main`
  3. فعّل GitHub Pages:
     - من إعدادات المستودع في GitHub: Settings → Pages → Source = Deploy from a branch → Branch = `main`، Folder = `/`.
  4. رابط الموقع سيكون: `https://<USERNAME>.github.io/<REPO>/`

- دومين مخصص (اختياري):
  - أضف ملف باسم `CNAME` في الجذر يحتوي اسم الدومين (مثال: `example.com`).
  - أضف سجل DNS من النوع CNAME يشير إلى: `<USERNAME>.github.io`.

## 2) Netlify (سهل جدًا)
- ادخل `https://app.netlify.com/`.
- أنشئ موقعًا جديدًا ثم اسحب وأسقط مجلد المشروع مباشرة (Drag & Drop).
- يدعم المواقع الثابتة فورًا.

## 3) Cloudflare Pages
- ادخل `https://pages.cloudflare.com/`.
- اربط بـ GitHub واختر المستودع، وسيبني الموقع تلقائيًا.

---

## تشغيل داخلي داخل الشبكة المحلية (غير عام)
- لتوفير الموقع على كل الواجهات بدل `localhost`:
  - افتح PowerShell كمسؤول (Admin) ونفّذ:
    - `netsh http add urlacl url=http://+:8010/ user=Everyone`
  - ثم داخل مجلد المشروع:
    - `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
    - `./dev-server.ps1 -Port 8010 -Host *`
  - احصل على عنوان جهازك عبر `ipconfig` ثم افتح من الأجهزة داخل الشبكة: `http://<IPv4-Address>:8010/`
- ملاحظة: للوصول من خارج الشبكة تحتاج فتح منفذ/تحويله في الراوتر أو استخدام خدمة نفق (مثل ngrok أو Cloudflare Tunnel).

---

## نصائح
- المسارات نسبية بالفعل (`script.js`, `style.css`)، لذلك الموقع يعمل على GitHub Pages دون تعديل.
- بعد كل تعديل، ادفع التغييرات إلى `main` ليُحدَّث الموقع.