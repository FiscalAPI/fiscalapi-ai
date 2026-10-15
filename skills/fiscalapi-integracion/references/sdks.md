# SDK oficiales de FiscalAPI

Los cinco SDK tienen la misma forma: un objeto de configuración con la URL base, la API key, el tenant y la zona horaria; un cliente; un servicio de facturas con `create`; y una respuesta con `succeeded` y `data`. La URL base es libre (`https://test.fiscalapi.com` o la que indique `FISCALAPI_API_URL`) y el SDK agrega `/api/v4/...`. El repo de cada uno tiene su README con más ejemplos.

Revisado contra la versión 4.0.450 de los cinco paquetes.

## .NET: [fiscalapi-net](https://github.com/FiscalAPI/fiscalapi-net)

- Instalar: `dotnet add package Fiscalapi` (netstandard2.0 y .NET Framework 4.6.1 en adelante).
- Namespaces: `Fiscalapi.Common` (configuración y respuesta), `Fiscalapi.Services` (cliente) y `Fiscalapi.Models` (factura).
- Cliente: `var client = FiscalApiClient.Create(new FiscalapiSettings { ApiUrl = ..., ApiKey = ..., Tenant = ..., TimeZone = "America/Mexico_City" });`. Con inyección de dependencias: `builder.Services.AddFiscalApi()` lee la sección `FiscalapiSettings` y requiere `using FiscalApi;` (con A mayúscula, a diferencia del resto del SDK).
- Emitir: `var response = await client.Invoices.CreateAsync(invoice);` con `Invoice`, `InvoiceIssuer` (`TaxCredentials` con `FileType.CertificateCsd` y `FileType.PrivateKeyCsd`), `InvoiceRecipient`, `InvoiceItem` e `InvoiceItemTax`.
- Respuesta: `response.Succeeded`, `response.Data.Id`, `response.Data.Uuid`, `response.Message`, `response.Details`, `response.TraceIdentifier`.
- Timeout fijo de 30 s.

## Node: [fiscalapi-node](https://github.com/FiscalAPI/fiscalapi-node)

- Instalar: `npm install fiscalapi`.
- Cliente: `import { FiscalapiClient } from 'fiscalapi'` y `FiscalapiClient.create({ apiUrl, apiKey, tenant, timeZone: 'America/Mexico_City' })`. **La clase es `FiscalapiClient`** (con `a` minúscula); los ejemplos del README escriben `FiscalApiClient`, que no existe.
- Emitir: `const response = await client.invoices.create(invoice)` con un objeto plano; `taxCredentials` lleva `fileType: 0` (`.cer`) y `fileType: 1` (`.key`).
- Respuesta: `response.succeeded`, `response.data.id`, `response.data.uuid`, `response.message`, `response.details`.
- Fechas: manda `date` como texto `yyyy-MM-ddTHH:mm:ss` (por ejemplo con `DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss")` de luxon). Un `new Date()` viaja en UTC con `Z` y deja de ser la hora local de `X-TIME-ZONE`.
- `debug: true` imprime los logs y además desactiva la validación SSL: no lo uses fuera de tu máquina.

## Python: [fiscalapi-python](https://github.com/FiscalAPI/fiscalapi-python)

- Instalar: `pip install fiscalapi` (Python 3.9 o más reciente).
- Cliente: `from fiscalapi import FiscalApiClient, FiscalApiSettings` y `client = FiscalApiClient(settings=FiscalApiSettings(api_url=..., api_key=..., tenant=..., time_zone="America/Mexico_City"))`.
- Emitir: `response = client.invoices.create(invoice)` con `Invoice`, `InvoiceIssuer` (`tax_credentials=[TaxCredential(base64_file=..., file_type=0, password=...), TaxCredential(..., file_type=1, ...)]`), `InvoiceRecipient`, `InvoiceItem` e `ItemTax`.
- Respuesta: `response.succeeded`, `response.data.id`, `response.data.uuid`, `response.message`, `response.details`, `response.trace_identifier`.
- Fechas: `date=datetime.now().strftime("%Y-%m-%dT%H:%M:%S")`; un `datetime` sin formatear manda microsegundos.
- El SDK no fija timeout en `requests`.

## PHP: [fiscalapi-php](https://github.com/FiscalAPI/fiscalapi-php)

- Instalar: `composer require fiscalapi/fiscalapi` (PHP 7.4 o más reciente).
- Cliente: `$settings = new \Fiscalapi\Http\FiscalApiSettings($apiUrl, $apiKey, $tenant);` y `$client = new \Fiscalapi\Services\FiscalApiClient($settings);`. Los argumentos son posicionales: después vienen `debug`, `verifySsl`, `apiVersion` y `timeZone`.
- Emitir: `$response = $client->getInvoiceService()->create($invoice);` con un arreglo asociativo con las mismas claves del JSON de las docs.
- Respuesta: `$json = $response->getJson();` y luego `$json['succeeded']`, `$json['data']['id']`, `$json['data']['uuid']`. `isSuccessful()` solo revisa que el HTTP sea 2xx: usa `succeeded`.

## Java: [fiscalapi-java](https://github.com/FiscalAPI/fiscalapi-java)

- Instalar: `com.fiscalapi:fiscalapi:4.0.450` en Maven o Gradle (Java 8 o más reciente).
- Paquetes: `com.fiscalapi.common` (configuración y respuesta), `com.fiscalapi.services` (cliente) y `com.fiscalapi.models.invoicing` (factura).
- Cliente: `FiscalApiSettings` con `setApiUrl`, `setApiKey`, `setTenant` y `setTimeZone`; `FiscalApiClient client = FiscalApiClient.create(settings);`.
- Emitir: `ApiResponse<Invoice> response = client.getInvoiceService().create(invoice);`. `TaxCredential` usa `setFileType(0)` y `setFileType(1)`.
- Los importes, cantidades y tasas son `BigDecimal` (`new BigDecimal("0.160000")`); los ejemplos del README que pasan `double` no compilan.
- Respuesta: `response.isSucceeded()`, `response.getData().getId()`, `response.getData().getUuid()`.
