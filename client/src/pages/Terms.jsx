export default function Terms() {
  const updated = '19/10/2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-slate-300 leading-relaxed" dir="rtl">
      <header className="mb-8 pb-6 border-b border-slate-800">
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">תנאי שימוש</h1>
        <p className="text-sm text-slate-500">עודכן לאחרונה: <span className="font-mono tabular-nums">{updated}</span></p>
      </header>

      <Section title="1. כללי">
        אתר <strong>פוקר ישראל</strong> (PokerIsrael.org) (&quot;האתר&quot;) מרכז מידע על טורנירי פוקר, משחקי קאש ומועדונים
        בישראל. השימוש באתר כפוף לתנאים אלה ול<a href="/privacy" className="text-poker-green-light hover:underline">מדיניות הפרטיות</a>.
        גלישה באתר או שימוש בו מהווים הסכמה לתנאים.
      </Section>

      <Section title="2. המידע באתר">
        המידע על טורנירים ומועדונים (מועדים, עלויות, מבני בליינדים, פרסים וכתובות) נמסר על ידי המועדונים או נאסף
        ממקורות פומביים, ומוצג כפי שהוא. ייתכנו שינויים, ביטולים או טעויות, ולכן מומלץ לאמת את הפרטים מול המועדון
        לפני ההגעה. האתר אינו צד להרשמה לטורניר או להתקשרות בינך לבין המועדון.
      </Section>

      <Section title="3. איסור העתקה ואיסוף אוטומטי של מידע">
        כל המידע המוצג באתר, לרבות רשימות הטורנירים, המועדונים, מועדי המשחק, המחירים ומבני הבליינדים, נאסף, נערך
        ומתוחזק על ידי פוקר ישראל ומהווה מאגר מידע המוגן בדין.
        <ul className="list-disc pr-5 space-y-1 mt-2">
          <li>חל איסור לאסוף, להעתיק, לשכפל או לאחזר מידע מהאתר באמצעים אוטומטיים — לרבות רובוטים, סורקים
            (scrapers/crawlers), סקריפטים או כלי בינה מלאכותית — וכן לפנות ישירות לממשקי התכנות (API) של האתר,
            ללא הסכמה מראש ובכתב.</li>
          <li>אין לפרסם מחדש מידע מהאתר, כולו או חלקו — לרבות צילומי מסך — באתר, ביישומון, ברשתות חברתיות,
            בקבוצות WhatsApp או Telegram, או בכל פלטפורמה אחרת, ללא הסכמה מראש ובכתב.</li>
          <li>פוקר ישראל רשאית לחסום גישה, לסמן את המידע באמצעים טכנולוגיים לצורך זיהוי העתקה (כגון סימני מים
            וקודים ייחודיים), ולנקוט הליכים משפטיים נגד מי שיפר סעיף זה.</li>
        </ul>
      </Section>

      <Section title="4. שימוש הוגן">
        מותר לשתף קישור לאתר או לעמוד של טורניר. אין לפגוע בפעילות האתר, לנסות לעקוף מנגנוני אבטחה,
        או להשתמש באתר לכל מטרה שאינה חוקית.
      </Section>

      <Section title="5. חשבונות משתמש">
        משתמש שנרשם לאתר אחראי לנכונות הפרטים שמסר ולשמירה על סודיות הסיסמה. בעלי מועדונים אחראים לתוכן
        שהם מפרסמים, ומצהירים שיש להם זכות לפרסמו. פוקר ישראל רשאית להסיר תוכן או להשבית חשבון שמפר תנאים אלה.
      </Section>

      <Section title="6. אחריות">
        האתר ניתן לשימוש כפי שהוא (AS IS). פוקר ישראל לא תישא באחריות לנזק שייגרם כתוצאה מהסתמכות על המידע
        באתר, משינויים או ביטולים של טורנירים, או מהתקשרות עם מועדון.
      </Section>

      <Section title="7. שינויים ויצירת קשר">
        אנו רשאים לעדכן תנאים אלה מעת לעת; הגרסה המעודכנת תפורסם בעמוד זה. לשאלות:
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
