# 🚀 מדריך העלאה לאוויר — PokerIsrael.org (Railway)

הקוד **מוכן לפרודקשן**: השרת מגיש גם את הלקוח הבנוי וגם את ה-API מאותו שירות אחד.

---

## שלב 1 — העלאת הקוד ל-GitHub
> נדרש חשבון GitHub (חינמי). את הפעולות האלו אתה מבצע — אני לא יכול להתחבר לחשבון שלך.

1. צור repository חדש (פרטי) ב-https://github.com/new — בלי README.
2. במחשב, מתיקיית הפרויקט:
   ```bash
   cd "D:/clod projects/poker-live-israel"
   git remote add origin https://github.com/<USERNAME>/pokerisrael.git
   git push -u origin master
   ```
   (אם תתבקש סיסמה — השתמש ב-Personal Access Token של GitHub, לא בסיסמת החשבון.)

⚠️ קובץ `server/.env` **לא** עולה ל-git (מוגן ב-.gitignore) — וזה נכון, הסודות יוגדרו ב-Railway.

---

## שלב 2 — יצירת פרויקט ב-Railway
1. היכנס ל-https://railway.app והתחבר עם GitHub.
2. **New Project → Deploy from GitHub repo** → בחר את ה-repo.
3. Railway יזהה את `package.json` בשורש ויריץ אוטומטית:
   - `npm run build` (מתקין ובונה את הלקוח + מתקין את השרת)
   - `npm start` (מריץ את השרת)

---

## שלב 3 — הוספת מסד נתונים
1. בפרויקט: **New → Database → Add PostgreSQL**.
2. Railway יוצר משתנה `DATABASE_URL` אוטומטית — הקוד כבר יודע להשתמש בו.

---

## שלב 4 — משתני סביבה (Variables)
בשירות השרת → לשונית **Variables** → הוסף:

| משתנה | ערך |
|--------|------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | מחרוזת אקראית ארוכה (אפשר את הקיימת ב-.env המקומי) |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | `https://pokerisrael.org` |
| `SERVER_URL` | `https://pokerisrael.org` |
| `ADMIN_EMAIL` | המייל שלך (יקבל הרשאת אדמין) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | אם רוצים אימות מייל (אופציונלי) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | אם רוצים כניסה עם Google |

`DATABASE_URL` כבר מוגדר אוטומטית — אל תיגע בו.

---

## שלב 5 — יצירת הטבלאות (פעם אחת)
אחרי שהשירות עלה, הרץ את הגדרת מסד הנתונים. שתי דרכים:

**א. דרך Railway CLI (מומלץ):**
```bash
npm i -g @railway/cli
railway login
railway link        # בחר את הפרויקט
railway run npm run setup-db
```

**ב. דרך לשונית הטרמינל/Deploy של Railway:** הרץ `npm run setup-db`.

זה יוצר את כל 8 הטבלאות + משתמש אדמין (לפי `ADMIN_EMAIL`, סיסמה ראשונית `Aa123456!` — שנה אותה אחרי כניסה).

---

## שלב 6 — חיבור הדומיין PokerIsrael.org
1. בשירות השרת ב-Railway → **Settings → Networking → Custom Domain** → הזן `pokerisrael.org` (וגם `www.pokerisrael.org`).
2. Railway ייתן לך רשומת **CNAME** (למשל `xxx.up.railway.app`).
3. אצל **רשם הדומיין שלך** (תגיד לי איזה — Namecheap / GoDaddy / Cloudflare וכו') → בהגדרות DNS:
   - `www` → CNAME → הערך מ-Railway
   - הדומיין הראשי (`@`) → לפי הוראות Railway (CNAME flattening / ALIAS, או A record ל-IP שייתנו)
4. המתן ל-propagation (דקות עד שעות). SSL מונפק אוטומטית ב-Railway.

---

## שלב 7 — עדכון Google OAuth (אם בשימוש)
ב-Google Cloud Console → Credentials → **Authorized redirect URIs**:
```
https://pokerisrael.org/api/auth/google/callback
```

---

## ✅ סיום
לאחר מכן, כל `git push` ל-GitHub יעדכן אוטומטית את האתר החי.

### הערות
- **גיבוי DB:** Railway מאפשר גיבויים — מומלץ להפעיל.
- **אדמין:** אם נרשמת לפני הגדרת `ADMIN_EMAIL`, הרץ ב-DB: `UPDATE users SET role='admin' WHERE email='<your-email>';`
- **אבטחה:** ודא ש-`NODE_ENV=production` מוגדר — מפעיל secure cookies + הגשת הלקוח.
