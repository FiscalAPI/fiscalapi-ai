---
description: Timbra tu primera factura de ingreso en el ambiente de pruebas de Fiscalapi con el SDK de tu proyecto, de punta a punta, y devuelve su UUID.
argument-hint: "[lenguaje, si el proyecto todavía no tiene uno]"
---

Timbra una factura de ingreso de prueba en este proyecto siguiendo la skill `fiscalapi-integracion` (antes de escribir código, lee su sección de SDK, su sección de reintentos y su referencia de SDK).

$ARGUMENTS

1. **API key y tenant.** Lee `FISCALAPI_API_KEY` y `FISCALAPI_TENANT_KEY` de las variables de entorno, y `FISCALAPI_API_URL` (si no existe, usa `https://test.fiscalapi.com`). Si falta la API key o el tenant, detente y explica cómo obtenerlos con la sección 1 de la skill `fiscalapi-integracion`. Nunca escribas la API key ni el tenant en el código ni en un archivo, y nunca uses `https://live.fiscalapi.com`.
2. **Lenguaje y SDK.** Detecta el lenguaje con la tabla de la skill (o usa el que te indiquen arriba; si el proyecto está vacío y no te indican uno, pregunta cuál usar). Instala el SDK oficial con el comando de la referencia de SDK de la skill `fiscalapi-integracion` (versión 4.0.462 o posterior, para la llave de idempotencia).
3. **Certificados de prueba.** Descarga el zip de [Certificados de prueba](https://docs.fiscalapi.com/testing-data/certificados-de-prueba.md) en una carpeta que no se versione (agrégala al `.gitignore`). Del emisor `FUNK671228PH6`, toma el Certificado CSD (.cer) y la Llave privada CSD (.key) de la subcarpeta `CSD_*` (no el Certificado FIEL (.cer) ni la Llave privada FIEL (.key)) y conviértelos a base64 al ejecutar; la contraseña es `12345678a`.
4. **Factura.** Arma una factura de ingreso por valores con el cuerpo de ejemplo de [Crear factura ingreso](https://docs.fiscalapi.com/invoices-by-value/crear-factura-ingreso.md): emisor `FUNK671228PH6` (régimen 621), receptor `EKU9003173C9` (régimen 601, uso G01, CP 42501), un concepto con IVA 16 % que conserve todos los campos del concepto del ejemplo (por valores, `itemSku` es obligatorio), y la fecha actual como texto `yyyy-MM-ddTHH:mm:ss`. Usa los nombres de clases y campos de la referencia de SDK de la skill `fiscalapi-integracion`.
5. **Timbra con llave de idempotencia y revisa la respuesta.** Genera una `Idempotency-Key` (UUID v4) una sola vez, antes de llamar, y pásala al método de crear factura del SDK. Si `succeeded` es verdadero, imprime el `id` y el `uuid` de `data`.
   - Un 400 con fallas de validación: corrígelo y vuelve a timbrar con la misma llave.
   - Un rechazo del PAC: corrígelo y vuelve a timbrar con una llave nueva.
   - Ninguno de los dos consume timbre. Para interpretarlos, usa la skill `fiscalapi-diagnostico`.
   - Ante un timeout o un error de red, reintenta con la misma llave y el mismo cuerpo, sin regenerar la fecha.
   - Ante un 500, no emitas de nuevo: el CFDI pudo quedar timbrado. Sigue la sección de reintentos de la skill `fiscalapi-integracion`.
6. **Comprueba.** Consulta la factura por su `id` con el SDK ([Obtener factura por ID](https://docs.fiscalapi.com/invoices-by-value/obtener-factura-por-id.md)) y confirma que trae el mismo `uuid`.

Responde con el `uuid`, el `id`, los archivos que creaste y el comando para volver a correr el programa.
