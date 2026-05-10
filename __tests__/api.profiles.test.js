const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CLIENT_URL = 'http://localhost:3000';

// Mock Prisma complet
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    profile: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    review: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    favorite: { findUnique: jest.fn().mockResolvedValue(null) },
    message: { findFirst: jest.fn().mockResolvedValue(null) },
  })),
}));

// Mock cacheService
jest.mock('../src/services/cacheService', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn(),
  delPattern: jest.fn(),
  TTL: { PROFILES_LIST: 60, PROFILE_DETAIL: 300, BOOSTS_FEATURED: 120 },
  isReady: jest.fn().mockReturnValue(false),
}));

// Mock geoService
jest.mock('../src/services/geoService', () => ({
  getCityCoords: jest.fn().mockReturnValue({ lat: 6.36, lng: 2.41 }),
  haversineKm: jest.fn().mockReturnValue(10),
}));

// Mock socket
jest.mock('../src/socket', () => ({ getIO: jest.fn(), initSocket: jest.fn(), sendNotification: jest.fn() }));

const app = require('../src/index');

const token = jwt.sign({ id: 'user-1', email: 'test@test.com', role: 'USER' }, 'test-secret', { expiresIn: '1h' });

describe('GET /api/profiles', () => {
  test('✅ Répond 200 sans authentification', async () => {
    const res = await request(app).get('/api/profiles');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profiles');
    expect(res.body).toHaveProperty('total');
  });

  test('✅ Accepte les paramètres de filtre', async () => {
    const res = await request(app).get('/api/profiles?city=Cotonou&page=1&limit=6');
    expect(res.status).toBe(200);
  });

  test('✅ Accepte le filtre isOnline', async () => {
    const res = await request(app).get('/api/profiles?isOnline=true');
    expect(res.status).toBe(200);
  });

  test('✅ Accepte le filtre radius', async () => {
    const res = await request(app).get('/api/profiles?city=Cotonou&radius=50');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/profiles/:id', () => {
  test('❌ Retourne 404 si profil introuvable', async () => {
    const { PrismaClient } = require('@prisma/client');
    const instance = new PrismaClient();
    instance.profile.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/profiles/profil-inexistant');
    expect(res.status).toBe(404);
  });
});

describe('Routes protégées', () => {
  test('❌ POST /api/profiles/:id/review sans auth → 401', async () => {
    const res = await request(app).post('/api/profiles/p1/review').send({ rating: 5, comment: 'Super' });
    expect(res.status).toBe(401);
  });

  test('❌ DELETE /api/messages/:id sans auth → 401', async () => {
    const res = await request(app).delete('/api/messages/msg-1');
    expect(res.status).toBe(401);
  });

  test('❌ GET /api/admin/stats sans auth → 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  test('❌ GET /api/admin/stats avec USER → 403', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('Auth routes', () => {
  test('❌ POST /api/auth/login avec données manquantes → 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('✅ POST /api/auth/login avec mauvais credentials → 401 ou 400', async () => {
    const { PrismaClient } = require('@prisma/client');
    const instance = new PrismaClient();
    instance.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nope@nope.com', password: 'wrongpass' });
    expect([400, 401]).toContain(res.status);
  });
});
