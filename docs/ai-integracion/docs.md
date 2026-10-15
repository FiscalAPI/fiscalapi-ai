# Integración asistida por IA: docs (fapi-docs y fapi-reusables)

El código va en fapi-docs (y en fapi-reusables solo si cambia el generador), en la rama `feat/ai-integracion` desde `main`. La fila del tablero se cierra con `<repo>@<hash>`.

**Hecho al planear:** fapi-docs tenía en curso la rama `feat/localization`. En `main` hay 0 archivos `content.en.mdx` y 52 `content.mdx`. Antes de DOC-01, revisa si la localización ya llegó a `main`; si llegó, la generación por sección cubre también las páginas en inglés y se carga `fapi-i18n`.

### DOC-01 — Generar `.md` por sección H2 en el build
**Objetivo:** que un agente pueda leer una sola sección (por ejemplo "Crear factura de pago") sin descargar la página completa, que llega a 647 KB.
**Depende de:** —
**Skills:** `fapi-sdk-docs-sync` (docs públicas), `fapi-i18n` (solo si la localización ya está en `main`).
**Modelo sugerido (opcional):** opus. Cambia rutas públicas del sitio.
**Contexto:** D-15, RF-02. Hoy `src/app/md/[[...slug]]/route.js` y los rewrites de `next.config.mjs` sirven `<página>.md`, y `getPageMarkdown` vive en `src/lib/docs.js`.
**Alcance:**
- Ruta de sección `/<página>/<ancla>.md`, con el mismo slug que el ancla H2 que ya genera el sitio. Devuelve el markdown de esa sección, del H2 hasta el siguiente H2.
- Se genera desde los mismos MDX en build (prerender), sin contenido nuevo que mantener.
- `llms.txt` agrega, por página, la lista de sus secciones con su URL `.md`.
**Criterios de aceptación (todos con `→ verificar`):**
- La sección se sirve sola → verificar: `npm run build && npm start` y `curl -s localhost:3000/invoices-by-value/crear-factura-de-pago.md | head`; el contenido empieza en ese H2 y no incluye el siguiente.
- Cada ancla del sitio tiene su `.md` → verificar: un script de build cuenta las secciones de los MDX (427 al planear) y las rutas generadas, y las compara.
- `llms.txt` lista las secciones → verificar: `curl -s localhost:3000/llms.txt | grep -c "\.md"` sube respecto a `main`.
**Pruebas focalizadas:** ninguna (no aplica). La verificación es el conteo del build.
**Fuera de alcance:** `llms-full.txt` (D-15).
**Notas:**
- Bloqueada: `invoices-by-value` e `invoices-by-reference` (23 H2 cada una, las secciones de facturas) están en `EXCLUDED_ROUTES` de `src/lib/docs.js`: noindex, `Disallow` en robots y fuera del sitemap, de `llms.txt` y de las copias `.md` (94a60f2). ¿Las secciones `.md` y su lista en `llms.txt` las incluyen? Propuesta: sí, sin tocar noindex, robots ni el sitemap.
- Localización (`feat/localization`) agrega `npm run es:diff`, que compara byte a byte `/llms.txt` y las `.md` contra `main`; si se fusiona antes, esta tarea declara su diferencia en `scripts/i18n/es-allowed.json`. Worktree listo: `fapi-docs-ai`.

### DOC-02 — Generar páginas de errores de Pagos y Comercio Exterior
**Objetivo:** que `fiscalapi-diagnostico` y `explicar-error` puedan enlazar los errores `CRP*` y `CCE*`, igual que hoy enlazan los de CFDI 4.0, Nómina y Carta Porte.
**Depende de:** —
**Skills:** `fapi-cfdi-rules`, `fapi-sdk-docs-sync`.
**Modelo sugerido (opcional):** haiku. Corre el generador existente.
**Contexto:** RF-03. Las páginas actuales salen de `fapi-reusables/scripts/sat-docs-md-errors-generator/app.py` sobre las matrices de `fapi-reusables/sat-docs`. Ya existen `sat-docs/pagos` y `sat-docs/comercio-exterior`.
**Alcance:**
- Correr el generador con las matrices de Pagos 2.0 y Comercio Exterior 2.0 y crear las páginas `errors/pagos-20` y `errors/comercio-exterior-20` con el mismo formato que `errors/cfdi-40`.
- Agregarlas a la navegación y a `llms.txt`.
- Si el generador necesita un cambio, va en fapi-reusables en su propio commit.
**Criterios de aceptación (todos con `→ verificar`):**
- Las dos páginas responden en `.md` → verificar: `curl -s localhost:3000/errors/pagos-20.md | grep -c "CRP"` y `curl -s localhost:3000/errors/comercio-exterior-20.md | grep -c "CCE"` mayores que 0.
- El número de códigos coincide con la matriz del SAT → verificar: conteo de filas de la matriz contra el conteo en la página.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** traducir los mensajes del SAT.
**Notas:**

### DOC-03 — Corregir el enlace del SDK de Node en `llms.txt`
**Objetivo:** que los agentes lleguen al repo real del SDK de Node.
**Depende de:** —
**Skills:** `fapi-sdk-docs-sync`.
**Modelo sugerido (opcional):** haiku.
**Contexto:** `src/app/llms.txt/route.js` enlaza `github.com/FiscalAPI/fiscalapi-js`, y el repo real es `fiscalapi-node`.
**Alcance:** cambiar el enlace y hacer grep de `fiscalapi-js` en todo fapi-docs por si aparece en otro lugar.
**Criterios de aceptación (todos con `→ verificar`):**
- No queda ningún `fiscalapi-js` → verificar: `grep -rn "fiscalapi-js" src` sin resultados.
- El enlace nuevo existe → verificar: `gh repo view FiscalAPI/fiscalapi-node --json name`.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** —
**Notas:**
