# 🂡 פוקר לייב ישראל — Project Onboarding

## מה הפרויקט הזה?
אתר רישום טורנירי פוקר חי בישראל. בעלי מועדונים מוסיפים טורנירים, גולשים מחפשים ומסננים, ומבצעים רישום דרך WhatsApp.

---

## Stack טכני
| שכבה | טכנולוגיה |
|---|---|
| Frontend | React 18 + Vite (port **5173**) |
| Backend | Node.js + Express (port **5000**) |
| Database | PostgreSQL (port **1986**) |
| Auth | JWT + bcryptjs |
| Style | Tailwind CSS v3, RTL Hebrew, `darkMode: 'class'` |
| Fonts | Heebo (Google Fonts) |

---

## הרצת הפרויקט

### שרת (Backend)
```bash
cd "D:\clod projects\poker-live-israel\server"
# node לא ב-PATH — משתמשים בנתיב מלא:
"C:\Program Files\nodejs\node.exe" index.js
# או עם nodemon (אם מותקן):
npm run dev
```
קובץ `.env` נמצא ב-`server/.env` — כולל DB_PORT=1986, JWT_SECRET וכו'.

### לקוח (Frontend)
```bash
cd "D:\clod projects\poker-live-israel\client"
npm run dev
```

### PostgreSQL
- Port: **1986**
- DB: `poker_live_israel`
- User: `postgres`
- psql: `C:\Program Files\PostgreSQL\12\bin\psql.exe`

---

## מבנה תיקיות מרכזי
```
poker-live-israel/
├── client/src/
│   ├── pages/
│   │   ├── Home.jsx          ← דף ראשי: רשימת טורנירים + פילטרים
│   │   ├── Dashboard.jsx     ← ניהול בעל מועדון: טורנירים + מועדונים
│   │   ├── AdminPanel.jsx    ← פאנל מנהל מערכת
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── components/
│   │   ├── Tournament/
│   │   │   ├── TournamentCard.jsx       ← כרטיס בתצוגת grid
│   │   │   ├── TournamentListRow.jsx    ← שורה בתצוגת רשימה
│   │   │   ├── TournamentDetailModal.jsx ← מודל פרטים (read-only)
│   │   │   └── TournamentForm.jsx       ← טופס יצירה/עריכה
│   │   ├── VenueMultiSelect.jsx         ← dropdown multi-select מועדונים
│   │   └── Layout/
│   │       ├── Navbar.jsx
│   │       └── Footer.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── ThemeContext.jsx   ← dark/light mode
│   ├── utils/
│   │   ├── api.js             ← axios instance (baseURL: http://localhost:5000/api)
│   │   └── whatsapp.js        ← formatTime, formatDate, formatCost, DAYS_HE, buildWhatsAppLink
│   ├── App.jsx
│   └── index.css              ← Tailwind + custom classes + .light mode overrides
├── server/
│   ├── index.js               ← Express app entry point
│   ├── routes/
│   │   ├── tournaments.js     ← GET / POST PUT טורנירים ומועדונים
│   │   ├── admin.js
│   │   ├── auth.js
│   │   └── upload.js          ← לוגואים + סרטונים (multer)
│   ├── controllers/
│   │   └── tournamentController.js  ← כל לוגיקת הטורנירים
│   ├── middleware/
│   │   └── auth.js            ← authenticate + requireRole
│   ├── config/db.js           ← pg Pool
│   └── database/schema.sql    ← schema + מיגרציות
```

---

## סכמת DB — טבלת tournaments (עמודות מלאות)
| עמודה | סוג | הערה |
|---|---|---|
| id | SERIAL PK | |
| venue_id | INTEGER FK | → venues.id |
| name | VARCHAR(150) | |
| description | TEXT | |
| cost | DECIMAL(10,2) | |
| start_time | TIMESTAMP | |
| estimated_end_time | TIMESTAMP | nullable |
| stages | JSONB | מערך שלבים/הפסקות |
| starting_stack | INTEGER | nullable |
| level_duration | INTEGER | דקות לשלב (ברירת מחדל) |
| day_of_week | INTEGER | 0=ראשון … 6=שבת |
| is_recurring | BOOLEAN | |
| status | VARCHAR(20) | `pending` / `approved` / `rejected` |
| rejection_reason | TEXT | nullable |
| is_boosted | BOOLEAN | מוצג תמיד ראשון |
| boost_label | VARCHAR(50) | טקסט על badge |
| re_entry | VARCHAR(20) | `1X` / `2X` / `3X` / `4X` / `Unlimited` / NULL |
| late_reg_level | INTEGER | מספר שלב / NULL |
| created_by | INTEGER FK | → users.id |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> **מיגרציה:** `re_entry` ו-`late_reg_level` נוספו ב-`ALTER TABLE` — **חובה** להריץ `schema.sql` מחדש או להוסיף ידנית אם DB חדש.

---

