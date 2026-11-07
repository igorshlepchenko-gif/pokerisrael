import { useState } from 'react';
import { useAuth } from '../../../client/src/context/AuthContext';
import HandLoggerWizard from '../../../client/src/components/HandLogger/HandLoggerWizard';
import HandHistoryPage from '../../../client/src/pages/HandHistoryPage';

function NoAccessModal({ user, onClose }) {
  const waPhone = '972545861119';
  const waText = encodeURIComponent(`שלום, שמי ${user?.name || ''} ואני מעוניין להשתמש בכלי רישום הידיים שלכם`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="rounded-2xl border border-slate-700 p-6 max-w-md w-full"
        style={{ background: 'linear-gradient(135deg, rgba(13,21,38,0.98) 0%, rgba(6,9,26,0.98) 100%)' }}
        dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔒</span>
          <h3 className="text-lg font-black text-white">גישה מוגבלת</h3>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          חבר יקר, אין לך הרשאה לכלי רישום הידיים. כלי זה נמצא כרגע בתהליך בניה ושיפורים ולכן אינו פתוח לקהל הרחב. לבקשת גישה נא לפנות להנהלת האתר.
        </p>
        <div className="flex gap-3">
          <a href={`https://wa.me/${waPhone}?text=${waText}`} target="_blank" rel="noreferrer"
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white text-center transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', boxShadow: '0 0 16px rgba(34,197,94,0.3)' }}>
            💬 פנייה בוואטסאפ
          </a>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [noAccessOpen, setNoAccessOpen] = useState(false);
  // HandHistoryPage owns its own fetch internally with no external refresh hook —
  // bumping this key forces a clean remount (and therefore a refetch) after a save,
  // without needing to modify the shared page component.
  const [historyKey, setHistoryKey] = useState(0);

  const hasAccess = user && (user.hand_logger_access || user.role === 'admin');

  const handleNewHand = () => {
    if (!hasAccess) { setNoAccessOpen(true); return; }
    setWizardOpen(true);
  };

  return (
    <div className="relative">
      {noAccessOpen && <NoAccessModal user={user} onClose={() => setNoAccessOpen(false)} />}

      {wizardOpen && (
        <HandLoggerWizard
          onClose={() => setWizardOpen(false)}
          onSaved={() => setHistoryKey(k => k + 1)}
        />
      )}

      {/* extra bottom clearance so the floating action button never covers the last list item */}
      <div className="pb-28">
        <HandHistoryPage key={historyKey} />
      </div>

      <button
        onClick={handleNewHand}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-black text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 24px rgba(59,130,246,0.6)' }}
      >
        <span className="text-lg">+</span> רשום יד חדשה
      </button>
    </div>
  );
}
