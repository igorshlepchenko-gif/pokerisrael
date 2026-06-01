# 🗺️ תוכנית פעולה — PokerIsrael.org

מסמך זה מרכז את המשימות הבאות: חיבור דומיין, מייל דומיין, והפיכת המערכת לאפליקציית מובייל.

---

## שלב 0 — תיקונים אחרונים (לפני העלייה לאוויר)
- [ ] מעבר על כל הטפסים בכל סוגי האירועים (לייב/אונליין/קאש) ובדיקת ולידציות
- [ ] בדיקת תצוגת כרטיסים/רשימה לכל הסוגים בדף הבית
- [ ] בדיקת ייצוא Excel + ייבוא תבנית עם כל השדות החדשים
- [ ] בדיקת Google OAuth מקצה לקצה (אחרי שיש GOOGLE_CLIENT_ID אמיתי)

---

## שלב 1 — חיבור דומיין (PokerIsrael.org)

### 1.1 בחירת אירוח (Hosting)
| אפשרות | יתרון | חיסרון | מתאים ל |
|--------|--------|---------|----------|
| **Railway / Render** ⭐ | פריסה פשוטה, SSL אוטומטי, DB מובנה | עלות חודשית | התחלה מהירה |
| **VPS (Hetzner / DigitalOcean)** | שליטה מלאה, זול | דורש ניהול שרת ידני | טווח ארוך |
| **Vercel (frontend) + Railway (backend)** | CDN מהיר ל-frontend | פיצול בין שירותים | סקייל |

**המלצה:** להתחיל עם **Railway** (גם שרת Node, גם PostgreSQL, גם SSL) — הכי מהיר לעלייה לאוויר.

### 1.2 הכנת הקוד לפרודקשן
- [ ] `cd client && npm run build` → תיקיית `dist/`
- [ ] להגיש את `dist/` כסטטי מהשרת (express.static) או דרך CDN נפרד
- [ ] להוסיף ב-`server/index.js`:
  ```js
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req,res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
  ```
- [ ] `NODE_ENV=production` → מפעיל secure cookies (כבר מוכן ב-COOKIE_OPTS)

### 1.3 משתני סביבה לפרודקשן (server/.env)
```
NODE_ENV=production
CLIENT_URL=https://pokerisrael.org
SERVER_URL=https://pokerisrael.org
DB_HOST=<מה-Railway>
JWT_SECRET=<כבר קיים, 512-bit>
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
```

