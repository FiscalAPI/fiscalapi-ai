---
name: fiscalapi-carta-porte
description: Timbra con FiscalAPI un CFDI/Factura de carta porte (complemento Carta Porte 3.1, autotransporte), de traslado (tipo T) o de ingreso por el flete (tipo I), con moneda, receptor y conceptos según el tipo, ubicaciones con domicilio y distancias, mercancías, autotransporte y figuras de transporte, sin los rechazos CP más comunes. Úsala cuando vayas a timbrar una carta porte o a amparar con CFDI el transporte de mercancías por carretera. No la uses para diagnosticar un error CP que ya devolvió la API (usa `fiscalapi-diagnostico`).
---

# CFDI/Factura de carta porte (complemento Carta Porte 3.1, autotransporte)

El CFDI/Factura de carta porte ampara el transporte de mercancías con el complemento Carta Porte 3.1. Es de traslado (tipo `T`) cuando mueves mercancía propia y de ingreso (tipo `I`) cuando cobras el flete. Esta skill cubre autotransporte; marítimo, aéreo y ferroviario no.

Antes de escribir el cuerpo, lee [Crear factura de carta porte](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-carta-porte.md) (por referencias: [esta sección](https://docs.fiscalapi.com/invoices-by-reference/crear-factura-de-carta-porte.md)) y toma su ejemplo como base. El ambiente, la API key y el SDK están en la skill `fiscalapi-integracion`.

## 1. El comprobante: traslado (`T`) o ingreso (`I`)

| | Traslado `T` | Ingreso `I` |
|---|---|---|
| Cuándo | Mueves mercancía propia; no cobras el flete | Cobras el servicio de transporte al receptor |
| `currencyCode` | `XXX` (CP103) | La del cobro, por ejemplo `MXN` (CP104) |
| Receptor | El mismo emisor (CP107) | Quien paga el flete |
| Uso CFDI | La API fija `S01` | El del receptor |
| Forma y método de pago | No llevan | Los del cobro |
| Conceptos (`items`) | Obligatorios; `taxObjectCode` `01` | Clave de servicio de transporte, por ejemplo `78101800` (CP109) |

En un traslado, la API deja subtotal y total en 0 aunque los conceptos tengan importe. Usa la moneda y el receptor de la tabla: en un traslado, `XXX` y el mismo RFC como emisor y receptor; si no, el PAC rechaza (CP103, CP107).

## 2. `complement.cartaPorte`

La API genera el `IdCCP`, el peso bruto total y el número total de mercancías: no los mandes. Copia los nombres de los campos exactamente como aparecen en el ejemplo de las docs: un nombre distinto deja ese dato fuera del XML.

- **Raíz:** `transpInternacId` (`No` para nacional, con acento en `Sí`), `unidadPesoId` ([unidad de peso](https://docs.fiscalapi.com/catalogs-info/carta-porte-31/clave-unidad-peso.md), por ejemplo `KGM`) y `totalDistRec`, la suma de las distancias de los destinos (CP125, CP126).
- **Ubicaciones** (al menos un origen y un destino, CP130): `tipoUbicacion` (`Origen` o `Destino`), `idUbicacion` (`OR` o `DE` más 6 dígitos), RFC y nombre del remitente o destinatario, `fechaHoraSalidaLlegada` y, **solo en los destinos**, `distanciaRecorrida` (CP141).
- **Domicilio de cada ubicación:** `estadoId` (clave de 3 letras del SAT, por ejemplo `CMX`, `JAL`, `COA`), `paisId` `MEX` y `codigoPostalId`; colonia, municipio y localidad deben corresponder a ese código postal y estado; si no, el PAC rechaza (CP143 a CP147).
- **Mercancías:** `bienesTranspId` ([clave de producto de carta porte](https://docs.fiscalapi.com/catalogs-info/carta-porte-31/clave-prod-serv-cp.md)), `descripcion`, `cantidad`, `claveUnidadId`, `pesoEnKg` (hasta 3 decimales) y `materialPeligrosoId` (`Sí` o `No`, según lo que la clave permita, CP155). Con material peligroso, `cveMaterialPeligrosoId`, `embalajeId` y el seguro de medio ambiente son obligatorios (CP182).
- **Autotransporte:** `permSCTId` ([tipo de permiso](https://docs.fiscalapi.com/catalogs-info/carta-porte-31/tipo-permiso.md)), `numPermisoSCT`, `configVehicularId` ([configuración vehicular](https://docs.fiscalapi.com/catalogs-info/carta-porte-31/config-autotransporte.md)), `pesoBrutoVehicular`, `placaVM` (5 a 7 caracteres sin guiones ni espacios), `anioModeloVM`, `aseguraRespCivil` y `polizaRespCivil`. Los `remolques` (máximo 2, con `subTipoRemId` y `placa`) van o no según la configuración vehicular (CP184): un tractocamión los exige, un camión unitario no.
- **Figuras de transporte:** al menos el operador (`tipoFiguraId` `01`) con `rfcFigura`, `nombreFigura` y `numLicencia` (CP193, CP194).

## 3. Catálogos

Los catálogos de carta porte se consultan con la API de catálogos ([tabla de nombres](https://docs.fiscalapi.com/catalogs/catalogos-de-carta-porte-3-1.md)): `SatClaveUnidadPeso`, `SatMaterialPeligroso`, `SatTipoEmbalaje`, `SatTipoPermiso`, `SatConfigAutotransporte`, `SatSubTipoRem`, `SatFiguraTransporte`, `SatColonia`, `SatMunicipio` y `SatLocalidad`. Para los domicilios:

- `estadoId` lleva la clave de 3 letras de `c_Estado`; consúltala en [Estados](https://docs.fiscalapi.com/catalogs-info/nomina-12/estados.md) (`SatPayrollStates`) y no uses las claves numéricas de `SatStates`.
- Toma el código postal, la colonia, el municipio y la localidad del domicilio real de cada ubicación, sin adivinarlos, y comprueba que correspondan entre sí con los catálogos `c_CodigoPostal` y `c_Colonia` del SAT.

## 4. Antes de timbrar

1. Tipo, moneda y receptor según la tabla de la sección 1.
2. `totalDistRec` igual a la suma de las distancias de los destinos; ninguna distancia en los orígenes.
3. Domicilios con estado de 3 letras y colonia, municipio, localidad y código postal congruentes.
4. Remolques según la configuración vehicular y un operador con licencia.

Si el PAC rechaza, busca el código en [Errores Carta Porte 3.1](https://docs.fiscalapi.com/errors/carta-porte-31/errores-carta-porte-3-1.md) o usa la skill `fiscalapi-diagnostico`. Para cancelar, consultar el estatus ante el SAT o descargar el XML y el PDF, usa la skill `fiscalapi-ciclo-de-vida`.
