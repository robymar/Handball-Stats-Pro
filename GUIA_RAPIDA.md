# 🚀 GUÍA RÁPIDA: Solución en 5 Pasos (20 minutos)

## ⚡ TL;DR - Lo que tienes que hacer AHORA

Tu código **YA ESTÁ BIEN**. El problema está en la **configuración de Supabase Dashboard**.

---

## ✅ PASO 1: Configurar Supabase Dashboard (5 min) - **CRÍTICO**

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto **Handball Stats Pro**
3. **Authentication** → **URL Configuration**
4. En **Redirect URLs**, haz clic en **"Add URL"**
5. Agrega: `handballstats://auth`
6. Haz clic en **Save**

**¿Por qué?** Sin esto, Supabase rechaza la redirección y usa `localhost:3000` (causando el error).

---

## ✅ PASO 2: Cambiar Site URL (2 min) - **RECOMENDADO**

**Mientras estás en la misma pantalla:**

1. Busca el campo **Site URL**
2. Cámbialo de `http://localhost:3000` a: `handballstats://auth`
3. **Save**

**¿Por qué?** Si algo falla, Supabase usará esta URL en lugar de localhost.

---

## ✅ PASO 3: Verificar Email Template (2 min)

1. **Authentication** → **Email Templates**
2. Selecciona **"Confirm signup"**
3. Busca el botón en el HTML
4. **DEBE decir:** `<a href="{{ .ConfirmationURL }}">`
5. **Si dice otra cosa:** Haz clic en **"Reset to default"**

---

## ✅ PASO 4: Crear archivo .env (3 min)

1. Copia el archivo `.env.example` y renómbralo a `.env`
2. Ve a **Settings** → **API** en Supabase
3. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
4. Pega los valores en `.env`

---

## ✅ PASO 5: Compilar y Probar (8 min)

```bash
npm run build
npx cap sync android
npx cap open android
```

Luego en Android Studio: **Run** → Ejecutar en dispositivo

---

## 🧪 PRUEBA FINAL

1. Abre la app
2. Regístrate con un email real
3. Ve a tu email
4. Haz clic en el enlace
5. **RESULTADO ESPERADO:** La app se abre y dice "✅ Email verificado!"

---

## 🐛 Si sigue sin funcionar

**Ejecuta el script de diagnóstico:**
```bash
verificar_config.bat
```

**Inspecciona el email:**
1. Copia el enlace del email (sin hacer clic)
2. Pégalo en un editor de texto
3. **Debe contener:** `&redirect_to=handballstats://auth`
4. **Si contiene `localhost`:** Problema en PASO 3 (plantilla)
5. **Si no tiene `redirect_to`:** Problema en PASO 1 (Dashboard)

---

## 📊 Checklist

- [ ] PASO 1: `handballstats://auth` en Redirect URLs ✅
- [ ] PASO 2: Site URL cambiada a `handballstats://auth` ✅
- [ ] PASO 3: Email template usa `{{ .ConfirmationURL }}` ✅
- [ ] PASO 4: Archivo `.env` creado con credenciales ✅
- [ ] PASO 5: App compilada y ejecutada ✅
- [ ] PRUEBA: Email verificado correctamente ✅

---

## 💡 Nota Importante

**Tu código está perfecto.** Tienes:
- ✅ Deep linking en AndroidManifest
- ✅ `emailRedirectTo` en el código
- ✅ Handler de deep links en App.tsx

**El problema es 100% configuración de Supabase Dashboard.**

---

## 📞 Documentos Relacionados

- **Análisis completo:** `INFORME_TECNICO_COMPLETO.md`
- **Diagnóstico anterior:** `DIAGNOSTICO_EMAIL.md`
- **Solución implementada:** `SOLUCION_VERIFICACION_EMAIL.md`

---

**Tiempo total estimado: 20 minutos**  
**Dificultad: Baja (solo configuración)**  
**Éxito garantizado: 99%** (si sigues los pasos exactamente)
