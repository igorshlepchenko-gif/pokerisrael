export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-900/50 py-8 text-center text-slate-500 text-sm">
      <div className="flex justify-center gap-4 text-2xl mb-3 opacity-30 select-none">
        <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
      </div>
      <p className="font-semibold text-slate-400">פוקר לייב ישראל</p>
      <p className="text-xs mt-1">כל הטורנירים מתקיימים במרכזי משחקי קלפים מורשים בלבד</p>
      <p className="text-xs mt-2 text-slate-600">© {new Date().getFullYear()} Poker Live Israel · כל הזכויות שמורות</p>

      {/* Ad slot — uncomment and replace with actual ad code when ready */}
      {/* <div className="max-w-3xl mx-auto mt-6">...</div> */}
    </footer>
  );
}
