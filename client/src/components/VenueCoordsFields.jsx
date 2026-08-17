import { useState } from 'react';
import { parsePastedCoords } from '../utils/nearby';

/**
 * שדות קו רוחב/אורך למועדון, עם קיצור דרך: מדביקים קישור מ-Google Maps
 * והמערכת מחלצת את המספרים לבד.
 *
 * מכוון שאין כאן geocoding אוטומטי מהכתובת — זה היה מוסיף תלות בשירות חיצוני
 * (מפתח, מכסות, עלות) עבור קומץ מועדונים שמוזנים פעם אחת.
 *
 * value: { latitude, longitude }
 * onChange: (patch) => void   // { latitude, longitude }
 */
export default function VenueCoordsFields({ value, onChange }) {
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState('');

  const applyPaste = (text) => {
    setPaste(text);
    if (!text.trim()) { setPasteError(''); return; }
    const coords = parsePastedCoords(text);
    if (coords) {
      onChange({ latitude: String(coords.lat), longitude: String(coords.lng) });
      setPasteError('');
    } else {
      setPasteError('לא זוהו קואורדינטות. בקישור מקוצר (maps.app.goo.gl) צריך לפתוח אותו קודם ואז להעתיק מסרגל הכתובות.');
    }
  };

  return (
    <>
      <div className="sm:col-span-2">
        <label className="block text-xs text-slate-400 mb-1">
          מיקום על המפה <span className="text-slate-500">(לחיפוש "הכי קרוב אליי" ולניווט)</span>
        </label>
        <input
          type="text"
          value={paste}
          onChange={e => applyPaste(e.target.value)}
          className="input-field text-sm"
          placeholder='הדבק קישור מ-Google Maps או "31.9730, 34.7925"'
        />
        {pasteError && <p className="text-amber-400 text-[11px] mt-1 leading-snug">{pasteError}</p>}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">קו רוחב (Latitude)</label>
        <input
          type="number" step="any" inputMode="decimal"
          value={value.latitude ?? ''}
          onChange={e => onChange({ latitude: e.target.value, longitude: value.longitude ?? '' })}
          className="input-field text-sm" placeholder="31.9730"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">קו אורך (Longitude)</label>
        <input
          type="number" step="any" inputMode="decimal"
          value={value.longitude ?? ''}
          onChange={e => onChange({ latitude: value.latitude ?? '', longitude: e.target.value })}
          className="input-field text-sm" placeholder="34.7925"
        />
      </div>
    </>
  );
}
