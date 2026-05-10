const jwt = require('jsonwebtoken');

// JWT de test
const makeToken = (user = {}) => jwt.sign(
  { id: user.id || 'user-test-1', email: user.email || 'test@test.com', role: user.role || 'USER' },
  process.env.JWT_SECRET || 'test-secret',
  { expiresIn: '1h' }
);

const makeAdminToken = () => makeToken({ id: 'admin-1', role: 'ADMIN' });
const makePremiumToken = () => makeToken({ id: 'premium-1', role: 'PREMIUM' });

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  profile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  message: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  review: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  boost: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
};

// Réponse mock standard
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: { id: 'user-test-1', email: 'test@test.com', role: 'USER' },
  ...overrides,
});

module.exports = { makeToken, makeAdminToken, makePremiumToken, mockPrisma, mockRes, mockReq };
