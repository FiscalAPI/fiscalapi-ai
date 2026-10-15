# Integración asistida por IA: medición

Los resultados de estas tareas van a `requisitos.md` → **Contexto medido**, con su fuente y sin datos personales (solo conteos y porcentajes). No se crea un archivo de resultados aparte.

### MED-01 — Medir mezcla de tipos y complementos en el restore de prod
**Objetivo:** saber qué tipos de CFDI y qué complementos timbran los clientes, para ordenar SK-04 a SK-09 y las evals.
**Depende de:** —
**Skills:** `fapi-investigate`, `fapi-local-env` (restore y sqlcmd local).
**Modelo sugerido (opcional):** haiku. Son consultas de lectura, sin decisiones.
**Contexto:** D-03; la métrica norte en `requisitos.md`.
**Alcance:**
- Confirmar que el restore local es de producción (`backupset.server_name`).
- Contar, en los últimos 12 meses y por mes, las facturas timbradas por `Invoices.TypeCode`.
- Contar las facturas con fila 1:1 en `Payroll`, `CartaPorte`, `ComercioExterior`, `InvoicePayment` y `GlobalInformation`.
- Contar los tenants distintos que usan cada tipo o complemento.
**Criterios de aceptación (todos con `→ verificar`):**
- El origen del restore está confirmado → verificar: `SELECT TOP 1 server_name, backup_finish_date FROM msdb.dbo.backupset WHERE database_name='WebApi' ORDER BY backup_finish_date DESC`.
- `requisitos.md` tiene una tabla de tipos y complementos con volumen, tenants y el orden resultante → verificar: `grep -n "Mezcla de tipos" docs/ai-integracion/requisitos.md`.
- El orden de SK-04 a SK-09 y de los casos de EV-01 y EV-02 queda ajustado en el tablero si la medición lo cambia → verificar: revisar el diff del README.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** errores del PAC (MED-03); embudo de Test (MED-02).
**Notas:**
- Hechos corregidos: Nómina y Pagos viven en `Payrolls` e `InvoicePayments` (1:1 por índice único en `InvoiceId`); Información global no es tabla sino columnas `Invoices.GlobalInformation_*`.
- Restore aparte `WebApi_ProdSnap_20261014` (READ_ONLY), borrado al terminar. Comercio Exterior: 0 facturas desde siempre; el orden de skills no cambia.

### MED-02 — Medir embudo y tiempo al primer timbre en el restore de Test
**Objetivo:** fijar la línea base de la métrica norte y medir cuántas cuentas abandonan en el paso de compra de prueba (para revisar D-09).
**Depende de:** —
**Skills:** `fapi-investigate`, `fapi-local-env`.
**Modelo sugerido (opcional):** opus. Hay que interpretar el embudo y separar las cuentas internas de las reales.
**Contexto:** D-09; la métrica norte en `requisitos.md`.
**Alcance:**
- Restaurar en local el respaldo de Test (origen en la memoria local `project_local_credentials`) y confirmar su `server_name`.
- Por cohorte semanal de los últimos 6 meses:
  - owners creados;
  - con correo confirmado;
  - con suscripción de prueba activa;
  - con primer `Invoice` timbrado;
  - mediana de minutos desde la creación hasta el primer timbre;
  - porcentaje que timbra en menos de 24 h.
- Excluir las cuentas internas (fixtures `rl-test-*`, dominios propios) con un criterio explícito.
**Criterios de aceptación (todos con `→ verificar`):**
- `requisitos.md` tiene la tabla del embudo, la línea base de la métrica norte y el criterio de exclusión → verificar: `grep -n "Embudo de Test" docs/ai-integracion/requisitos.md`.
- El abandono en el paso de suscripción queda cuantificado y llevado al usuario como dato para D-09 → verificar: la cifra aparece en las Notas de la tarea.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** cambiar el onboarding (D-09).
**Notas:**
- Dato para D-09: 215 de 378 owners confirmados (56.9 %) nunca hacen la compra de prueba, y nadie timbra sin ella. Línea base: mediana de 1,424 min al primer timbre, 15.4 % en menos de 24 h.
- "Suscripción" se midió como cualquier fila en `Features` (desde 2026-10-05 casi no hay `Type = 'Base'`). Restore aparte `WebApi_TestSnap` (READ_ONLY), borrado al terminar.

### MED-03 — Medir el top de rechazos del PAC en Seq
**Objetivo:** saber qué códigos de rechazo del PAC son los más frecuentes, para dar prioridad a `fiscalapi-diagnostico` y a los casos de las evals.
**Depende de:** U-01 (el usuario abre el túnel a Seq de producción).
**Skills:** `fapi-investigate`.
**Modelo sugerido (opcional):** haiku.
**Contexto:** los rechazos no se guardan en la BD; solo quedan en Seq con las propiedades `PacCode` y `TypeCode` (log de `InvoiceIssuanceService`).
**Alcance:**
- En Seq, por el túnel, sacar los 30 `PacCode` más frecuentes de los últimos 90 días, con su `TypeCode` y el número de tenants afectados.
- Cruzarlos con las tablas `/errors/*.md` de las docs para confirmar que cada código tiene página.
**Criterios de aceptación (todos con `→ verificar`):**
- `requisitos.md` tiene el top 30 con su volumen y si tiene página en las docs → verificar: `grep -n "Top de rechazos" docs/ai-integracion/requisitos.md`.
- Los códigos sin página quedan como Notas de DOC-02 o como "Fuera de alcance" → verificar: revisar el diff.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** guardar los rechazos en la BD.
**Notas:**
