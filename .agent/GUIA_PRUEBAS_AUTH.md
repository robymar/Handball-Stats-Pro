# 🧪 GUÍA DE PRUEBAS - Sistema de Autenticación Cloud

## ✅ ESTADO ACTUAL

### Configuración Completada:
- ✅ **Código de la app**: Todas las mejoras implementadas
- ✅ **Archivo .env**: Credenciales configuradas
- ✅ **Supabase Dashboard**: Email Auth + Redirect URLs configurados
- ✅ **Compilación**: Sin errores

**Estado:** 🎉 **LISTO PARA PROBAR**

---

## 🎯 TEST 1: Verificar Conexión (1 minuto)

### Paso 1: Abrir la App
```
El servidor de desarrollo está corriendo en:
http://localhost:5173
```

### Paso 2: Verificar que no hay errores
1. Abre la app en el navegador
2. Abre DevTools (F12)
3. Ve a la pestaña **Console**
4. NO deberías ver errores de "Supabase no está configurado"

**✅ Resultado esperado:** La app carga sin errores de Supabase

---

## 🎯 TEST 2: Registro de Usuario Nuevo (5 minutos)

### Paso 1: Ir a Cloud Sync
1. En la app, busca el botón **"Cloud"** o **"Cloud Sync"**
2. Haz click en él

### Paso 2: Ir a Registro
1. Haz click en **"¿No tienes cuenta? Regístrate"**
2. Verás un formulario de registro

### Paso 3: Completar el Formulario
```
Nombre Completo: [Tu Nombre]
Email:           [tu-email@gmail.com]
Contraseña:      [mínimo 6 caracteres]
```

### Paso 4: Enviar Registro
1. Haz click en **"Registrarse"**
2. Deberías ver un mensaje tipo:
   ```
   ¡Registro exitoso! 📧
   
   Te hemos enviado un email de confirmación a:
   tu-email@gmail.com
   
   Por favor revisa tu bandeja de entrada...
   ```

**✅ Resultado esperado:** Mensaje de confirmación mostrado

### Paso 5: Revisar Console (DevTools)
En la consola deberías ver:
```
🔐 Auth Event: INITIAL_SESSION
```

**✅ Resultado esperado:** No hay errores en consola

---

## 🎯 TEST 3: Confirmación por Email (5 minutos)

### Paso 1: Revisar Bandeja de Entrada
1. Abre tu email (Gmail, Outlook, etc.)
2. Busca email de **"noreply@supabase.io"** o **"Supabase"**
3. **IMPORTANTE:** Si no lo ves, revisa **SPAM/Correo no deseado**

### Paso 2: Abrir el Email
El email debería tener:
- **Subject:** Algo como "Confirm Your Email" o lo que configuraste
- **Contenido:** Un enlace/botón de confirmación

### Paso 3: Clic en el Enlace
1. Haz click en el enlace de confirmación
2. Si estás en **móvil con la app instalada**:
   - Debería abrir la app automáticamente
   - Verás un Toast: "✅ ¡Email confirmado!"
   
3. Si estás en **navegador web**:
   - Te redirigirá a `handballstats://auth` (puede mostrar error en navegador)
   - Esto es NORMAL en web, funciona en móvil

**✅ Resultado esperado (móvil):** App se abre y muestra confirmación

**✅ Resultado esperado (web):** Puedes confirmar manualmente en el dashboard

---

## 🎯 TEST 4: Login con Email Confirmado (2 minutos)

### Paso 1: Volver a la App
1. Si estás en móvil y la app se abrió, ya estás dentro
2. Si estás en web, vuelve a http://localhost:5173

### Paso 2: Ir a Login
1. Ve a **"Cloud Sync"** o **"Login"**
2. Introduce:
   ```
   Email:      [el que registraste]
   Contraseña: [la que pusiste]
   ```

### Paso 3: Hacer Login
1. Haz click en **"Entrar"** o **"Iniciar Sesión"**
2. Deberías ver:
   ```
   ✅ ¡Sesión iniciada correctamente!
   ```
3. La vista debería cambiar a **"Cloud Sync"** con opciones de:
   - Subir Todo a la Nube
   - Descargar Todo de la Nube

**✅ Resultado esperado:** Login exitoso, vista de Cloud Sync

### Paso 4: Verificar Console
En DevTools debería aparecer:
```
🔐 Auth Event: SIGNED_IN tu-email@gmail.com
```

**✅ Resultado esperado:** Usuario autenticado correctamente

---

