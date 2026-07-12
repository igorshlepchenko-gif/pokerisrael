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
| `CLIENT_URL` | `https://pokerisrael.org` |
| `SERVER_URL` | `https://pokerisrael.org` |
| `ADMIN_EMAIL` | המייל שלך (יקבל הרשאת אדמין) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | אם רוצים אימות מייל (אופציונלי) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | אם רוצים כניסה עם Google |

> חלון ההתחברות (session idle timeout) קבוע בקוד על 30 דקות גולשות — `JWT_EXPIRES_IN` הוסר כי הוא כבר לא נקרא. אפשר למחוק אותו ממשתני הסביבה ב-Railway, הוא פשוט לא עושה כלום יותר.

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

## שלב 6 — חיבור הדומיין PokerIsrael.org (רשם: GoDaddy)
⚠️ ל-GoDaddy אין CNAME flattening — אי אפשר CNAME על השורש. לכן www יהיה הראשי + הפניה מהשורש.

1. **Railway** → Settings → Networking → Custom Domain → הזן `www.pokerisrael.org`. העתק את יעד ה-CNAME (למשל `abc123.up.railway.app`).
2. **GoDaddy** → Domains → pokerisrael.org → **DNS** → הוסף רשומה:
   - Type: `CNAME` · Name: `www` · Value: היעד מ-Railway · TTL: ברירת מחדל
3. **GoDaddy** → Domain Settings → **Forwarding** → Add:
   - `pokerisrael.org` → `https://www.pokerisrael.org` · Permanent (301) · Forward only
4. עדכן ב-Railway: `CLIENT_URL` ו-`SERVER_URL` = `https://www.pokerisrael.org`
5. המתן ל-propagation (דקות עד שעה). SSL אוטומטי ב-Railway.

> חלופה: להעביר DNS ל-Cloudflare (חינם) — תומך CNAME על השורש, ואז `pokerisrael.org` ללא www יכול להיות הראשי.

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
