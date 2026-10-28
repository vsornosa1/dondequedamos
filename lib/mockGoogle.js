// Google simulado para desarrollar sin clave: se usa solo si falta GOOGLE_MAPS_API_KEY fuera de producción.
import { estimateMinutes, offset } from './core.js';

const PLACES = {
  a: ['Benimaclet, Valencia', 39.4876, -0.3570], b: ['Russafa, Valencia', 39.4616, -0.3749],
  c: ['Campanar, Valencia', 39.4840, -0.3990], d: ['Torrent, Valencia', 39.4371, -0.4655],
  e: ['El Cabanyal, Valencia', 39.4699, -0.3283], f: ['Patraix, Valencia', 39.4607, -0.3962],
  g: ['Burjassot, Valencia', 39.5097, -0.4133], h: ['Mislata, Valencia', 39.4752, -0.4180],
};
const NAMES = ['La Pepica del Barrio', 'Bar Tonyina', 'Casa Montaña', 'Bodega La Pascuala', 'Café de las Horas', 'El Rincón de Paco', 'Taberna Ultramarinos', 'Bar Cremaet', 'La Clotxa', 'Horchatería Fuster', 'Bar Mistela', 'El Gallo Azul'];
const TYPES = ['Restaurante', 'Bar', 'Restaurante', 'Bodega', 'Cafetería', 'Bar de tapas', 'Taberna', 'Bar', 'Restaurante', 'Horchatería', 'Bar de vinos', 'Bar de copas'];
const PRICES = ['PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_MODERATE'];
const SUMMARIES = [
  'Local de barrio con terraza, tapas caseras y cerveza muy fría.',
  'Barra larga, ambiente animado y raciones para compartir.',
  'Cocina valenciana de toda la vida en un local con azulejos.',
];
const HUES = [8, 205, 140, 268, 32, 186, 330, 24, 350, 48, 120, 220];

const photoName = (i, k) => `places/v${i}/photos/p${k}`;
const photos = (i, n) => Array.from({ length: n }, (_, k) => ({ name: photoName(i, k), authorAttributions: [{ displayName: 'Foto simulada' }] }));

// Imagen de relleno: un SVG con el nombre del sitio, para ver el diseño sin gastar en fotos reales.
function fakePhoto(i, k) {
  const h = HUES[i % HUES.length] + k * 22;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 55% 52%)"/><stop offset="1" stop-color="hsl(${h + 40} 60% 28%)"/></linearGradient></defs><rect width="800" height="520" fill="url(#g)"/><circle cx="${180 + k * 140}" cy="300" r="120" fill="rgba(255,255,255,.12)"/><circle cx="${560 - k * 90}" cy="190" r="80" fill="rgba(255,255,255,.1)"/><text x="40" y="470" font-family="sans-serif" font-size="44" font-weight="800" fill="rgba(255,255,255,.85)">${NAMES[i]}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function details(i) {
  return {
    id: `v${i}`, displayName: { text: NAMES[i] }, primaryTypeDisplayName: { text: TYPES[i] },
    shortFormattedAddress: `Carrer de Mock ${i + 1}, Valencia`, googleMapsUri: `https://maps.google.com/?cid=${i}`,
    rating: 4 + (i % 9) / 10, userRatingCount: 50 + i * 37, priceLevel: PRICES[i],
    priceRange: { startPrice: { currencyCode: 'EUR', units: String(10 + i) }, endPrice: { currencyCode: 'EUR', units: String(20 + i * 2) } },
    currentOpeningHours: { openNow: i % 5 !== 0 },
    regularOpeningHours: { weekdayDescriptions: ['lunes: Cerrado', 'martes: 12:00–0:00', 'miércoles: 12:00–0:00', 'jueves: 12:00–1:00', 'viernes: 12:00–2:00', 'sábado: 11:00–2:00', 'domingo: 11:00–17:00'] },
    editorialSummary: i % 4 === 3 ? undefined : { text: SUMMARIES[i % SUMMARIES.length] },
    websiteUri: i % 2 ? `https://example.com/${i}` : undefined,
    photos: photos(i, 3),
    outdoorSeating: i % 2 === 0, servesBeer: true, servesWine: i % 3 === 1, servesCocktails: i % 3 === 0,
    servesCoffee: i % 2 === 1, reservable: i % 4 === 0, goodForGroups: true, liveMusic: i === 11,
  };
}

export async function mockFetch(url, init) {
  url = String(url);
  const body = init?.body ? JSON.parse(init.body) : {};
  const ok = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  if (url.includes(':autocomplete')) {
    const q = body.input.toLowerCase().slice(0, 3);
    return ok({ suggestions: Object.entries(PLACES).filter(([, v]) => v[0].toLowerCase().includes(q)).map(([k, v]) => ({ placePrediction: { placeId: `mockplace_${k}`, structuredFormat: { mainText: { text: v[0].split(',')[0] }, secondaryText: { text: 'Valencia, España' } } } })) });
  }
  if (url.includes('/places/mockplace_')) {
    const v = PLACES[url.split('mockplace_')[1][0]];
    return ok({ location: { latitude: v[1], longitude: v[2] }, displayName: { text: v[0] } });
  }
  const media = url.match(/places\/v(\d+)\/photos\/p(\d+)\/media/);
  if (media) return ok({ photoUri: fakePhoto(+media[1], +media[2]) });
  const place = url.match(/\/v1\/places\/v(\d+)\?/);
  if (place) return ok(details(+place[1]));
  if (url.includes('searchNearby')) {
    const c = body.locationRestriction.circle;
    const ctr = { lat: c.center.latitude, lng: c.center.longitude };
    return ok({ places: NAMES.map((n, i) => {
      const p = offset(ctr, (c.radius * ((i * 7) % 10)) / 10, i * 47);
      return {
        id: `v${i}`, displayName: { text: n }, location: { latitude: p.lat, longitude: p.lng },
        rating: 4 + (i % 9) / 10, userRatingCount: 50 + i * 37, priceLevel: PRICES[i],
        shortFormattedAddress: `Carrer de Mock ${i + 1}, Valencia`, googleMapsUri: `https://maps.google.com/?cid=${i}`,
        primaryTypeDisplayName: { text: TYPES[i] }, currentOpeningHours: { openNow: i % 5 !== 0 }, photos: photos(i, 1),
      };
    }) });
  }
  if (url.includes('computeRouteMatrix')) {
    const ll = (w) => ({ lat: w.waypoint.location.latLng.latitude, lng: w.waypoint.location.latLng.longitude });
    const out = [];
    body.origins.forEach((o, i) => body.destinations.forEach((d, j) => out.push({
      originIndex: i, destinationIndex: j, condition: 'ROUTE_EXISTS',
      duration: `${Math.round(estimateMinutes(ll(o), body.travelMode, ll(d)) * 60 * (1 + ((i + j) % 3) * 0.08))}s`,
    })));
    return ok(out);
  }
  return { ok: false, status: 404, text: async () => '{}' };
}
