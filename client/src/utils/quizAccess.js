import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from './api';

// שם השעשועון — זמני. כל הטקסטים בעברית כרגע; תרגום לשפות נוספות בהמשך
export const QUIZ_NAME = 'שולם בליינד';

// שלב סגור: מי רואה את השעשועון נקבע בשרת — אדמין, משתמשים שאושרו בפאנל, או כולם
// כשהמתג "פתוח לכולם" דולק (server/services/quiz.js → access). התשובה נשמרת לכל משתמש.
const cache = new Map(); // userId|'guest' → Promise<{allowed, open}>

export function useQuizAccess() {
  const { user, loading } = useAuth() || {};
  const key = user?.id ?? 'guest';
  const [state, setState] = useState(() => (loading ? null : cache.get(key)?.value ?? null));

  useEffect(() => {
    if (loading) return undefined;
    let alive = true;
    if (!cache.has(key)) {
      const entry = { value: null };
      entry.promise = api.get('/quiz/access').then((r) => (entry.value = r.data)).catch(() => (entry.value = { allowed: false, open: false }));
      cache.set(key, entry);
    }
    const entry = cache.get(key);
    if (entry.value) setState(entry.value);
    else entry.promise.then((v) => alive && setState(v));
    return () => { alive = false; };
  }, [key, loading]);

  return { loading: loading || !state, allowed: !!state?.allowed, open: !!state?.open, reviewer: !!state?.reviewer };
}

// אחרי שינוי הרשאות בפאנל — לרענן
export function resetQuizAccessCache() { cache.clear(); }
