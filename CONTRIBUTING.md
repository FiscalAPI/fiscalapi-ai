# Contribuir

Gracias por mejorar fiscalapi-ai. Este documento explica cómo está organizado el repositorio y cómo validar un cambio antes de abrir un pull request.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `skills/` | Una carpeta por skill, con su `SKILL.md` y, si hace falta, `references/`. |
| `commands/` | Comandos del plugin, uno por archivo. |
| `.claude-plugin/`, `.cursor-plugin/` | Manifiestos del plugin y del marketplace. El de Cursor es una copia exacta del de Claude Code. |
| `docs-mcp/` | Servidor MCP `@fiscalapi/docs-mcp`. |
| `scripts/check-skills.mts` | Validación del frontmatter de las skills y de los enlaces a docs.fiscalapi.com. |

## Requisitos

Node.js 22.18 o posterior. Los scripts están escritos en TypeScript y Node.js los ejecuta sin compilarlos.

## Skills y comandos

- `name` es igual al nombre de la carpeta: minúsculas, dígitos y guiones.
- `description` va en una sola línea, en tercera persona, y dice qué hace la skill, cuándo usarla y cuándo no.
- `SKILL.md` tiene menos de 500 líneas.
- Las skills enlazan la documentación en lugar de copiarla. Usa la URL `.md` de la sección (`https://docs.fiscalapi.com/<página>/<sección>.md`).
- Las API keys siempre se leen de variables de entorno, y los ejemplos usan el ambiente de pruebas.

Valida los cambios con:

```
node scripts/check-skills.mts
```

## Servidor MCP

```
cd docs-mcp
npm ci
npm run typecheck
npm run build
npm test
```

`npm run build:data` genera `data/` a partir de la especificación OpenAPI pública y de docs.fiscalapi.com. Las pruebas no usan la red: trabajan con los archivos de `test/fixtures/`. Para actualizar la copia de la documentación que usan las pruebas:

```
node scripts/snapshot-docs.ts https://docs.fiscalapi.com test/fixtures/docs-corpus.json.gz
```

Convenciones del código:

- TypeScript estricto, sin `any`, sin aserciones de tipo y sin comentarios. Si un fragmento necesita explicarse, se reescribe con nombres más claros.
- El código y los mensajes internos van en inglés. Los títulos, las descripciones y los resultados de las herramientas van en español, porque los lee el modelo.
- Cada herramienta es una clase que implementa `McpTool` en `src/tools/` y recibe sus dependencias por interfaces.

## Pull requests

El workflow `Check` debe pasar: valida las skills, los manifiestos y el servidor MCP (typecheck, build, pruebas y contenido del paquete).
