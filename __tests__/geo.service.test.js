const { getCityCoords, haversineKm, CITY_COORDS } = require('../src/services/geoService');

describe('getCityCoords', () => {
  test('✅ Retourne les coords de Cotonou', () => {
    const coords = getCityCoords('Cotonou');
    expect(coords).not.toBeNull();
    expect(coords.lat).toBeCloseTo(6.3654, 1);
    expect(coords.lng).toBeCloseTo(2.4183, 1);
  });

  test('✅ Insensible à la casse', () => {
    expect(getCityCoords('cotonou')).toEqual(getCityCoords('Cotonou'));
    expect(getCityCoords('DAKAR')).toEqual(getCityCoords('Dakar'));
  });

  test('✅ Retourne les coords de Lagos', () => {
    const coords = getCityCoords('Lagos');
    expect(coords).not.toBeNull();
    expect(coords.lat).toBeCloseTo(6.5244, 1);
  });

  test('❌ Retourne null pour une ville inconnue', () => {
    expect(getCityCoords('Paris')).toBeNull();
    expect(getCityCoords('')).toBeNull();
    expect(getCityCoords(null)).toBeNull();
  });

  test('✅ Toutes les villes ont des coords valides', () => {
    Object.entries(CITY_COORDS).forEach(([city, coords]) => {
      expect(coords.lat).toBeGreaterThan(-90);
      expect(coords.lat).toBeLessThan(90);
      expect(coords.lng).toBeGreaterThan(-180);
      expect(coords.lng).toBeLessThan(180);
    });
  });
});

describe('haversineKm', () => {
  test('✅ Distance Cotonou → Lagos ≈ 100km', () => {
    const cotonou = getCityCoords('Cotonou');
    const lagos = getCityCoords('Lagos');
    const dist = haversineKm(cotonou.lat, cotonou.lng, lagos.lat, lagos.lng);
    expect(dist).toBeGreaterThan(80);
    expect(dist).toBeLessThan(150);
  });

  test('✅ Distance nulle entre un point et lui-même', () => {
    const dist = haversineKm(6.36, 2.41, 6.36, 2.41);
    expect(dist).toBeCloseTo(0, 1);
  });

  test('✅ Distance Dakar → Abidjan > 1000km', () => {
    const dakar = getCityCoords('Dakar');
    const abidjan = getCityCoords('Abidjan');
    const dist = haversineKm(dakar.lat, dakar.lng, abidjan.lat, abidjan.lng);
    expect(dist).toBeGreaterThan(1000);
  });

  test('✅ La distance est symétrique (A→B = B→A)', () => {
    const a = getCityCoords('Cotonou');
    const b = getCityCoords('Lomé');
    const d1 = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const d2 = haversineKm(b.lat, b.lng, a.lat, a.lng);
    expect(d1).toBeCloseTo(d2, 5);
  });
});
