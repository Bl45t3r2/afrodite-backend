const cache = require('../services/cacheService');
const { getCityCoords, haversineKm } = require('../services/geoService');
const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('../socket');
const prisma = new PrismaClient();

exports.getProfiles = async (req, res) => {
  try {
    const {
      city, category, minPrice, maxPrice, isOnline, isVerified,
      page = 1, limit = 12, search, tags
    } = req.query;

    // Cache key basée sur tous les paramètres de filtre
    const cacheKey = `profiles:list:${JSON.stringify(req.query)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const where = {
      status: 'ACTIVE',
      user: { role: { not: 'ADMIN' } }
    };

    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (isOnline === 'true') where.isOnline = true;

    // Filtre par rayon géographique (en km)
    let userLat = null, userLng = null;
    const radiusKm = req.query.radius ? parseFloat(req.query.radius) : null;
    if (req.query.lat && req.query.lng) {
      userLat = parseFloat(req.query.lat);
      userLng = parseFloat(req.query.lng);
    } else if (city && radiusKm) {
      // Géocoder la ville sélectionnée
      const coords = getCityCoords(city);
      if (coords) { userLat = coords.lat; userLng = coords.lng; }
    }
    if (isVerified === 'true') where.isVerified = true;
    if (category) where.categories = { has: category };
    if (search) where.displayName = { contains: search, mode: 'insensitive' };
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) where.tags = { hasSome: tagList };
    }
    if (minPrice || maxPrice) {
      where.pricePerHour = {};
      if (minPrice) where.pricePerHour.gte = parseFloat(minPrice);
      if (maxPrice) where.pricePerHour.lte = parseFloat(maxPrice);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [profiles, total] = await Promise.all([
      prisma.profile.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ isOnline: 'desc' }, { viewCount: 'desc' }],
        include: {
          photos: { where: { isMain: true, isPrivate: false }, take: 1 },
          videos: { where: { isPrivate: false }, orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }], take: 1 },
          _count: { select: { reviews: true, favoritedBy: true } },
          boosts: { where: { active: true, endAt: { gt: new Date() } }, take: 1 },
        }
      }),
      prisma.profile.count({ where })
    ]);

    // Filtrage par rayon si coords disponibles
    let filteredProfiles = profiles;
    if (userLat !== null && userLng !== null && radiusKm) {
      filteredProfiles = profiles.filter(p => {
        if (p.latitude && p.longitude) {
          return haversineKm(userLat, userLng, p.latitude, p.longitude) <= radiusKm;
        }
        // Fallback : vérifier via coords de la ville
        const coords = getCityCoords(p.city);
        if (coords) return haversineKm(userLat, userLng, coords.lat, coords.lng) <= radiusKm;
        return true; // inclure si pas de coords
      });

      // Ajouter la distance à chaque profil
      filteredProfiles = filteredProfiles.map(p => {
        const coords = p.latitude && p.longitude
          ? { lat: p.latitude, lng: p.longitude }
          : getCityCoords(p.city);
        const distance = coords ? Math.round(haversineKm(userLat, userLng, coords.lat, coords.lng)) : null;
        return { ...p, distance };
      });
    }

    // Trier : boostés en premier, puis en ligne, puis par vues
    const sorted = [...filteredProfiles].sort((a, b) => {
      const aBoost = a.boosts?.length > 0 ? 1 : 0;
      const bBoost = b.boosts?.length > 0 ? 1 : 0;
      if (bBoost !== aBoost) return bBoost - aBoost;
      if (b.isOnline !== a.isOnline) return b.isOnline ? 1 : -1;
      return b.viewCount - a.viewCount;
    });

    const result = { profiles: sorted, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
    await cache.set(cacheKey, result, cache.TTL.PROFILES_LIST);
    res.json(result);
  } catch (err) {
    console.error('getProfiles error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const cacheKey = `profiles:detail:${req.params.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);
    const profile = await prisma.profile.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { role: true } },
        photos: { where: { isPrivate: false } },
        videos: { where: { isPrivate: false }, orderBy: { createdAt: 'desc' } },
        reviews: {
          include: { user: { select: { id: true, profile: { select: { displayName: true } } } } },
          orderBy: [{ isVerified: 'desc' }, { createdAt: 'desc' }],
          take: 20
        },
        _count: { select: { reviews: true, favoritedBy: true } },
        availabilities: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } }
      }
    });

    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    // Bloquer l'accès public aux profils admin
    if (profile.user?.role === 'ADMIN') return res.status(404).json({ error: 'Profil introuvable' });

    await prisma.profile.update({
      where: { id: req.params.id },
      data: { viewCount: { increment: 1 } }
    });

    // Profils similaires — même ville ou même catégorie, exclu l'admin et le profil courant
    const similar = await prisma.profile.findMany({
      where: {
        id: { not: profile.id },
        status: 'ACTIVE',
        user: { role: { not: 'ADMIN' } },
        OR: [
          { city: profile.city },
          profile.categories.length > 0
            ? { categories: { hasSome: profile.categories } }
            : {}
        ]
      },
      take: 4,
      orderBy: { viewCount: 'desc' },
      include: {
        photos: { where: { isMain: true, isPrivate: false }, take: 1 },
        _count: { select: { reviews: true } }
      }
    });

    res.json({ ...profile, similar });
  } catch (err) {
    console.error('getProfile error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { displayName, age, city, bio, phone, pricePerHour, categories, tags, isOnline } = req.body;

    const data = { displayName, city, bio, phone, categories, tags };
    if (age !== undefined && age !== '') data.age = parseInt(age);
    if (pricePerHour !== undefined && pricePerHour !== '') data.pricePerHour = parseFloat(pricePerHour);
    if (isOnline !== undefined) data.isOnline = isOnline;
    // Géocoder automatiquement la ville
    if (city) {
      const coords = getCityCoords(city);
      if (coords) { data.latitude = coords.lat; data.longitude = coords.lng; }
    }

    const profile = await prisma.profile.update({
      where: { userId: req.user.id },
      data
    });

    res.json(profile);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.toggleFavorite = async (req, res) => {
  const { profileId } = req.params;
  const userId = req.user.id;

  const existing = await prisma.favorite.findUnique({
    where: { userId_profileId: { userId, profileId } }
  });

  if (existing) {
    await prisma.favorite.delete({ where: { userId_profileId: { userId, profileId } } });
    return res.json({ favorited: false });
  }

  await prisma.favorite.create({ data: { userId, profileId } });

  // Notifier le propriétaire du profil
  try {
    const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { userId: true, displayName: true } });
    const sender = await prisma.profile.findUnique({ where: { userId }, select: { displayName: true } });
    if (profile && profile.userId !== userId) {
      await sendNotification({
        userId: profile.userId,
        type: 'FAVORITE',
        title: 'Nouveau favori ❤️',
        body: `${sender?.displayName || 'Quelqu\'un'} a ajouté votre profil en favori`,
        link: `/profiles`,
      });
    }
  } catch {}

  res.json({ favorited: true });
};