## 🎯 TEST 5: Intentar Login SIN Confirmar Email (2 minutos)

Para verificar que la seguridad funciona:

### Paso 1: Registra OTRO Usuario
1. Usa un email diferente (ej: test2@gmail.com)
2. Completa el registro
3. **NO confirmes el email** (no hagas click en el enlace)

### Paso 2: Intentar Login
1. Intenta hacer login con ese email
2. Deberías ver un **ERROR**:
   ```
   ⚠️ Tu email aún no ha sido confirmado.
   
   Revisa tu bandeja de entrada y haz clic en el enlace de confirmación.
   ```

**✅ Resultado esperado:** Login bloqueado, mensaje de error claro

---

## 🎯 TEST 6: Recuperación de Contraseña (3 minutos)

### Paso 1: Ir a "Olvidé mi Contraseña"
1. En la pantalla de login
2. Haz click en **"¿Olvidaste tu contraseña?"**

### Paso 2: Introducir Email
1. Escribe tu email (el confirmado)
2. Haz click en enviar

### Paso 3: Revisar Email
1. Deberías recibir otro email de Supabase
2. Con un enlace de **"Reset Password"**

### Paso 4: Cambiar Contraseña
1. Haz click en el enlace
2. Si estás en móvil: App se abre en modo "Cambiar Contraseña"
3. Introduce nueva contraseña
4. Guarda

**✅ Resultado esperado:** Contraseña cambiada exitosamente

---

## 🎯 TEST 7: Sincronización de Datos (5 minutos)

### Paso 1: Crear Datos Locales
1. Sal de Cloud Sync (vuelve a la app)
2. Crea un equipo de prueba
3. Crea un partido de prueba

### Paso 2: Subir a la Nube
1. Ve a Cloud Sync
2. Haz click en **"Subir Todo a la Nube"**
3. Deberías ver:
   ```
   Subida completada: 1 equipos y 1 partidos subidos.
   ```

**✅ Resultado esperado:** Datos sincronizados correctamente

### Paso 3: Verificar en Dashboard de Supabase
1. Ve a: https://supabase.com/dashboard/project/clqocaxcvjyruqpwjiki
2. Ve a: **Table Editor**
3. Busca tabla **"teams"** y **"matches"**
4. Deberías ver tu equipo y partido

**✅ Resultado esperado:** Datos visibles en Supabase

---

## 🎯 TEST 8: Polling Automático - Detección de Confirmación (NUEVO)

### Paso 1: Registrar Usuario
1. Completa el formulario de registro
2. Envía el formulario
3. Observa la pantalla

**✅ Resultado esperado:**
- Mensaje de "Revisa tu email"
- Aparece sección azul con mensaje "⏳ Esperando confirmación de email..."
- Dos botones visibles:
  - "Reenviar Email de Confirmación"
  - "Usar App Offline (Confirmar Más Tarde)"

### Paso 2: Confirmar Email en Dispositivo
1. Abre el email en tu teléfono/computadora
2. Haz clic en el enlace de confirmación
3. **NO cierres la app** - mantén la pantalla de registro visible
4. Espera **máximo 5 segundos**

**✅ Resultado esperado:**
- La app detecta automáticamente la confirmación
- Aparece mensaje: "✅ ¡Email confirmado! Ya puedes iniciar sesión."
- Después de 2 segundos, cambia automáticamente a pantalla de Login
- Sección azul desaparece

**📄 En Console (F12):**
```
Checking email confirmation...
✅ Email confirmed!
Switching to login mode...
```

### Paso 3: Iniciar Sesión
1. Introduce email y contraseña
2. Haz login

**✅ Resultado esperado:** Login exitoso sin errores

---

## 🎯 TEST 9: Reenvío de Email y Modo Offline (NUEVO)

### Flujo A: Reenviar Email

#### Paso A.1: Registrar y Esperar
1. Registra un usuario nuevo
2. **NO abras el email** todavía
3. Observa la pantalla de espera

#### Paso A.2: Simular Email Perdido
1. Haz clic en "Reenviar Email de Confirmación"
2. Observa el loading

**✅ Resultado esperado:**
- Botón muestra "Enviando..."
- Después: Mensaje verde "📧 Email reenviado correctamente. Revisa tu bandeja de entrada (y spam)."

#### Paso A.3: Verificar Segundo Email
1. Revisa tu bandeja de entrada
2. Deberías tener **2 emails** de confirmación
3. Haz clic en cualquiera de los dos

**✅ Resultado esperado:** Ambos links funcionan (son válidos)

