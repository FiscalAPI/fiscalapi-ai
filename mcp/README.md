# @fiscalapi/mcp

Servidor MCP de solo lectura para integrar [FiscalAPI](https://docs.fiscalapi.com) (CFDI 4.0) desde tu agente de código. Le da al agente el catálogo de operaciones de la API, el esquema completo de cada una y una búsqueda en la documentación, para que escriba la integración sin adivinar rutas, campos ni reglas fiscales.

No usa red ni llaves: el OpenAPI y un índice de la documentación vienen dentro del paquete y el servidor solo lee esos archivos. Nunca llama a la API.

## Instalación

Requiere Node.js 22 o posterior.

```
npx -y @fiscalapi/mcp
```

En Claude Code:

```
claude mcp add fiscalapi -- npx -y @fiscalapi/mcp
```

En otros clientes MCP, registra un servidor stdio con el comando `npx` y los argumentos `-y @fiscalapi/mcp`.

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| `listar_operaciones` | Lista las operaciones agrupadas por tag: operationId, método, ruta y resumen. Acepta `tag` (opcional) para filtrar, por ejemplo `Invoices`. |
| `obtener_operacion` | Devuelve en JSON una operación por su `operationId` (por ejemplo `createInvoice`): descripción con el enlace a la documentación, parámetros, cuerpo y respuestas con los esquemas resueltos. Si el id no existe, sugiere los parecidos. |
| `buscar_docs` | Busca en las secciones de docs.fiscalapi.com: guías, reglas fiscales del SAT, catálogos, errores del PAC por código (por ejemplo `CFDI40147`) y la referencia de cada endpoint. Devuelve título, página, la URL `.md` de la sección y un extracto. Acepta `consulta` y `limite` (opcional, de 1 a 10; 5 por omisión). |

El flujo normal es `listar_operaciones` para encontrar el endpoint y `obtener_operacion` para ver su contrato. `buscar_docs` responde el resto: qué regla aplica, qué significa un error o qué valor de catálogo usar. Para leer una sección completa, el agente descarga su URL `.md`.

## Desarrollo

```
npm install
npm run build:data   # genera data/ desde el OpenAPI de live y docs.fiscalapi.com
npm run build
npm test
```

`build:data` lee el OpenAPI de `https://live.fiscalapi.com/api/openapi/v4.json`. Para usar otra fuente, pásala como argumento o en `FISCALAPI_OPENAPI_SOURCE` (URL o ruta de archivo):

```
FISCALAPI_OPENAPI_SOURCE=test/fixtures/openapi-v4.json npm run build:data
```

La documentación se descarga de `https://docs.fiscalapi.com` (`llms.txt` y la `.md` de cada sección). Para usar otro origen, pásalo con `--docs-origin` o en `FISCALAPI_DOCS_ORIGIN`:

```
npm run build:data -- test/fixtures/openapi-v4.json --docs-origin http://localhost:3000
```

`data/` no se versiona: lo genera el build y se publica dentro del paquete. `data/source.json` guarda el hash SHA-256 del OpenAPI y, en `docs`, el origen, el hash y el número de documentos de la documentación.

Las pruebas no usan la red: sirven en local `test/fixtures/openapi-v4.json` y `test/fixtures/docs-corpus.json.gz`, una copia del `llms.txt` y de todas sus `.md`. Para regenerar esa copia:

```
node scripts/snapshot-docs.mjs https://docs.fiscalapi.com test/fixtures/docs-corpus.json.gz
```

## Licencia

[MPL-2.0](https://github.com/FiscalAPI/fiscalapi-ai/blob/main/LICENSE)
