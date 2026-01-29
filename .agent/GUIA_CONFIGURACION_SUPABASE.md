# 🔧 Guía Paso a Paso: Configuración de Supabase para Handball Stats Pro

## 📋 Índice de Configuración

1. [Acceso al Dashboard](#1-acceso-al-dashboard)
2. [Authentication Settings](#2-authentication-settings)
3. [Email Templates](#3-email-templates)
4. [URL Configuration](#4-url-configuration)
5. [Security Settings](#5-security-settings)
6. [Verificación Final](#6-verificación-final)

---

## 1. Acceso al Dashboard

### Paso 1.1: Iniciar Sesión
1. Ve a: **https://supabase.com/dashboard**
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto (Handball Stats Pro)

### Paso 1.2: Identificar tu Proyecto
- Nombre del proyecto: `[Tu nombre de proyecto]`
- Project ID: `[Lo verás en la URL]`

---

## 2. Authentication Settings

### Paso 2.1: Navega a Authentication
```
Dashboard (lado izquierdo) → Authentication → Configuration
```

### Paso 2.2: Providers - Email
1. Busca la sección **"Providers"**
2. Haz clic en **"Email"**
3. Verifica/Configura lo siguiente:

#### ✅ Configuración Recomendada:
```
┌─────────────────────────────────────────────────────┐
│ Email Auth Settings                                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ☑ Enable email provider                             │
│                                                      │
│ ☑ Confirm email                                      │
│   └─ Users must confirm their email before login    │
│                                                      │
│ ☑ Secure email change                               │
│   └─ Require email verification when changing       │
│                                                      │
│ ☐ Enable email OTP (opcional)                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Paso 2.3: GUARDAR
**¡IMPORTANTE!** Haz clic en **"Save"** al final de la página.

---

## 3. Email Templates

### Paso 3.1: Navega a Email Templates
```
Dashboard → Authentication → Email Templates
```

### Paso 3.2: Configurar "Confirm signup"

#### A. Selecciona la plantilla
1. Haz clic en **"Confirm signup"**
2. Verás un editor con HTML/texto

#### B. Ejemplo de Template Recomendado

**Subject:**
```
Confirma tu email - Handball Stats Pro
```

**Body (puedes usar este):**
```html
<h2>¡Bienvenido a Handball Stats Pro!</h2>

<p>Hola,</p>

<p>Gracias por registrarte en Handball Stats Pro, la mejor app para gestionar estadísticas de balonmano.</p>

<p>Para activar tu cuenta y comenzar a sincronizar tus datos en la nube, confirma tu email haciendo clic en el siguiente enlace:</p>

<p>
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #2563eb; color: white; padding: 12px 24px; 
            text-decoration: none; border-radius: 8px; display: inline-block; 
            font-weight: bold;">
    Confirmar Email
  </a>
</p>

<p>O copia y pega este enlace en tu navegador:</p>
<p>{{ .ConfirmationURL }}</p>

<p><strong>💡 Importante:</strong> Este enlace expira en 24 horas.</p>

<p>Si no has creado esta cuenta, puedes ignorar este email.</p>

<hr>
<p style="color: #64748b; font-size: 12px;">
  Handball Stats Pro - Tu asistente de estadísticas de balonmano
</p>
```

#### C. Variables Importantes
**CRÍTICO:** El template DEBE incluir `{{ .ConfirmationURL }}`

Otras variables disponibles:
- `{{ .Email }}` - Email del usuario
- `{{ .Token }}` - Token de confirmación
- `{{ .TokenHash }}` - Hash del token
- `{{ .SiteURL }}` - URL de tu sitio

#### D. GUARDAR
Haz clic en **"Save"** arriba a la derecha.

---

### Paso 3.3: Configurar "Reset Password"

#### A. Selecciona la plantilla
1. Haz clic en **"Reset password"**
2. Edita el template

#### B. Ejemplo de Template

**Subject:**
```
Restablece tu contraseña - Handball Stats Pro
```

**Body:**
```html
<h2>Restablece tu contraseña</h2>

<p>Hola,</p>

<p>Has solicitado restablecer tu contraseña para Handball Stats Pro.</p>

<p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>

<p>
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #2563eb; color: white; padding: 12px 24px; 
            text-decoration: none; border-radius: 8px; display: inline-block; 
            font-weight: bold;">
    Cambiar Contraseña
  </a>
</p>

<p>O copia y pega este enlace en tu navegador:</p>
<p>{{ .ConfirmationURL }}</p>

<p><strong>💡 Importante:</strong> Este enlace expira en 1 hora.</p>

<p>Si no has solicitado cambiar tu contraseña, puedes ignorar este email de forma segura.</p>

<hr>
<p style="color: #64748b; font-size: 12px;">
  Handball Stats Pro - Tu asistente de estadísticas de balonmano
</p>
```

#### C. GUARDAR
Haz clic en **"Save"**.

---

## 4. URL Configuration

### Paso 4.1: Navega a URL Configuration
```
Dashboard → Authentication → URL Configuration
```

### Paso 4.2: Configurar Site URL

**Site URL:**
```
handballstats://auth
```

📝 **Nota:** Para apps móviles nativas, usa el deep link scheme.

### Paso 4.3: Configurar Redirect URLs

Añade TODAS estas URLs (una por línea):

```
handballstats://auth
handballstats://auth/**
handballstats://**
http://localhost:*
http://localhost:5173
http://localhost:5173/**
http://127.0.0.1:*
```

**Ejemplo visual:**
```
┌─────────────────────────────────────────────────────┐
│ Redirect URLs                                        │
├─────────────────────────────────────────────────────┤
│  handballstats://auth                               │
│  handballstats://auth/**                            │
│  handballstats://**                                 │
│  http://localhost:*                                 │
│  http://localhost:5173                              │
│  http://localhost:5173/**                           │
│  http://127.0.0.1:*                                 │
│                                                      │
│  [ + Add another URL ]                              │
└─────────────────────────────────────────────────────┘
```

### Paso 4.4: GUARDAR
Haz clic en **"Save"**.

---

## 5. Security Settings

### Paso 5.1: Navega a Settings
```
Dashboard → Settings → API
```

### Paso 5.2: Verificar Keys

Anota estas claves (ya deberías tenerlas en tu `.env`):

```env
VITE_SUPABASE_URL=https://[tu-proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG....[tu-clave-anon]
```

### Paso 5.3: Configuración Avanzada

Ve a: **Settings → General**

#### Rate Limiting (Opcional pero Recomendado)

Busca **"Rate Limits"** y configura:
```
Email Sign Up:        10 per hour
Password Sign In:     20 per hour  
Password Reset:       5 per hour
```

Esto previene spam y ataques de fuerza bruta.

---

## 6. Verificación Final

### Paso 6.1: Checklist de Verificación

Usa este checklist para confirmar que todo está configurado:

```
✅ CHECKLIST DE CONFIGURACIÓN
────────────────────────────────────────

AUTHENTICATION SETTINGS:
□ Email provider habilitado
□ "Confirm email" activado
□ "Secure email change" activado

EMAIL TEMPLATES:
□ "Confirm signup" configurado
  □ Subject actualizado
  □ Body incluye {{ .ConfirmationURL }}
  □ Guardado correctamente

□ "Reset password" configurado
  □ Subject actualizado
  □ Body incluye {{ .ConfirmationURL }}
  □ Guardado correctamente

URL CONFIGURATION:
□ Site URL = handballstats://auth
□ Redirect URLs incluye:
  □ handballstats://auth
  □ handballstats://auth/**
  □ http://localhost:*
□ Guardado correctamente

SECURITY:
□ API Keys verificadas
□ Rate limiting configurado (opcional)

GENERAL:
□ Sin errores en el dashboard
□ Todas las configuraciones guardadas
```

### Paso 6.2: Test Manual

Para verificar que todo funciona:

1. **En el Dashboard de Supabase:**
   ```
   Authentication → Users → Invite User
   ```
   
2. **Envía un email de prueba a ti mismo**

3. **Revisa tu bandeja de entrada:**
   - ✅ Email debe llegar
   - ✅ Subject debe ser el configurado
   - ✅ Enlace debe funcionar

---

## 📱 Configuración Específica para PKCE Flow

### IMPORTANTE para Seguridad Máxima

Si quieres usar PKCE flow (recomendado):

1. Ve a: **Settings → General**
2. Busca **"Auth Settings"**
3. Asegúrate que **"PKCE flow"** esté habilitado

```
┌─────────────────────────────────────────────────────┐
│ Auth Flow Type                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ○ Implicit Flow (legacy)                            │
│ ● PKCE Flow (recommended)                           │
│                                                      │
│ ℹ PKCE provides additional security by using        │
│   code challenges instead of direct tokens          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Selecciona:** ● PKCE Flow

---

## 🔍 Troubleshooting

### Problema 1: Email no llega
**Solución:**
1. Verifica que "Confirm email" esté activado
2. Revisa spam/junk
3. En Dashboard → Authentication → Logs
   - Busca errores de envío de email
4. Verifica que el template tenga `{{ .ConfirmationURL }}`

### Problema 2: Enlace no funciona
**Solución:**
1. Verifica Redirect URLs
2. Asegúrate que incluye `handballstats://auth`
3. Verifica que la app tenga el deep link configurado en `AndroidManifest.xml`

### Problema 3: Usuario no puede hacer login
**Solución:**
1. Ve a Authentication → Users
2. Busca al usuario
3. Verifica columna `email_confirmed_at`:
   - Si es `null`: Email no confirmado
   - Si tiene fecha: Email confirmado

### Problema 4: Tokens inválidos
**Solución:**
1. Ve a Settings → API
2. Verifica que las keys en `.env` coincidan
3. Regenera keys si es necesario (¡actualiza `.env`!)

---

## 💡 Mejores Prácticas

### 1. **Testing**
- Usa un email de prueba primero
- Verifica que todo funcione antes de compartir la app

### 2. **Seguridad**
- Nunca compartas tu `service_role` key
- Usa solo `anon` key en la app
- Mantén rate limiting activo

### 3. **Templates**
- Personaliza los templates con tu marca
- Usa un tono amigable
- Incluye instrucciones claras

### 4. **Monitoring**
- Revisa regularmente Authentication → Logs
- Monitorea tasa de confirmación de emails
- Detecta patrones sospechosos

---

## 📚 Recursos Adicionales

### Documentación Oficial
- **Auth Guides:** https://supabase.com/docs/guides/auth
- **Email Templates:** https://supabase.com/docs/guides/auth/auth-email-templates
- **Deep Linking:** https://supabase.com/docs/guides/auth/auth-deep-linking
- **PKCE Flow:** https://supabase.com/docs/guides/auth/auth-deep-linking/auth-deep-linking-pkce

### Community
- **Discord:** https://discord.supabase.com
- **GitHub:** https://github.com/supabase/supabase

---

## ✅ Configuración Completada

Una vez que hayas completado todos los pasos:

1. ✅ Marca cada ítem del checklist
2. 🧪 Realiza un test de registro completo
3. 🎉 ¡Tu app está lista para autenticación cloud!

---

## 🎯 Próximos Pasos

Después de configurar Supabase:

1. **Compila la app móvil:**
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```

2. **Prueba el flujo completo:**
   - Registro → Email → Confirmación → Login → Sync

3. **Monitorea:**
   - Revisa logs en Supabase
   - Verifica que los usuarios se confirmen
   - Chequea métricas de autenticación

---

**¿Necesitas ayuda?** Revisa la sección de Troubleshooting o consulta los logs en:
```
Dashboard → Authentication → Logs
```

**Estado:** 📋 **PENDIENTE DE CONFIGURACIÓN**

Una vez completado, cambia a: ✅ **CONFIGURADO**