## API Routes עיקריים
```
GET    /api/tournaments              ← כל הטורנירים (תומך: city, day, search, sort, venue_ids)
GET    /api/tournaments/public-venues ← מועדונים מאושרים לפילטר
GET    /api/tournaments/my           ← טורנירים של בעל המועדון המחובר [auth]
POST   /api/tournaments              ← יצירת טורניר [auth: venue_owner/admin]
PUT    /api/tournaments/:id          ← עדכון טורניר [auth: venue_owner/admin]
POST   /api/tournaments/bulk         ← העלאת Excel/CSV [auth]
GET    /api/tournaments/venues       ← מועדונים של המשתמש [auth]
POST   /api/tournaments/venues       ← יצירת מועדון [auth]
```

### אפשרויות מיון (sort param)
| ערך | תיאור |
|---|---|
| `start_time` | ברירת מחדל — לפי שעה |
| `day` | לפי יום בשבוע |
| `cost_asc` | עלות עולה |
| `cost_desc` | עלות יורד |
| `venue_name` | שם מועדון א-ת |

### הערות חשובות על query
- טורנירים מקודמים (`is_boosted=true`) מוצגים **תמיד** — גם עם פילטר פעיל
- `venue_ids` מקבל רשימה מופרדת בפסיקים: `?venue_ids=1,3,7`

---

## פיצ'רים שנבנו (לפי סדר כרונולוגי)

### v1 (commit: d5948c7)
- אימות JWT (register/login/roles)
- דף ראשי עם כרטיסים ורשימה
- דשבורד בעל מועדון + פאנל אדמין
- טופס טורניר עם טבלת בליינדים (presets: Hyper/Turbo/Regular)
- העלאת לוגו + סרטוני תדמית
- העלאת טורנירים מ-Excel/CSV

### v2 (commit: bd7f0ac)
- מודל פרטי טורניר (TournamentDetailModal) — נפתח בלחיצה על כרטיס/שורה
- הסרת עמודת שעת-סיום מטבלת הרשימה
- Dark/Light mode toggle בנאבבר

### v3 (commit: 1f14272) — נוכחי
- **מיון מורחב:** לפי זמן / יום / עלות עולה-יורד / שם מועדון
- **VenueMultiSelect:** dropdown multi-select לפילטור לפי מועדונים ספציפיים
- **Re-Entry:** dropdown בטופס (1X/2X/3X/4X/Unlimited), badge בכרטיס ובמודל
- **Late Reg:** בחירת שלב, חישוב אוטומטי של בליינדים ושעה, מוצג במודל + כרטיס
- **עריכת טורניר** (PUT) — כפתור ✏️ עריכה בדשבורד, טופס מאוכלס אוטומטית
- שגיאות ולידציה עם שם שדה ספציפי בעברית
- שינוי "מקום" → "מועדון" בכל הממשק
- כפתור סגירה מודגש במודל (עגול, אדום בhover)

---

## דגשים טכניים שנלמדו

### React / Frontend
- **אירועי DOM vs React synthetic events**: לא ניתן לטרגר onClick ב-DOM ישירות — יש להשתמש ב-`dispatchEvent(new MouseEvent('click', { bubbles: true }))`
- **z-index + `position: fixed`**: אלמנט fixed עם z-index שלילי נעלם מאחורי רקע ה-body האטום
- **multi-select dropdown**: `useRef` + `useEffect` לזיהוי קליק מחוץ לאלמנט
- **datetime-local format**: מחזיר `"YYYY-MM-DDTHH:MM"` (ללא שניות/timezone) — תקין לISO 8601
- **node-postgres + JSONB**: מחזיר JSONB כ-JavaScript object מפורסר אוטומטית

### Server
- **ולידציה עם express-validator**: שגיאות מוחזרות כ-`{ errors: [...] }` (לא `{ message }`) — יש לטפל בשני הפורמטים בlקוח
- **Route order**: routes סטטיות חייבות לפני `/:id` כדי למנוע conflicts
- **node לא ב-PATH**: נתיב מלא `C:\Program Files\nodejs\node.exe`
- **PostgreSQL port**: 1986 (לא ברירת מחדל 5432)
- **psql path**: `C:\Program Files\PostgreSQL\12\bin\psql.exe`
- **מיגרציה DB**: לאחר הוספת עמודות חדשות — חובה להריץ ALTER TABLE לפני הרצת שאילתות שמשתמשות בהן (אחרת 500)

### Git
- Branch: `master`
- 3 commits עד כה

---

## TODO / רעיונות להמשך
- [ ] דף פרופיל שחקן
- [ ] Push notifications על אישור/דחיית טורניר
- [ ] פרסום הטורניר ב-WhatsApp broadcast
- [ ] אפשרות מחיקת טורניר בדשבורד
- [ ] עריכת מועדון (לוגו, פרטים)
- [ ] חיפוש מתקדם (עלות מ-עד, שעה מ-עד)
- [ ] SEO + meta tags
- [ ] Deploy (Railway / Render + Vercel)
