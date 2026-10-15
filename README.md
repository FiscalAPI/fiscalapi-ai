# fiscalapi-ai

Skills en español para integrar [FiscalAPI](https://docs.fiscalapi.com) (CFDI 4.0) en tu ERP, POS o SaaS desde tu agente de código: Claude Code, Codex, Cursor o GitHub Copilot.

Las skills no copian la documentación: te llevan a la sección exacta de [docs.fiscalapi.com](https://docs.fiscalapi.com) y te ayudan a decidir qué endpoint, complemento o catálogo usar.

## Instalación

### Claude Code

```
/plugin install fiscalapi --marketplace FiscalAPI/fiscalapi-ai
```

O desde la terminal:

```
claude plugin marketplace add FiscalAPI/fiscalapi-ai
claude plugin install fiscalapi@fiscalapi
```

### Codex

```
codex plugin marketplace add FiscalAPI/fiscalapi-ai
codex plugin add fiscalapi@fiscalapi
```

### GitHub Copilot

En Copilot CLI:

```
copilot plugin marketplace add FiscalAPI/fiscalapi-ai
copilot plugin install fiscalapi@fiscalapi
```

En VS Code, agrega el marketplace a tu configuración:

```json
{
  "chat.plugins.enabled": true,
  "chat.plugins.marketplaces": ["FiscalAPI/fiscalapi-ai"]
}
```

### Cursor

Clona el repo en la carpeta de plugins locales y recarga la ventana (**Developer: Reload Window**):

```
git clone https://github.com/FiscalAPI/fiscalapi-ai ~/.cursor/plugins/local/fiscalapi
```

## Licencia

[MPL-2.0](LICENSE)
