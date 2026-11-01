# ¿Dónde quedamos? ha vuelto · vídeo corto para LinkedIn

**Qué es:** el vídeo del relanzamiento. Cuenta en 20 segundos el tercer capítulo: se hizo viral, el cupo gratis de Google se acabó en horas, la pausé, y ha vuelto preparada para no costar dinero.

**Para quién:** quien vio los dos posts anteriores (23.000 impresiones) y su red: producto, desarrollo, València. Se ve en el móvil y sin sonido al principio: el texto cuenta la historia.

**Lo que hay que recordar:** ha vuelto, y ahora no puede costarme dinero.

## Formato

- 4:5, 30 fps, 20 s (600 fotogramas). Se diseña a 1080x1350 y se exporta a 1728x2160, como la demo.
- Solo música, sin voz: house mediterráneo a 120 BPM con los instrumentos de la demo (`music/score_vuelve.py`). Un compás son 60 fotogramas y cada corte cae en un compás.
- Mismo look que la demo: noche (tinta) para el problema, la luz (papel) llega cuando vuelve la app; el amarillo solo marca el punto de encuentro y el cartel.

## Guion

| Fotogramas | Beat | En pantalla | Visual |
|---|---|---|---|
| 0-120 | Viral | «Se hizo viral.» · «23.000 impresiones» · «11.000 rutas en un día» | Noche. Los cuatro blobs saltan al ritmo. Los contadores suben; las rutas llenan una barra «Gratis al mes: 10.000» que se desborda en rojo. |
| 120-240 | Pausa | «Se acabó el cupo gratis de Google.» · cartel «EN PAUSA» | La música se para de golpe. Los blobs, cansados. La barra se queda roja y baja un cartel amarillo colgado, como los de una estación. |
| 240-300 | Giro | (el cartel) | Redoble y subida. |
| 300-480 | Vuelve | cartel «HA VUELTO» · «Y ya no puede costarme dinero:» · «Cupo diario gratis» · «Aviso, no factura» · «A 1 €, se apaga solo» | Las letras del cartel giran como un panel de estación y la luz (papel) sale del cartel. Tres tarjetas con icono, una por compás. Los blobs, contentos. |
| 480-600 | Cierre | «dondequedamos.app» · «Toda España · Gratis · Sin registro» | Vuelve la noche desde abajo; logo, dirección, QR y los blobs sobre el perfil de València. |

Lectura: cada texto se queda al menos `palabras / 3 + 1` s.

## Datos

Todos reales, de esta conversación y de la facturación de Google:

- 23.000 impresiones: 22.994 en las estadísticas del primer post de LinkedIn.
- 11.000 rutas en un día: 9.871 + 1.255 elementos de Route Matrix (Essentials y Pro) en un solo día, según Google Cloud.
- 10.000 gratis al mes: el tramo gratuito de Route Matrix Essentials.
- Cupo diario gratis, aviso en vez de factura y corte automático a 1 €: lo que hace ahora la app (`lib/quota.js`, el presupuesto `Maps-stop-1EUR` y su función de corte).
