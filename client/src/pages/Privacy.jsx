export default function Privacy() {
  const updated = '03/06/2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-slate-300 leading-relaxed" dir="rtl">
      <h1 className="text-3xl font-black text-white mb-2">מדיניות פרטיות</h1>
      <p className="text-sm text-slate-500 mb-8">עודכן לאחרונה: {updated}</p>

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
          <li><strong>מידע טכני:</strong> כתובת IP, סוג דפדפן ונתוני שימוש בסיסיים.</li>
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
        אנו לא משתמשים בעוגיות פרסום או מעקב צד-שלישי. ניתן למחוק עוגיות דרך הגדרות הדפדפן,
        אך הדבר עלול לפגוע בתפקוד האתר.
      </Section>

      <Section title="5. שיתוף מידע עם צד שלישי">
        איננו מוכרים ואיננו משכירים את המידע האישי שלך. מידע שתמסור בעת הרשמה לאירוע
        (שם וטלפון) מועבר למועדון המארגן לצורך הרשמתך בלבד. ייתכן שיתוף מידע אם נידרש לכך
        על פי חוק או צו שיפוטי.
      </Section>

      <Section title="6. אבטחת מידע">
        אנו נוקטים באמצעי אבטחה מקובלים: סיסמאות מאוחסנות מוצפנות (bcrypt) ולעולם אינן נחשפות,
        תקשורת מאובטחת ב-HTTPS, והגנות נוספות בשרת. עם זאת, אין אבטחה מושלמת ואיננו יכולים
        להבטיח הגנה מוחלטת.
      </Section>

      <Section title="7. זכויותיך">
        באפשרותך לעיין במידע שלך, לעדכן אותו או לבקש את מחיקתו. לפניות בנושא פרטיות,
        צור קשר בכתובת: <a href="mailto:info@pokerisrael.org" className="text-blue-400 hover:underline">info@pokerisrael.org</a>.
      </Section>

      <Section title="8. שינויים במדיניות">
        אנו רשאים לעדכן מדיניות זו מעת לעת. גרסה מעודכנת תפורסם בעמוד זה עם תאריך עדכון חדש.
      </Section>

      <Section title="9. יצירת קשר">
        בכל שאלה בנוגע למדיניות הפרטיות ניתן לפנות אלינו:
        <a href="mailto:info@pokerisrael.org" className="text-blue-400 hover:underline"> info@pokerisrael.org</a>
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
