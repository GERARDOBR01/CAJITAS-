# Aplicaciones de Cajitas para Android y iPhone

La misma interfaz web se empaqueta dentro de proyectos Capacitor 8.5.3. El contenido de `dist` está incluido en la aplicación: no se depende de una página remota para abrir Cajitas. Identificador: `mx.cajitas.ahorro`. Nombre: **Cajitas**.

## Android: APK de prueba

La entrega 0.4 se distribuye como [APK de prueba](https://github.com/GERARDOBR01/CAJITAS-/releases/tag/v0.4.0-preview.1). La pantalla de instalación web también enlaza esa descarga. El proyecto iOS se incluye en el código fuente; su instalación nativa requiere Xcode y firma de Apple.

Requisitos: Node compatible con `package.json`, JDK 21 y Android SDK con plataforma 36, build-tools 35.0.0 y platform-tools. Android Gradle Plugin 8.13 utiliza build-tools 35.0.0 con la plataforma 36. La configuración actual admite Android 7.0 / API 24 o superior.

```bash
npm ci
export ANDROID_HOME=/ruta/al/android-sdk
node scripts/android-build.mjs
```

El script compila la interfaz, sincroniza Android, ejecuta `assembleDebug` y copia el APK a `../artifacts/cajitas-android-test.apk`, junto con su SHA-256. Acepta `--output /ruta/cajitas.apk` y `--skip-web-build` cuando `dist` ya es la compilación definitiva. En este entorno el SDK está en `/workspace/.local/android-sdk` y el JDK completo en `/workspace/.local/jdk-21`; el script los detecta y el APK queda fuera del repositorio en `/workspace/artifacts`. En otra máquina configurar `JAVA_HOME` si el JDK no está en PATH.

Para instalar por USB:

```bash
adb install -r ../artifacts/cajitas-android-test.apk
```

También se puede abrir el APK en Android y autorizar la instalación desde la aplicación que lo abre. Es un paquete firmado con una clave **de depuración**, destinado a pruebas. Para distribuir en Google Play, crear una clave de publicación fuera del repositorio, configurar firma release en Android Studio y generar un AAB de publicación. Nunca subir claves, contraseñas o credenciales de proveedor.

## iPhone: proyecto para Xcode

El proyecto iOS está en `ios/App/App.xcodeproj` y usa Swift Package Manager. Requiere macOS, Xcode 26 o superior y iOS 15 o superior.

```bash
npm ci
npm run build:native
npx cap sync ios
npx cap open ios
```

En Xcode seleccionar el equipo de Apple Developer en **Signing & Capabilities**, un iPhone o simulador y ejecutar **Run**. Para TestFlight/App Store seleccionar dispositivo genérico, **Product > Archive**, y distribuir con la cuenta Apple correspondiente. No hay un IPA generado desde Linux ni una publicación en App Store. `PrivacyInfo.xcprivacy` incluye los motivos de acceso a preferencias locales y marcas de tiempo de los archivos usados por los plugins.

## Conexiones y funciones nativas

Android sirve los recursos internos como `https://localhost`; iOS usa `capacitor://localhost`. El retorno de autorización abre `cajitas://auth`, registrado en ambos proyectos. Las credenciales de Google, Banxico y Bitso permanecen en el servidor.

Si se necesitan conexiones remotas, compilar con `VITE_API_ORIGIN` apuntando a un servidor HTTPS público, y permitir los orígenes nativos mediante `NATIVE_APP_ORIGINS` en ese servidor. Seguir las instrucciones de conexiones del README para configurar las credenciales del servidor. Sin ese origen la aplicación funciona localmente; no se debe configurar `server.url` de Capacitor para producción.

Los proyectos incluyen App, Browser, Filesystem, Haptics, Local Notifications, Preferences y Share. Las notificaciones solicitan permiso al usuario; no se registra permiso de alarmas exactas. Android gestiona los bordes con SystemBars, que expone `--safe-area-inset-*`; la interfaz utiliza estos valores para respetar cámaras y gestos.

Android desactiva el backup automático de la app para que los identificadores de sesión no viajen con la copia del sistema. El respaldo JSON explícito lleva metas, mascota y visitas, sin sesiones ni claves. Al restaurarlo se desactiva el recordatorio: actívalo de nuevo en Mi mascota en ese dispositivo. La versión 0.4 tiene build number 4 en ambos proyectos.

Las APIs reales requieren un backend HTTPS desplegado y las credenciales del dueño. El APK de prueba sin `VITE_API_ORIGIN` contiene toda la experiencia local, pero no puede consultar Banxico/Gmail/Bitso. No se inventa una dirección de servidor. Añade la URL pública, recompila y sincroniza para activar las conexiones. El botón de descarga web admite un enlace público mediante `VITE_ANDROID_DOWNLOAD_URL`.

Después de cambiar la interfaz ejecutar `npm run build:native` y `npx cap sync`. Para regenerar los iconos y pantallas de inicio desde el icono web:

```bash
mkdir -p .local/native-assets
cp public/icon-512.png .local/native-assets/logo.png
npm exec --yes --package=@capacitor/assets@3.0.5 -- capacitor-assets generate --android --ios --assetPath .local/native-assets --iconBackgroundColor '#fff7ef' --iconBackgroundColorDark '#fff7ef' --splashBackgroundColor '#fff7ef' --splashBackgroundColorDark '#fff7ef'
```
