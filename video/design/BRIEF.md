# ¿Dónde quedamos? · demo para LinkedIn

**Qué es:** la demo de lanzamiento de ¿Dónde quedamos?, una web gratis que busca el sitio donde todos tardáis lo mismo en llegar, cada uno con su transporte. Se cuenta con un caso de València.

**Para quién:** la red de Vicent en LinkedIn (València, gente de producto y desarrollo, amigos). La mayoría lo ve en el móvil y sin sonido al principio, así que el texto en pantalla cuenta la historia y la música acompaña.

**Lo que hay que recordar:** el punto medio del mapa engaña. Con ¿Dónde quedamos? nadie se come el viaje.

## Formato

- 4:5 vertical, 30 fps: el mismo formato que el vídeo de Aparcat (10k visualizaciones), y el que más ocupa en el feed del móvil. Se diseña a 1080x1350 y se exporta a 1728x2160, para que los bordes de colores saturados no salgan escalonados.
- Unos 59 s. Solo música, sin voz.
- Música original y animada: house mediterráneo a 120 BPM (`music/score.py`); un compás son 60 fotogramas. La primera versión, una rumba, sigue en `music/score_rumba.py` como alternativa.
- Ritmo de lectura: cada texto se queda al menos `palabras / 3 + 1` s.

## Personajes

Vicent, Jenny, Ángel y Yania son cuatro "blobs" con ojos, inspirados en la referencia que mandó Vicent. Cada uno lleva el color de su línea en la app: rojo, azul, verde y morado.

| Persona | Sale de | Va en |
|---|---|---|
| Vicent | Benimaclet | bus/metro |
| Jenny | Russafa | bici |
| Ángel | Patraix | coche |
| Yania | El Cabanyal | andando |

## Datos

Los tiempos y los sitios salen de la búsqueda real de la app (`lib/search.js`) para el plan «Cenar», pasada por el Google simulado del repo (`lib/mockGoogle.js`). El simulador devuelve los mismos doce sitios para cualquier plan, así que para la cena se quedan solo los de tipo restaurante, taberna o bar de tapas. No hay datos inventados a mano, pero son ilustrativos: La Clotxa y los demás sitios son nombres de la simulación.

- **Punto medio del mapa:** Vicent 18 min, Jenny 10, Ángel 16 y Yania 54. Diferencia: 44 min.
- **Sitio más justo, La Clotxa (restaurante):** Vicent 17 min, Jenny 20, Ángel 21 y Yania 18. Nadie tarda más de 21 min y la diferencia baja a 4 min.

Las rutas del mapa son calles reales, sacadas de OSRM (OpenStreetMap). Donde dos rutas comparten calle, cada una va por su carril, como las líneas de metro de un plano. Los mapas de fondo son de OpenFreeMap, el mismo proveedor que usa la app.

## Look

Es la identidad de la app: señalética de punto de encuentro.

- **Colores:** papel `#F0F0EA`, tinta `#0E1A2B` y amarillo `#FFD100`. El amarillo solo marca el punto de encuentro.
- **Fondos:** fondo de noche (tinta) para el problema y el cierre; la luz (papel) llega con el producto.
- **Tipografía:** Overpass 900 para los titulares y Overpass Mono para la URL.
- **Transiciones:** las líneas de colores que convergen en el punto amarillo, y los blobs, llevan las transiciones.

## Cierre (CTA, como el de Aparcat)

Logo, `dondequedamos.app`, QR, "Gratis · sin registro", "Fet a la terreta" y los créditos de los datos.
