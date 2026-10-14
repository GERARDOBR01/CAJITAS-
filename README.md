# Cajitas ✦

PWA de ahorro en español de México. React + Vite, mascota SVG, datos locales y una función serverless Node para las integraciones.

**Alcance: Fases 1 y 2.** Sin contratos inteligentes, custodia, pagos ni transferencias. El candado es de compromiso, no bancario: el dinero sigue disponible en la app externa.

## Arranque local

Requiere Node 24 LTS (recomendado) o Node 22.12+, y npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Abre `http://localhost:5173`. Sin credenciales puedes usar las metas, los registros y respaldos. Las conexiones muestran su configuración pendiente; **no hay tasas inventadas**.

`npm run dev` sirve React y `/api/*` con el mismo handler de la función serverless. `npm run build` genera `dist`. `npm run preview` permite revisar la PWA construida, pero no ejecuta las APIs; para integraciones usa desarrollo o Vercel.

## Funciones

- Metas con nombre, monto MXN, fecha de desbloqueo y proveedor: Nu, Mercado Pago, Bitso u Otra.
- Registro en centavos, historial, progreso, racha de días consecutivos y confeti al cruzar el 100%.
- Mascota Caji que crece con el progreso agregado. Retiro anticipado con confirmación, tristeza temporal y mensaje sin culpa. Solo registra movimientos, no los realiza.
- Plan del ahorro restante por semana o cada 15 días. Permite ampliar la fecha cuando el plan resulte pesado. Desbloqueo a medianoche en la zona horaria del dispositivo.
- “Ir a apartar” abre el sitio oficial del proveedor, compatible con dispositivos; el usuario accede a su app y aparta allí. No se usan deep links privados ni operaciones automatizadas.
- Simulador con Banxico, fecha de publicación por serie y comparación con la tasa capturada. Interés simple, base 365, tasa constante, antes de impuestos/comisiones, sin reinversión. TIIE es referencia interbancaria, no un producto de ahorro.
- Gmail OAuth de lectura, búsqueda por remitentes exactos, revisión, asignación recordada y deduplicación por ID de correo. Patrones actuales **pendientes de validar**; cada detección requiere revisión. El registro automático está implementado para patrones validados con cajita recordada del mismo proveedor, pero está desactivado para los fixtures actuales.
- Bitso opcional de consulta; el saldo consultado permanece separado del ahorro registrado. Cada moneda conserva su unidad.
- Respaldo JSON validado y confirmado antes de reemplazar datos. Un fallo de almacenamiento rechaza el cambio. Datos guardados dañados pueden descargarse y no se sobrescriben hasta restaurar un respaldo válido.
- PWA instalable, disponible sin conexión después de cargar la versión construida. APIs y OAuth requieren internet. El service worker no cachea respuestas API.

## Banxico: obtener el token

