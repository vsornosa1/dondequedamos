# ¿Dónde quedamos?

**[dondequedamos.app](https://dondequedamos.app)** · El sitio más justo para quedar.

El punto medio del mapa engaña. ¿Dónde quedamos? busca el sitio donde **todos tardáis lo mismo en llegar**, cada uno con su transporte: andando, en bus o metro, en bici o en coche. Gratis, sin registro y sin descargas.

<img src="video/out/poster.png" alt="¿Dónde quedamos?" width="320">

## Qué hace

1. Cada persona dice desde dónde sale (una dirección o su ubicación) y qué puede usar.
2. Elegís el plan (cañas, café, cenar, parque o biblioteca) y cuándo.
3. La app busca sitios reales y los ordena por **«más justo»**: que quien más tarda, tarde lo menos posible, sin alargar el viaje al resto por nada. También se pueden ordenar por **«menos tiempo»**.
4. Lo mandáis al grupo con un enlace que enseña el sitio, lo que tarda cada uno y su ruta.

Funciona en toda España.

## Cómo busca: rápido y preguntando lo mínimo a Google

1. **Estima en local, sin APIs.** Distancia en línea recta por un factor de rodeo, a una velocidad media por transporte. Con eso busca el punto más justo en una rejilla que se va estrechando. Son milisegundos.
2. **Comprueba esa zona con tiempos reales.** El punto estimado, un anillo de 6 puntos alrededor y el centro geográfico, en una sola matriz de rutas de Google por transporte. Andando solo pregunta por lo que está a menos de 25 minutos estimados.
3. **Busca los sitios reales en la zona ganadora** y corrige la estimación de cada persona con lo que se desvió en el paso 2. Solo los 8 sitios más prometedores van a Google.

Son unos 50 cálculos de ruta por búsqueda, y las búsquedas repetidas salen de caché. El código está en `lib/core.js` y `lib/search.js`.

## A 0 €

Cada llamada a Google se cuenta **antes** de hacerse, y la que no cabe en el tramo gratuito no se hace. En ese caso la app sigue con lo que tenga: tiempos estimados, sitios sin foto o un aviso de que por hoy se han acabado las búsquedas. Además hay cuotas diarias en Google y un corte automático si algún día se cobra 1 €. Todo está en [GRATIS.md](GRATIS.md), con un servidor de rutas gratis (OSRM y OpenTripPlanner) para depender menos de Google.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router), React 19 y TypeScript.
- [MapLibre GL](https://maplibre.org) con los mapas de [OpenFreeMap](https://openfreemap.org) (OpenStreetMap). [GSAP](https://gsap.com) para las animaciones.
- Google Maps Platform: Places API (New) para direcciones y sitios, Routes API para los tiempos y las rutas.
- [Upstash Redis](https://upstash.com): enlaces cortos, caché, límites por IP y el contador del tramo gratis.
- [Vercel](https://vercel.com), con Web Analytics sin cookies.
- [Remotion](https://www.remotion.dev) para los vídeos de `video/`.

## Ponerlo en marcha

```bash
npm install
npm run dev:mock   # con un Google simulado: no hace falta clave y no se gasta nada
npm test
npm run build
```

Con Google de verdad, crea `.env.local` con `GOOGLE_MAPS_API_KEY` y arranca con `npm run dev`. La clave necesita Places API (New) y Routes API, y no puede llevar restricción por sitios web, porque las llamadas salen del servidor. En producción hacen falta también `KV_REST_API_URL` y `KV_REST_API_TOKEN` (Upstash): sin ellas la app no llama a Google, porque no puede contar el tramo gratuito. El resto de variables están en [GRATIS.md](GRATIS.md#variables-de-entorno).

## Estructura

| Carpeta | Qué hay |
|---|---|
| `app/` | Las páginas y la API (`/api/search`, `/api/autocomplete`, `/api/route`…) |
| `components/` | La interfaz |
| `lib/` | La búsqueda (`core.js`, `search.js`), el cliente de Google (`google.js`), el guardián del tramo gratis (`quota.js`), las rutas propias (`freeRouting.js`) y los enlaces (`share.js`) |
| `test/` | Las pruebas (`node --test`) |
| `infra/free-routing/` | El servidor de rutas gratis (OSRM, OpenTripPlanner y Caddy) |
| `video/` | Los vídeos de lanzamiento, hechos con Remotion |

## Privacidad

- No se guarda ninguna dirección: se usan para calcular y se olvidan.
- El enlace que se comparte lleva el sitio, los nombres y los minutos de cada uno. Las rutas van sin sus primeros 300 m, así que no se ve desde dónde sale nadie.
- Las visitas se cuentan con Vercel Web Analytics, sin cookies. Antes de enviar nada, las URLs de las propuestas se anonimizan.

## Licencia

[PolyForm Noncommercial 1.0.0](LICENSE.md). Puedes usar, estudiar, modificar y compartir el código para **fines no comerciales**: uso personal, estudio, investigación, proyectos personales, organizaciones sin ánimo de lucro o centros educativos. **El uso comercial no está permitido.** Si te interesa, escríbeme por [GitHub](https://github.com/vsornosa1).

No es una licencia «open source» según la definición de la OSI: el código está a la vista para aprender de él, no para venderlo.

Hay piezas con su propia licencia, que mandan sobre esta:

- Las fuentes Overpass (`assets/fonts`, `video/public/fonts`): SIL Open Font License 1.1.
- Las rutas de `video/src/data/routes.json`: datos de © colaboradores de OpenStreetMap, con licencia ODbL.
- El estilo de mapa de `video/src/data/positron.json`: OpenFreeMap y OpenMapTiles, con su licencia.
- Los sitios, las fotos y los tiempos que enseña la app salen de Google Maps, con sus condiciones de uso.

## Apoyo

Cada búsqueda cuesta dinero en Google Maps. Si la app te sirve, puedes [apoyar el proyecto](https://github.com/sponsors/vsornosa1).

Fet a la terreta ♥
