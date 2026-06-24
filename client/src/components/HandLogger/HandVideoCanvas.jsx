import { useState, useRef } from 'react';
import { recordVideo } from '../../utils/handVideo';

export default function HandVideoCanvas({ handState, narrative }) {
  const [status, setStatus] = useState('idle'); // idle | recording | ready | error
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const blobRef = useRef(null);

  const generate = async () => {
    setStatus('recording');
    setProgress(0);
    try {
      const blob = await recordVideo(handState, p => setProgress(p));
      blobRef.current = blob;
      setVideoUrl(URL.createObjectURL(blob));
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || String(e));
      setStatus('error');
    }
  };

  const download = () => {
    if (!blobRef.current) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blobRef.current);
    a.download = `poker-hand-${Date.now()}.webm`;
    a.click();
  };

  const shareViaWebShare = async () => {
    if (!blobRef.current) return;
    const file = new File([blobRef.current], 'poker-hand.webm', { type: 'video/webm' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'יד פוקר', text: narrative }); }
      catch { /* user cancelled */ }
    } else {
      download();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">WebM · ~15 שנ'</span>
        <h3 className="text-sm font-bold text-slate-200">🎬 סרטון יד</h3>
      </div>

      {status === 'idle' && (
        <button onClick={generate}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm hover:from-blue-500 hover:to-cyan-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20">
          🎬 צור סרטון
        </button>
      )}

      {status === 'recording' && (
        <div className="text-center py-4">
          <div className="text-slate-400 text-sm mb-3">מייצר סרטון... {progress}%</div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {status === 'ready' && videoUrl && (
        <div className="space-y-3">
          <video src={videoUrl} controls className="w-full rounded-xl border border-slate-700" />
          <div className="flex gap-2">
            <button onClick={download}
              className="flex-1 py-2 rounded-xl border border-blue-500/40 text-blue-400 text-sm font-bold hover:bg-blue-500/10 transition-all">
              ⬇ הורד
            </button>
            <button onClick={shareViaWebShare}
              className="flex-1 py-2 rounded-xl border border-emerald-500/40 text-emerald-400 text-sm font-bold hover:bg-emerald-500/10 transition-all">
              📤 שתף
            </button>
          </div>
          <button onClick={generate}
            className="w-full py-1.5 rounded-xl text-slate-500 text-xs hover:text-slate-400 transition-all">
            🔄 צור מחדש
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center py-3">
          <div className="text-red-400 text-sm mb-2">שגיאה בייצור הסרטון</div>
          {errorMsg && (
            <div className="text-red-300 text-xs font-mono bg-slate-900 rounded p-2 mb-2 text-left break-all">
              {errorMsg}
            </div>
          )}
          <button onClick={generate}
            className="px-4 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600">
            נסה שוב
          </button>
        </div>
      )}
    </div>
  );
}
