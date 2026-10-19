# Splitwise con REA: qué traer a Guardadito

Captura del **2026-10-18** con el servidor MCP de REA (`capture_browser_scenario`, proveedor `rea-playwright-browser-scenario` v1, Chromium 155.0.8059.40 lanzado y cerrado por REA). Solo se capturaron **páginas públicas**: el sitio de Splitwise, su centro de ayuda y su ficha en Google Play México. No se abrió una cuenta ni se usó la app privada. Tampoco se descompiló el APK, ni se copiaron imágenes, textos o código. Lo que sigue son comportamientos documentados que Guardadito adapta con código, textos y arte propios.

## Por qué Splitwise

Es la app «intermediaria» con más éxito entre personas. Nunca guarda el dinero: lleva la cuenta compartida y deja que cada quien pague por donde quiera. Eso es lo mismo que necesita Guardadito para el ahorro en pareja, el guardián y, más adelante, las tandas.

Señales observadas en la ficha de Play México (`ev_e409d7e4…646de`):

- **10 M+ descargas, 4.6 estrellas, 195 k opiniones** y en el lugar **#7 de mayor recaudación en Finanzas** en México.
- Ella misma se describe como útil «con amigos o con la pareja».
- Las quejas de usuarios mexicanos van contra el **límite de gastos por día en la versión gratis** y contra el precio de Pro (**$799 al año**). Ahí hay una oportunidad: Guardadito no debe limitar el registro de ahorro en la versión gratis.

## Evidencia

| Página pública | Evidencia REA | Qué se observó |
| --- | --- | --- |
| [splitwise.com](https://www.splitwise.com/), celular 390×844, es-MX | `ev_fa05a9fa4f719d2a345838680ab61703c47fc93cf426cb51ad7afb0b5460f307` | Cuatro promesas: seguir saldos y «quién debe a quién», organizar por grupo, agregar rápido «antes de olvidar quién pagó», saldar y «registrar cualquier pago en efectivo o en línea». En la lista de funciones aparecen división igual o desigual, por % o por partes, gastos recurrentes, modo sin conexión con sincronización en la nube, y escaneo de recibos y gráficas como funciones Pro. |
| [Centro de ayuda](https://kb.splitwise.com/) y [Play MX](https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile&hl=es_419&gl=MX) | `ev_e409d7e4cd8eb551f78119ddf5bd8b39ce471e19bd7963efa4b19d08011646de` | Categorías de ayuda: saldos y gastos, grupos e invitaciones, cuenta, pagos integrados y Pro. Las cifras de Play están arriba. |
| Listas de artículos de [grupos](https://kb.splitwise.com/groups), [saldos](https://kb.splitwise.com/balances-and-expenses) y [primeros pasos](https://kb.splitwise.com/getting-started) | `ev_a07fe358d9fcc95a2c2156bfd26ea6475d59c0a14b2572dfa394c82699420098` | Hay un artículo para dividir un gasto de pareja, otro para unirse a un grupo existente y otro para deshacer un pago marcado por error. |
| Ocho artículos (los de abajo) | `ev_3d0224a7bce5de61712469779fc8624d5498ddb8031832750c82c54d32774bea` | El detalle de cada comportamiento está en la siguiente tabla. |

## Comportamiento observado → cómo lo adapta Guardadito

| Splitwise (lo que dice su ayuda) | Guardadito |
| --- | --- |
| **Pareja que comparte gastos:** se divide «por partes», por ejemplo 2 partes para quien paga por los dos y 0 para su pareja. | En la cajita en pareja, la **parte de cada quien** se puede poner por % (60/40), por montos fijos o mitad y mitad. Lo más común es mitad y mitad, así que va por defecto. |
| **Unirse a un grupo:** nadie entra solo; un miembro invita por correo o teléfono, o comparte un **enlace de invitación**. Si la invitación llegó a otro correo, el enlace te pide entrar con tu cuenta. | **Enlace o código de invitación** para mandar por WhatsApp. Al abrirlo, la app pide crear cuenta o entrar, y luego une la cajita. Sin enlace no hay forma de entrar. |
| **Sin administradores:** cualquier persona involucrada puede ver, editar o borrar, porque «cualquiera debe poder corregir errores». A cambio, todo cambio avisa y queda en la Actividad. | Se adapta a medias: **cada quien corrige solo sus propios aportes**, porque es dinero que la otra persona apartó en su propia cuenta. Toda corrección queda en la Actividad compartida y avisa a la pareja. |
| **Deshacer un pago por error:** se borra el registro y el saldo se recalcula. Si el pago fue por una app externa, borrar el registro **no cancela la transferencia**. | Igual: borrar un aporte o un depósito confirmado recalcula la meta, con un aviso claro de que «esto no devuelve dinero en tu banco». Ya existe la validación de saldo histórico en `CorrectEntry.jsx`. |
| **Restaurar lo borrado** desde la Actividad («Restaurar»); cualquiera de los involucrados puede hacerlo. | **Papelera en la Actividad**: un aporte borrado se puede restaurar por 30 días. Hoy borrar es definitivo. |
| **Recurrentes:** semanal, quincenal, mensual o anual; se repiten hasta detenerlos; recordatorio por correo antes de cada uno; editar el último cambia los futuros. | Ya existen el **plan** y los recordatorios semanales, quincenales y mensuales (`src/calendar.js`). Lo que falta es hacer el plan **visible para la pareja** («Ana aparta $150 cada quincena») y que el aviso llegue a quien le toca. **No** se registra solo: sigue haciendo falta confirmar que el dinero sí se apartó. |
| **Agregar a alguien sin correo:** se puede crear un miembro «de nombre», y más tarde se le da acceso. Splitwise manda **una invitación, un recordatorio y luego deja en paz** a la persona. | Se puede **crear la cajita en pareja antes de que el otro tenga cuenta**. Se le manda una invitación y un recordatorio, nada más, con el mismo tono sin presión de las reglas de avisos. |
| **Revisar saldos:** Actividad reciente, resumen imprimible por mes y **exportar a hoja de cálculo**, con una fila por movimiento y una columna por persona. | La Actividad y el CSV ya existen; para cajitas compartidas se agrega **una columna por persona** al CSV. |
| **Simplificar deudas:** reacomoda quién paga a quién sin cambiar el saldo de nadie. | No aplica a pareja. Se guarda para tandas: calcular quién paga y quién cobra en cada turno. |
| Pro: escaneo de recibos, gráficas, búsqueda, divisas. | Ideas para «Guardadito+». Leer comprobantes ya existe y es gratis (`LocalMailImport.jsx`). |

## Lo que Guardadito agrega y Splitwise no tiene

Splitwise está hecho para **deudas**, y su tono es neutral («quién debe a quién»). Guardadito está hecho para **metas**, y su tono es de cariño:

- La mascota celebra los aportes de los dos.
- Notitas y premios que una persona le prepara a la otra.
- El modo guardián, para quien no tiene cuenta.
- Nunca se usa la palabra «debes» entre la pareja: se dice «te faltan $300 de tu parte», sin comparar quién aportó más.

## Límites

- Todo sale de documentación pública; no prueba cómo se comporta la app privada.
- Las cifras de Play son una foto del 18-oct-2026.
- El centro de ayuda se leyó en inglés (`en-US`); el sitio y la ficha de Play, en `es-MX`.
- Los JSON de evidencia completos y la captura de pantalla quedaron fuera del repositorio, en la carpeta temporal de la sesión. No se agregaron imágenes de Splitwise al repo ni al producto.
- Antes de afirmar que Guardadito es «mejor», hay que probarlo con parejas reales.
