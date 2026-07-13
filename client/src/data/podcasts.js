// כדי להוסיף/לעדכן קישורים: הדביקו את כתובת ה-URL המלאה מכל פלטפורמה.
// שדה ריק ("") פשוט מסתיר את הכפתור/הנגן המתאים בעמוד.
// logo: שימו את קובץ התמונה בתיקיית client/public/podcasts/ והפנו אליו כאן בתור "/podcasts/שם-קובץ.png"
// (אם logo ריק/חסר, מוצג אימוג'י כברירת מחדל)
export const PODCASTS = [
  {
    id: 'no-limit',
    name: 'No Limit',
    emoji: '🎙️',
    logo: '/podcasts/no-limit.png',
    color: '#1d4ed8',
    spotifyUrl: 'https://open.spotify.com/show/5waaJZWLKKknGeHPuK21tv',
    instagramUrl: '',
    facebookUrl: '',
    youtubeUrl: 'https://www.youtube.com/@%D7%A0%D7%95-%D7%9C%D7%99%D7%9E%D7%99%D7%98',
  },
  {
    id: 'ace-high',
    name: 'אס בגובה',
    emoji: '🃏',
    logo: '/podcasts/ace-high.png',
    color: '#059669',
    spotifyUrl: 'https://open.spotify.com/show/1dQ2r3gBCl33pumO04gNBJ',
    instagramUrl: '',
    facebookUrl: '',
    youtubeUrl: 'https://www.youtube.com/@%D7%90%D7%A1%D7%91%D7%92%D7%95%D7%91%D7%94',
  },
  {
    id: 'poker-geeks',
    name: 'Poker Geeks',
    emoji: '🤓',
    logo: '/podcasts/poker-geeks.png',
    color: '#d97706',
    spotifyUrl: 'https://open.spotify.com/show/4r0YKXZ1PWwD0DC1XACaKp',
    instagramUrl: '',
    facebookUrl: '',
    youtubeUrl: 'https://www.youtube.com/@PokerGeeks',
  },
];

// מקבל כתובת show/episode רגילה מ-Spotify ומחזיר את כתובת ה-iframe להטמעה.
export function getSpotifyEmbedUrl(spotifyUrl) {
  if (!spotifyUrl) return null;
  const match = spotifyUrl.match(/(show|episode)\/([a-zA-Z0-9]+)/);
  if (!match) return null;
  return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
}
