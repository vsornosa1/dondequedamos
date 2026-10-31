#!/usr/bin/env bash
# Descarga el mapa (OpenStreetMap) y los horarios (GTFS) y los prepara para OSRM y OpenTripPlanner.
# Se ejecuta en la máquina del servidor, con Docker, antes del primer `docker compose up -d` y cada vez que
# quieras datos nuevos (los horarios cambian: una vez al mes está bien). Guía: GRATIS.md
#
#   REGION=valencia ./prepare.sh      (una comunidad de Geofabrik: valencia, madrid, cataluna, andalucia…)
#
# Los horarios: pon en otp/ los GTFS que quieras, con «gtfs» en el nombre (p. ej. otp/emt.gtfs.zip), o deja
# que este script baje los de GTFS_URLS. OpenTripPlanner lee todos los que encuentre.
set -euo pipefail
cd "$(dirname "$0")"

REGION="${REGION:-valencia}"
OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:v26.10.0-debian
OTP_IMAGE=docker.io/opentripplanner/opentripplanner:2.10.0
# Memoria para construir el grafo de OpenTripPlanner (una comunidad cabe de sobra en 10 GB).
OTP_BUILD_MEMORY="${OTP_BUILD_MEMORY:-10g}"

# Horarios de la Comunitat Valenciana. URLs de la lista de feeds de Transitous (github.com/public-transport/transitous,
# feeds/es.json), todas con licencia CC BY 4.0. Cambian de vez en cuando: si alguna falla, búscala en
# nap.transportes.gob.es o mobilitydatabase.org y cámbiala aquí (o pon el .zip a mano en otp/).
GTFS_URLS=(
  "emt-valencia.gtfs.zip https://files.mobilitydatabase.org/mdb-795/latest.zip"
  "metrovalencia.gtfs.zip https://files.mobilitydatabase.org/mdb-2830/latest.zip"
  "cercanias-renfe.gtfs.zip https://nap.transportes.gob.es/api/Fichero/download/1130"
  "interurbano-cv.gtfs.zip https://nap.transportes.gob.es/api/Fichero/download/1526"
)

mkdir -p data otp

echo "== Mapa de ${REGION} (Geofabrik)"
curl -fL --retry 3 -o data/region.osm.pbf "https://download.geofabrik.de/europe/spain/${REGION}-latest.osm.pbf"

# Un juego de datos por perfil: cada osrm-routed sirve uno.
for pair in foot:foot bike:bicycle car:car; do
  dir="${pair%%:*}"; profile="${pair##*:}"
  echo "== OSRM: ${dir}"
  mkdir -p "data/${dir}"
  cp data/region.osm.pbf "data/${dir}/region.osm.pbf"
  docker run --rm -v "${PWD}/data/${dir}:/data" "${OSRM_IMAGE}" osrm-extract -p "/opt/${profile}.lua" /data/region.osm.pbf
  docker run --rm -v "${PWD}/data/${dir}:/data" "${OSRM_IMAGE}" osrm-partition /data/region.osrm
  docker run --rm -v "${PWD}/data/${dir}:/data" "${OSRM_IMAGE}" osrm-customize /data/region.osrm
  rm -f "data/${dir}/region.osm.pbf"
done

echo "== Horarios (GTFS)"
if [ "${SKIP_GTFS_DOWNLOAD:-}" != "1" ]; then
  for entry in "${GTFS_URLS[@]}"; do
    name="${entry%% *}"; url="${entry#* }"
    if curl -fL --retry 3 -o "otp/${name}.tmp" "${url}"; then mv "otp/${name}.tmp" "otp/${name}"; else
      rm -f "otp/${name}.tmp"; echo "   ⚠ No se ha podido bajar ${name} (${url}). Sigue sin él o ponlo a mano en otp/."
    fi
  done
fi
ls otp/*gtfs*.zip >/dev/null 2>&1 || { echo "Falta al menos un GTFS en otp/ (con «gtfs» en el nombre)."; exit 1; }

echo "== OpenTripPlanner: grafo de calles y horarios"
cp data/region.osm.pbf otp/region.osm.pbf
docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx${OTP_BUILD_MEMORY}" -v "${PWD}/otp:/var/opentripplanner" "${OTP_IMAGE}" --build --save

echo "Listo. Ahora: cp env.example .env (si no lo has hecho), rellénalo y docker compose up -d"
echo "Si ya estaba en marcha: docker compose restart"
