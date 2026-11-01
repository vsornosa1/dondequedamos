# dondequedamos a 0 €

La app solo usa la parte gratuita de Google Maps Platform. Cada llamada a Google se cuenta **antes** de hacerse, y la que no cabe en el tramo gratis del mes no se hace. En su lugar la app sigue con lo que tenga: tiempos estimados, sin foto, sin ruta dibujada… Si todo lo de Google se agota, avisa de que por hoy no quedan búsquedas.

Lo hace `lib/quota.js`. Este documento explica qué garantiza, qué revisar antes de reactivar la app en Vercel y cómo montar un servidor de rutas gratuito para que quepa mucha más gente.

## Qué garantiza

- **Un tope por SKU.** Google regala usos al mes por SKU: Essentials 10.000, Pro 5.000 y Enterprise 1.000. La app se queda en el **80 %** de cada uno (`FREE_TIER_SAFETY`), por si Google cuenta algo que aquí no.
- **Reparto por días.** Cada día se puede gastar lo que queda del mes entre los días que faltan. Así un pico como el de LinkedIn no se come el mes entero, y lo que no se usa un día pasa al siguiente. El día y el mes son los de Google, en hora del Pacífico: el cupo diario se renueva a las 9:00 en España (a las 8:00 algunas semanas de primavera y otoño, cuando el cambio de hora no coincide).
- **Cuenta compartida.** Se cuenta en Upstash Redis con `INCRBY` atómico, compartido por todas las instancias de Vercel. **En producción sin Redis no se llama a Google**: sin una cuenta común no hay garantía de no pasarse.
- **Si Redis falla, no se llama.** Lo mismo que sin Redis.

| Lo que hace la app | SKU | Gratis al mes | Tope (80 %) | ≈ al día |
|---|---|---|---|---|
| Buscar sitios (Nearby, nivel Pro por defecto) | Nearby Search Pro | 5.000 | 4.000 | 130 |
| … o en nivel Enterprise (`PLACES_NEARBY_TIER=enterprise`) | Nearby Search Enterprise | 1.000 | 800 | 26 |
| Tiempos de cada uno a cada sitio | Route Matrix Essentials (por elemento) | 10.000 | 8.000 | 265 elementos |
| Ruta dibujada (andar, bici, transporte) | Compute Routes Essentials | 10.000 | 8.000 | 265 |
| Ruta dibujada en coche (con tráfico) | Compute Routes Pro | 5.000 | 4.000 | 130 |
| Sugerencias al escribir una dirección | Autocomplete Requests | 10.000 | 8.000 | 265 |
| Elegir una sugerencia | Place Details Essentials (+ sesión) | 10.000 | 8.000 | 265 |
| Ficha del sitio | Place Details Enterprise + Atmosphere | 1.000 | 800 | 26 |
| Fotos | Place Details Photos | 1.000 | 800 | 26 |

### Qué pasa cuando se acaba cada uno

| Se acaba | Lo que ve la gente |
|---|---|
| Buscar sitios | «Por hoy se han acabado las búsquedas gratis. Vuelven a las 9:00», con un enlace para apoyar el proyecto. La búsqueda no empieza, así que tampoco gasta matriz. |
| Matriz de tiempos | La búsqueda sigue con tiempos estimados (≈) y una nota que lo explica. |
| Rutas dibujadas | El mapa no dibuja la línea (como antes cuando faltaba una ruta). |
| Sugerencias de dirección | «Por hoy se ha acabado el buscador de direcciones gratis», con «Usar mi ubicación» y las direcciones recientes. |
| Ficha | «Por hoy se han acabado las fichas gratis», y el botón a Google Maps. |
| Fotos | Los sitios salen sin foto (nunca con una imagen rota). |

### Cuántas búsquedas caben

Una búsqueda de 3 personas gasta 1 o 2 Nearby y unos 45 elementos de matriz.

