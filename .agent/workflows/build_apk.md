---
description: Cómo generar el APK de Android
---

Sigue estos pasos para generar el archivo instalable (APK) de tu aplicación:

1.  **Abrir Android Studio**:
    Ejecuta el siguiente comando en tu terminal:
    ```bash
    npm run cap:open:android
    ```
    Esto abrirá Android Studio con tu proyecto cargado.

2.  **Esperar Sincronización**:
    Al abrirse, verás una barra de progreso en la parte inferior derecha. Espera a que termine y diga "Gradle sync finished" o deje de cargar.

3.  **Generar el APK**:
    *   Ve al menú superior: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
    *   Aparecerá una notificación "Build APK(s)" en la esquina inferior derecha cuando termine.

4.  **Localizar el Archivo**:
    *   En la notificación que aparece, haz clic en el enlace azul **locate**.
    *   Se abrirá una carpeta con el archivo `app-debug.apk`.

5.  **Instalar**:
    *   Copia ese archivo a tu tablet o móvil.
    *   Ábrelo e instálalo.
