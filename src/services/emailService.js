const https = require('https');

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@afrodiz.com';
const FROM_NAME = 'Afrodite';

async function sendBrevoEmail({ to, subject, html, text }) {
  const payload = JSON.stringify({
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    replyTo: { email: FROM_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
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
        if (res.statusCode === 201) resolve(JSON.parse(data));
        else reject(new Error('Brevo API error ' + res.statusCode + ': ' + data));
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Brevo API timeout')); });
    req.write(payload);
    req.end();
  });
}

exports.sendVerificationEmail = async (email, token) => {
  const link = `${BASE_URL}/auth/verify-email?token=${token}`;
  await sendBrevoEmail({
    to: email,
    subject: 'Confirmez votre adresse email — Afrodite',
    text: `Bonjour,\n\nMerci de vous etre inscrit sur Afrodite !\n\nCliquez sur ce lien pour confirmer votre adresse email :\n${link}\n\nCe lien est valable 24 heures.\n\nSi vous n'avez pas cree de compte, ignorez cet email.\n\nCordialement,\nL'equipe Afrodite\nafrodiz.com`,
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmez votre email</title></head>
<body style="margin:0;padding:0;background:#f9f5f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f7;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#D4537E,#993556);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">Afrodite</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">La plateforme de profils verifies</p>
</td></tr>
<tr><td style="padding:36px 40px;">
<h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;font-weight:600;">Confirmez votre adresse email</h2>
<p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.7;">Merci de vous etre inscrit sur <strong>Afrodite</strong> ! Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.</p>
<p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.7;">Ce lien de confirmation est valable pendant <strong>24 heures</strong>.</p>
<p style="margin:0 0 28px;color:#4a5568;font-size:15px;line-height:1.7;">Apres confirmation, vous pourrez acceder a votre profil et commencer a vous connecter avec des milliers de membres sur la plateforme.</p>
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td align="center" style="padding:8px 0 28px;">
<a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#D4537E,#993556);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 48px;border-radius:10px;">Confirmer mon email</a>
</td></tr>
</table>
<p style="margin:0 0 10px;color:#718096;font-size:14px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
<p style="margin:0;background:#f7f7f7;border-radius:8px;padding:12px 16px;font-size:13px;color:#4a5568;word-break:break-all;font-family:monospace;">${link}</p>
</td></tr>
<tr><td style="background:#f9f5f7;padding:24px 40px;border-top:1px solid #f0e8ec;">
<p style="margin:0 0 8px;color:#718096;font-size:13px;text-align:center;">Si vous n'avez pas cree de compte sur Afrodite, ignorez cet email.</p>
<p style="margin:0;color:#a0aec0;font-size:12px;text-align:center;">2025 Afrodite - Tous droits reserves - afrodiz.com</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  });
};

exports.sendWelcomeEmail = async (email, displayName) => {
  await sendBrevoEmail({
    to: email,
    subject: 'Bienvenue sur Afrodite !',
    text: `Bonjour ${displayName},\n\nVotre compte Afrodite est maintenant active. Completez votre profil pour commencer.\n\nAccedez a votre tableau de bord : ${BASE_URL}/dashboard\n\nCordialement,\nL'equipe Afrodite\nafrodiz.com`,
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f5f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f7;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#D4537E,#993556);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">Afrodite</h1>
</td></tr>
<tr><td style="padding:36px 40px;">
<h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;font-weight:600;">Bienvenue, ${displayName} !</h2>
<p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.7;">Votre compte est maintenant active avec succes. Vous pouvez acceder a toutes les fonctionnalites d'Afrodite.</p>
<p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.7;">Commencez par completer votre profil : ajoutez une photo, une description et vos informations pour attirer plus de visiteurs.</p>
<p style="margin:0 0 28px;color:#4a5568;font-size:15px;line-height:1.7;">Rejoignez des milliers de membres actifs sur la plateforme et commencez a vous connecter des aujourd'hui.</p>
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td align="center" style="padding:8px 0 28px;">
<a href="${BASE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#D4537E,#993556);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:10px;">Completer mon profil</a>
</td></tr>
</table>
</td></tr>
<tr><td style="background:#f9f5f7;padding:24px 40px;border-top:1px solid #f0e8ec;">
<p style="margin:0;color:#a0aec0;font-size:12px;text-align:center;">2025 Afrodite - Tous droits reserves - afrodiz.com</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  });
};

exports.sendPasswordResetEmail = async (email, token) => {
  const link = `${BASE_URL}/auth/reset-password?token=${token}`;
  await sendBrevoEmail({
    to: email,
    subject: 'Reinitialisation de votre mot de passe — Afrodite',
    text: `Bonjour,\n\nVous avez demande la reinitialisation de votre mot de passe sur Afrodite.\n\nCliquez sur ce lien pour choisir un nouveau mot de passe :\n${link}\n\nCe lien est valable 1 heure seulement.\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\nCordialement,\nL'equipe Afrodite\nafrodiz.com`,
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f5f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5f7;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#D4537E,#993556);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">Afrodite</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Reinitialisation de mot de passe</p>
</td></tr>
<tr><td style="padding:36px 40px;">
<h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;font-weight:600;">Reinitialisation de votre mot de passe</h2>
<p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.7;">Vous avez demande la reinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
<p style="margin:0 0 28px;color:#e53e3e;font-size:14px;line-height:1.6;font-weight:600;">Ce lien est valable pendant 1 heure seulement.</p>
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td align="center" style="padding:8px 0 28px;">
<a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#D4537E,#993556);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 48px;border-radius:10px;">Reinitialiser mon mot de passe</a>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
<tr><td style="background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:14px 16px;">
<p style="margin:0;color:#c53030;font-size:13px;line-height:1.6;">Si vous n'avez pas demande cette reinitialisation, ignorez cet email. Votre mot de passe reste inchange.</p>
</td></tr>
</table>
<p style="margin:0 0 10px;color:#718096;font-size:14px;">Lien direct :</p>
<p style="margin:0;background:#f7f7f7;border-radius:8px;padding:12px 16px;font-size:13px;color:#4a5568;word-break:break-all;font-family:monospace;">${link}</p>
</td></tr>
<tr><td style="background:#f9f5f7;padding:24px 40px;border-top:1px solid #f0e8ec;">
<p style="margin:0;color:#a0aec0;font-size:12px;text-align:center;">2025 Afrodite - Tous droits reserves - afrodiz.com</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  });
};
