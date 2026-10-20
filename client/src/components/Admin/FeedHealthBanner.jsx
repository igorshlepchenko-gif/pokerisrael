import { useState, useEffect } from 'react';
import api from '../../utils/api';

// פס אזהרה בראש פאנל הניהול: ייבוא טורנירים אוטומטי שלא התעדכן בזמן (server/services/feedMonitor.js)
const SOURCE = { jokerclub: 'סורק הג׳וקר (במחשב שלך)', letspoker: 'LetsPoker', doubleup: 'סורק דאבלאפ (במחשב שלך)', feed: 'פיד' };
const fmt = (d) => (d ? new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'אף פעם');
const ago = (h) => (h >= 48 ? `${Math.round(h / 24)} ימים` : `${h} שעות`);

export default function FeedHealthBanner() {
  const [stale, setStale] = useState([]);
  useEffect(() => {
    api.get('/admin/feed-health').then((r) => setStale(r.data.stale || [])).catch(() => {});
  }, []);
  if (stale.length === 0) return null;
  return (
    <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <p className="font-bold text-amber-300 mb-2">⚠️ ייבוא טורנירים שלא התעדכן בזמן</p>
      <ul className="space-y-1 text-slate-200">
        {stale.map((f) => (
          <li key={f.id}>
            <b>{f.venue}</b> <span className="text-slate-400">({SOURCE[f.source] || f.source})</span> — עדכון אחרון {fmt(f.lastSynced)}, לפני {ago(f.ageHours)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400 mt-2">הטורנירים של המועדונים האלה באתר לא מתעדכנים עד שהייבוא יחזור לעבוד. בקש מ-Claude לבדוק.</p>
    </div>
  );
}
