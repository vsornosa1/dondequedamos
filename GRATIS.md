# dondequedamos a 0 €

La app solo usa la parte gratuita de Google Maps Platform y, si lo configuras, el crédito de tu cuenta de Google (más abajo). Cada llamada a Google se cuenta **antes** de hacerse, y la que no cabe no se hace. En su lugar la app sigue con lo que tenga: tiempos estimados, sin foto, sin ruta dibujada… Si todo lo de Google se agota, avisa de que por hoy no quedan búsquedas.

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

## Usar el crédito de Google (opcional)

Tu cuenta tiene crédito de la prueba gratuita: lo ves en Facturación → Créditos. Con estas dos variables, cuando se acaba lo gratis del día, el guardián paga con el crédito en vez de pasar a tiempos estimados o quitar fotos:

```bash
GOOGLE_CREDIT_EUR=244,94        # lo que queda, tal cual sale en Facturación → Créditos
GOOGLE_CREDIT_UNTIL=2027-01-27  # su fecha de fin
```

- **Gasta como mucho el 80 %** (`GOOGLE_CREDIT_SAFETY`), repartido por días hasta 2 días antes de que caduque. Con 244,94 € hasta el 27 de enero sale a unos 2,30 € al día. Lo que no se gasta un día pasa al siguiente.
- **Cuenta de más, nunca de menos.** Usa los precios de lista en dólares como si fueran euros, un 10-15 % por encima de lo que cobra Google en euros. Lo que paga el crédito no se descuenta del tramo gratis, y el tramo gratis se queda en el 80 % del de Google. Así, lo que Google cobra de verdad siempre es menos de lo que apunta el guardián.
- **Desde 2 días antes de que caduque** (el 26 de enero), vuelve solo al tramo gratis, sin tocar nada.
- **2,30 € al día dan para** unas 10 búsquedas más con tiempos reales, unas 70 búsquedas de sitios más o unas 300 fotos más, según lo que se acabe antes ese día.
- Para gastarlo más deprisa, por ejemplo todo en noviembre para aprovechar el relanzamiento, pon una fecha anterior en `GOOGLE_CREDIT_UNTIL`.
- Si cambias el importe o la fecha, la cuenta del crédito empieza de cero. Para ponerla al día, copia a la vez el importe que diga la facturación.

**Tu cuenta ya es de pago.** El crédito se convirtió al activarla (en Créditos aparece como «FreeTrialUpgrade»). Cuando se acabe o caduque, Google cobrará en la tarjeta lo que pase del tramo gratis. El guardián evita que pase; la alerta de presupuesto te avisa si pasa.

## Antes de despausar en Vercel

1. **Upstash Redis en producción.** Comprueba que `KV_REST_API_URL` y `KV_REST_API_TOKEN` están en las variables de Vercel (son las de los enlaces cortos). Sin ellas, la app no llamará a Google.
2. **Lleva los cambios a `main`.** El `vercel.json` solo impide desplegar las ramas `claude/*`: `main` sigue desplegando como siempre.
   - Si vas a usar el crédito, añade también `GOOGLE_CREDIT_EUR` y `GOOGLE_CREDIT_UNTIL` (sección anterior).
3. **Si reactivas a mitad de mes**, el contador empieza en cero, pero Google ya habrá contado lo de ese mes. Baja el margen hasta el mes siguiente: `FREE_TIER_SAFETY=0.5`, o un tope concreto con `GOOGLE_FREE_CAPS='{"matrixEssentials":2000}'`.
4. **Segunda red en Google Cloud** (por si algo se escapa: otra app con la misma clave, un error…):
   - **Restringe la clave** a «Places API (New)» y «Routes API» en APIs y servicios → Credenciales.
     - **Restricción de aplicación: ninguna.** Las llamadas salen de los servidores de Vercel, sin Referer, y una restricción por sitios web las bloquea todas: la app se queda sin sugerencias de direcciones, sin búsquedas y sin rutas.
     - No hace falta esa restricción: la clave nunca llega al navegador (las fotos se sirven con una redirección sin ella).
   - **Alerta de presupuesto** de 1 € en Facturación → Presupuestos y alertas, sobre el coste con los créditos descontados: avisa si algo se llega a cobrar de verdad. Avisa, pero no corta.
   - **Cuotas** de Routes API y Places API (New) lo más bajas que permita la consola, en APIs y servicios → Cuotas.
   - **Corte automático** (montado en `artful-cipher-513021-g1`): ver la sección siguiente.
