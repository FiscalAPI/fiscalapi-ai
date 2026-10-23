---
description: Revisa una integración existente con FiscalAPI y reporta los defectos que causan problemas en producción, con la línea y la corrección de cada uno.
argument-hint: "[carpeta o archivos a revisar; por omisión, todo el proyecto]"
---

Revisa la integración con FiscalAPI de este proyecto, siguiendo las skills `fiscalapi-integracion` y `fiscalapi-ciclo-de-vida`.

$ARGUMENTS

Busca en el código (excluye `node_modules`, `bin`, `obj`, `vendor` y dependencias) estos defectos, en este orden:

1. **API keys en el código o en archivos versionados.** Valores que empiecen con `sk_test_` o `sk_live_`, secretos de webhook (`whsec_`), o una API key o tenant escritos como texto en lugar de leerse del entorno o de un gestor de secretos. Revisa también `.env` versionados y archivos de configuración. Una API key `sk_live_` es crítica: indica rotarla en el dashboard.
2. **Peticiones sin `X-TIME-ZONE`.** Llamadas HTTP directas a FiscalAPI que mandan `X-API-KEY` pero no `X-TIME-ZONE`, o un cliente del SDK sin zona horaria cuando el sistema no trabaja en hora de México.
3. **Reintentos a ciegas tras un 5xx o un timeout al timbrar.** Un ciclo de reintento, una librería de retry o un `catch` que vuelve a llamar `POST /api/v4/invoices` (o `invoices.create`) sin consultar antes si la factura quedó timbrada. Un 5xx o un timeout al timbrar no se reintenta.
4. **Webhooks sin verificar la firma.** Código de la URL del webhook que recibe eventos de FiscalAPI y procesa el cuerpo sin verificar `webhook-signature` con el secreto, o que verifica sobre el JSON ya parseado en lugar del cuerpo crudo.

Además, si los ves, repórtalos: la URL de producción (`live.fiscalapi.com`) en código de pruebas, `succeeded` sin revisar en la respuesta, y una cancelación marcada como definitiva con la sola respuesta del DELETE.

Responde con una tabla: defecto, archivo y línea, por qué es un problema (con el enlace a la sección de las docs que aplique) y la corrección concreta. Si no encuentras un defecto de la lista, dilo explícitamente. No modifiques archivos: solo reporta.
