const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
};

const requirePremium = (req, res, next) => {
  if (!['PREMIUM', 'ADMIN'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Abonnement premium requis' });
  }
  next();
};

module.exports = { authenticate, requireRole, requirePremium };
