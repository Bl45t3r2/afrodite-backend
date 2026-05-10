// Coordonnées GPS des villes supportées
const CITY_COORDS = {
  'Cotonou':    { lat: 6.3654,  lng: 2.4183  },
  'Porto-Novo': { lat: 6.4969,  lng: 2.6289  },
  'Lomé':       { lat: 6.1375,  lng: 1.2123  },
  'Abidjan':    { lat: 5.3600,  lng: -4.0083 },
  'Dakar':      { lat: 14.6928, lng: -17.4467 },
  'Accra':      { lat: 5.6037,  lng: -0.1870 },
  'Lagos':      { lat: 6.5244,  lng: 3.3792  },
  'Douala':     { lat: 4.0511,  lng: 9.7679  },
  'Abuja':      { lat: 9.0765,  lng: 7.3986  },
  'Nairobi':    { lat: -1.2921, lng: 36.8219 },
};

/**
 * Retourne les coords d'une ville ou null si inconnue
 */
exports.getCityCoords = (city) => {
  if (!city) return null;
  const key = Object.keys(CITY_COORDS).find(
    k => k.toLowerCase() === city.toLowerCase()
  );
  return key ? CITY_COORDS[key] : null;
};

/**
 * Distance en km entre deux points GPS (formule Haversine)
 */
exports.haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

exports.CITY_COORDS = CITY_COORDS;
