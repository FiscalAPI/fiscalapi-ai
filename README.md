# fiscalapi-ai

Skills y comandos en español para integrar [FiscalAPI](https://docs.fiscalapi.com) (CFDI 4.0) en tu ERP, POS, SaaS o app desde tu agente de código: Claude Code, Codex, Cursor o GitHub Copilot.

Las skills no copian la documentación. Llevan al agente a la sección exacta de [docs.fiscalapi.com](https://docs.fiscalapi.com) y le ayudan a decidir qué operación, complemento o catálogo SAT usar.

## Qué incluye

### Skills

El agente carga cada skill cuando la tarea lo requiere.

| Skill | Úsala para |
| --- | --- |
| `fiscalapi-integracion` | Empezar: ambiente de pruebas, API key y tenant, SDK según el lenguaje y modo por valores o por referencias. |
| `fiscalapi-ingreso-egreso` | CFDI/Factura de ingreso, CFDI/Factura de egreso (nota de crédito) y CFDI/Factura global. |
| `fiscalapi-pagos` | CFDI/Factura de pago (complemento de recepción de pagos 2.0) de facturas PPD. |
| `fiscalapi-nomina` | CFDI/Factura de nómina (complemento de nómina 1.2). |
| `fiscalapi-carta-porte` | CFDI/Factura de carta porte (complemento Carta Porte 3.1, autotransporte). |
| `fiscalapi-comercio-exterior` | CFDI/Factura de comercio exterior (complemento Comercio Exterior 2.0). |
| `fiscalapi-ciclo-de-vida` | Cancelación, estatus ante el SAT, XML, PDF, envío por correo y webhooks. |
| `fiscalapi-diagnostico` | Interpretar errores de validación, rechazos del PAC y errores del servidor. |

### Comandos

| Comando | Qué hace |
| --- | --- |
| `primer-timbre` | Timbra tu primera factura de ingreso en el ambiente de pruebas con el SDK de tu proyecto y devuelve su UUID. |
| `explicar-error` | Explica un error de la API (un código como `CFDI40147` o la respuesta JSON completa) y propone la corrección. |
| `revisar-integracion` | Revisa una integración existente y reporta los defectos que causan problemas en producción, con la línea y la corrección de cada uno. |

### Servidor MCP de documentación

[`@fiscalapi/docs-mcp`](docs-mcp/README.md) es opcional y complementa a las skills: le da al agente la especificación pública de la API y una búsqueda en la documentación, sin llamar a la API ni requerir API key. Se instala por separado.

## Requisitos

Para timbrar en el ambiente de pruebas necesitas una cuenta, una API key y el tenant. Sigue [Pasos para comenzar](https://docs.fiscalapi.com/quickstart/pasos-para-comenzar.md).

## Instalación

### Claude Code

En una sesión:

```
/plugin marketplace add FiscalAPI/fiscalapi-ai
/plugin install fiscalapi@fiscalapi
```

O desde la terminal:

```
claude plugin marketplace add FiscalAPI/fiscalapi-ai
claude plugin install fiscalapi@fiscalapi
```

### Codex

Agrega el marketplace y después instala `fiscalapi` desde `/plugins` en una sesión de Codex:

```
codex plugin marketplace add FiscalAPI/fiscalapi-ai
```

### GitHub Copilot CLI

```
copilot plugin marketplace add FiscalAPI/fiscalapi-ai
copilot plugin install fiscalapi@fiscalapi
```

### VS Code

Agrega el marketplace en tu `settings.json` (función experimental de VS Code) e instala `fiscalapi` desde la vista de plugins del chat:

```json
{
  "chat.plugins.enabled": true,
  "chat.plugins.marketplaces": ["FiscalAPI/fiscalapi-ai"]
}
```

### Cursor

Clona el repositorio en la carpeta de plugins locales y recarga la ventana con **Developer: Reload Window**:

```
git clone https://github.com/FiscalAPI/fiscalapi-ai ~/.cursor/plugins/local/fiscalapi
```

## Seguridad

- Las skills leen la API key y el tenant de variables de entorno (`FISCALAPI_API_URL`, `FISCALAPI_API_KEY`, `FISCALAPI_TENANT`). No los escribas en el código ni en archivos versionados.
- Trabaja en el ambiente de pruebas (`https://test.fiscalapi.com`). Timbrar en producción es un acto fiscal irreversible.

## Soporte

Consulta la [documentación](https://docs.fiscalapi.com) o abre un [issue](https://github.com/FiscalAPI/fiscalapi-ai/issues).

## Licencia

[MPL-2.0](LICENSE)
