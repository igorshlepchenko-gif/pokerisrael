export default function Accessibility() {
  const updated = '03/06/2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-slate-300 leading-relaxed" dir="rtl">
      <h1 className="text-3xl font-black text-white mb-2">הצהרת נגישות</h1>
      <p className="text-sm text-slate-500 mb-8">עודכן לאחרונה: {updated}</p>

      <Section title="מחויבות לנגישות">
        אתר <strong>פוקר ישראל</strong> רואה חשיבות רבה במתן שירות שוויוני לכלל הגולשים,
        לרבות אנשים עם מוגבלות. אנו פועלים להנגיש את האתר ולשפר אותו באופן מתמשך,
        בהתאם לתקן הישראלי ת"י 5568 המבוסס על הנחיות WCAG 2.0 ברמה AA.
      </Section>

      <Section title="כלי הנגישות באתר">
        באתר מותקן <strong>סרגל נגישות</strong> (כפתור ♿ בפינת המסך) המאפשר:
        <ul className="list-disc pr-5 space-y-1 mt-2">
          <li>הגדלה והקטנה של גודל הטקסט</li>
          <li>ניגודיות גבוהה</li>
          <li>הדגשת קישורים</li>
          <li>גופן קריא</li>
          <li>איפוס ההגדרות</li>
        </ul>
      </Section>

      <Section title="התאמות נוספות">
        <ul className="list-disc pr-5 space-y-1">
          <li>ניווט מלא באמצעות מקלדת</li>
          <li>מבנה כותרות וסמנטיקה תקינה</li>
          <li>טקסט חלופי לתמונות ולוגואים</li>
          <li>תאימות לקוראי מסך</li>
          <li>תמיכה בכיווניות RTL</li>
        </ul>
      </Section>

      <Section title="הסתייגות">
        על אף מאמצינו להנגיש את כלל הדפים, ייתכן שחלקים מסוימים טרם הונגשו במלואם או
        נמצאים בתהליך שיפור. אנו ממשיכים לפעול לשיפור הנגישות באופן שוטף.
      </Section>

      <Section title="פנייה בנושא נגישות">
        נתקלת בבעיית נגישות או שיש לך הצעה לשיפור? נשמח לשמוע.
        ניתן לפנות לרכז הנגישות שלנו בכתובת:
        <a href="mailto:accessibility@pokerisrael.org" className="text-blue-400 hover:underline"> accessibility@pokerisrael.org</a>.
        אנו נעשה כמיטב יכולתנו לטפל בפנייה בהקדם.
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
