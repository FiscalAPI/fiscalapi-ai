# SDK oficiales de Fiscalapi

Los cinco SDK tienen la misma forma: un objeto de configuración con la URL base, la API key, el tenant y la zona horaria; un cliente; un servicio de facturas con `create`; y una respuesta con `succeeded` y `data`. La URL base es libre (`https://test.fiscalapi.com` o la que indique `FISCALAPI_API_URL`) y el SDK agrega `/api/v4/...`. El repo de cada uno, enlazado en su título, tiene en su README los requisitos de runtime y más ejemplos.

**Idempotencia:** desde la versión 4.0.462, los cinco aceptan la llave de idempotencia como argumento opcional de crear factura, crear ticket y transferir timbres, y la mandan en el header `Idempotency-Key` (reglas en la sección 6 de la skill). Retirar timbres no acepta llave en ningún SDK. Ningún SDK reintenta una petición por su cuenta (salvo la recuperación de conexión de OkHttp en Java, abajo): el reintento con la misma llave lo hace tu código.

## .NET: [fiscalapi-net](https://github.com/FiscalAPI/fiscalapi-net)

- Instalar: `dotnet add package Fiscalapi`.
- Cliente: `var client = FiscalApiClient.Create(new FiscalapiSettings { ApiUrl = ..., ApiKey = ..., Tenant = ..., TimeZone = "America/Mexico_City" });`, con `Fiscalapi.Common` (configuración y respuesta) y `Fiscalapi.Services` (cliente). Con inyección de dependencias: `builder.Services.AddFiscalApi()` lee la sección `FiscalapiSettings` y requiere `using FiscalApi;`.
- Timbrar: `var response = await client.Invoices.CreateAsync(invoice, idempotencyKey);` con `Invoice`, `InvoiceIssuer` (`TaxCredentials` con `FileType.CertificateCsd` y `FileType.PrivateKeyCsd`), `InvoiceRecipient`, `InvoiceItem` e `InvoiceItemTax`, del namespace `Fiscalapi.Models`. Transferir timbres: `client.Stamps.TransferStamps(request, idempotencyKey)`.
- Respuesta: `response.Succeeded`, `response.Data.Id`, `response.Data.Uuid`, `response.Message`, `response.Details`, `response.TraceIdentifier`. En un error, `Data` queda vacío y el `data` del API va en `response.ErrorData`; en un 400 de validación, `Details` une las fallas como `Campo: mensaje; ...`.
- Timeout: fijo de 30 s. Al vencer, `CreateAsync` lanza `TaskCanceledException` (no devuelve un `ApiResponse`): atrápala y reintenta con la misma llave.

## Node: [fiscalapi-node](https://github.com/FiscalAPI/fiscalapi-node)

- Instalar: `npm install fiscalapi`.
- Cliente: `import { FiscalapiClient } from 'fiscalapi'` y `FiscalapiClient.create({ apiUrl, apiKey, tenant, timeZone: 'America/Mexico_City' })`. La clase es `FiscalapiClient`, con `a` minúscula.
- Timbrar: `const response = await client.invoices.create(invoice, idempotencyKey)` con un objeto plano; `taxCredentials` lleva `fileType: 0` para el Certificado CSD (.cer) y `fileType: 1` para la Llave privada CSD (.key). Transferir timbres: `client.stamps.transferStamps(request, idempotencyKey)`.
- Respuesta: `response.succeeded`, `response.data.id`, `response.data.uuid`, `response.traceIdentifier`. En los errores, `message` y `details` no son los del API:
  - En un 400 de validación, `message` es el mensaje de la primera falla y `details` es la lista de fallas en JSON.
  - En los demás errores, `message` es el texto del cliente HTTP (por ejemplo `Request failed with status code 422`) y `details` es el cuerpo del API en JSON: lee el `message` y los `details` reales con `JSON.parse(response.details)`.
- Timeout: fijo de 30 s. Un timeout o un error de red llega como `httpStatusCode` 500 sin `traceIdentifier` y con `details` `{}`: no es un 500 del API, sino una respuesta que no llegó; reintenta con la misma llave.
- Fechas: manda `date` como texto `yyyy-MM-ddTHH:mm:ss` (por ejemplo con `DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss")` de luxon). Un `new Date()` viaja en UTC con `Z` y deja de ser la hora local de `X-TIME-ZONE`.
- Notas: usa `debug: true` solo en desarrollo local.

