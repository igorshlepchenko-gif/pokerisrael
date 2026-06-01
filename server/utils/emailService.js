const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * שולח מייל אימות לאחר הרשמה
 */
exports.sendVerificationEmail = async ({ to, name, token }) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"פוקר לייב ישראל 🂡" <${process.env.GMAIL_USER}>`,
    to,
    subject: '✅ אמת את כתובת המייל שלך — פוקר לייב ישראל',
    html: `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#166534,#15803d);padding:32px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">🂡</div>
              <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:1px;">פוקר לייב ישראל</div>
              <div style="color:#bbf7d0;font-size:13px;margin-top:4px;">POKER LIVE ISRAEL</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              <h2 style="color:#f1f5f9;margin:0 0 12px;font-size:20px;">שלום ${name} 👋</h2>
              <p style="color:#94a3b8;margin:0 0 24px;line-height:1.7;font-size:15px;">
                תודה שנרשמת לפוקר לייב ישראל!<br/>
                לחץ על הכפתור כדי לאמת את כתובת המייל שלך ולהפעיל את החשבון:
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:28px 0;">
                <a href="${verifyUrl}"
                   style="background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;
                          border-radius:12px;font-size:16px;font-weight:700;display:inline-block;
                          letter-spacing:0.5px;">
                  ✅ אימות כתובת מייל
                </a>
              </div>

              <p style="color:#64748b;font-size:13px;margin:20px 0 0;line-height:1.6;">
                הקישור תקף ל-<strong style="color:#94a3b8;">24 שעות</strong>.<br/>
                אם לא נרשמת, פשוט התעלם ממייל זה.
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #334155;margin:24px 0;" />

              <p style="color:#475569;font-size:12px;margin:0;line-height:1.6;">
                אם הכפתור לא עובד, העתק את הקישור הבא לדפדפן:<br/>
                <a href="${verifyUrl}"
                   style="color:#4ade80;word-break:break-all;font-size:11px;">${verifyUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;padding:20px 32px;text-align:center;">
              <p style="color:#334155;font-size:12px;margin:0;">
                ♠ ♥ ♦ ♣ &nbsp;&nbsp; פוקר לייב ישראל © ${new Date().getFullYear()}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
};

/**
 * שולח שוב מייל אימות (Resend)
 */
exports.resendVerificationEmail = exports.sendVerificationEmail;
