# 🂡 פוקר לייב ישראל — Poker Live Israel

אפליקציה לניהול וצפייה בטורנירי פוקר בישראל.

---

## דרישות מקדימות

1. **Node.js** (גרסה 18+) — [הורד מכאן](https://nodejs.org)
2. **PostgreSQL** — [הורד מכאן](https://www.postgresql.org/download/)

---

## הוראות הפעלה

### 1. הכנת מסד הנתונים

```sql
-- ב-psql או pgAdmin, צור מסד נתונים:
CREATE DATABASE poker_live_israel;
```

### 2. הגדרת השרת

```bash
cd server

# העתק קובץ .env
copy .env.example .env

# ערוך את .env עם הפרטים שלך:
# DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
# JWT_SECRET - שנה לסיסמה חזקה!
# ADMIN_EMAIL - המייל שלך

# התקן dependencies
npm install

# צור טבלאות ומשתמש אדמין ראשוני
npm run setup-db

# הפעל בmode פיתוח
npm run dev
```

### 3. הפעלת הפרונטאנד

```bash
cd client
npm install
npm run dev
```

הפרונטאנד יפתח ב: http://localhost:5173

---

## כניסה ראשונה

כניסת אדמין ברירת מחדל:
- **מייל**: `admin@pokerliveisrael.co.il` (או מה שהגדרת ב-ADMIN_EMAIL)
- **סיסמה**: `Admin123!@#`

**⚠️ חשוב: שנה את הסיסמה מיד לאחר ההתחברות הראשונה!**

---

## תפקידים במערכת

| תפקיד | הרשאות |
|-------|---------|
| 🃏 שחקן | צפייה בטורנירים, הרשמה דרך וואצאפ |
| 🏠 שחקן + בעל מקום | + הוספת מקומות וטורנירים (דורש אישור) |
| 👑 אדמין | + אישור/דחיית מקומות וטורנירים, ניהול משתמשים |

---

## מבנה הפרויקט

```
poker-live-israel/
├── client/          ← React + Vite + Tailwind CSS
│   └── src/
│       ├── pages/   ← Home, Login, Register, Dashboard, AdminPanel
│       ├── components/
│       ├── context/ ← AuthContext, ThemeContext
│       └── utils/   ← api.js, whatsapp.js
└── server/          ← Node.js + Express + PostgreSQL
    ├── routes/
    ├── controllers/
    ├── middleware/
    └── database/
```

---

## פריסה לשרת

```bash
# בנה את הפרונטאנד
cd client && npm run build

# העתק את תיקיית dist/ לשרת הווב שלך
# הפעל את השרת ב-production:
cd server && NODE_ENV=production npm start
```

---

## הגדרות .env שנדרשות

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=poker_live_israel
DB_USER=postgres
DB_PASSWORD=הסיסמה_שלך
JWT_SECRET=מפתח_סודי_חזק_לפחות_32_תווים
ADMIN_EMAIL=המייל_שלך@דומיין.com
CLIENT_URL=http://localhost:5173
```
