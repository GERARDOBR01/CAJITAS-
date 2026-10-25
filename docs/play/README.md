# Guardadito en Google Play

Todo lo que pide Play Console, listo para copiar. Paquete: `mx.guardadito.ahorro`.

## 1. Lo que solo puedes hacer tú

1. **Cuenta de desarrollador**: [play.google.com/console](https://play.google.com/console), pago único de 25 USD y verificación de identidad con INE. Elige cuenta **personal**.
2. **Prueba cerrada obligatoria**: las cuentas personales nuevas necesitan **12 testers con Android durante 14 días seguidos** antes de publicar en producción. Jade usa iPhone, así que no cuenta. Sirven amigos y familia con una cuenta de Google cada uno.
3. Responder los formularios de las secciones 4 a 6 (ya están contestados abajo).

## 2. El paquete firmado (.aab)

- Se compila en GitHub: **Actions → «Paquete para Google Play» → Run workflow**. Al terminar, descarga el artefacto `guardadito-play`, que trae `app-release.aab` para subir a Play y `app-release.apk` para instalar directo.
- También corre solo al crear una etiqueta `v*` (por ejemplo `v0.15.0`).
- **Llave de subida**: `C:\Users\gerar\Documents\Guardadito-Play\upload-key.jks`, con su contraseña en `LEEME-llave.txt`. **Haz una copia de esa carpeta en una USB o en tu nube privada.** En GitHub vive como secreto del repositorio y nunca entra al código.
  - SHA-256 del certificado de subida: `38:31:31:55:4A:E5:3D:58:8F:8B:FF:26:6A:D6:BC:0A:19:87:A1:8E:90:D7:2E:76:96:CC:E1:A7:D6:91:CC:23`
- Activa **Play App Signing** (viene por defecto): Google guarda la llave final y tú solo usas la de subida. Si la pierdes, Play permite reiniciarla.
- Cada versión nueva necesita un `versionCode` mayor en `android/app/build.gradle`. Hoy es 18 (0.18.0).
- La app de la tienda es la versión pública: sin Gmail, Bitso, Banxico ni el APK de prueba (`VITE_OWNER_TOOLS` apagado en el modo `native`).

## 3. Ficha de la tienda

**Nombre** (30 caracteres): `Guardadito: ahorro en pareja`

**Descripción breve** (80): `Metas de ahorro solas o en pareja, con tu mascota. Con cualquier banco.`

**Descripción completa**:

```
Guardadito te acompaña a ahorrar poquito a poquito, sola o en pareja.

Crea cajitas para lo que sueñas (un viaje, unos tenis o tu colchoncito) y registra cada pasito. Tu dinero se queda donde ya lo tienes: Nu, Mercado Pago, tu banco o en efectivo. Guardadito no es un banco y nunca mueve tu dinero: lleva la cuenta clara y te echa porras.

AHORREN JUNTOS
• Vincula tu cuenta con la de tu pareja con un código.
• Cajitas en pareja: definen la meta y la parte de cada quien (mitad y mitad, 60/40…). Cada quien aparta desde su banco y la barra muestra cómo va cada uno, sin comparaciones.
• Mándale sorpresas: notitas, premios que se abren al llegar al 25, 50 o 100 % y una mascota con tus propias palabras.
• Avisos cuando tu pareja aparta para la meta de los dos.

¿NO TIENES CUENTA DE BANCO?
Una persona de confianza puede ser tu guardián: le mandas tu ahorro por transferencia o en efectivo, confirma cuando le llega y los dos ven la misma cuenta.

TU PLAN, A TU RITMO
• Tu siguiente pasito por semana, quincena o mes según tu fecha objetivo.
• Una mascota que crece con tu constancia y nunca te regaña.
• Recordatorios amables, actividad con gráfica, exportar a CSV y papelera para recuperar lo que borraste.

PRIVADA DESDE EL INICIO
Sin cuenta, todo se queda en tu teléfono. Con cuenta, solo tú y tu pareja vinculada ven sus datos. Sin anuncios y sin vender datos.
```

**Categoría**: Finanzas · **Etiquetas**: ahorro, presupuesto · **Correo de contacto**: el correo nuevo de Guardadito (el mismo que va en `CONTACT_EMAIL`, `src/support.js`) · **Sitio web**: https://gerardobr01.github.io/CAJITAS-/

**Gráficos** (en `docs/play/assets/`, se regeneran con `node scripts/play-assets.mjs`, que compila la versión pública y toma las capturas):
- Ícono 512×512: `public/icon-512.png`
- Gráfico destacado 1024×500: `grafico-destacado.png`
- Capturas de teléfono 1080×1920: `1-inicio.png` a `5-mas.png`

## 4. Política de privacidad y borrado de cuenta

- Política de privacidad: https://gerardobr01.github.io/CAJITAS-/privacidad.html
- Borrar cuenta (URL que pide Play): https://gerardobr01.github.io/CAJITAS-/borrar-cuenta.html
- Dentro de la app: Más → Mi cuenta → «Borrar mi cuenta».

## 5. Seguridad de los datos (formulario)

- ¿Recopila o comparte datos? **Sí recopila; no comparte** con terceros. Firebase y Vercel son proveedores de servicio y no cuentan como «compartir».
- ¿Cifrados en tránsito? **Sí** (HTTPS).
- ¿El usuario puede pedir que se borren? **Sí**, en la app y en la URL de arriba.

| Tipo de dato (Play) | Recopilado | Obligatorio | Para qué |
|---|---|---|---|
| Información personal → Correo electrónico | Sí | Solo si crea cuenta (opcional) | Funcionalidad de la app, administración de la cuenta |
| Información personal → Nombre | Sí | Opcional | Funcionalidad de la app |
| Información financiera → Otra información financiera (metas, montos registrados, CLABE del guardián) | Sí | Opcional | Funcionalidad de la app |
| Fotos (premios que manda la pareja) | Sí | Opcional | Funcionalidad de la app |
| Mensajes en la app (notitas) | Sí | Opcional | Funcionalidad de la app |
| Identificadores del dispositivo (dirección de avisos) | Sí | Opcional | Funcionalidad de la app (avisos) |

No recopila ubicación, contactos, historial de navegación, datos de salud ni de pagos con tarjeta. No hay anuncios ni analítica.

## 6. Otros formularios de la consola

- **Anuncios**: no contiene anuncios.
- **Acceso a la app**: todo funciona sin cuenta. Para revisar «Mi pareja», crea dos cuentas de prueba, o deja en la consola una cuenta de prueba con su contraseña.
- **Clasificación de contenido** (IARC): app de utilidad o productividad, sin violencia, sin contenido sexual, sin apuestas. Usuarios que interactúan: **sí**, solo con su pareja vinculada por código, sin chat público. Resultado esperado: «Apto para todos» o PEGI 3.
- **Público objetivo**: 18 años o más. Con 13 a 17 tendrías que cumplir la política de Familias; mejor no marcarlo por ahora.
- **Apps financieras**: declara que **no** ofrece préstamos, inversión, banca ni pagos. Es una herramienta para registrar ahorro y nunca mueve dinero.
- **Gobierno, salud, VPN, noticias**: no aplica.

## 7. Orden sugerido

1. Crear la cuenta de desarrollador y la app «Guardadito».
2. Llenar las secciones 3 a 6.
3. Correr el flujo «Paquete para Google Play», descargar el `.aab` y subirlo a **Prueba cerrada**.
4. Invitar a los 12 testers (con una lista de correos o un Grupo de Google) y esperar 14 días con al menos 12 activos.
5. Solicitar el acceso a **Producción** desde el panel. Google pregunta cómo fue la prueba.

## Límites conocidos de la versión Android

- **Avisos**: la app de Android no recibe avisos todavía, porque el WebView no tiene Web Push. Habría que integrar Firebase Cloud Messaging nativo. Sí puede mandarle avisos a la pareja que usa la web o el iPhone.
- La conexión con Gmail no está habilitada en la app de la tienda.
