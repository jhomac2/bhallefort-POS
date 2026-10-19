# Bhalleffort

Sistema de ventas para tienda de abarrotes / víveres. Funciona sin internet y guarda los datos en el navegador (IndexedDB).

Diseñado por Jhordy Cabascango · https://www.tiktok.com/@mr_jhordy21

## Qué incluye
- Venta con lector de códigos de barras o manual (solo efectivo), fiado y ventas en espera.
- Apertura de caja obligatoria cada día (efectivo tienda, efectivo Mi Vecino, cuentas Pichincha y Guayaquil).
- Panel fijo de **Mi Vecino**: depósitos, retiros, servicios y recargas.
- Dueños de productos ilimitados, con ventas y ganancias por dueño.
- Edición de ventas y precios con historial de cambios y aviso al cerrar caja.
- Cierre de caja con conteo y opción de sumar a la contabilidad de un dueño.
- Dashboard de utilidad (día, semana, mes, año, rango) y reportes PDF de cualquier fecha.
- Envío de reportes por WhatsApp (un solo PDF: tienda, Mi Vecino o ambos).
- Sin IVA. Factura SRI opcional (solo anota los datos del cliente).

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app completa (todo el código dentro). |
| `sw.js` | Service worker: guarda la app para que abra **sin internet**. |
| `manifest.webmanifest` + `icon-*.png`, `icon.svg`, `apple-touch-icon.png` | Permiten instalarla como app en el computador o el celular. |
| `src/`, `template.html`, `build.py`, `vendor/` | Código fuente para regenerar `index.html`. |

`sw.js`, `manifest.webmanifest` y los iconos deben estar en la **misma carpeta** que `index.html`.

## Publicar en GitHub Pages
1. Sube todos los archivos a un repositorio.
2. Settings → Pages → Deploy from a branch → `main` / `(root)`.
3. Abre `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/` **una vez con internet**. Desde ahí funciona sin conexión.
4. En Chrome: menú ⋮ → «Instalar Bhalleffort» (queda como app con su ícono).

## Usar sin GitHub
Abre `index.html` directamente en el navegador. También funciona sin internet.

## Actualizar
Tras cambiar el código ejecuta `python3 build.py` (genera `index.html`) y cambia `VERSION` en `sw.js` (por ejemplo `bhalleffort-v2`) para que los equipos reciban la versión nueva.

Los datos quedan en el navegador de cada equipo: descarga un respaldo cada semana desde Ajustes. Las librerías jsPDF y jspdf-autotable (licencia MIT) están en `vendor/`.
