const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Afrodite" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
const BASE_URL = process.env.CLIENT_URL || 'http://localhost:3000';

exports.sendVerificationEmail = async (email, token) => {
  const link = `${BASE_URL}/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '✨ Confirmez votre adresse email — Afrodite',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f5f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f7;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Afrodite</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">La plateforme de profils vérifiés</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;font-weight:600;">Confirmez votre email</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Merci de vous être inscrit sur Afrodite ! Cliquez sur le bouton ci-dessous pour activer votre compte.
              Ce lien est valable <strong>24 heures</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="padding:8px 0 32px;">
                <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#D4537E,#993556);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;letter-spacing:0.2px;">
                  ✅ Confirmer mon email
                </a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">Vous ne pouvez pas cliquer ? Copiez ce lien dans votre navigateur :</p>
            <p style="margin:0;background:#f9f5f7;border-radius:8px;padding:12px;font-size:12px;color:#6b7280;word-break:break-all;">${link}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f5f7;padding:24px 48px;border-top:1px solid #f0e8ec;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              Si vous n'avez pas créé de compte sur Afrodite, ignorez cet email.<br>
              © ${new Date().getFullYear()} Afrodite — Tous droits réservés.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  });
};

exports.sendWelcomeEmail = async (email, displayName) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '🎉 Bienvenue sur Afrodite !',
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f9f5f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f7;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Afrodite</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;">Bienvenue, ${displayName} ! 🎉</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Votre compte est activé. Complétez votre profil, ajoutez vos photos et commencez à vous connecter avec des milliers de membres.
            </p>
            <a href="${BASE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#D4537E,#993556);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;">
              Compléter mon profil →
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f5f7;padding:20px 48px;border-top:1px solid #f0e8ec;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">© ${new Date().getFullYear()} Afrodite</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  });
};

exports.sendPasswordResetEmail = async (email, token) => {
  const link = `${BASE_URL}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '🔑 Réinitialisation de votre mot de passe — Afrodite',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f5f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f7;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Afrodite</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Réinitialisation de mot de passe</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;font-weight:600;">Nouveau mot de passe</h2>
            <p style="margin:0 0 8px;color:#6b7280;font-size:15px;line-height:1.6;">
              Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
            </p>
            <p style="margin:0 0 28px;color:#ef4444;font-size:13px;">⏱ Ce lien est valable <strong>1 heure</strong> seulement.</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="padding:8px 0 32px;">
                <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#D4537E,#993556);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;">
                  🔑 Réinitialiser mon mot de passe
                </a>
              </td></tr>
            </table>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
              <p style="margin:0;color:#dc2626;font-size:13px;">
                ⚠️ Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe reste inchangé.
              </p>
            </div>
            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">Lien direct :</p>
            <p style="margin:0;background:#f9f5f7;border-radius:8px;padding:12px;font-size:12px;color:#6b7280;word-break:break-all;">${link}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f5f7;padding:24px 48px;border-top:1px solid #f0e8ec;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              © ${new Date().getFullYear()} Afrodite — Tous droits réservés.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  });
};
