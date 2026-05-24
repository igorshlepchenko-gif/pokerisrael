export function buildWhatsAppLink(whatsappNumber, tournamentName) {
  const clean = whatsappNumber.replace(/\D/g, '').replace(/^0/, '972');
  const msg = `שלום, הגעתי אליכם מאתר הפוקר לייב ישראל, ברצוני להרשם לטורניר ${tournamentName}`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatCost(cost) {
  if (!cost || cost === 0) return 'חינם';
  return `₪${Number(cost).toLocaleString('he-IL')}`;
}