## Python: [fiscalapi-python](https://github.com/FiscalAPI/fiscalapi-python)

- Instalar: `pip install fiscalapi`.
- Cliente: `from fiscalapi import FiscalApiClient, FiscalApiSettings` y `client = FiscalApiClient(settings=FiscalApiSettings(api_url=..., api_key=..., tenant=..., time_zone="America/Mexico_City"))`.
- Timbrar: `response = client.invoices.create(invoice, idempotency_key=...)` con `Invoice`, `InvoiceIssuer` (`tax_credentials=[TaxCredential(base64_file=..., file_type=0, password=...), TaxCredential(..., file_type=1, ...)]`), `InvoiceRecipient`, `InvoiceItem` e `ItemTax`. Transferir timbres: `client.stamps.transfer_stamps(request, idempotency_key=...)`.
- Respuesta: `response.succeeded`, `response.data.id`, `response.data.uuid`, `response.message`, `response.details`, `response.trace_identifier`. En un error, el `data` del API va en `response.error_data`.
- Fechas: `date=datetime.now().strftime("%Y-%m-%dT%H:%M:%S")`; un `datetime` sin formatear manda microsegundos.
- Timeout: las llamadas del cliente no tienen timeout, y un error de red lanza la excepción de `requests`. Si tu sistema necesita un límite de espera, aplícalo desde tu código; al vencer, reintenta con la misma `idempotency_key` y el mismo cuerpo.

## PHP: [fiscalapi-php](https://github.com/FiscalAPI/fiscalapi-php)

- Instalar: `composer require fiscalapi/fiscalapi`.
- Cliente: `$settings = new \Fiscalapi\Http\FiscalApiSettings($apiUrl, $apiKey, $tenant);` y `$client = new \Fiscalapi\Services\FiscalApiClient($settings);`. Los argumentos son posicionales: después vienen `debug`, `verifySsl`, `apiVersion` y `timeZone`.
- Timbrar: `$response = $client->getInvoiceService()->create($invoice, $idempotencyKey);` con un arreglo asociativo con las mismas claves del JSON de las docs. Transferir timbres: `$client->getStampService()->transferStamps($data, $idempotencyKey)`.
- Respuesta: `$json = $response->getJson();` y luego `$json['succeeded']`, `$json['data']['id']`, `$json['data']['uuid']`. Decide si la operación tuvo éxito con `$json['succeeded']`, no con `isSuccessful()`. Un error del API llega con su cuerpo tal cual en `getJson()`.
- Timeout: sin timeout. Un error de red lanza `RuntimeException`; atrápala y reintenta con la misma llave.

## Java: [fiscalapi-java](https://github.com/FiscalAPI/fiscalapi-java)

- Instalar: `com.fiscalapi:fiscalapi` en Maven o Gradle, con la versión más reciente publicada.
- Cliente: `FiscalApiSettings` con `setApiUrl`, `setApiKey`, `setTenant` y `setTimeZone`; `FiscalApiClient client = FiscalApiClient.create(settings);`, con `com.fiscalapi.common` (configuración y respuesta) y `com.fiscalapi.services` (cliente).
- Timbrar: `ApiResponse<Invoice> response = client.getInvoiceService().create(invoice, idempotencyKey);`, con los modelos de `com.fiscalapi.models.invoicing`. `TaxCredential` usa `setFileType(0)` y `setFileType(1)`. Transferir timbres: `client.getStampService().transferStamps(request, idempotencyKey)`.
- Respuesta: `response.isSucceeded()`, `response.getData().getId()`, `response.getData().getUuid()`, `response.getTraceIdentifier()`. En un error, el `data` del API va en `response.getErrorData()`.
- Timeout: 30 s para conectar y 30 s para leer. Al vencer, o ante un error de red, lanza `RuntimeException` (con la `IOException` como causa); atrápala y reintenta con la misma llave. El cliente HTTP (OkHttp) puede repetir por su cuenta un envío ante ciertas fallas de conexión: manda siempre la llave al timbrar.
- Tipos: los importes, cantidades y tasas son `BigDecimal` (`new BigDecimal("0.160000")`), no `double`.
