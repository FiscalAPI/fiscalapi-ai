# Integración asistida por IA: evals

Todo va en fiscalapi-ai, en `evals/`, en la rama `feat/ai-integracion`. Las evals se corren a mano antes de cada release (D-11), con una cuenta y una llave de test de FiscalAPI que se leen de variables de entorno y nunca se escriben en el repo.

### EV-01 — Montar el harness de evals con los casos de ingreso y pagos
**Objetivo:** medir, caso por caso, si un agente integra FiscalAPI mejor con las skills y con el MCP que sin nada.
**Depende de:** SK-05, MCP-02.
**Skills:** `anthropic-skills:skill-creator` (sección de evals), `superpowers:writing-skills`. El patrón de `skill-validator` de dotnet/skills se revisa con `gh api`.
**Modelo sugerido (opcional):** opus. Diseña la medición de la que depende U-04.
**Contexto:** D-11, RF-06.
**Alcance:**
- Elegir el runner: reutilizar `skill-validator` (dotnet/skills) o un script mínimo que lance el agente en modo no interactivo sobre un proyecto plantilla. Se decide aquí y se documenta en D-11.
- Cada caso trae:
  - el prompt del integrador en español;
  - un proyecto plantilla (Node Express y .NET mínimo);
  - las 3 variantes de D-11.
- Calificación automática: el proyecto resultante, ejecutado, produce un UUID en test, y `GET /api/v4/invoices/{id}` confirma su estado.
- Métricas: éxito, tokens e intentos.
- Casos iniciales: factura de ingreso, nota de crédito, factura global, y factura PPD con su complemento de pago.
**Criterios de aceptación (todos con `→ verificar`):**
- Un solo comando corre los 4 casos en las 3 variantes y genera un reporte en tabla → verificar: ejecución y reporte generado.
- Un caso con una skill rota a propósito baja su tasa de éxito → verificar: corrida con un enlace o una regla falsa plantada.
**Pruebas focalizadas:** ninguna (no aplica). El harness es la prueba.
**Fuera de alcance:** correr en CI (D-11).
**Notas:**

### EV-02 — Agregar casos de nómina, carta porte y comercio exterior
**Objetivo:** cubrir con evals todos los casos CFDI del feature.
**Depende de:** EV-01, SK-09.
**Skills:** `fapi-cfdi-rules`.
**Modelo sugerido (opcional):** haiku para escribir los casos; opus revisa la calificación.
**Contexto:** D-03; el orden y los casos extra los fija MED-01 y el top de rechazos de MED-03.
**Alcance:**
- Casos de nómina ordinaria, Carta Porte de traslado por autotransporte y exportación definitiva con Comercio Exterior.
- Un caso de "explicar error" por cada código del top 5 de MED-03.
**Criterios de aceptación (todos con `→ verificar`):**
- Los casos nuevos corren en las 3 variantes → verificar: reporte con las filas nuevas.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** —
**Notas:**

### EV-03 — Correr las 3 variantes y reportar
**Objetivo:** dar al usuario los datos para U-04: publicar o no el MCP y pedir o no los marketplaces oficiales (Q-01).
**Depende de:** EV-02.
**Skills:** `superpowers:verification-before-completion`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-07, D-11, Q-01.
**Alcance:**
- Corrida completa con N repeticiones por caso (N lo fija EV-01 según la varianza).
- Tabla de éxito, tokens e intentos por caso y variante.
- Recomendación:
  - si las skills mejoran frente a sin nada;
  - si el MCP mejora frente a las skills solas;
  - qué skills reescribir.
- El resumen va en las Notas de esta tarea y en el cuerpo del commit; no se versiona ningún archivo de evidencia.
**Criterios de aceptación (todos con `→ verificar`):**
- El reporte existe y cubre todos los casos y variantes → verificar: tabla en el cuerpo del commit.
- La recomendación se apoya en las cifras → verificar: cada afirmación cita su fila.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** publicar (U-04).
**Notas:**
