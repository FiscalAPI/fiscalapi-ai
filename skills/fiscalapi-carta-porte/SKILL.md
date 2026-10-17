---
name: fiscalapi-carta-porte
description: Emite con FiscalAPI un CFDI con complemento Carta Porte 3.1 por autotransporte, de traslado (tipo T) o de ingreso por el flete (tipo I). Decide moneda, receptor y conceptos según el tipo, arma ubicaciones de origen y destino con domicilio y distancias, mercancías con su clave, peso y material peligroso, el autotransporte (permiso SCT, vehículo, seguros y remolques) y las figuras de transporte, y evita los rechazos CP más comunes. Úsala cuando vayas a timbrar una carta porte o a transportar mercancías por carretera con CFDI. Para un error CP que ya devolvió la API, usa fiscalapi-diagnostico.
---

# Carta Porte 3.1 por autotransporte

Antes de escribir el cuerpo, lee [Crear factura de carta porte](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-carta-porte.md) (por referencias: [esta sección](https://docs.fiscalapi.com/invoices-by-reference/crear-factura-de-carta-porte.md)) y toma su ejemplo como base. El ambiente, las llaves y el SDK están en la skill `fiscalapi-integracion`. Esta skill cubre autotransporte; marítimo, aéreo y ferroviario no.

## 1. Traslado (T) o ingreso (I)

| | Traslado `T` | Ingreso `I` |
|---|---|---|
| Cuándo | Mueves mercancía propia; no cobras el flete | Cobras el servicio de transporte a un cliente |
| `currencyCode` | `XXX` (CP103) | La del cobro, por ejemplo `MXN` (CP104) |
| Receptor | El mismo emisor (CP107) | El cliente |
| Uso CFDI | FiscalAPI fija `S01` | El del cliente |
| Forma y método de pago | No llevan | Los del cobro |
| Conceptos (`items`) | Obligatorios; `taxObjectCode` `01` | Clave de servicio de transporte, por ejemplo `78101800` (CP109) |

En un traslado, FiscalAPI deja subtotal y total en 0 aunque los conceptos tengan importe. FiscalAPI no valida la moneda ni que el receptor sea el emisor: si te equivocas, rechaza el PAC.

## 2. `complement.cartaPorte`

FiscalAPI genera solos el `IdCCP`, el peso bruto total y el número total de mercancías: no los mandes. Los nombres de los campos son los del ejemplo de las docs; un campo mal escrito se ignora sin error, así que cópialos de ahí.

- **Raíz:** `transpInternacId` (`No` para nacional, con acento en `Sí`), `unidadPesoId` ([unidad de peso](https://docs.fiscalapi.com/catalogs-info/carta-porte-31/clave-unidad-peso.md), por ejemplo `KGM`) y `totalDistRec`, la suma de las distancias de los destinos (CP125, CP126).
- **Ubicaciones** (al menos un origen y un destino, CP130): `tipoUbicacion` (`Origen` o `Destino`), `idUbicacion` (`OR` o `DE` más 6 dígitos), RFC y nombre del remitente o destinatario, `fechaHoraSalidaLlegada` y, **solo en los destinos**, `distanciaRecorrida` (CP141).
- **Domicilio de cada ubicación:** `estadoId` (clave de 3 letras del SAT, por ejemplo `CMX`, `JAL`, `COA`), `paisId` `MEX` y `codigoPostalId`; colonia, municipio y localidad deben corresponder a ese código postal y estado (CP143 a CP147). FiscalAPI no lo valida.
- **Mercancías:** `bienesTranspId` ([clave de producto de carta porte](https://docs.fiscalapi.com/catalogs-info/carta-porte-31/clave-prod-serv-cp.md)), `descripcion`, `cantidad`, `claveUnidadId`, `pesoEnKg` (hasta 3 decimales) y `materialPeligrosoId` (`Sí` o `No`, según lo que la clave permita, CP155). Con material peligroso, `cveMaterialPeligrosoId`, `embalajeId` y el seguro de medio ambiente son obligatorios (CP182).
- **Autotransporte:** `permSCTId` ([tipo de permiso](https://docs.fiscalapi.com/catalogs-info/carta-porte-31/tipo-permiso.md)), `numPermisoSCT`, `configVehicularId` ([configuración vehicular](https://docs.fiscalapi.com/catalogs-info/carta-porte-31/config-autotransporte.md)), `pesoBrutoVehicular`, `placaVM` (5 a 7 caracteres sin guiones ni espacios), `anioModeloVM`, `aseguraRespCivil` y `polizaRespCivil`. Los `remolques` (máximo 2, con `subTipoRemId` y `placa`) van o no según la configuración vehicular (CP184): un tractocamión los exige, un camión unitario no.
- **Figuras de transporte:** al menos el operador (`tipoFiguraId` `01`) con `rfcFigura`, `nombreFigura` y `numLicencia` (CP193, CP194).

## 3. Catálogos

Los catálogos de carta porte se consultan con la API de catálogos ([tabla de nombres](https://docs.fiscalapi.com/catalogs/catalogos-de-carta-porte-3-1.md)): `SatClaveUnidadPeso`, `SatMaterialPeligroso`, `SatTipoEmbalaje`, `SatTipoPermiso`, `SatConfigAutotransporte`, `SatSubTipoRem`, `SatFiguraTransporte`, `SatColonia`, `SatMunicipio` y `SatLocalidad`. Ten en cuenta sus límites:

- `SatStates` usa claves numéricas, no las de 3 letras que pide `estadoId`.
- No hay catálogo de códigos postales, y colonia, municipio y localidad no traen su código postal: la coherencia entre ellos no se puede comprobar con la API. Toma esos datos de una fuente confiable (el domicilio fiscal real) y no los adivines.

## 4. Antes de timbrar

1. Tipo, moneda y receptor según la tabla de la sección 1.
2. `totalDistRec` igual a la suma de las distancias de los destinos; ninguna distancia en los orígenes.
3. Domicilios con estado de 3 letras y colonia, municipio, localidad y código postal congruentes.
4. Remolques según la configuración vehicular y un operador con licencia.

Si el PAC rechaza, busca el código en [Errores Carta Porte 3.1](https://docs.fiscalapi.com/errors/carta-porte-31/errores-carta-porte-3-1.md) o usa la skill `fiscalapi-diagnostico`. Para consultar el estatus o cancelar, usa `fiscalapi-ciclo-de-vida`.
