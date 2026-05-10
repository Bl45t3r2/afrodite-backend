const jwt = require('jsonwebtoken');
const { authenticate, requireRole, requirePremium } = require('../src/middleware/auth');
const { mockRes } = require('./helpers');

process.env.JWT_SECRET = 'test-secret';

describe('authenticate middleware', () => {
  const validToken = jwt.sign({ id: '1', email: 'a@b.com', role: 'USER' }, 'test-secret', { expiresIn: '1h' });

  test('✅ Passe avec un token valide', () => {
    const req = { headers: { authorization: `Bearer ${validToken}` } };
    const res = mockRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe('a@b.com');
  });

  test('❌ Rejette sans token', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('❌ Rejette avec un token expiré', () => {
    const expired = jwt.sign({ id: '1' }, 'test-secret', { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${expired}` } };
    const res = mockRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('❌ Rejette avec un token falsifié', () => {
    const req = { headers: { authorization: 'Bearer fake.token.here' } };
    const res = mockRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireRole middleware', () => {
  test('✅ Autorise le bon rôle', () => {
    const req = { user: { role: 'ADMIN' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('❌ Refuse un rôle insuffisant', () => {
    const req = { user: { role: 'USER' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('ADMIN')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('✅ Accepte plusieurs rôles', () => {
    const req = { user: { role: 'PREMIUM' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('ADMIN', 'PREMIUM')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requirePremium middleware', () => {
  test('✅ Autorise PREMIUM', () => {
    const req = { user: { role: 'PREMIUM' } };
    const res = mockRes();
    const next = jest.fn();
    requirePremium(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('✅ Autorise ADMIN', () => {
    const req = { user: { role: 'ADMIN' } };
    const res = mockRes();
    const next = jest.fn();
    requirePremium(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('❌ Refuse USER', () => {
    const req = { user: { role: 'USER' } };
    const res = mockRes();
    const next = jest.fn();
    requirePremium(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
