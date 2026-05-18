const https = require('https');

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@afrodiz.com';
const FROM_NAME = 'Afrodite';

<<<<<<< HEAD
// Envoyer via l'API HTTP Brevo (pas SMTP — évite les blocages de ports)
=======
>>>>>>> 1d48245 (fix: use Brevo HTTP API instead of SMTP)
async function sendBrevoEmail({ to, subject, html }) {
  const payload = JSON.stringify({
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Brevo API error ${res.statusCode}: ${data}`));
        }
      });
    });
<<<<<<< HEAD

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Brevo API timeout'));
    });

=======
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Brevo API timeout')); });
>>>>>>> 1d48245 (fix: use Brevo HTTP API instead of SMTP)
    req.write(payload);
    req.end();
  });
}

exports.sendVerificationEmail = async (email, token) => {
  const link = `${BASE_URL}/auth/verify-email?token=${token}`;
<<<<<<< HEAD

  await sendBrevoEmail({
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
        <tr>
          <td style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Afrodite</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">La plateforme de profils vérifiés</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;font-weight:600;">Confirmez votre email</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Merci de vous être inscrit sur Afrodite ! Cliquez sur le bouton ci-dessous pour activer votre compte.
              Ce lien est valable <strong>24 heures</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="padding:8px 0 32px;">
                <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#D4537E,#993556);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;">
                  ✅ Confirmer mon email
                </a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">Vous ne pouvez pas cliquer ? Copiez ce lien :</p>
            <p style="margin:0;background:#f9f5f7;border-radius:8px;padding:12px;font-size:12px;color:#6b7280;word-break:break-all;">${link}</p>
          </td>
        </tr>
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
</html>`,
=======
  await sendBrevoEmail({
    to: email,
    subject: '✨ Confirmez votre adresse email — Afrodite',
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:28px">Afrodite</h1>
      </div>
      <div style="padding:40px 48px">
        <h2 style="color:#1a1a1a">Confirmez votre email</h2>
        <p style="color:#6b7280;line-height:1.6">Cliquez sur le bouton ci-dessous pour activer votre compte. Ce lien est valable <strong>24 heures</strong>.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${link}" style="background:linear-gradient(135deg,#D4537E,#993556);color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;display:inline-block">✅ Confirmer mon email</a>
        </div>
        <p style="color:#9ca3af;font-size:13px">Ou copiez ce lien : <br><span style="word-break:break-all;font-size:12px">${link}</span></p>
      </div>
    </div>`,
>>>>>>> 1d48245 (fix: use Brevo HTTP API instead of SMTP)
  });
};

exports.sendWelcomeEmail = async (email, displayName) => {
  await sendBrevoEmail({
    to: email,
    subject: '🎉 Bienvenue sur Afrodite !',
<<<<<<< HEAD
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f9f5f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f7;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Afrodite</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;">Bienvenue, ${displayName} ! 🎉</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Votre compte est activé. Complétez votre profil et commencez à vous connecter avec des milliers de membres.
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
</html>`,
=======
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:28px">Afrodite</h1>
      </div>
      <div style="padding:40px 48px">
        <h2 style="color:#1a1a1a">Bienvenue, ${displayName} ! 🎉</h2>
        <p style="color:#6b7280;line-height:1.6">Votre compte est activé. Complétez votre profil et commencez à vous connecter avec des milliers de membres.</p>
        <a href="${BASE_URL}/dashboard" style="background:linear-gradient(135deg,#D4537E,#993556);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;display:inline-block">Compléter mon profil →</a>
      </div>
    </div>`,
>>>>>>> 1d48245 (fix: use Brevo HTTP API instead of SMTP)
  });
};

exports.sendPasswordResetEmail = async (email, token) => {
  const link = `${BASE_URL}/auth/reset-password?token=${token}`;
<<<<<<< HEAD

  await sendBrevoEmail({
    to: email,
    subject: '🔑 Réinitialisation de votre mot de passe — Afrodite',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f5f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f7;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Afrodite</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;">Nouveau mot de passe</h2>
            <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
              Cliquez ci-dessous pour réinitialiser votre mot de passe. Lien valable <strong>1 heure</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="padding:8px 0 32px;">
                <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#D4537E,#993556);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;">
                  🔑 Réinitialiser mon mot de passe
                </a>
              </td></tr>
            </table>
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
</html>`,
=======
  await sendBrevoEmail({
    to: email,
    subject: '🔑 Réinitialisation de votre mot de passe — Afrodite',
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#D4537E,#993556);padding:36px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:28px">Afrodite</h1>
      </div>
      <div style="padding:40px 48px">
        <h2 style="color:#1a1a1a">Réinitialisation du mot de passe</h2>
        <p style="color:#6b7280;line-height:1.6">Cliquez ci-dessous pour choisir un nouveau mot de passe. Lien valable <strong>1 heure</strong>.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${link}" style="background:linear-gradient(135deg,#D4537E,#993556);color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;display:inline-block">🔑 Réinitialiser mon mot de passe</a>
        </div>
        <p style="color:#9ca3af;font-size:13px">Lien direct : <br><span style="word-break:break-all;font-size:12px">${link}</span></p>
      </div>
    </div>`,
>>>>>>> 1d48245 (fix: use Brevo HTTP API instead of SMTP)
  });
};
