// Mock ioredis pour ne pas avoir besoin d'un vrai Redis
jest.mock('ioredis', () => {
  const store = new Map();
  const timers = new Map();

  const mockRedis = jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key) => store.get(key) || null),
    setex: jest.fn(async (key, ttl, val) => {
      store.set(key, val);
      if (timers.has(key)) clearTimeout(timers.get(key));
      timers.set(key, setTimeout(() => store.delete(key), ttl * 1000));
    }),
    del: jest.fn(async (...keys) => keys.forEach(k => store.delete(k))),
    scan: jest.fn(async () => ['0', []]),
    incr: jest.fn(async (key) => {
      const val = (parseInt(store.get(key) || '0') + 1);
      store.set(key, String(val));
      return val;
    }),
    expire: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    on: jest.fn((event, cb) => { if (event === 'connect') cb(); }),
    _store: store,
  }));

  return mockRedis;
});

const cache = require('../src/services/cacheService');

describe('cacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('✅ set puis get retourne la valeur', async () => {
    await cache.set('test:key', { name: 'Afrodite' }, 60);
    const val = await cache.get('test:key');
    expect(val).toEqual({ name: 'Afrodite' });
  });

  test('✅ get retourne null pour une clé inexistante', async () => {
    const val = await cache.get('inexistant:key:xyz');
    expect(val).toBeNull();
  });

  test('✅ set supporte les tableaux', async () => {
    await cache.set('test:array', [1, 2, 3], 60);
    const val = await cache.get('test:array');
    expect(val).toEqual([1, 2, 3]);
  });

  test('✅ set supporte les valeurs null/false', async () => {
    await cache.set('test:bool', false, 60);
    const val = await cache.get('test:bool');
    expect(val).toBe(false);
  });

  test('✅ getOrSet appelle fn() au premier accès', async () => {
    const fn = jest.fn().mockResolvedValue({ fresh: true });
    const val = await cache.getOrSet('test:getorset', fn, 60);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(val).toEqual({ fresh: true });
  });

  test('✅ getOrSet n\'appelle pas fn() si le cache existe', async () => {
    await cache.set('test:getorset2', { cached: true }, 60);
    const fn = jest.fn();
    const val = await cache.getOrSet('test:getorset2', fn, 60);
    expect(fn).not.toHaveBeenCalled();
    expect(val).toEqual({ cached: true });
  });

  test('✅ del supprime la clé', async () => {
    await cache.set('test:del', { data: 1 }, 60);
    await cache.del('test:del');
    const val = await cache.get('test:del');
    expect(val).toBeNull();
  });

  test('✅ TTL contient les constantes attendues', () => {
    expect(cache.TTL.PROFILES_LIST).toBe(60);
    expect(cache.TTL.PROFILE_DETAIL).toBe(300);
    expect(cache.TTL.BOOSTS_FEATURED).toBe(120);
    expect(cache.TTL.STATS).toBe(3600);
  });

  test('✅ incr incrémente correctement', async () => {
    const v1 = await cache.incr('test:counter', 60);
    const v2 = await cache.incr('test:counter', 60);
    expect(v2).toBe(v1 + 1);
  });
});
