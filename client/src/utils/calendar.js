// "Add to calendar" for a tournament — a Google Calendar quick-add link (zero friction
// for Google Calendar users) plus a universal .ics download (Apple Calendar, Outlook, etc.)
// No calendar API/OAuth scopes needed — both are plain client-side URL/file construction.
import { formatCost, eventDisplayDate } from './whatsapp';

function pad(n) {
  return String(n).padStart(2, '0');
}

// YYYYMMDDTHHMMSSZ — the UTC basic format both Google Calendar and .ics expect
function toICSDate(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) + 'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) + 'Z'
  );
}

function eventWindow(tournament) {
  // אירוע חוזר — יום היומן צריך להיות המופע הבא, לא תאריך היצירה המקורי
  const start = new Date(eventDisplayDate(tournament));
  const end = tournament.estimated_end_time
    ? new Date(tournament.estimated_end_time)
    : new Date(start.getTime() + 5 * 60 * 60 * 1000); // default 5h when no estimate is set
  return { start, end };
}

function eventDetails(tournament) {
  const parts = [];
  if (tournament.cost) parts.push(`כניסה: ${formatCost(tournament.cost)}`);
  if (tournament.gtd) parts.push(`GTD: ₪${Number(tournament.gtd).toLocaleString('he-IL')}`);
  if (tournament.venue_name) parts.push(`מקום: ${tournament.venue_name}`);
  return parts.join('\n');
}

function eventLocation(tournament) {
  return [tournament.venue_address, tournament.venue_city].filter(Boolean).join(', ');
}

export function buildGoogleCalendarUrl(tournament) {
  const { start, end } = eventWindow(tournament);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: tournament.name,
    dates: `${toICSDate(start)}/${toICSDate(end)}`,
    details: eventDetails(tournament),
    location: eventLocation(tournament),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadICS(tournament) {
  const { start, end } = eventWindow(tournament);
  const escape = (s) => String(s || '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PokerIsrael//Tournament//HE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:tournament-${tournament.id}@pokerisrael.org`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escape(tournament.name)}`,
    `DESCRIPTION:${escape(eventDetails(tournament))}`,
    `LOCATION:${escape(eventLocation(tournament))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(tournament.name || 'tournament').replace(/[^\w֐-׿]+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
