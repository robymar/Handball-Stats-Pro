# 📱 GUÍA COMPLETA - Probar Autenticación Cloud en Android

## ✅ COMPILACIÓN COMPLETADA

Se ha completado:
- ✅ Build de producción (npm run build)
- ✅ Sincronización con Capacitor (npx cap sync android)
- ✅ Código con todas las mejoras implementadas
- ✅ Archivo .env con credenciales correctas

**Estado:** 🎉 **LISTO PARA COMPILAR APK Y PROBAR**

---

## 🎯 OPCIÓN 1: Probar en Dispositivo Físico (Recomendado)

### Paso 1: Abrir en Android Studio
```bash
npx cap open android
```

Esto abrirá el proyecto en Android Studio.

### Paso 2: Conectar tu Dispositivo Android
1. Conecta tu móvil por USB
2. Activa **"Depuración USB"** en el móvil:
   - Ajustes → Acerca del teléfono
   - Toca 7 veces en "Número de compilación"
   - Vuelve a Ajustes → Opciones de desarrollo
   - Activa "Depuración USB"

### Paso 3: Ejecutar la App
En Android Studio:
1. Espera a que Gradle sincronice
2. Selecciona tu dispositivo en el dropdown
3. Click en el botón **▶ Run**
4. La app se instalará y abrirá automáticamente

---

## 🎯 OPCIÓN 2: Generar APK para Instalar Manualmente

### Usando el Workflow Existente:

Ya tienes un workflow configurado. Úsalo:

```bash
# Ver el workflow disponible
cat .agent/workflows/build_apk.md
```

O manualmente:

### Paso 1: Abrir Android Studio
```bash
npx cap open android
```

### Paso 2: Generar APK
1. En Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Espera a que compile (puede tardar 2-5 minutos)
3. Cuando termine, verás un mensaje: **"APK(s) generated successfully"**
4. Click en **"locate"** para encontrar el APK

### Paso 3: Ubicación del APK
```
android\app\build\outputs\apk\debug\app-debug.apk
```

### Paso 4: Instalar en tu Móvil
1. Copia el APK a tu móvil (USB, email, Drive, etc.)
2. En el móvil, abre el APK
3. Permite "Instalar desde orígenes desconocidos" si te lo pide
4. Instala la app

---

## 🧪 PRUEBAS EN ANDROID

### TEST 1: Verificar que la App Funciona

1. **Abre la app** en tu móvil
2. Verifica que carga sin errores
3. Navega por las pantallas principales
4. ✅ Todo debería funcionar como antes

---

### TEST 2: Probar Registro Cloud

#### Paso 1: Ir a Cloud Sync
1. En la app, busca el botón **"Cloud"** 💾 (probablemente en la vista de Archivo)
2. Toca el botón

#### Paso 2: Registrarse
1. Toca **"Regístrate"**
2. Completa:
   ```
   Nombre: [Tu nombre]
   Email:  [tu-email-real@gmail.com]
   Contraseña: [mínimo 6 caracteres]
   ```
3. Toca **"Registrarse"**

#### Paso 3: Verificar Mensaje
Deberías ver un mensaje con:
```
¡Registro exitoso! 📧

Te hemos enviado un email de confirmación a:
tu-email@gmail.com

Por favor revisa tu bandeja...
```

**✅ Si ves este mensaje:** Registro funcionó correctamente

---

### TEST 3: Confirmar Email

#### Paso 1: Revisar Email en tu Móvil
1. Abre la app de Email (Gmail, Outlook, etc.)
2. Busca email de **"noreply@supabase.io"**
3. **IMPORTANTE:** Revisa SPAM si no lo ves

#### Paso 2: Abrir el Email
- Subject: "Confirm Your Email" (o personalizado)
- Debería tener un botón/enlace de confirmación

#### Paso 3: Tocar el Enlace
🎯 **MOMENTO CRÍTICO - Aquí se prueba el Deep Link:**

1. **Toca el enlace** en el email
2. Android debería preguntar: **"Abrir con Handball Stats Pro"**
3. Toca **"Abrir"**
4. La app debería:
   - Abrirse automáticamente
   - Mostrar un Toast: **"✅ ¡Email confirmado!"**
   - Redirigir a la vista de Cloud Sync

**✅ Si todo eso pasa:** Deep Links funcionan perfectamente

**❌ Si no funciona:** Ver sección de Troubleshooting abajo

---

### TEST 4: Login con Email Confirmado

#### Paso 1: Ir a Login
Si la app no te llevó automáticamente:
1. Ve a Cloud Sync
2. Si no estás logueado, verás el formulario de login

#### Paso 2: Hacer Login
```
Email:      [el que registraste]
Contraseña: [la que pusiste]
```
Toca **"Entrar"**

#### Paso 3: Verificar Sesión
Deberías ver:
- ✅ Mensaje: "¡Sesión iniciada correctamente!"
- ✅ Vista de Cloud Sync con opciones:
  - 📤 "Subir Todo a la Nube"
  - 📥 "Descargar Todo de la Nube"
  - Tu email mostrado arriba

**✅ Si ves esto:** Login funciona correctamente

---

### TEST 5: Sincronización de Datos

#### Paso 1: Crear Datos de Prueba
1. Sal de Cloud Sync (botón atrás)
2. Crea un equipo de prueba
3. Crea un partido de prueba