1. Abre la [documentación oficial SIE API](https://www.banxico.org.mx/SieAPIRest/service/v1/) y selecciona **Obtener token**. Completa el proceso y copia tu token.
2. En `.env`, configura `BANXICO_TOKEN=...`. **Nunca uses el prefijo `VITE_` para secretos.**
3. Reinicia `npm run dev`. Rendimiento consulta `/api/rates`; el servidor llama a SIE con **`Bmx-Token`**, timeout de 10 segundos y caché en memoria de 5 minutos.

Series verificadas en el [catálogo oficial de instrumentos](https://www.banxico.org.mx/Indicadores/consulta/Instrumentos.action), consultado el 14 de octubre de 2026:

| Serie | Referencia |
| --- | --- |
| `SF43783` | TIIE a 28 días, diaria |
| `SF282` | CETES a 28 días, semanal |

Endpoint: `GET https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43783,SF282/datos/oportuno`. Datos ausentes o `N/E` se muestran como no disponibles. Fallos de API no se sustituyen por tasas de ejemplo.

## Gmail OAuth y comprobantes

1. Crea un proyecto Google Cloud y habilita **Gmail API**.
2. Configura la pantalla de consentimiento. Agrega tu cuenta como usuario de prueba si está en modo Testing.
3. Crea credenciales **OAuth client ID → Web application**. Autoriza la URI de redirección `http://localhost:5173/api/gmail/callback` (y la equivalente HTTPS al desplegar).
4. Configura `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_ORIGIN` y `SESSION_SECRET` en el servidor. Genera un secreto de sesión aleatorio de al menos 32 caracteres:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. De tus comprobantes reales, toma los remitentes exactos y configura `GMAIL_NU_SENDERS` y `GMAIL_MP_SENDERS`, separados por comas. **No hay direcciones adivinadas.** No uses los remitentes `.example.invalid` de los fixtures en producción.
6. Reinicia y entra en Conexiones → Conectar Gmail. Se solicita únicamente `https://www.googleapis.com/auth/gmail.readonly`. “Buscar depósitos” consulta los últimos 90 días, sin spam/papelera, en páginas de 20 mensajes. “Consultar más comprobantes” continúa la paginación.

El scope permite leer el buzón, aunque Cajitas filtra comprobantes por remitente. Google clasifica `gmail.readonly` como restringido; publicar para usuarios externos puede requerir su proceso de verificación. Consulta los [scopes oficiales](https://developers.google.com/workspace/gmail/api/auth/scopes) y [OAuth de servidor](https://developers.google.com/workspace/gmail/api/auth/web-server).

OAuth usa state ligado al navegador, PKCE y cookies HttpOnly/SameSite con ID opaco. Los tokens viven cifrados en el servidor; no llegan a localStorage, respaldos ni JSON del cliente. En desarrollo se guardan en `.local/` (ignorado por Git). Producción requiere Redis REST. Desconectar borra los tokens de la sesión y solicita su revocación en Google.

### Parser: validación pendiente

`server/parser.js` contiene `nu-deposit-v1` y `mp-deposit-v1`, ambos `validated: false`. `tests/fixtures/receipts.js` contiene correos **sintéticos**, no muestras reales anonimizadas ni validación del formato de las instituciones. El parser exige remitente exacto, DKIM alineado según Authentication-Results de Google, asunto de depósito recibido, monto único MXN/pesos y fecha válida. Ignora pendientes, fallidos, promociones, monedas desconocidas y montos ambiguos.

Para ajustar patrones, hacen falta 3 o 4 correos de Nu y Mercado Pago anonimizados, conservando asunto, estructura MIME/HTML, etiquetas, separadores del monto y dominio del remitente. Sustituye nombres, CLABE, cuentas, referencias y cantidades por datos ficticios con el mismo formato. Agrega fixtures y pruebas antes de cambiar `validated` a `true`. Mientras estén pendientes, recordar una cajita solo preselecciona el destino: no elimina la revisión.

Cada correo aceptado o ignorado deja un ID hash persistente para no contarlo de nuevo. La consulta es manual, sin lectura de fondo. Un correo demuestra un depósito, **no el saldo actual**. Antes de aceptar un correo, revisa si ya registraste ese depósito manualmente: no se deduplica un movimiento manual contra un correo sin identificador común.

## Bitso: llave de solo balances

1. Activa 2FA en Bitso y crea una llave en la sección de API. [Guía oficial de credenciales](https://docs.bitso.com/bitso-api/docs/2-generate-your-api-credentials).
2. Habilita únicamente **Ver balances / View balances**. Deja deshabilitados permisos de operar, retirar, transferir y otros accesos.
3. Guarda `BITSO_API_KEY` y `BITSO_API_SECRET` en el `.env` del servidor. Define `BITSO_OWNER_PASSWORD` como contraseña aleatoria de **16 caracteres o más**, independiente de la contraseña de Bitso, y configura `SESSION_SECRET`.
4. En Conexiones introduce esa contraseña de acceso → Habilitar consulta → Consultar saldo. La llave nunca se captura en la interfaz. Cerrar acceso elimina la autorización de la sesión.

Esta conexión es **personal para el dueño de la instalación**: una llave representa una cuenta. Conectar Gmail no autoriza consultar Bitso. Una versión multiusuario requeriría llaves y autorización por usuario, fuera de esta entrega.

Solo se llama a `GET https://bitso.com/api/v3/balance/`, con HMAC-SHA256 de `nonce + GET + /api/v3/balance/`. Nonce monotónico, compartido en Redis al desplegar. No existen rutas que muevan dinero. Este endpoint no permite comprobar los permisos adicionales de una llave; créala con el permiso mínimo. [Balance oficial](https://docs.bitso.com/bitso-api/docs/get-account-balance), [firma oficial](https://docs.bitso.com/bitso-api/docs/create-signed-requests).

## Despliegue serverless

Incluye `api/router.js` y `vercel.json` para Vercel: una función Node atiende `/api/*`, Vite genera el frontend. No se ha desplegado automáticamente.

- Configura las variables de `.env.example` en los secretos del hosting; no subas `.env`.
- Usa `APP_ORIGIN=https://tu-dominio` y registra la redirección HTTPS en Google.
- Para Gmail/Bitso configura `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` de Redis compatible con Upstash REST. Sesiones cifradas AES-256-GCM con `SESSION_SECRET`, con expiración y compartidas entre invocaciones. El servidor rechaza usar disco temporal como almacén de sesiones de producción.
- Si solo usas metas y Banxico, Redis y variables de Gmail/Bitso son opcionales.
- Rotar `SESSION_SECRET` invalida las sesiones anteriores; vuelve a conectar.

No se envían ni modifican correos. Sin scraping ni librerías no oficiales de Nu/Mercado Pago. `google-auth-library`, oficial, se usa únicamente en el servidor. `.env`, sesiones, dependencias y compilación están ignorados.

## Verificación

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Tests unitarios: parser, Banxico con API mockeada, firma Bitso, centavos, rachas, respaldos y deduplicación. Tests del handler: sesiones, rechazo de mutaciones sin Origin, PKCE/state de un solo uso y Gmail filtrado por remitente con proveedores mockeados.

Playwright usa **Chromium a 390 × 844** y ejecuta `npm run dev`. Cubre crear meta, countdown, ahorro, retiro anticipado, confirmación, meta alcanzada y confeti, persistencia tras recarga y exportar/restaurar respaldo. También simulador sin credenciales y Gmail mockeado. Las capturas se regeneran en `docs/screenshots/`.

**Llamadas autenticadas reales pendientes:** Banxico, Gmail y Bitso requieren credenciales del dueño. Las capturas de conexiones usan datos sintéticos, no cuentas reales.

| Captura móvil | Vista |
| --- | --- |
| [Inicio](docs/screenshots/01-inicio-mobile.png) | Primera cajita |
| [Meta y countdown](docs/screenshots/02-meta-countdown-mobile.png) | Plan semanal |
| [Retiro anticipado](docs/screenshots/03-retiro-confirmacion-mobile.png) | Confirmación |
| [Meta alcanzada](docs/screenshots/04-meta-alcanzada-mobile.png) | Celebración |
| [Simulador](docs/screenshots/05-simulador-mobile.png) | Token pendiente y tasa capturada |
| [Conexiones](docs/screenshots/06-conexiones-mobile.png) | Depósito sintético por revisar |

Los iconos PWA se regeneran desde la mascota SVG con `node scripts/generate-icons.js` (requiere Chromium instalado).
