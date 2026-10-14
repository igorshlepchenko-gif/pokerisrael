export default function Privacy() {
  const updated = '14/10/2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-slate-300 leading-relaxed" dir="rtl">
      <header className="mb-8 pb-6 border-b border-slate-800">
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">מדיניות פרטיות</h1>
        <p className="text-sm text-slate-500">עודכן לאחרונה: <span className="font-mono tabular-nums">{updated}</span></p>
      </header>

      <Section title="1. כללי">
        אתר <strong>פוקר ישראל</strong> (PokerIsrael.org) ("האתר", "אנחנו") מכבד את פרטיותך.
        מדיניות זו מסבירה איזה מידע אנו אוספים, כיצד אנו משתמשים בו וכיצד אנו שומרים עליו.
        השימוש באתר מהווה הסכמה למדיניות זו.
      </Section>

      <Section title="2. איזה מידע אנו אוספים">
        <ul className="list-disc pr-5 space-y-1">
          <li><strong>פרטי הרשמה:</strong> שם, כתובת אימייל ומספר טלפון בעת יצירת חשבון.</li>
          <li><strong>פרטי הרשמה לאירועים:</strong> שם וטלפון הנמסרים בעת הרשמה לטורניר.</li>
          <li><strong>תוכן שאתה יוצר:</strong> מועדונים, טורנירים ומשחקים שמפעיל מועדון מעלה.</li>
          <li><strong>מידע טכני:</strong> סוג הדפדפן והמכשיר, הדף שממנו הגעת לאתר והדפים שבהם צפית — נאסף באופן אנונימי, כמפורט בסעיף &quot;מדידת כניסות לאתר&quot;.</li>
        </ul>
      </Section>

      <Section title="3. כיצד אנו משתמשים במידע">
        <ul className="list-disc pr-5 space-y-1">
          <li>לאפשר רישום, התחברות וניהול החשבון שלך.</li>
          <li>לחבר בין שחקנים למועדונים (למשל הפניית הרשמה ב-WhatsApp).</li>
          <li>להציג ולנהל אירועים באתר.</li>
          <li>לשפר את השירות ולשמור על אבטחת המערכת.</li>
        </ul>
      </Section>

      <Section title="4. עוגיות (Cookies)">
        האתר משתמש בעוגיות חיוניות בלבד — בעיקר לצורך שמירת ההתחברות שלך (אסימון מאובטח).
        אנו לא משתמשים בעוגיות פרסום או מעקב צד-שלישי. עמודים מסוימים כוללים נגנים מוטמעים של
        Spotify או YouTube, הכפופים למדיניות הפרטיות של אותם שירותים. ניתן למחוק עוגיות דרך הגדרות
        הדפדפן, אך הדבר עלול לפגוע בתפקוד האתר.
      </Section>

      <Section title="5. מדידת כניסות לאתר">
        כדי לדעת כמה אנשים משתמשים באתר ואילו תכנים מעניינים אותם, אנו סופרים כניסות לאתר באמצעות
        מערכת מדידה פנימית שלנו, ללא שימוש בשירותי מדידה של צד שלישי (כגון Google Analytics).
        <ul className="list-disc pr-5 space-y-1 mt-2">
          <li>המדידה <strong>אינה משתמשת בעוגיות</strong> ואינה שומרת מזהה כלשהו בדפדפן שלך.</li>
          <li><strong>כתובת ה-IP שלך אינה נשמרת.</strong> לצורך ספירת מבקרים נוצר קוד מוצפן חד-כיווני
            שמשתנה מדי יום, כך שלא ניתן לזהות אותך באמצעותו, לשחזר ממנו את כתובת ה-IP או לעקוב אחר
            ביקוריך לאורך זמן.</li>
          <li>הנתונים הנשמרים: הדף שבו צפית, סוג המכשיר (נייד, מחשב או טאבלט) והאתר שממנו הגעת
            (למשל גוגל או פייסבוק).</li>
          <li>הנתונים משמשים לסטטיסטיקה כללית בלבד ונמחקים אוטומטית לאחר כ-13 חודשים.</li>
        </ul>
      </Section>

      <Section title="6. שיתוף מידע עם צד שלישי">
        איננו מוכרים ואיננו משכירים את המידע האישי שלך. מידע שתמסור בעת הרשמה לאירוע
        (שם וטלפון) מועבר למועדון המארגן לצורך הרשמתך בלבד. ייתכן שיתוף מידע אם נידרש לכך
        על פי חוק או צו שיפוטי.
      </Section>

      <Section title="7. אבטחת מידע">
        אנו נוקטים באמצעי אבטחה מקובלים: סיסמאות מאוחסנות מוצפנות (bcrypt) ולעולם אינן נחשפות,
        תקשורת מאובטחת ב-HTTPS, והגנות נוספות בשרת. עם זאת, אין אבטחה מושלמת ואיננו יכולים
        להבטיח הגנה מוחלטת.
        <p className="mt-2">
          לצורך הגנה על האתר מפני שימוש לרעה (כגון העתקה אוטומטית של תוכן או ניסיונות פריצה), אנו
          מתעדים בקשות שנחסמו או שנראו חשודות — כתובת IP, סוג הדפדפן והדף שאליו נשלחה הבקשה. תיעוד
          זה נמחק אוטומטית לאחר 30 יום.
        </p>
      </Section>

      <Section title="8. זכויותיך">
        באפשרותך לעיין במידע שלך, לעדכן אותו או לבקש את מחיקתו. לפניות בנושא פרטיות,
        צור קשר בכתובת: <a href="mailto:info@pokerisrael.org" className="text-poker-green-light hover:underline">info@pokerisrael.org</a>.
      </Section>

      <Section title="9. שינויים במדיניות">
        אנו רשאים לעדכן מדיניות זו מעת לעת. גרסה מעודכנת תפורסם בעמוד זה עם תאריך עדכון חדש.
      </Section>

      <Section title="10. יצירת קשר">
        בכל שאלה בנוגע למדיניות הפרטיות ניתן לפנות אלינו:
        <a href="mailto:info@pokerisrael.org" className="text-poker-green-light hover:underline"> info@pokerisrael.org</a>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}
