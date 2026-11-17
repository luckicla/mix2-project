# Mix² · MixUp + Mix4Up

La web que junta las dos apps de luckicla en un solo sitio:

- **[MixUp](https://github.com/luckicla/zentor)**: reproductor de música para Windows y Android, con modo DJ, YouTube y Spotify, ecualizador y estética de fanzine.
- **[Mix4Up](https://github.com/luckicla/mix4up)**: tu YouTube sin Shorts y sin anuncios, y todos tus vídeos, para Windows y Android.

Web: **https://luckicla.github.io/mix2-project/**

## Qué tiene

- Las dos apps explicadas, con capturas, sus enlaces de descarga (instalador, portable y APK con QR) y enlaces a la web y al código de cada una.
- Un diseño que mezcla los dos: las letras de recorte, las rayas de peligro y las sombras duras de MixUp con las esquinas redondeadas, los degradados y las maquetas de Mix4Up.
- **Novedades y versiones que se actualizan solas.** La web lee en directo las releases de los dos repos en GitHub: en cuanto MixUp o Mix4Up publican una versión, sale aquí (versión, tamaños de los archivos, notas, tabla de todas las versiones y cifras de descargas).

## Cómo se actualiza

- `docs/js/site.js` pregunta a la API de GitHub por las releases de `luckicla/zentor` y `luckicla/mix4up` (con 10 minutos de caché en el navegador).
- Si la API no contesta (límite de peticiones o sin conexión), usa `docs/data/releases.json`, una copia que genera `tools/releases.py`.
- `.github/workflows/web.yml` publica `docs/` en GitHub Pages con cada cambio en `main` y **cada hora**, regenerando esa copia.
- Opcional, para que la copia se refresque al momento: desde el workflow de MixUp o Mix4Up, al publicar, manda un `repository_dispatch` de tipo `nueva-version` a este repo (necesita un token con permiso sobre él).

## Archivos

```
docs/index.html        la página
docs/css/site.css      los estilos (la mezcla de los dos diseños)
docs/js/site.js        versiones, novedades, descargas, QR y pestañas
docs/img/              logos y capturas
docs/vendor/qrcode.js  generador de QR (licencia MIT, en LICENSE-qrcode-generator.txt)
tools/releases.py      genera docs/data/releases.json
```

Para verla en local: `python3 -m http.server -d docs` y abre http://localhost:8000.

## Activar GitHub Pages

En *Settings → Pages*, en *Source* elige **GitHub Actions**. A partir de ahí se publica sola.

© 2026 luckicla. MixUp y Mix4Up se distribuyen con la licencia PolyForm Noncommercial 1.0.0.
