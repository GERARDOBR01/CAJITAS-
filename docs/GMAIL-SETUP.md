# Correos: usar hoy y activar Gmail después

La versión publicada funciona sin un backend: en **Más → Conexiones → Importar un correo** abre un `.eml` o pega el texto. También puedes hacerlo desde **Registrar ahorro → Usar un correo de depósito** en una cajita. Nada se suma hasta revisar cajita, monto y fecha y marcar la confirmación.

En Gmail de computadora, abre el mensaje y usa su menú de tres puntos → **Descargar mensaje**. En el celular puedes copiar el texto y pegarlo. [Instrucciones oficiales de Google](https://support.google.com/mail/answer/9261412?hl=es). Los archivos `.txt` se tratan como texto pegado. Límite: 2 MB por archivo.

El correo se procesa en el dispositivo; no se sube ni se guarda su contenido. Solo se guardan el movimiento revisado y una huella hash para reconocer la importación. Un archivo o texto pegado no autentica al remitente: verifica el depósito en Nu o Mercado Pago. Los registros confirmados de esta forma se marcan como manuales. Si coincide app, monto y día con otro movimiento, puedes vincularlo sin sumar o confirmar que se trata de un depósito distinto. La coincidencia no demuestra identidad; cantidades o fechas diferentes pueden no sugerirse. Una nueva copia con contenido modificado y sin Message-ID puede generar otra huella.

## Desarrollo con Gmail directo

1. Usa Node 24. Ejecuta `npm ci`, copia `.env.example` a `.env` y ejecuta `npm run dev`. `.env` está ignorado por Git.
2. Crea un proyecto en [Google Cloud](https://console.cloud.google.com/) y habilita **Gmail API**. Configura la pantalla de consentimiento y agrega tu correo a los usuarios de prueba.
3. Crea un cliente OAuth **Aplicación web**. Agrega exactamente `http://localhost:5173/api/gmail/callback` a sus URI de redirección autorizados. El flujo usa OAuth de servidor, no un token capturado en la interfaz.
4. Configura en `.env`:

   | Variable | Valor para desarrollo |
   | --- | --- |
   | `APP_ORIGIN` | `http://localhost:5173` |
   | `GOOGLE_REDIRECT_URI` | `http://localhost:5173/api/gmail/callback` |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Credenciales del cliente web de Google |
   | `SESSION_SECRET` | Un valor aleatorio de al menos 32 caracteres |
   | `GMAIL_NU_SENDERS`, `GMAIL_MP_SENDERS` | Remitentes exactos de tus comprobantes, separados por comas |

   Para generar un secreto en tu equipo:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Se necesita al menos un remitente configurado para habilitar la conexión; solo se buscan los proveedores configurados. No uses las direcciones sintéticas de los tests. No hace falta definir `WEB_APP_URL` ni `VITE_API_ORIGIN` cuando cliente y backend están juntos en localhost.

5. Ejecuta `npm run check:setup`: muestra nombres faltantes, nunca valores. Código de salida 2 significa configuración incompleta; 0 significa que pasó esta revisión local, **no** que se haya probado Google. Reinicia Vite al cambiar variables.
6. Abre **Más → Conexiones → Gmail directo → Conectar Gmail**. Tras autorizar, usa **Buscar depósitos**. Se solicita únicamente `gmail.readonly`; la búsqueda se filtra por los remitentes exactos y los últimos 90 días. No envía ni modifica correos.

Los tokens se guardan cifrados en `.local/` durante el desarrollo. No se envían al navegador. Desconectar elimina la sesión y solicita la revocación en Google. [OAuth de servidor](https://developers.google.com/workspace/gmail/api/auth/web-server) y [scopes de Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes).

## Backend HTTPS para Pages y las apps nativas

El repositorio incluye `api/router.js` y `vercel.json`. Importa **CAJITAS-** en Vercel, con el directorio raíz del repo, comando `npm run build` y salida `dist`. Necesitas una base Redis compatible con Upstash REST para que las sesiones sobrevivan entre funciones.

Ejemplo de direcciones; sustituye el dominio del backend por el tuyo:

| Configuración | Dónde | Ejemplo |
| --- | --- | --- |
| `APP_ORIGIN` | Servidor | `https://tu-backend.vercel.app` |
| `GOOGLE_REDIRECT_URI` | Servidor y cliente web en Google Cloud | `https://tu-backend.vercel.app/api/gmail/callback` |
| `WEB_APP_URL` | Servidor | `https://gerardobr01.github.io/CAJITAS-/` |
| `VITE_API_ORIGIN` | Equipo/CI que compila Pages y las apps | `https://tu-backend.vercel.app` |
| `NATIVE_APP_ORIGINS` | Servidor | `capacitor://localhost,https://localhost` |

`GOOGLE_REDIRECT_URI` apunta al **backend**, no a Pages. `WEB_APP_URL` es la URL completa de la web, con la ruta y la barra final. `VITE_API_ORIGIN` lleva solo el origen, sin `/api`, ni otras rutas. Es una dirección pública, nunca una credencial.

Configura también en las variables privadas de Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, los remitentes y `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. No copies credenciales al repo ni uses `VITE_` en secretos. Agrega el callback HTTPS al cliente web de Google. Vuelve a desplegar el backend tras cambiar variables.

En el equipo de compilación puedes revisar una copia privada de esta configuración:

```bash
npm run check:setup -- --production --web
# Para salida estructurada, solo nombres/estados:
npm run check:setup -- --production --web --json
```

Comprueba `https://tu-backend.vercel.app/api/status`. `gmailConfigured`, `gmailReadiness`, `webBridgeConfigured` y `webReadiness` indican si faltan variables. No muestran credenciales. Esto no prueba que las credenciales sean válidas: completa una conexión y una consulta con tu cuenta de prueba para verificarlo.

Después configura `VITE_API_ORIGIN` antes de compilar:

```bash
npm run build:pages
npm run deploy:pages -- --skip-build
# Se necesita una nueva app para incorporar la dirección del backend:
npm run build:android
npm run sync:ios
```

Pages puede consultar el backend mediante una lista permitida de origen y URL de retorno exactos. El código de retorno es de un solo uso, caduca en 60 segundos y requiere una prueba del navegador que inició la conexión. Los tokens de Google permanecen cifrados en el servidor. En web externa se guarda un ID opaco de sesión en `sessionStorage`, separado por backend; cerrar la pestaña puede requerir reconectar. En Capacitor el ID opaco se guarda en Preferences. La web servida por el propio backend usa cookies HttpOnly.

La descarga actual no lleva un backend configurado. Configurarlo requiere volver a compilar/publicar Pages y el APK; crear variables solo en Vercel no cambia una app ya instalada. La importación local continúa disponible.

## Patrones y publicación pública

Los patrones Nu y Mercado Pago del lector directo siguen con `validated: false`: las muestras existentes son sintéticas. Revisa cada detección. Para validarlos hacen falta 3 o 4 comprobantes reales anonimizados que conserven asunto, estructura MIME/HTML, etiquetas de monto y dominio del remitente. Cambia nombres, cuentas, CLABE, referencias y cantidades manteniendo el formato. Agrega fixtures y pruebas antes de activar un patrón. Un remitente configurado no valida por sí solo el formato.

`gmail.readonly` permite técnicamente leer el buzón; el filtro de Guardadito limita su consulta. Google lo clasifica como scope restringido. El modo Testing exige usuarios de prueba y puede requerir reconexiones por la expiración de sus autorizaciones. Distribuir la conexión para terceros puede requerir verificación de Google. La alternativa local no necesita OAuth.

## Si algo falla

| Síntoma | Qué revisar |
| --- | --- |
| Gmail aparece “Por habilitar” | `check:setup`, `/api/status` y compilación con `VITE_API_ORIGIN` cuando corresponda |
| `redirect_uri_mismatch` en Google | Callback exacto del backend en Cloud Console, incluyendo protocolo, puerto y ruta |
| Regresa a Pages pero no conecta | Misma pestaña, `WEB_APP_URL` exacta, sesión no expirada; inicia la conexión otra vez |
| Funciona una vez y luego pierde la sesión | Redis REST y `SESSION_SECRET` estable en todas las invocaciones |
| No encuentra depósitos | Remitente exacto, últimos 90 días, consulta paginada y estado real de los correos; revisa los patrones pendientes |
| Importación local sin monto o fecha | Captúralos al revisar; los datos ambiguos no se adivinan |
| Correo que ya registraste a mano | Vincula al movimiento sugerido; no confirmes otro depósito si es el mismo |

Banxico y Bitso son conexiones independientes; su setup sigue en el [README](../README.md). Guardadito no custodia ni mueve dinero.
