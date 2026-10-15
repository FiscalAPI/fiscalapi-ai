---
description: Timbra tu primera factura de ingreso en el ambiente de pruebas de FiscalAPI con el SDK de tu proyecto, de punta a punta, y devuelve su UUID.
argument-hint: "[lenguaje, si el proyecto todavía no tiene uno]"
---

Timbra una factura de ingreso de prueba en este proyecto siguiendo la skill `fiscalapi-integracion` (lee su sección de SDK y `references/sdks.md` antes de escribir código).

$ARGUMENTS

1. **Llaves.** Lee `FISCALAPI_API_KEY` y `FISCALAPI_TENANT` de las variables de entorno, y `FISCALAPI_API_URL` (si no existe, usa `https://test.fiscalapi.com`). Si falta la llave o el tenant, detente y explica cómo obtenerlas con el paso 1 de la skill. Nunca escribas las llaves en el código ni en un archivo, y nunca uses `https://live.fiscalapi.com`.
2. **Lenguaje y SDK.** Detecta el lenguaje con la tabla de la skill (o usa el que te indiquen arriba; si el proyecto está vacío y no te indican uno, pregunta cuál usar). Instala el SDK oficial con el comando de `references/sdks.md`.
3. **Certificados de prueba.** Descarga el zip de [Certificados de prueba](https://docs.fiscalapi.com/testing-data/certificados-de-prueba.md) en una carpeta que no se versione (agrégala al `.gitignore`). Del emisor `FUNK671228PH6`, toma el `.cer` y el `.key` de la subcarpeta `CSD_*` (no los de la FIEL) y conviértelos a base64 al ejecutar; la contraseña es `12345678a`.
4. **Factura.** Arma una factura de ingreso por valores con el cuerpo de ejemplo de [Crear factura ingreso](https://docs.fiscalapi.com/invoices-by-value/crear-factura-ingreso.md): emisor `FUNK671228PH6` (régimen 621), receptor `EKU9003173C9` (régimen 601, uso G01, CP 42501), un concepto con IVA 16 % que conserve todos los campos del concepto del ejemplo (por valores, `itemSku` es obligatorio), y la fecha actual como texto `yyyy-MM-ddTHH:mm:ss`. Usa los nombres del SDK, no los del README si `references/sdks.md` dice que el README falla.
5. **Timbra una sola vez.** Si `succeeded` es verdadero, imprime el `id` y el `uuid` de `data`. Si no, interpreta la respuesta con la skill `fiscalapi-diagnostico`, corrige y vuelve a intentar. Ante un 5xx o un timeout, no reintentes: sigue la regla de la skill.
6. **Comprueba.** Consulta la factura por su `id` con el SDK ([Obtener factura por ID](https://docs.fiscalapi.com/invoices-by-value/obtener-factura-por-id.md)) y confirma que trae el mismo `uuid`.

Responde con el `uuid`, el `id`, los archivos que creaste y el comando para volver a correr el programa.
