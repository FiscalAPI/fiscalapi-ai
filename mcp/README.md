# @fiscalapi/mcp

Servidor MCP de solo lectura para integrar [FiscalAPI](https://docs.fiscalapi.com) (CFDI 4.0) desde tu agente de código. Le da al agente el catálogo de operaciones de la API y el esquema completo de cada una, para que escriba la integración sin adivinar rutas ni campos.

No usa red ni llaves: el OpenAPI de FiscalAPI viene dentro del paquete y el servidor solo lee esos archivos. Nunca llama a la API.

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

El flujo normal es `listar_operaciones` para encontrar el endpoint y `obtener_operacion` para ver su contrato.

## Desarrollo

```
npm install
npm run build:data   # genera data/ desde el OpenAPI de live
npm run build
npm test
```

`build:data` lee el OpenAPI de `https://live.fiscalapi.com/api/openapi/v4.json`. Para usar otra fuente, pásala como argumento o en `FISCALAPI_OPENAPI_SOURCE` (URL o ruta de archivo):

```
FISCALAPI_OPENAPI_SOURCE=test/fixtures/openapi-v4.json npm run build:data
```

`data/` no se versiona: lo genera el build y se publica dentro del paquete. `data/source.json` guarda el hash SHA-256 de la fuente.

## Licencia

[MPL-2.0](https://github.com/FiscalAPI/fiscalapi-ai/blob/main/LICENSE)
