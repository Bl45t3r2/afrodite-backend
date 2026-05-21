const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, access_mode: 'authenticated' }, // privé — non accessible publiquement
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });

// GET /verification/me — statut de ma vérification
router.get('/me', authenticate, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const verif = await prisma.identityVerification.findUnique({
      where: { profileId: profile.id }
    });
    res.json(verif || null);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /verification/submit — soumettre les documents
router.post(
  '/submit',
  authenticate,
  upload.fields([
    { name: 'docFront', maxCount: 1 },
    { name: 'docBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
      if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

      // Vérifier qu'il n'y a pas déjà une demande approuvée
      const existing = await prisma.identityVerification.findUnique({ where: { profileId: profile.id } });
      if (existing?.status === 'APPROVED') {
        return res.status(400).json({ error: 'Votre identité est déjà vérifiée' });
      }

      const files = req.files;
      if (!files?.docFront?.[0] || !files?.selfie?.[0]) {
        return res.status(400).json({ error: 'Documents manquants (recto + selfie requis)' });
      }

      const { docType } = req.body;
      if (!['CNI', 'PASSEPORT', 'PERMIS'].includes(docType)) {
        return res.status(400).json({ error: 'Type de document invalide' });
      }

      // Upload sécurisé (dossier privé Cloudinary)
      const folder = `afrodite/identity/${profile.id}`;
      const [frontResult, selfieResult] = await Promise.all([
        uploadToCloudinary(files.docFront[0].buffer, folder),
        uploadToCloudinary(files.selfie[0].buffer, folder),
      ]);

      let backUrl = null;
      if (files?.docBack?.[0]) {
        const backResult = await uploadToCloudinary(files.docBack[0].buffer, folder);
        backUrl = backResult.secure_url;
      }

      // Upsert (remplace une demande rejetée)
      const verif = await prisma.identityVerification.upsert({
        where: { profileId: profile.id },
        update: {
          docType,
          docFrontUrl: frontResult.secure_url,
          docBackUrl: backUrl,
          selfieUrl: selfieResult.secure_url,
          status: 'PENDING',
          note: null,
          submittedAt: new Date(),
          reviewedAt: null,
        },
        create: {
          profileId: profile.id,
          docType,
          docFrontUrl: frontResult.secure_url,
          docBackUrl: backUrl,
          selfieUrl: selfieResult.secure_url,
          status: 'PENDING',
        },
      });

      res.json({ success: true, verification: verif });
    } catch (err) {
      console.error('Verification submit error:', err.message);
      res.status(500).json({ error: 'Erreur lors de l\'envoi des documents' });
    }
  }
);

module.exports = router;
