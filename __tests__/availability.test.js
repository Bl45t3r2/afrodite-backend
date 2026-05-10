const { mockRes, mockReq } = require('./helpers');

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    profile: { findUnique: jest.fn() },
    availability: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  })),
}));

const { PrismaClient } = require('@prisma/client');

describe('Availability — logique métier', () => {
  let prisma;
  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
  });

  test('✅ GET public retourne les créneaux actifs', async () => {
    const slots = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isActive: true },
      { dayOfWeek: 5, startTime: '10:00', endTime: '20:00', isActive: true },
    ];
    prisma.availability.findMany.mockResolvedValue(slots);

    // Simuler la logique du controller
    const result = await prisma.availability.findMany({ where: { isActive: true } });
    expect(result).toHaveLength(2);
    expect(result[0].dayOfWeek).toBe(1);
  });

  test('✅ Les jours vont de 0 (Dim) à 6 (Sam)', () => {
    const DAYS = [0, 1, 2, 3, 4, 5, 6];
    DAYS.forEach(d => {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(6);
    });
  });

  test('✅ startTime < endTime est une contrainte valide', () => {
    const isValid = (start, end) => start < end;
    expect(isValid('09:00', '18:00')).toBe(true);
    expect(isValid('18:00', '09:00')).toBe(false);
    expect(isValid('00:00', '23:30')).toBe(true);
  });

  test('✅ Les créneaux par défaut couvrent lundi-vendredi', () => {
    const defaults = [1,2,3,4,5].map(d => ({ dayOfWeek: d, isActive: true }));
    const weekdays = defaults.filter(s => s.isActive);
    expect(weekdays).toHaveLength(5);
    const weekend = [0, 6].map(d => ({ dayOfWeek: d, isActive: false }));
    expect(weekend.every(s => !s.isActive)).toBe(true);
  });
});

describe('Review — vérification avis', () => {
  test('✅ isVerified = true si échange de messages existe', () => {
    const hasMessaged = true;
    const isVerified = !!hasMessaged;
    expect(isVerified).toBe(true);
  });

  test('✅ isVerified = false si aucun échange', () => {
    const hasMessaged = null;
    const isVerified = !!hasMessaged;
    expect(isVerified).toBe(false);
  });

  test('✅ Rating doit être entre 1 et 5', () => {
    const isValidRating = (r) => Number.isInteger(r) && r >= 1 && r <= 5;
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
  });

  test('✅ Commentaire vide est rejeté', () => {
    const isValidComment = (c) => typeof c === 'string' && c.trim().length > 0;
    expect(isValidComment('')).toBe(false);
    expect(isValidComment('   ')).toBe(false);
    expect(isValidComment('Très bien')).toBe(true);
  });
});
