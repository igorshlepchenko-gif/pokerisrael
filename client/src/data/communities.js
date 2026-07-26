// כדי להוסיף קהילה: הוסיפו אובייקט למערך למטה עם type מתאים (whatsapp / telegram / facebook / youtube).
// url הוא הקישור המלא (קישור הזמנה לקבוצת וואטסאפ/טלגרם, קישור לקבוצת פייסבוק, או קישור לערוץ יוטיוב).
// logo (אופציונלי): שימו את קובץ התמונה בתיקיית client/public/communities/ והפנו אליו כאן בתור "/communities/שם-קובץ.png"
// (אם logo ריק/חסר, מוצג אייקון הפלטפורמה כברירת מחדל)
// cta (אופציונלי): טקסט כפתור מותאם אישית (למשל ערוץ שידור שדורש "עקבו" ולא "הצטרפות לקבוצה"). בלי זה, מוצג טקסט ברירת המחדל של הפלטפורמה.
export const COMMUNITIES = [
  { id: 'wa-medabrim-poker', name: 'מדברים פוקר', type: 'whatsapp', logo: '', url: 'https://chat.whatsapp.com/BiCSddd7rTiHipg6KDaJsO' },
  { id: 'wa-royal-flush-business', name: 'Royal Flush Business - קהילת העצמאים', type: 'whatsapp', logo: '', url: 'https://chat.whatsapp.com/KNl0cjfrtQDDMeIFKQSBLd' },
  { id: 'wa-kidrurim-dream-with-me', name: 'Kidrurim - Dream With Me!', type: 'whatsapp', logo: '', url: 'https://chat.whatsapp.com/LF4rfcplQtIEoWUukT5PDO?s=cl&p=i&mlu=4' },
  { id: 'wa-alon-eldar-channel', name: 'הערוץ של אלון אלדר', type: 'whatsapp', cta: 'עקבו אחרי הערוץ', logo: '', url: 'https://whatsapp.com/channel/0029VbAn27jJf05UsbUO451E' },
  { id: 'tg-elkanuts', name: 'אלקנאטס', type: 'telegram', logo: '', url: 'https://t.me/elkanuts' },
  { id: 'fb-pokernet', name: 'פוקרנט - קהילת הפוקר של ישראל', type: 'facebook', logo: '', url: 'https://www.facebook.com/groups/968496560156456' },
  { id: 'yt-poker7-israel', name: 'חדשות פוקר 7', type: 'youtube', logo: '', url: 'https://www.youtube.com/@Poker7.Israel' },
];
