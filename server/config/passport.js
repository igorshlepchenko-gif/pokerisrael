const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./db');

// רושמים את אסטרטגיית Google רק אם ה-credentials מוגדרים (אחרת היא קורסת)
const googleConfigured =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  !process.env.GOOGLE_CLIENT_ID.includes('your-google');

if (googleConfigured) {
  passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email    = profile.emails?.[0]?.value || null;
        const name     = profile.displayName || profile.name?.givenName || 'משתמש Google';
        const avatar   = profile.photos?.[0]?.value || null;

        // 1. חיפוש לפי google_id
        let result = await pool.query(
          'SELECT id, name, email, phone, role, is_active, token_version FROM users WHERE google_id = $1',
          [googleId]
        );
        if (result.rows[0]) {
          if (!result.rows[0].is_active) return done(null, false, { message: 'החשבון מושבת' });
          return done(null, result.rows[0]);
        }

        // 2. חיפוש לפי מייל — קישור לחשבון קיים
        if (email) {
          result = await pool.query(
            'SELECT id, name, email, phone, role, is_active, token_version FROM users WHERE email = $1',
            [email]
          );
          if (result.rows[0]) {
            if (!result.rows[0].is_active) return done(null, false, { message: 'החשבון מושבת' });
            // קישור google_id לחשבון הקיים
            await pool.query(
              'UPDATE users SET google_id = $1, auth_provider = $2 WHERE id = $3',
              [googleId, 'google', result.rows[0].id]
            );
            return done(null, result.rows[0]);
          }
        }

        // 3. יצירת משתמש חדש
        result = await pool.query(
          `INSERT INTO users
             (name, email, google_id, auth_provider, role, is_active, email_verified, password, phone)
           VALUES ($1, $2, $3, 'google', 'player', true, true, null, null)
           RETURNING id, name, email, phone, role, token_version`,
          [name, email, googleId]
        );
        done(null, result.rows[0]);
      } catch (err) {
        done(err);
      }
    }
  )
  );
} else {
  console.log('ℹ️  Google OAuth לא מוגדר — דילוג על רישום האסטרטגיה');
}

// ללא session — JWT בלבד
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