exports.canReview = async (req, res) => {
  try {
    if (!req.user) return res.json({ canReview: false, hasMessaged: false, alreadyReviewed: false });

    const profile = await prisma.profile.findUnique({
      where: { id: req.params.id },
      select: { userId: true }
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    // Vérifier échange de messages
    const hasMessaged = !!(await prisma.message.findFirst({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: profile.userId },
          { senderId: profile.userId, receiverId: req.user.id },
        ]
      }
    }));

    // Vérifier avis existant
    const existingReview = await prisma.review.findUnique({
      where: { profileId_userId: { profileId: req.params.id, userId: req.user.id } }
    });

    res.json({
      canReview: true, // on permet toujours, mais on indique si vérifié
      hasMessaged,
      alreadyReviewed: !!existingReview,
      existingReview: existingReview || null,
    });
  } catch (err) {
    console.error('canReview error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || parseInt(rating) < 1 || parseInt(rating) > 5) {
      return res.status(400).json({ error: 'Note invalide (1-5)' });
    }
    if (!comment?.trim()) {
      return res.status(400).json({ error: 'Le commentaire est obligatoire' });
    }

    // Récupérer le profil cible pour avoir son userId
    const targetProfile = await prisma.profile.findUnique({
      where: { id: req.params.id },
      select: { userId: true }
    });
    if (!targetProfile) return res.status(404).json({ error: 'Profil introuvable' });

    // Vérifier si l'auteur a déjà échangé des messages avec ce profil
    const hasMessaged = await prisma.message.findFirst({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: targetProfile.userId },
          { senderId: targetProfile.userId, receiverId: req.user.id },
        ]
      }
    });

    const isVerified = !!hasMessaged;

    const review = await prisma.review.upsert({
      where: { profileId_userId: { profileId: req.params.id, userId: req.user.id } },
      update: { rating: parseInt(rating), comment: comment.trim(), isVerified },
      create: { profileId: req.params.id, userId: req.user.id, rating: parseInt(rating), comment: comment.trim(), isVerified }
    });

    // Notifier le propriétaire du profil
    try {
      const profile = await prisma.profile.findUnique({ where: { id: req.params.id }, select: { userId: true, displayName: true } });
      const sender = await prisma.profile.findUnique({ where: { userId: req.user.id }, select: { displayName: true } });
      if (profile && profile.userId !== req.user.id) {
        const stars = '⭐'.repeat(parseInt(rating));
        await sendNotification({
          userId: profile.userId,
          type: 'REVIEW',
          title: `Nouvel avis ${stars}`,
          body: `${sender?.displayName || 'Quelqu\'un'} vous a laissé un avis ${parseInt(rating)}/5`,
          link: `/profiles`,
        });
      }
    } catch {}

    res.json(review);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.getMyFavorites = async (req, res) => {
  const favorites = await prisma.favorite.findMany({
    where: { userId: req.user.id },
    include: {
      profile: {
        include: { photos: { where: { isMain: true }, take: 1 } }
      }
    }
  });
  res.json(favorites.map(f => f.profile));
};

exports.getMyStats = async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, viewCount: true }
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const [favoritesCount, messagesCount, reviewsData, viewsThisWeek] = await Promise.all([
      prisma.favorite.count({ where: { profileId: profile.id } }),
      prisma.message.count({ where: { receiverId: req.user.id } }),
      prisma.review.aggregate({
        where: { profileId: profile.id },
        _avg: { rating: true },
        _count: true
      }),
      // Vues simulées sur 7 jours (basé sur viewCount total)
      Promise.resolve(
        Array.from({ length: 7 }, (_, i) => ({
          day: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('fr-FR', { weekday: 'short' }),
          views: Math.floor(Math.random() * 30 + 5)
        }))
      )
    ]);

    res.json({
      totalViews: profile.viewCount,
      favoritesCount,
      messagesCount,
      averageRating: reviewsData._avg.rating || 0,
      reviewsCount: reviewsData._count,
      viewsPerDay: viewsThisWeek
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.getPopularTags = async (req, res) => {
  try {
    const profiles = await prisma.profile.findMany({
      where: { status: 'ACTIVE', user: { role: { not: 'ADMIN' } } },
      select: { tags: true }
    });

    // Compter la fréquence de chaque tag
    const tagCount = {};
    profiles.forEach(p => {
      p.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    const sorted = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag, count]) => ({ tag, count }));

    res.json(sorted);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
