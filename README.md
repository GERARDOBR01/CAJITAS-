# Cajitas ✦

## [⬇️ Descargar la app para Android](https://github.com/GERARDOBR01/CAJITAS-/releases/download/v0.3.0-preview.1/Cajitas-0.3.0-android-preview.apk)

**Android 7.0 o posterior · APK de prueba, versión 0.3.** [Abrir Cajitas en la web](https://gerardobr01.github.io/CAJITAS-/) · [Todas las descargas](https://github.com/GERARDOBR01/CAJITAS-/releases/tag/v0.3.0-preview.1)

En Android, abre el APK descargado para instalarlo. Para iPhone puedes instalar la versión web desde Safari con Compartir → Agregar a pantalla de inicio. El proyecto nativo de iPhone requiere Xcode y firma Apple.

PWA de ahorro en español de México. React + Vite, mascota SVG, datos locales y una función serverless Node para las integraciones.

**Versión 0.3:** también incluye proyectos **Android e iPhone con Capacitor**, mascotas personalizables, hábitos y una navegación móvil pensada para usarla como app. [Setup nativo, APK y Xcode](docs/NATIVE-APPS.md).

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

### La nueva experiencia

- Vista previa del aporte semanal o cada 15/30 días antes de crear o editar una meta; muestra cuánto falta y ofrece montos rápidos editables. Ninguna sugerencia crea un depósito por sí sola.
- Registra la fecha real del movimiento. Corrige o elimina registros manuales equivocados desde Actividad, con confirmación antes de eliminar. Cada cambio valida saldos por orden de fecha; se rechaza una corrección que deje un saldo histórico negativo. Los registros vinculados a Gmail conservan su origen y no se editan como registros manuales.
- El gráfico de 14 días y su total siguen la cajita seleccionada; el mes filtra la lista, métricas del periodo y CSV.
- Protección contra consultas lentas y cambios desde otra pestaña que podrían sobrescribir datos más recientes. La vista se actualiza entre pestañas del mismo navegador; los dispositivos siguen siendo independientes.
- Cinco escenas SVG originales: bienvenida, semillas, libreta, mochila de respaldo y jardín de celebración. Movimiento reducible y botón de corrección con área táctil amplia. En el inicio se destaca la compañía; la racha de depósitos queda como información secundaria.

- Cerdito Pipo, vaquita Mila, conejito Luna o Caji: nombre y brote, moñito, bufanda o estrella, con ilustraciones SVG originales.
- Animaciones de parpadeo, caricias, corazones y celebración. Opción de desactivarlas, además de respetar reducir movimiento del dispositivo.
- Visita diaria y cinco niveles de compañía. Un día cuenta una vez aunque tenga varias visitas o depósitos; la cantidad de dinero no determina la amistad. Visitar no registra un depósito.
- Plantillas de sueños, frecuencia de ahorro persistente, edición de nombre/monto/proveedor/fecha y archivo reversible. Archivar conserva dinero e historial y detiene asignaciones automáticas de correo a esa cajita.
- Actividad unificada, gráfico de saldo registrado de 14 días, tabla accesible, filtros por cajita/mes y CSV con protección contra fórmulas en campos de texto.
- Recordatorio semanal: notificación local con permiso en apps nativas, o evento `.ics` para importar en calendario en la web. No realiza transferencias ni añade registros automáticamente. Al restaurar un respaldo hay que activar el recordatorio de nuevo.
- Barra de navegación inferior, zonas seguras y compartir archivos desde el teléfono. En la app nativa se replica el registro local en Preferences; se recupera la copia válida más reciente al abrir.
- Backups v2 incluyen mascota, visitas, frecuencia y archivo; se migran los respaldos v1 sin perder movimientos. Cada instalación tiene sus propios datos: utiliza el respaldo para trasladarlos.

La revisión del [mercado mexicano](docs/research/mexico-market-2026-10.md) compara documentación oficial de Nu, Mercado Pago, BBVA, Banorte, ScotiaMóvil, Fintual y Spendee. Metas y apartados ya existen: no se afirma exclusividad ni superioridad comercial. [Conciliación estudiada con REA](docs/research/rea-matching.md) documenta el patrón de revisión de registros manuales/importados de YNAB, con sus límites y las decisiones propias de Cajitas.

La investigación usó **REA 6.5.0** para observar artículos públicos oficiales de Qapital, Monarch y Finch. [Patrones y decisiones](docs/research/reference-patterns.md), [evidencia y límites](docs/research/rea-evidence.md). Se adaptaron comportamientos con código y arte originales; no se copiaron recursos de esas apps ni se accedió a sus cuentas privadas.

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

Cada correo aceptado, vinculado o ignorado deja un ID hash persistente para no contarlo de nuevo. La consulta es manual, sin lectura de fondo. Un correo demuestra un depósito, **no el saldo actual**. Si hay registros manuales con el mismo monto, proveedor y día local, Cajitas suspende el registro automático y pide revisión. Puedes vincular el correo a un registro existente, incluso archivado, sin cambiar su monto/fecha/ID ni sumar dinero; si es otro depósito, se requiere confirmación explícita. La coincidencia es una sugerencia, no una identidad demostrada. Fechas distintas o montos capturados incorrectamente pueden no producir sugerencias: revisa siempre el comprobante.

## Bitso: llave de solo balances

1. Activa 2FA en Bitso y crea una llave en la sección de API. [Guía oficial de credenciales](https://docs.bitso.com/bitso-api/docs/2-generate-your-api-credentials).
2. Habilita únicamente **Ver balances / View balances**. Deja deshabilitados permisos de operar, retirar, transferir y otros accesos.
3. Guarda `BITSO_API_KEY` y `BITSO_API_SECRET` en el `.env` del servidor. Define `BITSO_OWNER_PASSWORD` como contraseña aleatoria de **16 caracteres o más**, independiente de la contraseña de Bitso, y configura `SESSION_SECRET`.
4. En Conexiones introduce esa contraseña de acceso → Habilitar consulta → Consultar saldo. La llave nunca se captura en la interfaz. Cerrar acceso elimina la autorización de la sesión.

Esta conexión es **personal para el dueño de la instalación**: una llave representa una cuenta. Conectar Gmail no autoriza consultar Bitso. Una versión multiusuario requeriría llaves y autorización por usuario, fuera de esta entrega.

Solo se llama a `GET https://bitso.com/api/v3/balance/`, con HMAC-SHA256 de `nonce + GET + /api/v3/balance/`. Nonce monotónico, compartido en Redis al desplegar. No existen rutas que muevan dinero. Este endpoint no permite comprobar los permisos adicionales de una llave; créala con el permiso mínimo. [Balance oficial](https://docs.bitso.com/bitso-api/docs/get-account-balance), [firma oficial](https://docs.bitso.com/bitso-api/docs/create-signed-requests).

## Publicación web y backend

### GitHub Pages

La web está en [gerardobr01.github.io/CAJITAS-/](https://gerardobr01.github.io/CAJITAS-/), con un botón visible de descarga Android. Pages publica la compilación estática desde `gh-pages` (carpeta raíz). No debe publicar el `index.html` de código fuente de `main`.

```bash
npm run build:pages
npm run preview:pages
# Con acceso Git de escritura configurado:
npm run deploy:pages
```

El script publica únicamente `dist` y `.nojekyll` en la rama de distribución. En Settings → Pages, el origen es Deploy from a branch → gh-pages → /(root). El modo Pages ajusta recursos, manifiesto y service worker al prefijo `/CAJITAS-/`. Metas, mascotas, historial y respaldos funcionan allí; Banxico, Gmail y Bitso requieren el servidor de la aplicación, que Pages no ejecuta. Esa versión muestra las conexiones como no habilitadas y conserva la comparación con tasas capturadas sin inventar referencias.

### Backend

Incluye `api/router.js` y `vercel.json` para Vercel: una función Node atiende `/api/*`, Vite genera el frontend. No se ha desplegado automáticamente.

Para las apps nativas, `VITE_API_ORIGIN` es el origen **público HTTPS** del backend, no un secreto. Hay que definirlo antes de `npm run build:native`. En el servidor, `NATIVE_APP_ORIGINS=capacitor://localhost,https://localhost` habilita únicamente esos origins de Capacitor. La web conserva sus cookies HttpOnly; la app guarda un ID opaco de sesión en Preferences y usa un bearer para consultar el servidor. El código móvil OAuth es de un solo uso, caduca en 60 segundos y exige la prueba de la app que inició la conexión; los tokens de Google permanecen cifrados en el servidor. La app nativa no registra un service worker ni carga una página remota como `server.url`.

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
npm run build:native
# Con JDK 21 y Android SDK instalados:
npm run build:android
```

Tests unitarios: parser, Banxico con API mockeada, firma Bitso, centavos, rachas, respaldos y deduplicación. Tests del handler: sesiones, rechazo de mutaciones sin Origin, PKCE/state de un solo uso y Gmail filtrado por remitente con proveedores mockeados.

Validación de la versión 0.3: **40 tests unitarios**, **16 flujos en Chromium a 390 × 844**, compilaciones web/nativa, APK Android compilado y firma verificada, y sincronización/lectura del proyecto Xcode. Incluye migración v1/v2, check-ins sin dinero, archivo reversible, CSV, calendario, instalación y el intercambio OAuth nativo con Google mockeado. No hay prueba en un dispositivo físico ni una compilación iOS ejecutada en macOS.

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

Las nuevas capturas son de viewport exacto **390 × 844**:

| Captura | Vista |
| --- | --- |
| [Cerdito](docs/screenshots/v2-01-cerdito-mobile.png) | Pipo con moñito |
| [Vaquita](docs/screenshots/v2-02-vaquita-mobile.png) | Mila con bufanda |
| [Conejito](docs/screenshots/v2-03-conejito-mobile.png) | Luna |
| [Meta](docs/screenshots/v2-04-meta-mobile.png) | Plan y movimientos |
| [Actividad](docs/screenshots/v2-05-actividad-mobile.png) | Saldo registrado e historial |
| [Instalación](docs/screenshots/v2-06-instalar-mobile.png) | Oferta de instalación simulada para verificar el flujo |
| [Descarga en Pages](docs/screenshots/v2-07-descarga-pages-mobile.png) | Botón de descarga al inicio de la web |

Los iconos PWA se regeneran desde la mascota SVG con `node scripts/generate-icons.js` (requiere Chromium instalado).

### Refinamiento 0.3

| Captura móvil | Qué verifica |
| --- | --- |
| [Plan antes de crear](docs/screenshots/v3-01-plan-mobile.png) | Aporte estimado por frecuencia |
| [Correo y registro existente](docs/screenshots/v3-02-correo-mobile.png) | Selección explícita sin sumar dos veces |
| [Corrección](docs/screenshots/v3-03-correccion-mobile.png) | Ajuste de error de captura |
| [Actividad filtrada](docs/screenshots/v3-04-actividad-mobile.png) | Saldo e historial de una cajita |
| [Jardín de sueños](docs/screenshots/v3-05-jardin-mobile.png) | Ilustración original y primer paso |

Los correos de estas capturas son sintéticos y las APIs están mockeadas. Los patrones reales de Nu y Mercado Pago siguen pendientes de validar con correos anonimizados.
