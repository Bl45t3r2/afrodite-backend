const Redis = require('ioredis');

let redis = null;
let connected = false;

// Connexion Redis — graceful degradation si Redis non disponible
function getClient() {
  if (redis) return redis;

  redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
      if (times > 3) return null; // arrêter après 3 tentatives
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  redis.on('connect', () => { connected = true; console.log('✅ Redis connecté'); });
  redis.on('error', (err) => {
    connected = false;
    if (!err.message.includes('ECONNREFUSED')) console.error('Redis error:', err.message);
  });
  redis.on('close', () => { connected = false; });

  redis.connect().catch(() => { connected = false; });

  return redis;
}

const isReady = () => connected;

// TTL par défaut en secondes
const TTL = {
  PROFILES_LIST: 60,        // 1 min — liste des profils (change souvent)
  PROFILE_DETAIL: 300,      // 5 min — détail d'un profil
  BOOSTS_FEATURED: 120,     // 2 min — profils boostés
  STATS: 3600,              // 1h — statistiques admin
  GEO_COORDS: 86400,        // 24h — coordonnées GPS (statiques)
};

/**
 * Récupérer une valeur du cache
 */
async function get(key) {
  if (!isReady()) return null;
  try {
    const val = await getClient().get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

/**
 * Stocker une valeur dans le cache
 */
async function set(key, value, ttlSeconds = 60) {
  if (!isReady()) return false;
  try {
    await getClient().setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Supprimer une ou plusieurs clés (supporte les wildcards via scan)
 */
async function del(...keys) {
  if (!isReady()) return;
  try {
    await getClient().del(...keys);
  } catch {}
}

/**
 * Supprimer toutes les clés correspondant à un pattern
 */
async function delPattern(pattern) {
  if (!isReady()) return;
  try {
    const client = getClient();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await client.del(...keys);
    } while (cursor !== '0');
  } catch {}
}

/**
 * Cache-aside helper : retourne le cache ou appelle fn() et le stocke
 */
async function getOrSet(key, fn, ttlSeconds = 60) {
  const cached = await get(key);
  if (cached !== null) return cached;

  const value = await fn();
  await set(key, value, ttlSeconds);
  return value;
}

/**
 * Incrémenter un compteur (ex: rate limiting)
 */
async function incr(key, ttlSeconds = 60) {
  if (!isReady()) return 0;
  try {
    const client = getClient();
    const val = await client.incr(key);
    if (val === 1) await client.expire(key, ttlSeconds);
    return val;
  } catch {
    return 0;
  }
}

module.exports = { get, set, del, delPattern, getOrSet, incr, TTL, isReady };
