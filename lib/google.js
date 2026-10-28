// Cliente mínimo de Google Maps Platform (Routes API + Places API New).

export function makeGoogle(key, fetchFn = fetch) {
  const call = async (url, { method = 'POST', body, fieldMask } = {}) => {
    const headers = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key };
    if (fieldMask) headers['X-Goog-FieldMask'] = fieldMask;
    const res = await fetchFn(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const msg = data?.error?.message || data?.[0]?.error?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  };

  const wp = (p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });

  return {
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

    async place(id, sessionToken) {
      const qs = new URLSearchParams({ languageCode: 'es' });
      if (sessionToken) qs.set('sessionToken', sessionToken);
      const d = await call(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?${qs}`, {
        method: 'GET', fieldMask: 'location,formattedAddress,displayName',
      });
      return { lat: d.location.latitude, lng: d.location.longitude, label: d.displayName?.text, address: d.formattedAddress };
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
        fieldMask: [
          'places.id', 'places.displayName', 'places.location', 'places.rating', 'places.userRatingCount',
          'places.formattedAddress', 'places.shortFormattedAddress', 'places.googleMapsUri', 'places.priceLevel',
          'places.primaryTypeDisplayName', 'places.currentOpeningHours.openNow', 'places.businessStatus', 'places.photos',
        ].join(','),
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

    // Devuelve matriz [origen][destino] en minutos (null si no hay ruta).
    async matrix(origins, destinations, mode, departureTime) {
      const body = {
        origins: origins.map(wp),
        destinations: destinations.map(wp),
        travelMode: mode,
        languageCode: 'es',
      };
      if (mode === 'DRIVE') { body.routingPreference = 'TRAFFIC_AWARE'; body.departureTime = departureTime; }
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
