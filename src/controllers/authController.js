const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');
const { applyReferralCode, getOrCreateReferralCode } = require('../services/referralService');

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(50),
  age: z.number().min(18).max(99),
  city: z.string().min(2),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  identifier: z.string(),
  password: z.string(),
});

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const emailExists = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailExists) return res.status(409).json({ error: 'Email déjà utilisé' });

    if (data.phone) {
      const phoneExists = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (phoneExists) return res.status(409).json({ error: 'Numéro de téléphone déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newUser = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone || null,
        passwordHash,
        emailVerified: false,
        verificationToken,
        verificationExpiry,
        profile: {
          create: {
            displayName: data.displayName,
            age: data.age,
            city: data.city,
            phone: data.phone || null,
          }
        },
        subscription: {
          create: {
            status: 'TRIAL',
            plan: 'basic',
            currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }
        }
      },
    });

    // Générer automatiquement un code de parrainage
    try {
      await getOrCreateReferralCode(newUser.id);
    } catch {}

    // Appliquer le code de parrainage si fourni
    if (data.referralCode) {
      try {
        await applyReferralCode(newUser.id, data.referralCode);
      } catch (refErr) {
        console.warn('Referral apply error:', refErr.message);
      }
    }

    // Envoi email de vérification avec logs détaillés
    let emailSent = false;
    try {
      console.log('=== ENVOI EMAIL VERIFICATION ===');
      console.log('To:', data.email);
      console.log('SMTP_HOST:', process.env.SMTP_HOST);
      console.log('SMTP_PORT:', process.env.SMTP_PORT);
      console.log('SMTP_USER:', process.env.SMTP_USER);
      console.log('SMTP_PASS défini:', !!process.env.SMTP_PASS);
      console.log('CLIENT_URL:', process.env.CLIENT_URL);
      await sendVerificationEmail(data.email, verificationToken);
      emailSent = true;
      console.log('✅ Email envoyé avec succès à', data.email);
    } catch (emailErr) {
      console.error('=== ERREUR EMAIL ===');
      console.error('Message:', emailErr.message);
      console.error('Code:', emailErr.code);
      console.error('Response:', emailErr.response);
      console.error('ResponseCode:', emailErr.responseCode);
      console.error('Command:', emailErr.command);
      console.error('===================');
    }

    res.status(201).json({
      message: 'Compte créé ! Vérifiez votre email pour activer votre compte.',
      emailSent,
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error('Register error:', err.message, err.code || '');
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token manquant' });

  try {
    const user = await prisma.user.findUnique({ where: { verificationToken: token }, include: { profile: true } });
    if (!user) return res.status(400).json({ error: 'Lien invalide ou déjà utilisé' });
    if (user.verificationExpiry < new Date()) return res.status(400).json({ error: 'Lien expiré. Demandez un nouveau.' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email déjà confirmé' });

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationExpiry: null }
    });

    try { await sendWelcomeEmail(user.email, user.profile?.displayName || 'là'); } catch {}

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({
      message: 'Email confirmé avec succès !',
      user: { id: user.id, email: user.email, role: user.role, profile: user.profile },
      accessToken,
      refreshToken,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Aucun compte avec cet email' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email déjà confirmé' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({ where: { id: user.id }, data: { verificationToken, verificationExpiry } });
    await sendVerificationEmail(email, verificationToken);
    res.json({ message: 'Email de confirmation renvoyé !' });
  } catch (err) {
    console.error('resendVerification error:', err.message);
    res.status(500).json({ error: 'Erreur envoi email' });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);

    const isPhone = /^[\+\d\s\-\(\)]{8,}$/.test(identifier) && !identifier.includes('@');
    const user = await prisma.user.findFirst({
      where: isPhone ? { phone: identifier } : { email: identifier },
      include: { profile: true, subscription: true }
    });

    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    if (user.profile?.status === 'BANNED') return res.status(403).json({ error: 'Compte suspendu' });

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'email_not_verified',
        message: 'Confirmez votre email avant de vous connecter.',
        email: user.email,
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role, profile: user.profile, subscription: user.subscription },
      accessToken,
      refreshToken
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error('Login error:', err.message, err.code || '');
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    const { accessToken, refreshToken: newRefresh } = generateTokens(user);
    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};

exports.me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      emailVerified: true,
      profile: { include: { photos: true, videos: true } },
      subscription: true,
    }
  });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ message: 'Si cet email existe, un lien a été envoyé.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({ where: { id: user.id }, data: { resetToken, resetTokenExpiry } });
    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'Si cet email existe, un lien a été envoyé.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });

  try {
    const user = await prisma.user.findUnique({ where: { resetToken: token } });
    if (!user) return res.status(400).json({ error: 'Lien invalide ou déjà utilisé' });
    if (user.resetTokenExpiry < new Date()) return res.status(400).json({ error: 'Lien expiré. Faites une nouvelle demande.' });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null }
    });

    res.json({ message: 'Mot de passe mis à jour avec succès !' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.validateResetToken = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false, error: 'Token manquant' });

  try {
    const user = await prisma.user.findUnique({ where: { resetToken: token } });
    if (!user || user.resetTokenExpiry < new Date()) return res.json({ valid: false });
    res.json({ valid: true, email: user.email });
  } catch {
    res.status(500).json({ valid: false });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Champs requis' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    res.json({ message: 'Mot de passe mis à jour avec succès !' });
  } catch (err) {
    console.error('changePassword error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.deleteAccount = async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Mot de passe requis' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' });
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ message: 'Compte supprimé' });
  } catch (err) {
    console.error('deleteAccount error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
