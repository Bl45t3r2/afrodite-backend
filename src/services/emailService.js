const https = require('https');
const BASE_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@afrodiz.com';
const FROM_NAME = 'Afrodite';
async function sendBrevoEmail({ to, subject, html }) {
  const payload = JSON.stringify({ sender: { name: FROM_NAME, email: FROM_EMAIL }, to: [{ email: to }], subject, htmlContent: html });
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST', headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => res.statusCode === 201 ? resolve(JSON.parse(data)) : reject(new Error('Brevo ' + res.statusCode + ': ' + data)));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}
exports.sendVerificationEmail = async (email, token) => {
  const link = BASE_URL + '/auth/verify-email?token=' + token;
  await sendBrevoEmail({ to: email, subject: 'Confirmez votre email — Afrodite', html: '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px"><div style="background:linear-gradient(135deg,#D4537E,#993556);padding:30px;text-align:center;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0">Afrodite</h1></div><div style="padding:30px;background:#fff"><h2>Confirmez votre email</h2><p style="color:#6b7280">Cliquez ci-dessous pour activer votre compte (lien valable 24h).</p><div style="text-align:center;margin:24px 0"><a href="' + link + '" style="background:#D4537E;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600">Confirmer mon email</a></div><p style="font-size:12px;color:#9ca3af">Lien : ' + link + '</p></div></div>' });
};
exports.sendWelcomeEmail = async (email, displayName) => {
  await sendBrevoEmail({ to: email, subject: 'Bienvenue sur Afrodite !', html: '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px"><div style="background:linear-gradient(135deg,#D4537E,#993556);padding:30px;text-align:center;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0">Afrodite</h1></div><div style="padding:30px;background:#fff"><h2>Bienvenue ' + displayName + ' !</h2><p style="color:#6b7280">Votre compte est activé.</p><a href="' + BASE_URL + '/dashboard" style="background:#D4537E;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600">Compléter mon profil</a></div></div>' });
};
exports.sendPasswordResetEmail = async (email, token) => {
  const link = BASE_URL + '/auth/reset-password?token=' + token;
  await sendBrevoEmail({ to: email, subject: 'Réinitialisation mot de passe — Afrodite', html: '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px"><div style="background:linear-gradient(135deg,#D4537E,#993556);padding:30px;text-align:center;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0">Afrodite</h1></div><div style="padding:30px;background:#fff"><h2>Réinitialisation</h2><p style="color:#6b7280">Lien valable 1 heure.</p><div style="text-align:center;margin:24px 0"><a href="' + link + '" style="background:#D4537E;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600">Réinitialiser</a></div></div></div>' });
};