- **Solo con Google:** unas 6 búsquedas al día con tiempos reales de Google. Las siguientes, hasta unas 120 al día, salen con tiempos estimados.
- **Con el servidor de rutas gratis** (más abajo): unas 120 búsquedas al día, todas con tiempos reales. El límite pasa a ser Nearby Search.

Con `PLACES_NEARBY_TIER=enterprise` vuelven la valoración, el precio y «abierto ahora» en la lista, pero el techo baja a unas 25 búsquedas al día. En nivel Pro, la ficha de cada sitio sigue mostrando la valoración y el horario.

## Antes de despausar en Vercel

1. **Upstash Redis en producción.** Comprueba que `KV_REST_API_URL` y `KV_REST_API_TOKEN` están en las variables de Vercel (son las de los enlaces cortos). Sin ellas, la app no llamará a Google.
2. **Lleva esta rama a `main`.** El `vercel.json` solo impide desplegar las ramas `claude/*`: `main` sigue desplegando como siempre.
3. **Si reactivas a mitad de mes**, el contador empieza en cero, pero Google ya habrá contado lo de ese mes. Baja el margen hasta el mes siguiente: `FREE_TIER_SAFETY=0.5`, o un tope concreto con `GOOGLE_FREE_CAPS='{"matrixEssentials":2000}'`.
4. **Segunda red en Google Cloud** (por si algo se escapa: otra app con la misma clave, un error…):
   - **Restringe la clave** a «Places API (New)» y «Routes API» en APIs y servicios → Credenciales.
   - **Alerta de presupuesto** de 1 € en Facturación → Presupuestos y alertas. Avisa, pero no corta.
   - **Cuotas** de Routes API y Places API (New) lo más bajas que permita la consola, en APIs y servicios → Cuotas.
   - Si quieres un corte duro, Google documenta cómo desactivar la facturación desde una alerta de presupuesto (presupuesto → Pub/Sub → Cloud Function). Corta todo el proyecto de Google Cloud, no solo los mapas.
5. **Despausa el proyecto** en Vercel.

## Probar en local sin gastar

```bash
npm run dev:mock    # Google simulado, aunque el .env tenga la clave de verdad
npm test            # incluye las pruebas del guardián (test/quota.test.js)
```

Para ver cómo se comporta la app cuando se acaba algo, pon ese tope a cero:

```bash
GOOGLE_FREE_CAPS='{"nearbyPro":0}' npm run dev:mock          # sin búsquedas
GOOGLE_FREE_CAPS='{"matrixEssentials":0,"photos":0}' npm run dev:mock   # tiempos estimados, sin fotos
GOOGLE_FREE_CAPS='{"autocomplete":0}' npm run dev:mock       # sin buscador de direcciones
```

En modo simulado se cuenta en memoria, nunca en el Redis de producción.

## Servidor de rutas gratis (opcional, pero multiplica la capacidad)

Con él, los tiempos y las rutas de andar, bici, coche y transporte público salen de tus propios servidores, con datos de OpenStreetMap y los horarios oficiales (GTFS):

- **OSRM** para andar, bici y coche.
- **OpenTripPlanner** para el transporte público.

Google queda solo para buscar sitios, fichas, fotos y direcciones. Si tu servidor se cae, la app vuelve a Google dentro del cupo gratis.

Todo está en `infra/free-routing/`: Docker Compose con OSRM (3 perfiles), OpenTripPlanner 2.10 y Caddy, que pone HTTPS automático y una contraseña para que solo lo use tu app. Las imágenes funcionan en ARM y en x86.

### Dónde, gratis: Oracle Cloud Always Free

