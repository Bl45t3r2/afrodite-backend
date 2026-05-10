const { mockRes, mockReq } = require('./helpers');

// Mock Prisma avant d'importer le controller
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    message: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  })),
}));

// Mock cacheService
jest.mock('../src/services/cacheService', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn(),
  delPattern: jest.fn(),
  TTL: { PROFILES_LIST: 60, PROFILE_DETAIL: 300 },
  isReady: jest.fn().mockReturnValue(false),
}));

const { PrismaClient } = require('@prisma/client');
const ctrl = require('../src/controllers/messageController');

describe('sendMessage — limites de quota', () => {
  let prismaInstance;

  beforeEach(() => {
    prismaInstance = new PrismaClient();
    jest.clearAllMocks();
  });

  test('❌ USER dépasse la limite journalière (5 messages)', async () => {
    prismaInstance.message.count.mockResolvedValue(5); // déjà 5 messages envoyés
    const req = mockReq({ body: { receiverId: 'receiver-1', content: 'Salut' }, user: { id: 'user-1', role: 'USER' } });
    const res = mockRes();
    await ctrl.sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('daily_limit_reached');
  });

  test('✅ PREMIUM n\'a pas de limite', async () => {
    prismaInstance.message.count.mockResolvedValue(999);
    prismaInstance.message.create.mockResolvedValue({ id: 'msg-1', content: 'Salut', senderId: 'user-1', receiverId: 'receiver-1' });
    const req = mockReq({ body: { receiverId: 'receiver-1', content: 'Salut' }, user: { id: 'user-1', role: 'PREMIUM' } });
    const res = mockRes();
    await ctrl.sendMessage(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test('❌ Message vide refusé', async () => {
    const req = mockReq({ body: { receiverId: 'receiver-1', content: '   ' } });
    const res = mockRes();
    await ctrl.sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('❌ Destinataire manquant refusé', async () => {
    const req = mockReq({ body: { content: 'Salut' } });
    const res = mockRes();
    await ctrl.sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('✅ getMessageQuota retourne le quota USER', async () => {
    prismaInstance.message.count.mockResolvedValue(3);
    const req = mockReq({ user: { id: 'user-1', role: 'USER' } });
    const res = mockRes();
    await ctrl.getMessageQuota(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.unlimited).toBe(false);
    expect(body.limit).toBe(5);
    expect(body.used).toBe(3);
    expect(body.remaining).toBe(2);
  });

  test('✅ getMessageQuota retourne unlimited pour PREMIUM', async () => {
    const req = mockReq({ user: { id: 'user-1', role: 'PREMIUM' } });
    const res = mockRes();
    await ctrl.getMessageQuota(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.unlimited).toBe(true);
  });
});
