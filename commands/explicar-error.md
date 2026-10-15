---
description: Explica un error de la API de FiscalAPI (un código como CFDI40147 o la respuesta JSON completa) y propone la corrección.
argument-hint: <código o respuesta JSON>
---

Explica este error de FiscalAPI siguiendo la skill `fiscalapi-diagnostico`:

$ARGUMENTS

1. Clasifícalo con el árbol de decisión de la skill: validación de FiscalAPI, rechazo del PAC o del SAT, error del servidor u otro 4xx.
2. Abre la página o sección enlazada que le corresponde y localiza la fila del código o la regla del campo.
3. Responde con el tipo de error, la causa según esa fila o sección (con su enlace) y el cambio concreto que hay que hacer.

Si solo recibiste un código, sin respuesta, explícalo con su fila de la tabla y pide la respuesta completa solo si hace falta para proponer el cambio.
