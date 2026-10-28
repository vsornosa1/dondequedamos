import type { NextRequest } from 'next/server';
import { fail, getGoogle, json, limited, noKey, tooMany } from '@/lib/api';

const FEATURES: [string, string][] = [
  ['outdoorSeating', 'Terraza'], ['servesBeer', 'Cerveza'], ['servesWine', 'Vino'], ['servesCocktails', 'Cócteles'],
  ['servesCoffee', 'Café'], ['servesDessert', 'Postres'], ['servesVegetarianFood', 'Opciones vegetarianas'],
  ['reservable', 'Se puede reservar'], ['goodForGroups', 'Bien para grupos'], ['liveMusic', 'Música en directo'],
];

type Money = { units?: string; currencyCode?: string };
const euros = (m?: Money) => (m?.units ? `${m.units} ${m.currencyCode === 'EUR' || !m.currencyCode ? '€' : m.currencyCode}` : '');

// Ficha de un sitio con fotos. Se cachea en la CDN: los datos de un bar cambian poco.
export async function GET(req: NextRequest) {
  if (limited(req, 've', 60, 600_000)) return tooMany('Demasiadas consultas, espera un poco.');
  const google = getGoogle();
  if (!google) return noKey();
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!/^[\w-]{2,300}$/.test(id)) return json({ error: 'Sitio no válido.' }, 400);
  try {
    const v = await google.details(id);
    const from = euros(v.priceRange?.startPrice), to = euros(v.priceRange?.endPrice);
    return json({
      id,
      name: v.displayName?.text || '',
      type: v.primaryTypeDisplayName?.text || '',
      address: v.shortFormattedAddress || v.formattedAddress || '',
      rating: v.rating ?? null,
      ratings: v.userRatingCount ?? 0,
      price: v.priceLevel || null,
      range: from && to ? `${from.replace(' €', '')}–${to}` : from || to || '',
      openNow: v.currentOpeningHours?.openNow ?? null,
      hours: v.regularOpeningHours?.weekdayDescriptions || [],
      summary: v.editorialSummary?.text || '',
      web: v.websiteUri || '',
      maps: v.googleMapsUri || '',
      features: FEATURES.filter(([k]) => v[k] === true).map(([, label]) => label),
      photos: (v.photos || []).slice(0, 4).map((p: { name: string; authorAttributions?: { displayName?: string }[] }) => ({
        name: p.name, by: p.authorAttributions?.[0]?.displayName || '',
      })),
    }, 200, { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' });
  } catch (e) {
    return fail(e);
  }
}