#### Paso 2: Subir a la Nube
1. Vuelve a Cloud Sync
2. Toca **"Subir Todo a la Nube"** 📤
3. Deberías ver:
   ```
   Subida completada: 1 equipos y 1 partidos subidos.
   ```

#### Paso 3: Verificar en Supabase
En tu PC:
1. Ve a https://supabase.com/dashboard/project/clqocaxcvjyruqpwjiki
2. Table Editor → **teams**
3. Table Editor → **matches**
4. Deberías ver tus datos

**✅ Si los datos aparecen:** Sincronización funciona

---

## 🔍 TROUBLESHOOTING ANDROID

### ❌ Deep Link NO funciona (no abre la app)

**Síntomas:**
- Tocas el enlace del email
- Android NO pregunta "Abrir con..."
- Se abre en navegador o no pasa nada

**Soluciones:**

#### 1. Verificar AndroidManifest.xml
Asegúrate que tiene el intent-filter:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="handballstats" />
    <data android:scheme="https" />
    <data android:host="handballstats" />
</intent-filter>
```

Si falta algo, añádelo y recompila.

#### 2. Reinstalar la App Completamente
```bash
# Desinstala la app del móvil manualmente
# Luego recompila e instala de nuevo
npm run build
npx cap sync android
npx cap open android
# Run en Android Studio
```

#### 3. Probar Deep Link Manualmente
En tu PC, con el móvil conectado:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "handballstats://auth"
```

Si esto abre la app → intent-filter está bien  
Si no abre → hay problema en AndroidManifest.xml

---

### ❌ Email NO llega

**Soluciones:**
1. ✅ Revisa SPAM/Correo no deseado
2. ✅ Espera 1-2 minutos
3. ✅ Intenta con Gmail (suele ser más confiable)
4. ✅ Verifica en PC: Supabase → Authentication → Logs

---

### ❌ App se Cierra al Abrir (Crash)

**Soluciones:**

#### Ver Logs en Android Studio:
1. Android Studio → **Logcat** (pestaña abajo)
2. Busca líneas rojas (errores)
3. Busca: "handballstats", "supabase", "auth"

#### Logs desde Terminal:
```bash
adb logcat | findstr "handballstats"
```

Copia el error y te ayudo a solucionarlo.

---

### ❌ "Supabase no está configurado"

**Soluciones:**
1. Verifica que `.env` existe y tiene las variables
2. Recompila COMPLETAMENTE:
   ```bash
   npm run build
   npx cap sync android
   # Reinstala en el móvil
   ```

---

## 📱 LOGS EN ANDROID

### Ver Logs en Tiempo Real:

#### Opción 1: Android Studio
```
View → Tool Windows → Logcat
```

Busca:
- `🔐 Auth Event:` - Eventos de autenticación
- `📱 App opened with URL:` - Deep links
- `✅ Sesión establecida:` - Confirmaciones exitosas

#### Opción 2: Terminal (adb)
```bash
adb logcat | findstr "handballstats"
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

```
COMPILACIÓN:
□ npm run build ejecutado sin errores
□ npx cap sync android ejecutado
□ APK generado o app instalada en dispositivo

PRUEBAS BÁSICAS:
□ App abre correctamente
□ Navegación funciona
□ No hay crashes

PRUEBAS DE AUTENTICACIÓN:
□ Registro de usuario funciona
□ Email de confirmación llega
□ Deep link abre la app (CRÍTICO)
□ Toast de confirmación aparece
□ Login funciona después de confirmar
□ Login falla si email NO confirmado

PRUEBAS DE SYNC:
□ Subir datos a la nube funciona
□ Datos aparecen en Supabase Dashboard
□ Descargar datos funciona

LOGS:
□ Console logs con emojis visibles en Logcat
□ No hay errores de Supabase
□ Deep links se procesan correctamente
```

---

## 🎯 COMANDOS RÁPIDOS

### Compilar y Sincronizar:
```bash
npm run build && npx cap sync android
```

### Abrir en Android Studio:
```bash
npx cap open android
```

### Ver Logs del Dispositivo:
```bash
adb logcat | findstr "handballstats"
```

### Reinstalar App:
```bash
# En el móvil: Desinstalar manualmente
npm run build
npx cap sync android
npx cap open android
# Run en Android Studio
```

---

## 🎉 SI TODO FUNCIONA

¡FELICIDADES! 🎊

Tu app Android tiene:
- ✅ Autenticación cloud completamente funcional
- ✅ Deep links funcionando
- ✅ Verificación de email obligatoria
- ✅ Sincronización de datos
- ✅ Mensajes claros al usuario
- ✅ Lista para distribución

**Próximos pasos:**
1. ✅ Genera APK firmado para producción
2. ✅ Prueba en múltiples dispositivos
3. ✅ Sube a Google Play Store

---

## 🆘 SI ALGO FALLA

Dime:
1. **En qué test** te quedaste
2. **Qué error** ves (screenshot o mensaje)
3. **Logs de Logcat** (si la app crashea)
4. **Versión de Android** de tu dispositivo

Con esa info te ayudo específicamente.

---

**Compilado:** ✅  
**Sincronizado:** ✅  
**Estado:** 🚀 **LISTO PARA PROBAR EN ANDROID**

¡Instala la app en tu móvil y prueba el registro! 📱
