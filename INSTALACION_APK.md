# Guía de Instalación del APK - Handball Stats Pro

## 📱 Ubicación del APK

El APK de debug se encuentra en:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

**Tamaño del archivo**: Aproximadamente 5-10 MB

## 🚀 Instalación en Tablet Android

### Opción 1: Transferencia por Cable USB

1. **Conecta tu tablet** al ordenador mediante cable USB
2. **Copia el archivo APK** a la tablet:
   - Abre el explorador de archivos de Windows
   - Navega a tu tablet en "Este equipo"
   - Copia `app-debug.apk` a la carpeta `Downloads` de la tablet
3. **En la tablet**:
   - Abre la app "Archivos" o "Mis archivos"
   - Ve a la carpeta "Descargas"
   - Toca el archivo `app-debug.apk`
4. **Permite la instalación**:
   - Si aparece un mensaje de "Fuente desconocida", toca "Configuración"
   - Activa "Permitir desde esta fuente"
   - Vuelve atrás y toca "Instalar"
5. **Abre la aplicación** una vez instalada

### Opción 2: Transferencia Inalámbrica

#### Usando Google Drive / OneDrive / Dropbox:
1. Sube `app-debug.apk` a tu servicio de nube
2. En la tablet, descarga el archivo desde la app de nube
3. Toca el archivo descargado para instalarlo
4. Sigue los pasos 4-5 de la Opción 1

#### Usando Email:
1. Envíate el APK por email como adjunto
2. En la tablet, abre el email y descarga el adjunto
3. Toca el archivo descargado para instalarlo
4. Sigue los pasos 4-5 de la Opción 1

## ⚠️ Notas Importantes

### APK de Debug vs Release
- Este es un **APK de debug** (desarrollo)
- Android mostrará advertencias de seguridad al instalar
- Es completamente seguro, pero no está firmado con certificado de producción
- Para uso personal está perfectamente bien

### Permisos
La aplicación puede solicitar permisos para:
- Almacenamiento (para guardar estadísticas)
- Acceso a archivos (para exportar datos)

### Actualizaciones
Para actualizar la aplicación:
1. Compila un nuevo APK siguiendo el proceso de compilación
2. Instala el nuevo APK sobre la versión existente
3. Los datos se conservarán automáticamente

## 🔧 Solución de Problemas

### "No se puede instalar la aplicación"
- **Solución**: Ve a Configuración → Seguridad → Activar "Orígenes desconocidos"

### "Aplicación no instalada"
- **Solución**: Desinstala la versión anterior primero
- O asegúrate de que hay suficiente espacio en la tablet

### "Análisis del paquete con error"
- **Solución**: El archivo APK puede estar corrupto
- Vuelve a copiar el archivo desde el ordenador

## 📋 Requisitos del Sistema

- **Android**: 5.0 (Lollipop) o superior
- **Espacio**: ~20 MB libres
- **RAM**: 1 GB mínimo recomendado

## 🔄 Recompilar el APK

Si necesitas recompilar el APK en el futuro:

```bash
# 1. Compilar la aplicación web
npm run build

# 2. Sincronizar con Capacitor
npm run cap:sync

# 3. Compilar el APK
cd android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\rober\AppData\Local\Android\Sdk"
.\gradlew.bat assembleDebug
```

El nuevo APK estará en la misma ubicación: `android\app\build\outputs\apk\debug\app-debug.apk`