1. Crea una cuenta en Oracle Cloud. Pide tarjeta para verificar, pero los recursos «Always Free» no se cobran.
2. Crea una instancia **VM.Standard.A1.Flex** con 4 OCPU y 24 GB, Ubuntu, marcada como «Always Free-eligible». **Solo crea recursos con esa etiqueta**: lo demás sí se cobra.
3. Abre los puertos 80 y 443 en la *Security List* de la red y en el cortafuegos de la máquina (las imágenes de Ubuntu de Oracle traen reglas de `iptables` que los cierran).
4. Instala Docker, clona el repo y:

   ```bash
   cd infra/free-routing
   ./prepare.sh                    # REGION=valencia por defecto (Comunitat Valenciana)
   cp env.example .env             # DOMAIN (vale <ip-con-guiones>.sslip.io) y ROUTING_TOKEN
   docker compose up -d
   ```

5. Compruébalo desde tu ordenador (no gasta Google):

   ```bash
   OSRM_WALK_URL=https://TU-DOMINIO/osrm/foot OSRM_BIKE_URL=https://TU-DOMINIO/osrm/bike \
   OSRM_CAR_URL=https://TU-DOMINIO/osrm/car OTP_URL=https://TU-DOMINIO/otp/gtfs/v1 \
   ROUTING_TOKEN=tu-contraseña node dev/free-routing-smoke.mjs
   ```

6. Pon esas mismas cinco variables en Vercel y vuelve a desplegar.

Oracle puede recuperar instancias gratuitas que pasan días casi sin usar CPU. Si te pasa, vuelve a crearla y repite `prepare.sh`: los datos se regeneran solos.

### Los horarios

`prepare.sh` baja los GTFS de la Comunitat Valenciana: EMT Valencia, Metrovalencia, Cercanías Renfe y los autobuses interurbanos. Las URLs vienen de la lista de feeds de [Transitous](https://github.com/public-transport/transitous/blob/main/feeds/es.json) y tienen licencia CC BY 4.0. Las URLs cambian a veces: si alguna falla, el script avisa y sigue. Puedes poner cualquier GTFS a mano en `infra/free-routing/otp/` (con «gtfs» en el nombre). Repite `prepare.sh` una vez al mes para tener horarios al día.

### Lo que no está probado

La lógica del cliente (`lib/freeRouting.js`) tiene pruebas con respuestas en el formato de las APIs de OSRM y OpenTripPlanner, y `dev/free-routing-smoke.mjs` se ha probado contra un servidor simulado. **`prepare.sh`, el Compose y el Caddyfile no se han ejecutado nunca**: haz el paso 5 antes de poner las variables en Vercel. Si algo no cuadra, la app no se rompe: vuelve a Google dentro del cupo gratis.

## Variables de entorno

| Variable | Para qué | Por defecto |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | La clave de Google Maps | — |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis: el contador del tramo gratis (y los enlaces cortos, la caché y el límite por IP) | — (sin ellas, en producción no se llama a Google) |
| `PLACES_NEARBY_TIER` | `pro` (5.000 gratis, sin valoración en la lista) o `enterprise` (1.000 gratis, con valoración) | `pro` |
| `FREE_TIER_SAFETY` | Qué parte del tramo gratis se usa (0–1) | `0.8` |
| `GOOGLE_FREE_CAPS` | Topes mensuales por SKU, en JSON. Por ejemplo `{"nearbyPro":2000}` | Los de Google |
| `FREE_TIER_GUARD` | `off` quita el guardián. **Entonces Google cobra lo que pase del tramo gratis.** | activado |
| `OSRM_WALK_URL`, `OSRM_BIKE_URL`, `OSRM_CAR_URL` | Servidores OSRM propios | — (Google) |
| `OTP_URL` | Endpoint GraphQL de OpenTripPlanner (`…/otp/gtfs/v1`) | — (Google) |
| `ROUTING_TOKEN` | La contraseña del servidor de rutas (cabecera `X-Routing-Token`) | — |

Si un día llegan donaciones o patrocinios, `GOOGLE_FREE_CAPS` y `FREE_TIER_SAFETY` son las palancas para subir el cupo sabiendo cuánto cuesta.
