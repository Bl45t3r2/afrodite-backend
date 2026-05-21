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

const storage = multer.memoryStorage();
const uploadPhoto = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
const uploadVideo = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// ── PHOTOS ──────────────────────────────────────────

router.post('/photo', authenticate, uploadPhoto.single('photo'), async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'afrodite/profiles', transformation: [{ width: 800, quality: 'auto' }] },
        (err, result) => err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    const photosCount = await prisma.photo.count({ where: { profileId: profile.id } });
    const photo = await prisma.photo.create({
      data: {
        profileId: profile.id,
        url: result.secure_url,
        publicId: result.public_id,
        isMain: photosCount === 0,
        isPrivate: req.body.isPrivate === 'true',
      }
    });

    res.json(photo);
  } catch (err) {
    console.error('Photo upload error:', err.message);
    res.status(500).json({ error: 'Erreur upload photo' });
  }
});

router.delete('/photo/:id', authenticate, async (req, res) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!photo) return res.status(404).json({ error: 'Photo introuvable' });
  await cloudinary.uploader.destroy(photo.publicId);
  await prisma.photo.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.patch('/photo/:id/main', authenticate, async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
  await prisma.photo.updateMany({ where: { profileId: profile.id }, data: { isMain: false } });
  await prisma.photo.update({ where: { id: req.params.id }, data: { isMain: true } });
  res.json({ success: true });
});

// ── VIDÉOS ──────────────────────────────────────────

router.post('/video', authenticate, uploadVideo.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune vidéo reçue' });

    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    // Limiter à 5 vidéos par profil
    const videosCount = await prisma.video.count({ where: { profileId: profile.id } });
    if (videosCount >= 5) return res.status(400).json({ error: 'Maximum 5 vidéos par profil' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'afrodite/videos',
          transformation: [{ quality: 'auto', fetch_format: 'mp4' }],
          eager: [{ width: 400, height: 300, crop: 'fill', format: 'jpg' }], // thumbnail
          eager_async: false,
        },
        (err, result) => err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    const thumbnailUrl = result.eager?.[0]?.secure_url || null;

    const video = await prisma.video.create({
      data: {
        profileId: profile.id,
        url: result.secure_url,
        publicId: result.public_id,
        thumbnailUrl,
        duration: result.duration || null,
        isPrivate: req.body.isPrivate === 'true',
      }
    });

    res.json(video);
  } catch (err) {
    console.error('Video upload error:', err.message);
    res.status(500).json({ error: 'Erreur upload vidéo' });
  }
});

router.patch('/video/:id/main', authenticate, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });
    await prisma.video.updateMany({ where: { profileId: profile.id }, data: { isMain: false } });
    await prisma.video.update({ where: { id: req.params.id }, data: { isMain: true } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/video/:id', authenticate, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) return res.status(404).json({ error: 'Vidéo introuvable' });
    if (video.profileId !== profile.id) return res.status(403).json({ error: 'Non autorisé' });

    await cloudinary.uploader.destroy(video.publicId, { resource_type: 'video' });
    await prisma.video.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;
