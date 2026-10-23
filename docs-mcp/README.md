# @fiscalapi/docs-mcp

Servidor MCP de solo lectura que pone la especificación pública de la API de [FiscalAPI](https://docs.fiscalapi.com) (CFDI 4.0) y su documentación al alcance de tu agente de código, para que escriba la integración sin adivinar rutas, campos ni reglas fiscales.

El servidor no llama a la API de FiscalAPI y no requiere API key. La especificación y el índice de la documentación vienen dentro del paquete, así que funciona sin conexión.

## Requisitos

Node.js 22 o posterior.

## Instalación

El servidor se ejecuta con `npx -y @fiscalapi/docs-mcp` por stdio. Regístralo en tu cliente con el nombre `fiscalapi-docs`.

### Claude Code

```
claude mcp add fiscalapi-docs -- npx -y @fiscalapi/docs-mcp
```

### Codex

```
codex mcp add fiscalapi-docs -- npx -y @fiscalapi/docs-mcp
```

O en `~/.codex/config.toml`:

```toml
[mcp_servers.fiscalapi-docs]
command = "npx"
args = ["-y", "@fiscalapi/docs-mcp"]
```

### GitHub Copilot CLI

```
copilot mcp add fiscalapi-docs -- npx -y @fiscalapi/docs-mcp
```

### VS Code

En `.vscode/mcp.json`:

```json
{
  "servers": {
    "fiscalapi-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@fiscalapi/docs-mcp"]
    }
  }
}
```

### Cursor

En `~/.cursor/mcp.json` (global) o `.cursor/mcp.json` (proyecto):

```json
{
  "mcpServers": {
    "fiscalapi-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@fiscalapi/docs-mcp"]
    }
  }
}
```

### Otros clientes

Registra un servidor stdio con el comando `npx` y los argumentos `-y @fiscalapi/docs-mcp`.

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| `fiscalapi_list_operations` | Lista las operaciones de la API agrupadas por tag, con `operationId`, método HTTP, ruta y resumen. Acepta `tag` (opcional), por ejemplo `Invoices`. |
| `fiscalapi_get_operation` | Devuelve en JSON el contrato de una operación por su `operationId` (por ejemplo `createInvoice`): descripción con el enlace a su documentación, parámetros, cuerpo de la petición y respuestas con los esquemas resueltos. Si el `operationId` no existe, sugiere los más parecidos. |
| `fiscalapi_search_docs` | Busca en las secciones de docs.fiscalapi.com: guías, reglas fiscales del SAT, catálogos SAT, errores de validación y rechazos del PAC por código (por ejemplo `CFDI40147`) y la referencia de cada operación. Devuelve el título, la página, la URL `.md` de la sección y un extracto. Acepta `query` y `limit` (opcional, de 1 a 10; 5 por omisión). |

## Flujo recomendado

1. `fiscalapi_list_operations` para encontrar la operación.
2. `fiscalapi_get_operation` para leer su contrato antes de escribir el código.
3. `fiscalapi_search_docs` para saber qué regla aplica, qué significa un error o qué valor de catálogo usar. Para leer una sección completa, el agente descarga su URL `.md`.

## Licencia

[MPL-2.0](https://github.com/FiscalAPI/fiscalapi-ai/blob/main/LICENSE)