### 1.4 DNS (אצל רשם הדומיין)
- [ ] רשומת **A** → IP של השרת (או CNAME ל-Railway/Render)
- [ ] רשומת **CNAME** ל-`www` → הדומיין הראשי
- [ ] להמתין ל-propagation (עד 48 שעות, בד"כ דקות)

### 1.5 SSL / HTTPS
- Railway/Render — אוטומטי
- VPS — `certbot` (Let's Encrypt) + nginx reverse proxy

### 1.6 עדכון Google OAuth
- [ ] ב-Google Console → Authorized redirect URIs:
  `https://pokerisrael.org/api/auth/google/callback`

---

## שלב 2 — מייל דומיין (שליחה + קבלה במערכת)

### 2.1 אירוח מייל
| ספק | עלות | הערה |
|------|------|------|
| **Zoho Mail** ⭐ | חינם עד 5 משתמשים | תומך IMAP/SMTP + API |
| **Google Workspace** | ~$6/חודש/משתמש | מקצועי, מוכר |
| **רשם הדומיין** | לרוב כלול | בסיסי |

**המלצה:** Zoho Mail (חינם) ליצירת `info@pokerisrael.org`, `noreply@pokerisrael.org`.

### 2.2 שליחת מיילים (כבר 90% מוכן)
- הקוד הקיים: `server/utils/emailService.js` עם nodemailer
- [ ] להחליף את ה-transporter מ-`service:'gmail'` ל-SMTP של הדומיין:
  ```js
  nodemailer.createTransport({
    host: 'smtp.zoho.com', port: 465, secure: true,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  });
  ```
- [ ] לעדכן `from:` לכתובת הדומיין
- [ ] להגדיר **SPF + DKIM + DMARC** ב-DNS (מונע ספאם) — Zoho נותן הוראות

### 2.3 קבלה ותשובות בתוך המערכת (החלק המורכב)
שתי גישות:

**גישה A — IMAP polling (פשוט יותר):**
- [ ] חבילת `imapflow` או `node-imap` — מתחבר לתיבה כל X דקות
- [ ] שומר מיילים נכנסים בטבלת `messages` חדשה
- [ ] ממשק "תיבת דואר" בפאנל האדמין — קריאה + תשובה (שליחה דרך SMTP)

**גישה B — Inbound Email API (מקצועי יותר):**
- [ ] SendGrid Inbound Parse / Mailgun Routes — מייל נכנס → webhook ל-`/api/inbound-mail`
- [ ] השרת מקבל POST עם תוכן המייל ושומר ב-DB
- [ ] יתרון: real-time, ללא polling

### 2.4 סכמת DB למיילים
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  direction VARCHAR(10),      -- 'in' / 'out'
  from_addr VARCHAR(255),
  to_addr VARCHAR(255),
  subject VARCHAR(500),
  body TEXT,
  thread_id VARCHAR(100),     -- לקיבוץ שיחות
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## שלב 3 — אפליקציית מובייל (Android + iOS)

### 3.1 ניתוח אפשרויות
| גישה | שיתוף קוד | מאמץ | תחושה נייטיב | המלצה |
|------|-----------|-------|---------------|--------|
| **Capacitor** ⭐ | ~95% (עוטף את ה-React הקיים) | נמוך | טובה | ✅ **מומלץ** |
| PWA | 100% | מינימלי | בינונית | התחלה זמנית |
| React Native | ~40% (לוגיקה בלבד) | גבוה | מצוינת | טווח ארוך |
| Expo | ~40% | בינוני | מצוינת | חלופה ל-RN |

**המלצה:** **Capacitor** — כי כבר יש React + Vite. עוטפים את אותו ה-build לאפליקציה נייטיב לשתי הפלטפורמות עם שינוי מינימלי.

### 3.2 שלבי מימוש Capacitor
```bash
cd client
npm install @capacitor/core @capacitor/cli
npx cap init "PokerIsrael" "org.pokerisrael.app"
npm install @capacitor/ios @capacitor/android
npm run build
npx cap add ios
npx cap add android
npx cap sync
```
- [ ] להגדיר `server.url` ב-`capacitor.config.json` או להשתמש ב-build מקומי
- [ ] API calls → לשנות מ-relative (`/api`) ל-absolute (`https://pokerisrael.org/api`)
- [ ] CORS בשרת → לאשר את origin של האפליקציה
- [ ] JWT — לעבור מ-httpOnly cookie ל-Authorization header באפליקציה (cookies מורכבים ב-WebView)

### 3.3 התאמות UI למובייל
- [ ] בדיקת responsive בכל המסכים (כבר RTL + Tailwind — בסיס טוב)
- [ ] תפריט המבורגר לנאבר במובייל (כרגע מוסתר ב-`md:flex`)
- [ ] Safe areas (notch) — `@capacitor/status-bar`
- [ ] כפתור "הוסף למסך הבית" / splash screen

### 3.4 פיצ'רים נייטיב
- [ ] **Push notifications** — `@capacitor/push-notifications` + Firebase (FCM)
  - התראה על טורניר חדש, אישור הרשמה
- [ ] **Deep links** — פתיחת טורניר ספציפי מקישור
- [ ] שיתוף נייטיב (`@capacitor/share`)

### 3.5 פרסום בחנויות
| חנות | עלות | זמן אישור | דרישות |
|------|------|-----------|---------|
| **Google Play** | $25 חד-פעמי | 1-3 ימים | APK/AAB, מדיניות פרטיות |
| **Apple App Store** | $99/שנה | 1-7 ימים | Mac ל-build, מדיניות פרטיות, App Review |

- [ ] חשבון Apple Developer (דורש Mac או שירות ענן ל-build כמו Codemagic/EAS)
- [ ] חשבון Google Play Console
- [ ] אייקונים + screenshots + תיאור לכל חנות
- [ ] מדיניות פרטיות + תנאי שימוש (חובה לשתיהן)
- [ ] ⚠️ **שים לב:** אפליקציות הימורים/פוקר — לבדוק מדיניות החנויות. מערכת *מידע* על טורנירים (ללא משחק בכסף אמיתי באפליקציה) בד"כ מאושרת, אבל צריך ניסוח זהיר.

### 3.6 חלופה מהירה — PWA (אפשר כבר עכשיו)
- [ ] להוסיף `manifest.json` + Service Worker (`vite-plugin-pwa`)
- [ ] משתמשים יכולים "להתקין" מהדפדפן ללא חנות
- [ ] טוב כשלב ביניים עד לאפליקציות הנייטיב

---

## סדר עדיפויות מומלץ למחר
1. **תיקונים אחרונים** (שלב 0)
2. **חיבור דומיין + SSL** (שלב 1) — הבסיס להכל
3. **שליחת מייל מהדומיין** (שלב 2.1-2.2) — מהיר, משלים את אימות המייל
4. **קבלת מיילים במערכת** (שלב 2.3) — אחרי שהבסיס יציב
5. **PWA** (שלב 3.6) — ניצחון מהיר למובייל
6. **Capacitor + חנויות** (שלב 3.1-3.5) — הפרויקט הגדול

---

## הערות חשובות
- **אבטחה:** הסיסמאות מאוחסנות כ-bcrypt hash ולעולם לא נחשפות. בעת מעבר לפרודקשן לוודא `NODE_ENV=production`.
- **גיבוי DB:** לפני העלייה לאוויר — להגדיר גיבוי אוטומטי של PostgreSQL.
- **JWT באפליקציה:** במובייל לעבור ל-Authorization header (כבר נתמך במקביל ל-cookies).
