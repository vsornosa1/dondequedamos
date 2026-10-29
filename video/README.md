# Vídeo de lanzamiento

La demo de LinkedIn de ¿Dónde quedamos?: 4:5, 60 s, con música original sintetizada. Se diseña a 1080x1350 y se exporta a 1728x2160. Se hizo con Remotion y la skill motion-video.

- `design/BRIEF.md`: el brief.
- `design/SCRIPT.md`: el guion por beats.
- `design/LINKEDIN.md`: el texto del post.
- `out/dondequedamos-demo.mp4`: el vídeo final.
- `music/house.mp3` y `music/rumba.mp3`: las dos músicas, por si se quiere cambiar.
- `out/poster.png`: la portada.

## Volver a generarlo

Los mapas, el worker y la música son archivos generados y no se suben a git.

```sh
npm install
cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/
npx remotion still src/index.ts MapNight public/map-night.png --gl=angle   # necesita red (OpenFreeMap)
npx remotion still src/index.ts MapDay public/map-day.png --gl=angle
sh music/master.sh      # exporta los cortes, sintetiza la música (house) y la masteriza a -14 LUFS
sh scripts/render.sh    # fotogramas PNG, vídeo sin sonido (out/video.mp4) y out/dondequedamos-demo.mp4
```

Los fotogramas se exportan en PNG y no en el JPEG al 80 % que usa Remotion por defecto: el JPEG dejaba los avatares pixelados. Y se renderizan a 1,6x: el vídeo guarda el color a la mitad de resolución, y a 1080 de ancho el borde rojo de Vicent salía escalonado.

## Las dos músicas

- `music/score.py`: house mediterráneo, la del vídeo. Su MP3 está en `music/house.mp3`.
- `music/score_rumba.py`: la primera, una rumba con guitarra. Su MP3 está en `music/rumba.mp3`.

Para montar el vídeo con la rumba sin volver a renderizar:

```sh
sh music/master.sh score_rumba.py public/music-rumba.wav
sh scripts/render.sh mux public/music-rumba.wav out/dondequedamos-demo-rumba.mp4
```

## Cambiar algo

- **Tiempos:** todos están en `src/timing.ts`. Después de cambiarlos, vuelve a ejecutar `sh music/master.sh` para que los golpes de la música sigan cuadrando.
- **Datos de la historia:** están en `src/data/scenario.json`. Salen de la búsqueda de la app sobre el Google simulado de `lib/mockGoogle.js`, así que son ilustrativos.
- **Rutas:** las calles salen de OSRM y están en `src/data/routes.json`. Se regeneran con `node scripts/fetch-routes.mjs`.