5. **Despausa el proyecto** en Vercel.

## El corte automático por presupuesto

Es la tercera red: el guardián evita gastar, la alerta avisa y el corte apaga. Montado en el proyecto `artful-cipher-513021-g1`:

- El presupuesto `Maps-stop-1EUR` (1 € al mes, con créditos y descuentos descontados) publica en el topic `maps-budget-stop`.
- La función `stop-maps-on-budget` (Cloud Run, `europe-west1`; código en `~/maps-budget-stop` de Cloud Shell) desactiva `places.googleapis.com` y `routes.googleapis.com` cuando el coste del mes llega a 1 €. No toca la facturación ni otros servicios.
- Como el presupuesto descuenta los créditos, **mientras dure el crédito no salta**: el coste neto es 0 €. Solo salta si se llega a cobrar dinero de verdad.

**Comprobar que el presupuesto real está conectado** (en Cloud Shell):

```bash
BA=$(gcloud billing projects describe artful-cipher-513021-g1 --format='value(billingAccountName)'); BA=${BA#billingAccounts/}
gcloud billing budgets list --billing-account="$BA" --format=json
```

En el presupuesto tiene que salir:

- `displayName: Maps-stop-1EUR`, **exactamente el nombre que comprueba la función**. Si no coinciden, la función descarta los avisos reales y el corte nunca salta, aunque la prueba manual funcione (el mensaje simulado lleva el nombre bueno). Pasó con un presupuesto llamado «Free tier gmaps».
- `amount` en EUR de 1 (`"units": "1"`).
- `budgetFilter.projects` con este proyecto. Sin ese filtro cuenta toda la cuenta de facturación, y el gasto de otro proyecto apagaría Maps.
- `creditTypesTreatment: INCLUDE_ALL_CREDITS`.
- `notificationsRule.pubsubTopic: projects/artful-cipher-513021-g1/topics/maps-budget-stop`.

Google manda el estado del presupuesto a ese topic varias veces al día aunque no haya gasto. La prueba definitiva es ver en los registros de la función (Cloud Run → `stop-maps-on-budget` → Registros) un mensaje real con `budgetDisplayName: Maps-stop-1EUR` y `costAmount: 0`. Si la función no escribe el mensaje que recibe, añade esa línea.

**Si salta:**

- La app sigue en pie y dice «Ahora mismo no podemos consultar Google Maps». En los registros de Vercel aparece «Google Maps apagado o bloqueado para esta clave».
- Si solo se apaga Routes, las búsquedas siguen con tiempos estimados.
- Antes de reactivar, mira en Facturación qué se ha cobrado y por qué.
- **Ojo:** si reactivas las APIs el mismo mes, la siguiente notificación (el coste del mes sigue en 1 € o más) las vuelve a apagar en unas horas. Para reactivar antes de fin de mes, sube antes el importe del presupuesto o desconecta el topic. Después:

  ```bash
  gcloud services enable places.googleapis.com routes.googleapis.com --project=artful-cipher-513021-g1
  ```

- Las notificaciones de facturación llevan horas de retraso: el corte no garantiza un máximo exacto de 1 €. Por eso el guardián es la primera red.

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

Y para ver qué pasa cuando el corte automático apaga las APIs:

```bash
MOCK_GOOGLE_OFF=places,routes npm run dev:mock    # o solo una de las dos
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
| `GOOGLE_CREDIT_EUR` | El crédito que queda (Facturación → Créditos), para gastarlo cuando se acaba lo gratis | — (sin crédito) |
| `GOOGLE_CREDIT_UNTIL` | La fecha de fin del crédito (AAAA-MM-DD); se deja de usar 2 días antes | — |
| `GOOGLE_CREDIT_SAFETY` | Qué parte del crédito se usa (0–1) | `0.8` |
| `OSRM_WALK_URL`, `OSRM_BIKE_URL`, `OSRM_CAR_URL` | Servidores OSRM propios | — (Google) |
| `OTP_URL` | Endpoint GraphQL de OpenTripPlanner (`…/otp/gtfs/v1`) | — (Google) |
| `ROUTING_TOKEN` | La contraseña del servidor de rutas (cabecera `X-Routing-Token`) | — |

Si un día llegan donaciones o patrocinios, `GOOGLE_FREE_CAPS` y `FREE_TIER_SAFETY` son las palancas para subir el cupo sabiendo cuánto cuesta. Los precios por SKU están en `PRICE_MILLI_EUR` (`lib/quota.js`).
