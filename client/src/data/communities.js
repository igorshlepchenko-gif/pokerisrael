// כדי להוסיף קהילה: הוסיפו אובייקט למערך למטה עם type מתאים (whatsapp / telegram / facebook / youtube).
// url הוא הקישור המלא (קישור הזמנה לקבוצת וואטסאפ/טלגרם, קישור לקבוצת פייסבוק, או קישור לערוץ יוטיוב).
// logo (אופציונלי): שימו את קובץ התמונה בתיקיית client/public/communities/ והפנו אליו כאן בתור "/communities/שם-קובץ.png"
// (אם logo ריק/חסר, מוצג אייקון הפלטפורמה כברירת מחדל)
// cta (אופציונלי): טקסט כפתור מותאם אישית (למשל ערוץ שידור שדורש "עקבו" ולא "הצטרפות לקבוצה"). בלי זה, מוצג טקסט ברירת המחדל של הפלטפורמה.
// logoFit (אופציונלי): 'cover' ממלא את המסגרת גם אם זה חותך את הצדדים (ברירת מחדל: 'contain' — לא חותך, אבל עלול להשאיר רווח). שימושי ללוגו לרוחב.
// category (אופציונלי): מקבץ את הקהילה תחת קטגוריה מיוחדת בראש הדף (למשל 'online') במקום תחת סקציית הפלטפורמה הרגילה (וואטסאפ/טלגרם/...).
export const COMMUNITIES = [
  {
    id: 'wa-ludus',
    name: 'קהילת LUDUS',
    type: 'whatsapp',
    category: 'online',
    logo: '/communities/ludus.png',
    description: `מי אנחנו?
מועדון פוקר ישראלי אקסקלוסיבי המתמקד בטורנירים בלבד, עם דגש על מקצוענות, למידה, קהילתיות ומשחק אחראי בסטנדרט מתקדם ובטוח.

🏆 טורנירים בלבד
👥 קהילה איכותית, לומדת ומלמדת.
🔒 כל המשתמשים מאושרים לפי תעודת זהות.
🛡️ הגבלות ותקרות למשחק אחראי.
💵 הפקדות ומימושים דרך CashCash — ללא סוכנים.

━━━━━━━━━━━━━━━

מה זה לודוס?
לודוס הוא מונח בלטינית שמשמעותו "משחק" או "שעשוע", אך משמעותו האמיתית גדולה הרבה יותר — עולם של אסטרטגיה, משמעת, תחרות וחוקים ברורים, שבו כל החלטה יכולה לשנות את התוצאה.

בפילוסופיה ובתורת המשחקים, לודוס מייצג חתירה למצוינות דרך שליטה עצמית, חשיבה חדה ורוח תחרותית.

ברומא העתיקה, לודוס היה בית הספר לגלדיאטורים — המקום שבו לוחמים עוצבו לקרב, ולמדו לא רק להילחם, אלא גם כבוד, משמעת ונחישות ⚔️`,
    url: 'https://chat.whatsapp.com/GioxEVv0aqu8J8aTYYChco',
  },
  {
    id: 'wa-max7',
    name: 'MAX7',
    type: 'whatsapp',
    category: 'online',
    logo: '/communities/max7.png',
    description: `ברוכים הבאים לקלאב הלימודי החדש שלנו. 🤓
בכל יום (א-ה) ינותח ספוט ע"י אחד מטובי המאמנים בארץ! ✍🏼🧠
הספוט יפורסם בקבוצת ווטצאפ ייעודית לשחקנים פעילים.
מספר הקלאב הוא 770299`,
    url: 'https://chat.whatsapp.com/J8hSbj2h2HrJkvrkR8fq0I?mode=gi_t',
  },
  {
    id: 'wa-high-pulse-poker',
    name: 'פוקר בדופק גבוה - הלב של הפוקר',
    type: 'whatsapp',
    logo: '/communities/high-pulse-poker.jpeg',
    description: 'יש קהילות שקמות מתוך רעיון ויש קהילות שקמות מתוך צורך.\n\nבשנת 2020, בתקופה שבה לא היה אפשר להיפגש סביב שולחן הפוקר, נולד פוקר בדופק גבוה.\nמה שהתחיל כחיבור בין שחקנים באונליין, הפך עם השנים לבית חם עבור שחקנים מכל הארץ.\n\nכיום הקהילה משלבת משחקי אונליין, מפגשים בטורנירי לייב, ליגה שנתית ואירועים קהילתיים, אבל מעל הכול היא מחברת בין אנשים שחולקים את אותה אהבה למשחק.\nזו בדיוק הסיבה שאנחנו גאים להיות הלב של הפוקר ♥️',
    url: 'https://chat.whatsapp.com/CWEqQtc1GKpIoiMw8AgbrQ?s=sw&p=i&ilr=4&amv=2',
  },
  {
    id: 'wa-medabrim-poker',
    name: 'מדברים פוקר',
    type: 'whatsapp',
    logo: '/communities/medabrim-poker.png',
    description: 'קהילת מדברים פוקר נוצרה לפני כ-4 שנים במטרה להיות מקום לאנשים שאוהבים את המשחק.\n\nבקהילה תוכלו למצוא מגוון קבוצות בנושאים שונים החל משיח על ידיים וקבוצות למידה וגם קבוצות ייעודיות לשחקני אונליין.',
    url: 'https://chat.whatsapp.com/BiCSddd7rTiHipg6KDaJsO',
  },
  { id: 'wa-top-playoff', name: 'עולם הפלייאוף העליון', type: 'whatsapp', cta: 'בקשת הצטרפות', description: 'הקהילה סגורה לחברים שלמדו בפלייאוף', logo: '/communities/top-playoff.jpeg', url: 'https://api.whatsapp.com/send?phone=972545498581&text=שלום,+אני+רוצה+להתחבר+לעולם+הפלייאוף+העליון' },
  {
    id: 'wa-royal-flush-business',
    name: 'Royal Flush Business - קהילת העצמאים',
    type: 'whatsapp',
    logo: '/communities/royal-flush-business.png',
    description: `בפוקר כל אחד לעצמו, אבל בעסקים אנחנו כוח אחד גדול.

זהו הבית של שחקני הפוקר שהם גם בעלי עסקים ועצמאים – אנשים שיודעים לנהל סיכונים, לקרוא את המפה ולהמר על עצמם כשצריך. הקבוצה הוקמה כדי להרים אחד לשני ולחזק את הקהילה דווקא בתקופה המאתגרת הזו.

כאן לא עושים 'צ'ק' – כאן דוחפים קדימה את העסקים של חברי הענף, צורכים שירותים אחד מהשני ומוצאים אנשי מקצוע שאפשר לסמוך עליהם (בלי בלופים). מוזמנים להציג את העסק שלכם, להציע מבצעים לחברים ולמצוא את הדרך לצמוח יחד.

כי כשהקהילה מנצחת – כולם זוכים בקופה.

מומלץ לשנות את הכינוי בוואטסאפ לשם המלא + תחום העיסוק כדי שיהיה קל למצוא אתכם`,
    url: 'https://chat.whatsapp.com/KNl0cjfrtQDDMeIFKQSBLd',
  },
  { id: 'wa-kidrurim-dream-with-me', name: 'Kidrurim - Dream With Me!', type: 'whatsapp', logo: '/communities/kidrurim.png', url: 'https://chat.whatsapp.com/LF4rfcplQtIEoWUukT5PDO?s=cl&p=i&mlu=4' },
  { id: 'wa-alon-eldar-channel', name: 'הערוץ של אלון אלדר', type: 'whatsapp', cta: 'עקבו אחרי הערוץ', logo: '', url: 'https://whatsapp.com/channel/0029VbAn27jJf05UsbUO451E' },
  {
    id: 'wa-showdown',
    name: 'ShowDown | The Moment Of Truth',
    type: 'whatsapp',
    logo: '/communities/showdown.jpeg',
    description: 'Every hand has a story. Every story ends at ShowDown ♦️',
    url: 'https://chat.whatsapp.com/L3tUwy7x4Vz2kbvM3tqvGv?mode=gi_t',
  },
  {
    id: 'wa-no-limit',
    name: 'קהילת No Limit',
    type: 'whatsapp',
    logo: '/communities/no-limit.jpeg',
    description: `קהילה שקטה של No Limit
עדכונים מהשטח, רגעים אמיתיים, ומה שקורה עכשיו
אם אתה משחק ואוהב פוקר - המקום שלך פה.
כאן מתעדכנים בכל מה שקורה איתנו ועם עולם הפוקר באופן כללי`,
    url: 'https://chat.whatsapp.com/G4tvarWDuAKDSJYaTHEAF3',
  },
  {
    id: 'wa-dama-club',
    name: 'Dama Club',
    type: 'whatsapp',
    cta: 'בקשת הצטרפות',
    logo: '/communities/dama-club.jpeg',
    description: `DAMA Club היא קהילת נשים ייחודית שנוצרה כדי לתת לנשים מרחב מקצועי, נעים ותומך ללמוד, לתרגל ולהתפתח בעולם הפוקר – מהצעדים הראשונים ועד לרמה מתקדמת. הקהילה מתאימה גם לנשים שעושות את הצעדים הראשונים שלהן בפוקר ורוצות ללמוד בצורה ברורה, חכמה ובטוחה, וגם לנשים שכבר משחקות ורוצות לחדד אסטרטגיות, לתרגל ולהשתפר.

המטרה של DAMA Club היא ליצור מרחב לא שיפוטי, חיובי ומעצים, שבו כל אישה מרגישה בנוח לשאול שאלות, לטעות, להתנסות, לצחוק, ללמוד ולהתקדם בקצב שלה. כאן בונות ביטחון דרך תרגול, תמיכה, מקצועיות והרבה אנרגיה טובה.`,
    url: `https://api.whatsapp.com/send?phone=972508567268&text=${encodeURIComponent('שלום, אני רוצה להצטרף לקהילת הדאמה')}`,
  },
  { id: 'tg-elkanuts', name: 'אלקנאטס', type: 'telegram', logo: '/communities/elkanuts.jpg', description: 'תוכן פוקר ישראלי', url: 'https://t.me/elkanuts' },
  { id: 'tg-as-bagova', name: 'קהילת אס בגובה', type: 'telegram', logo: '/communities/as-bagova.jpeg', url: 'https://t.me/AsBagova' },
  { id: 'fb-pokernet', name: 'פוקרנט - קהילת הפוקר של ישראל', type: 'facebook', logo: '', url: 'https://www.facebook.com/groups/968496560156456' },
  { id: 'fb-poker-israel-ads', name: 'פוקר ישראל בפייסבוק - פרסום משחקי קאש בשקיפות מלאה', type: 'facebook', logo: '/communities/poker-israel-facebook.png', logoFit: 'cover', url: 'https://www.facebook.com/groups/173732592641570/?ref=share&mibextid=NSMWBT' },
  { id: 'yt-poker7-israel', name: 'חדשות פוקר 7', type: 'youtube', logo: '/communities/poker7-israel.png', logoFit: 'cover', url: 'https://www.youtube.com/@Poker7.Israel' },
];
