// Cliente mínimo de Google Maps Platform (Routes API + Places API New).

// Nearby Search se cobra según los campos que se piden. En Pro (5.000 gratis al mes) llegan los sitios
// ordenados por popularidad, con foto y tipo; en Enterprise (1.000 gratis) además valoración, precio y
// si está abierto ahora. Se elige con PLACES_NEARBY_TIER.
const NEARBY_PRO = [
  'places.id', 'places.displayName', 'places.location', 'places.formattedAddress', 'places.shortFormattedAddress',
  'places.googleMapsUri', 'places.primaryTypeDisplayName', 'places.businessStatus', 'places.photos',
];
const NEARBY_ENTERPRISE = [...NEARBY_PRO, 'places.rating', 'places.userRatingCount', 'places.priceLevel', 'places.currentOpeningHours.openNow'];

const BLOCKED = ['SERVICE_DISABLED', 'API_KEY_SERVICE_BLOCKED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED'];

export function makeGoogle(key, fetchFn = fetch, { nearbyTier = 'pro' } = {}) {
  const enterprise = nearbyTier === 'enterprise';
  const call = async (url, { method = 'POST', body, fieldMask } = {}) => {
    const headers = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key };
    if (fieldMask) headers['X-Goog-FieldMask'] = fieldMask;
    const res = await fetchFn(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const e = data?.error || data?.[0]?.error || {};
      const err = new Error(e.message || `HTTP ${res.status}`);
      err.status = res.status;
      // La API está apagada (el corte automático por presupuesto la desactiva) o la clave no la permite
      // (restringida a otra API, p. ej. «Places API» en vez de «Places API (New)», o a sitios web, que bloquea
      // las llamadas desde el servidor): no es un fallo pasajero, es «Google Maps no está disponible», y el
      // motivo exacto queda en el registro. Con 503 en vez de 403, la búsqueda sigue con tiempos estimados si
      // lo apagado es la matriz.
      const reasons = (Array.isArray(e.details) ? e.details : []).map((d) => d?.reason);
      if (res.status === 403 && reasons.some((r) => BLOCKED.includes(r))) {
        Object.assign(err, { status: 503, code: 'quota', reason: 'off' });
      }
      throw err;
    }
    return data;
  };

  // computeRoutes recibe el punto tal cual; la matriz lo envuelve en { waypoint }.
  const point = (p) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const wp = (p) => ({ waypoint: point(p) });

  return {
    // Qué SKU gasta cada llamada, para el guardián del tramo gratuito (lib/quota.js).
    sku: {
      autocomplete: 'autocomplete',
      session: 'autocompleteSessions',
      place: 'placeEssentials',
      details: 'detailsEnterpriseAtmosphere',
      photo: 'photos',
      photos: 'photos',
      nearby: enterprise ? 'nearbyEnterprise' : 'nearbyPro',
      route: (mode) => (mode === 'DRIVE' ? 'routesPro' : 'routesEssentials'),
      matrix: () => 'matrixEssentials',
    },

    async autocomplete(input, sessionToken, bias) {
      const body = { input, languageCode: 'es', includedRegionCodes: ['es'] };
      if (sessionToken) body.sessionToken = sessionToken;
      if (bias) body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 30000 } };
      const d = await call('https://places.googleapis.com/v1/places:autocomplete', { body });
      return (d.suggestions || [])
        .filter((s) => s.placePrediction)
        .slice(0, 5)
        .map((s) => ({
          id: s.placePrediction.placeId,
          main: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text,
          secondary: s.placePrediction.structuredFormat?.secondaryText?.text || '',
        }));
    },

    // Solo campos Essentials: con un campo Pro (displayName), Google cobra la sesión entera como
    // Enterprise + Atmosphere (5 veces más). El nombre ya llega en la sugerencia del autocompletado.
    async place(id, sessionToken) {
      const qs = new URLSearchParams({ languageCode: 'es' });
      if (sessionToken) qs.set('sessionToken', sessionToken);
      const d = await call(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?${qs}`, {
        method: 'GET', fieldMask: 'location,formattedAddress',
      });
      return { lat: d.location.latitude, lng: d.location.longitude, address: d.formattedAddress };
    },

    // Ficha de un sitio: solo se pide cuando alguien la abre.
    async details(id) {
      return call(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=es`, {
        method: 'GET',
        fieldMask: [
          'id', 'displayName', 'primaryTypeDisplayName', 'shortFormattedAddress', 'formattedAddress', 'googleMapsUri',
          'rating', 'userRatingCount', 'priceLevel', 'priceRange', 'currentOpeningHours.openNow',
          'regularOpeningHours.weekdayDescriptions', 'editorialSummary', 'websiteUri', 'photos',
          'outdoorSeating', 'servesBeer', 'servesWine', 'servesCocktails', 'servesCoffee', 'servesDessert',
          'servesVegetarianFood', 'reservable', 'goodForGroups', 'liveMusic',
        ].join(','),
      });
    },

    // URL temporal de una foto (googleusercontent): así la clave nunca llega al navegador.
    async photo(name, maxPx = 800) {
      const d = await call(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxPx}&maxHeightPx=${maxPx}&skipHttpRedirect=true`, { method: 'GET' });
      return d.photoUri;
    },

    async nearby(center, radius, types) {
      const d = await call('https://places.googleapis.com/v1/places:searchNearby', {
        fieldMask: (enterprise ? NEARBY_ENTERPRISE : NEARBY_PRO).join(','),
        body: {
          includedTypes: types,
          maxResultCount: 20,
          rankPreference: 'POPULARITY',
          languageCode: 'es',
          locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } },
        },
      });
      return (d.places || []).filter((p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL');
    },

    // Ruta real de una persona al sitio, para dibujarla en el mapa. Solo pide la geometría y la duración,
    // así que se cobra como Compute Routes Essentials (o Pro si es en coche con tráfico). En alta calidad,
    // para que el trazado siga las calles y las vías como en Google Maps (cuesta lo mismo).
    async route(origin, dest, mode, departureTime) {
      const body = { origin: point(origin), destination: point(dest), travelMode: mode, languageCode: 'es', polylineQuality: 'HIGH_QUALITY' };
      if (mode === 'DRIVE') { body.routingPreference = 'TRAFFIC_AWARE'; body.departureTime = departureTime; }
      if (mode === 'TRANSIT') body.departureTime = departureTime;
      const d = await call('https://routes.googleapis.com/directions/v2:computeRoutes', {
        body, fieldMask: 'routes.duration,routes.polyline.encodedPolyline',
      });
      const r = d.routes?.[0];
      return r ? { polyline: r.polyline?.encodedPolyline || '', min: Math.round(parseInt(r.duration, 10) / 60) } : null;
    },

    // Devuelve matriz [origen][destino] en minutos (null si no hay ruta).
    // En coche, sin tráfico: con TRAFFIC_AWARE la matriz se cobra como Pro (el doble por elemento) y para
    // comparar candidatos basta. El tráfico real sale en la ruta que se dibuja (route).
    async matrix(origins, destinations, mode, departureTime) {
      const body = {
        origins: origins.map(wp),
        destinations: destinations.map(wp),
        travelMode: mode,
        languageCode: 'es',
      };
      if (mode === 'TRANSIT') body.departureTime = departureTime;
      const d = await call('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        body, fieldMask: 'originIndex,destinationIndex,duration,condition,status',
      });
      const out = origins.map(() => destinations.map(() => null));
      for (const el of Array.isArray(d) ? d : []) {
        const o = el.originIndex ?? 0, t = el.destinationIndex ?? 0;
        if (el.condition === 'ROUTE_EXISTS' && el.duration) out[o][t] = Math.round(parseInt(el.duration, 10) / 60);
      }
      return out;
    },
  };
}