### Flujo B: Modo Offline

#### Paso B.1: Elegir Modo Offline
1. Registra un usuario
2. Haz clic en "Usar App Offline (Confirmar Más Tarde)"

**✅ Resultado esperado:**
- Vuelve a la pantalla principal de la app
- Puedes usar la app normalmente (modo offline)

#### Paso B.2: Usar App Sin Confirmar
1. Crea un equipo
2. Crea un partido
3. Juega normalmente

**✅ Resultado esperado:** Todo funciona en modo local

#### Paso B.3: Intentar Sincronizar
1. Ve a Cloud Sync
2. Intenta hacer Login

**✅ Resultado esperado:**
- Muestra error: "Email aún no confirmado"
- Aparece automáticamente la sección azul con botones
- Puedes hacer clic en "Reenviar Email"

#### Paso B.4: Confirmar y Sincronizar
1. Ve a tu email
2. Confirma el email
3. Vuelve a la app
4. Haz login

**✅ Resultado esperado:**
- Login exitoso
- Puedes sincronizar tus datos

---

## 🔍 TROUBLESHOOTING

### ❌ Problema: "Email no llega"

**Soluciones:**
1. ✅ Revisa SPAM/Correo no deseado
2. ✅ Espera 1-2 minutos (puede tardar)
3. ✅ Verifica en Supabase Dashboard → Authentication → Logs
4. ✅ Intenta con otro email (Gmail suele funcionar mejor)

---

### ❌ Problema: "Error al hacer login"

**Soluciones:**
1. ✅ Verifica que confirmaste el email
2. ✅ Revisa Console (F12) para ver el error exacto
3. ✅ Verifica credenciales (email y contraseña correctos)
4. ✅ Mira en Supabase Dashboard → Authentication → Users
   - El usuario debe tener `email_confirmed_at` con fecha
   - Si es `null`, no está confirmado

---

### ❌ Problema: "Deep link no funciona en móvil"

**Soluciones:**
1. ✅ Verifica que compilaste después de los cambios:
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```
2. ✅ Verifica `AndroidManifest.xml` tiene el scheme `handballstats://`
3. ✅ Reinstala la app completamente

---

### ❌ Problema: "Usuario no puede hacer login después de confirmar"

**Soluciones:**
1. ✅ Cierra sesión completamente
2. ✅ Recarga la app
3. ✅ Intenta login de nuevo
4. ✅ Verifica en Dashboard que `email_confirmed_at` NO sea `null`

---

## 📊 CHECKLIST DE VERIFICACIÓN

```
TESTS OBLIGATORIOS:
□ Test 1: Conexión a Supabase sin errores
□ Test 2: Registro de usuario nuevo
□ Test 3: Email de confirmación llega
□ Test 4: Login con email confirmado funciona
□ Test 5: Login SIN confirmar email falla (seguridad)

TESTS OPCIONALES:
□ Test 6: Recuperación de contraseña
□ Test 7: Sincronización de datos

VERIFICACIÓN EN CONSOLA:
□ No hay errores de Supabase
□ Logs de auth aparecen con emojis 🔐
□ Deep links se procesan correctamente
```

---

## 🎉 SI TODO FUNCIONA

**¡FELICIDADES!** 🎊

Tu sistema de autenticación cloud está:
- ✅ Completamente funcional
- ✅ Seguro (verificación de email obligatoria)
- ✅ Con mensajes claros al usuario
- ✅ Listo para producción

**Próximos pasos:**
1. Compila la versión de producción
2. Genera el APK
3. Prueba en dispositivos reales
4. ¡Distribuye tu app!

---

## 📝 LOGS ESPERADOS

### Consola del Navegador (Registro):
```
🔐 Auth Event: INITIAL_SESSION
```

### Consola del Navegador (Login):
```
🔐 Auth Event: SIGNED_IN tu-email@gmail.com
```

### Consola del Navegador (Deep Link en móvil):
```
📱 App opened with URL: handballstats://auth#access_token=...
🔐 Deep Link Type: signup
✅ Sesión establecida: signup
```

---

## 🆘 SI NECESITAS AYUDA

1. **Captura de pantalla** del error
2. **Console logs** (F12 → Console)
3. **Supabase Logs** (Dashboard → Authentication → Logs)
4. Dime exactamente en qué paso te quedaste

---

**Fecha de pruebas:** 26 de enero de 2026  
**Versión de la app:** 1.1.69  
**Estado:** ✅ LISTO PARA PROBAR

¡Buena suerte con las pruebas! 🚀
