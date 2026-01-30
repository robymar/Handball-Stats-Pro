# 🔍 DIAGNÓSTICO: Verificación de Email en Supabase

## ✅ CÓDIGO YA IMPLEMENTADO

**BUENAS NOTICIAS:** Tu código **SÍ tiene** el manejo de deep links implementado correctamente en `App.tsx` (líneas 1959-2098).

El código maneja:
- ✅ PKCE Flow (más seguro)
- ✅ Implicit Flow (fallback)
- ✅ Manejo de errores
- ✅ Feedback con Toast
- ✅ Redirección automática

---

## 🔧 PASOS PARA SOLUCIONAR EL PROBLEMA

### 1. **CREAR ARCHIVO `.env`** (URGENTE)

Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_publica_aqui
```

**¿Dónde encontrar estos valores?**
1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **API**
4. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

---

### 2. **CONFIGURAR REDIRECT URLs EN SUPABASE** (CRÍTICO)

Ve a tu proyecto de Supabase Dashboard:

1. **Authentication** → **URL Configuration**
2. En **Redirect URLs**, agrega:
   ```
   handballstats://auth
   ```
3. **Guarda los cambios**

**IMPORTANTE:** Si no agregas esta URL, Supabase rechazará la redirección y el email no funcionará.

---

### 3. **VERIFICAR CONFIGURACIÓN DE EMAIL**

En Supabase Dashboard:

1. **Authentication** → **Providers** → **Email**
2. Asegúrate que esté **habilitado**
3. Verifica que **"Confirm email"** esté **activado**
4. Opcional: Personaliza el template del email si quieres

---

### 4. **VERIFICAR EMAIL TEMPLATE**

En Supabase Dashboard:

1. **Authentication** → **Email Templates** → **Confirm signup**
2. Verifica que el template incluya:
   ```html
   <a href="{{ .ConfirmationURL }}">Confirmar email</a>
   ```

**NOTA:** El `{{ .ConfirmationURL }}` debe incluir automáticamente el `redirect_to` que configuraste.

---

## 🧪 CÓMO PROBAR

### Paso 1: Compilar la app
```bash
npm run build
npx cap sync android
```

### Paso 2: Abrir en Android Studio
```bash
npx cap open android
```

### Paso 3: Ejecutar y probar
1. Abre la app en un dispositivo/emulador Android
2. Regístrate con un email **real** (no temporal)
3. Ve a tu bandeja de entrada
4. Haz clic en el enlace de verificación
5. La app debería abrirse automáticamente
6. Deberías ver un Toast: "✅ ¡Email confirmado correctamente!"

---

## 🐛 SI SIGUE SIN FUNCIONAR

### Opción 1: Ver logs en tiempo real

```bash
# Ejecuta la app y mira los logs
npx cap run android

# En otra terminal, filtra los logs relevantes:
adb logcat | findstr /i "deep link supabase auth"
```

Busca mensajes como:
- `📱 App opened with URL: handballstats://auth?code=...`
- `🔐 PKCE Flow detected`
- `✅ Código intercambiado exitosamente`
- `❌ Error al intercambiar código: ...`

### Opción 2: Probar deep link manualmente

```bash
# Asegúrate que la app está abierta, luego ejecuta:
adb shell am start -a android.intent.action.VIEW -d "handballstats://auth?code=test123"
```

Deberías ver en los logs:
```
📱 App opened with URL: handballstats://auth?code=test123
🔐 PKCE Flow detected
```

Si NO ves estos logs, el problema está en el `AndroidManifest.xml`.

### Opción 3: Verificar AndroidManifest.xml

Abre `android/app/src/main/AndroidManifest.xml` y verifica que tenga:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="handballstats" android:host="auth" />
</intent-filter>
```

---

## 🔍 POSIBLES PROBLEMAS Y SOLUCIONES

### Problema 1: "El enlace no abre la app"
**Causa:** `AndroidManifest.xml` mal configurado o app no compilada
**Solución:**
```bash
npx cap sync android
npx cap run android
```

### Problema 2: "La app se abre pero no pasa nada"
**Causa:** El código no está detectando el deep link
**Solución:** Verifica los logs con `adb logcat`

### Problema 3: "Error: invalid code"
**Causa:** El código ya fue usado o expiró
**Solución:** Solicita un nuevo email de verificación desde la app (botón "Reenviar Email")

### Problema 4: "Error: redirect_to not allowed"
**Causa:** No agregaste `handballstats://auth` en Redirect URLs de Supabase
**Solución:** Ve a Supabase Dashboard → Authentication → URL Configuration

### Problema 5: "El email nunca llega"
**Causa:** Email bloqueado o en spam
**Solución:**
- Revisa la carpeta de spam
- Usa un email de Gmail/Outlook (no temporales)
- Verifica en Supabase Dashboard → Authentication → Users si el usuario aparece

---

## 📊 CHECKLIST DE VERIFICACIÓN

Marca cada item cuando lo completes:

- [ ] Archivo `.env` creado con credenciales correctas
- [ ] `handballstats://auth` agregado en Redirect URLs de Supabase
- [ ] Email confirmation habilitado en Supabase
- [ ] App compilada con `npm run build && npx cap sync android`
- [ ] Probado registro con email real
- [ ] Email recibido en bandeja de entrada
- [ ] Clic en enlace del email
- [ ] App se abre automáticamente
- [ ] Toast de confirmación aparece
- [ ] Login funciona correctamente

---

## 💡 INFORMACIÓN ADICIONAL

### ¿Por qué puede fallar?

1. **Sin `.env`:** La app no puede conectarse a Supabase
2. **Redirect URL no configurada:** Supabase rechaza la redirección
3. **Código expirado:** Los códigos de verificación expiran en 24 horas
4. **App no sincronizada:** Cambios en `AndroidManifest.xml` no aplicados

### ¿Cómo funciona el flujo?

```
1. Usuario se registra
   ↓
2. Supabase envía email con:
   https://tuproyecto.supabase.co/auth/v1/verify?
   token=XXX&type=signup&redirect_to=handballstats://auth
   ↓
3. Usuario hace clic
   ↓
4. Navegador redirige a:
   handballstats://auth?code=YYY
   ↓
5. Android abre tu app (AndroidManifest.xml)
   ↓
6. App detecta deep link (App.tsx línea 1962)
   ↓
7. App llama a exchangeCodeForSession(code)
   ↓
8. Supabase verifica y marca email como confirmado
   ↓
9. App muestra Toast de éxito
   ↓
10. Usuario puede iniciar sesión
```

---

## 🆘 SI NADA FUNCIONA

Envíame:

1. **Logs completos** de `adb logcat` cuando haces clic en el enlace
2. **Screenshot** del email de verificación que recibes
3. **Screenshot** de la configuración de Redirect URLs en Supabase
4. **Contenido** de tu archivo `.env` (oculta las claves reales)

---

## ✅ PRÓXIMOS PASOS

1. **Copia el `.env` de tu otro ordenador** o créalo con tus credenciales
2. **Configura Redirect URLs en Supabase Dashboard**
3. **Compila y prueba:** `npm run build && npx cap sync android`
4. **Verifica los logs** mientras pruebas
5. **Reporta** cualquier error que veas en los logs

