# SDK oficiales de FiscalAPI

Los cinco SDK tienen la misma forma: un objeto de configuración con la URL base, la API key, el tenant y la zona horaria; un cliente; un servicio de facturas con `create`; y una respuesta con `succeeded` y `data`. La URL base es libre (`https://test.fiscalapi.com` o la que indique `FISCALAPI_API_URL`) y el SDK agrega `/api/v4/...`. El repo de cada uno, enlazado en su título, tiene en su README los requisitos de runtime y más ejemplos.

## .NET: [fiscalapi-net](https://github.com/FiscalAPI/fiscalapi-net)

- Instalar: `dotnet add package Fiscalapi`.
- Cliente: `var client = FiscalApiClient.Create(new FiscalapiSettings { ApiUrl = ..., ApiKey = ..., Tenant = ..., TimeZone = "America/Mexico_City" });`, con `Fiscalapi.Common` (configuración y respuesta) y `Fiscalapi.Services` (cliente). Con inyección de dependencias: `builder.Services.AddFiscalApi()` lee la sección `FiscalapiSettings` y requiere `using FiscalApi;`.
- Timbrar: `var response = await client.Invoices.CreateAsync(invoice);` con `Invoice`, `InvoiceIssuer` (`TaxCredentials` con `FileType.CertificateCsd` y `FileType.PrivateKeyCsd`), `InvoiceRecipient`, `InvoiceItem` e `InvoiceItemTax`, del namespace `Fiscalapi.Models`.
- Respuesta: `response.Succeeded`, `response.Data.Id`, `response.Data.Uuid`, `response.Message`, `response.Details`, `response.TraceIdentifier`.
- Notas: el timeout es fijo de 30 s.

## Node: [fiscalapi-node](https://github.com/FiscalAPI/fiscalapi-node)

- Instalar: `npm install fiscalapi`.
- Cliente: `import { FiscalapiClient } from 'fiscalapi'` y `FiscalapiClient.create({ apiUrl, apiKey, tenant, timeZone: 'America/Mexico_City' })`. La clase es `FiscalapiClient`, con `a` minúscula.
- Timbrar: `const response = await client.invoices.create(invoice)` con un objeto plano; `taxCredentials` lleva `fileType: 0` para el Certificado CSD (.cer) y `fileType: 1` para la Llave privada CSD (.key).
- Respuesta: `response.succeeded`, `response.data.id`, `response.data.uuid`, `response.message`, `response.details`.
- Fechas: manda `date` como texto `yyyy-MM-ddTHH:mm:ss` (por ejemplo con `DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss")` de luxon). Un `new Date()` viaja en UTC con `Z` y deja de ser la hora local de `X-TIME-ZONE`.
- Notas: usa `debug: true` solo en desarrollo local.

## Python: [fiscalapi-python](https://github.com/FiscalAPI/fiscalapi-python)

- Instalar: `pip install fiscalapi`.
- Cliente: `from fiscalapi import FiscalApiClient, FiscalApiSettings` y `client = FiscalApiClient(settings=FiscalApiSettings(api_url=..., api_key=..., tenant=..., time_zone="America/Mexico_City"))`.
- Timbrar: `response = client.invoices.create(invoice)` con `Invoice`, `InvoiceIssuer` (`tax_credentials=[TaxCredential(base64_file=..., file_type=0, password=...), TaxCredential(..., file_type=1, ...)]`), `InvoiceRecipient`, `InvoiceItem` e `ItemTax`.
- Respuesta: `response.succeeded`, `response.data.id`, `response.data.uuid`, `response.message`, `response.details`, `response.trace_identifier`.
- Fechas: `date=datetime.now().strftime("%Y-%m-%dT%H:%M:%S")`; un `datetime` sin formatear manda microsegundos.
- Notas: las llamadas del cliente no tienen timeout. Si tu sistema necesita un límite de espera, aplícalo desde tu código y trata su vencimiento al timbrar como un timeout: resultado incierto, sin reintento.

## PHP: [fiscalapi-php](https://github.com/FiscalAPI/fiscalapi-php)

- Instalar: `composer require fiscalapi/fiscalapi`.
- Cliente: `$settings = new \Fiscalapi\Http\FiscalApiSettings($apiUrl, $apiKey, $tenant);` y `$client = new \Fiscalapi\Services\FiscalApiClient($settings);`. Los argumentos son posicionales: después vienen `debug`, `verifySsl`, `apiVersion` y `timeZone`.
- Timbrar: `$response = $client->getInvoiceService()->create($invoice);` con un arreglo asociativo con las mismas claves del JSON de las docs.
- Respuesta: `$json = $response->getJson();` y luego `$json['succeeded']`, `$json['data']['id']`, `$json['data']['uuid']`. Decide si la operación tuvo éxito con `$json['succeeded']`, no con `isSuccessful()`.

## Java: [fiscalapi-java](https://github.com/FiscalAPI/fiscalapi-java)

- Instalar: `com.fiscalapi:fiscalapi` en Maven o Gradle, con la versión más reciente publicada.
- Cliente: `FiscalApiSettings` con `setApiUrl`, `setApiKey`, `setTenant` y `setTimeZone`; `FiscalApiClient client = FiscalApiClient.create(settings);`, con `com.fiscalapi.common` (configuración y respuesta) y `com.fiscalapi.services` (cliente).
- Timbrar: `ApiResponse<Invoice> response = client.getInvoiceService().create(invoice);`, con los modelos de `com.fiscalapi.models.invoicing`. `TaxCredential` usa `setFileType(0)` y `setFileType(1)`.
- Respuesta: `response.isSucceeded()`, `response.getData().getId()`, `response.getData().getUuid()`.
- Tipos: los importes, cantidades y tasas son `BigDecimal` (`new BigDecimal("0.160000")`), no `double`.
