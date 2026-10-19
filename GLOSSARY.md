# Glosario

Términos del dominio de Guardadito. Úsalos igual en código, tests y revisiones de arquitectura.

- **Cajita** (`goal`): una meta de ahorro con monto objetivo, fecha opcional y movimientos.
- **Movimiento** (`entry`): un depósito (`cents > 0`) o retiro (`cents < 0`) dentro de una cajita. Su `source` dice de dónde vino (`manual`, `gmail`, `guardian`).
- **Journal**: todos los datos de una persona en un dispositivo (cajitas, preferencias, comprobantes importados). Es lo que se valida con `validateBackup`, se respalda y se sincroniza con la cuenta.
- **Journal store**: el módulo que guarda el Journal en el dispositivo (web o nativo), impide pisar cambios más nuevos con escrituras viejas y avisa a quien lo escuche. No conoce textos de la interfaz ni recordatorios.
- **Respaldo**: un archivo exportado del Journal. Restaurarlo reemplaza el Journal y apaga los recordatorios.
- **Guardián**: la pareja que confirma depósitos y retiros de una cajita en pareja.
- **Comprobante** (`receipt`): el aviso de un depósito que llega por Gmail o por un archivo de correo local. Se cuenta una sola vez (`importedIds`) y puede coincidir con un movimiento ya anotado (mismo monto, misma app, mismo día).
- **Receipt kernel** (`src/receipts/kernel.js`): lo que Gmail y el correo local comparten (qué es la misma operación, contarla una vez, anotar el depósito). Cada fuente decide lo suyo: qué movimientos puede reconocer, qué pasa al vincular y con qué `source` se anota el nuevo.
- **Respuesta al ahorro** (`src/feedback/`): lo que la persona ve y siente después de un cambio en el Journal, leído del cambio mismo: celebrar si una cajita llegó a su meta, la mascota contenta si entró dinero, la nota de retiro si salió. Si entró dinero cuenta como ahorro, venga de donde venga (manual, Gmail, correo local o guardián): abre las sorpresas de «La próxima vez que ahorre» y responde el recordatorio.
- **Acciones de cajita** (`src/goals/`): lo que una persona puede hacer con sus cajitas desde cualquier pantalla (crear, registrar un movimiento, editar o archivar, corregir un registro, importar un correo, depositar con el guardián). Decide qué diálogo está abierto y qué cambio guarda cada uno.
