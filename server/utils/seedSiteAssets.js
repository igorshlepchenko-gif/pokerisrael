const fs = require('fs');
const path = require('path');

/**
 * מעביר נכסי-אתר קבועים (כרגע: סרטון ההסבר של "מצא טורניר קרוב אליי")
 * מתיקיית הבנייה אל ה-Volume, פעם אחת.
 *
 * למה בכלל: הסרטון הוגש קודם מתוך הריפו. העברה ל-Volume מוציאה קובץ מדיה
 * מבקרת הגרסאות — אבל אז אין דרך "לשלוח" אותו לפרודקשן בלי SSH או העלאה
 * ידנית. הפונקציה הזו פותרת את זה: כל עוד הקובץ עדיין בבנייה הוא מועתק
 * ל-Volume בעלייה, וה-Volume שורד דפלויים. אחרי שהעותק קיים אפשר למחוק
 * אותו מהריפו — ומאותו רגע ה-Volume הוא המקור היחיד.
 *
 * לא דורס קובץ קיים: אם האדמין העלה גרסה חדשה דרך הפאנל, היא מנצחת.
 */
const ASSETS = [
  { name: 'nearby-promo.mp4', dir: 'videos' },
];

function seedSiteAssets() {
  const uploadsDir = path.join(__dirname, '../uploads');
  const distVideoDir = path.join(__dirname, '../../client/dist/video');

  for (const asset of ASSETS) {
    try {
      const target = path.join(uploadsDir, asset.dir, asset.name);
      if (fs.existsSync(target)) continue;

      const source = path.join(distVideoDir, asset.name);
      if (!fs.existsSync(source)) continue;   // כבר הוסר מהריפו — אין מה לזרוע

      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      console.log(`📦 נכס אתר הועתק ל-Volume: ${asset.dir}/${asset.name}`);
    } catch (err) {
      // זריעה היא נוחות בלבד — כישלון בה לעולם לא צריך למנוע עליית שרת
      console.error(`⚠️  זריעת ${asset.name} נכשלה:`, err.message);
    }
  }
}

module.exports = { seedSiteAssets };
