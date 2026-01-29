# 🔍 GUÍA VISUAL: Cómo Encontrar URL Configuration en Supabase

## 📍 Ubicación Exacta - Varias Rutas Posibles

Supabase ha cambiado su interfaz varias veces. Aquí están **TODAS** las ubicaciones posibles:

---

## 🎯 OPCIÓN 1: Authentication → URL Configuration (Más Común)

### Paso a Paso:

1. **En el Dashboard de Supabase** (https://supabase.com/dashboard)
   - Deberías ver tu proyecto en el listado
   
2. **Selecciona tu proyecto** (click en el nombre)

3. **En el menú lateral IZQUIERDO**, busca el ícono 🔒 **Authentication**
   - Es un candado o shield
   - Está en la barra lateral izquierda
   
4. **Click en Authentication**
   - Se expandirá un submenú

5. **Busca en el submenú:**
   ```
   Authentication
   ├── Users
   ├── Policies  
   ├── Providers (o "Configuration")
   ├── Email Templates
   └── URL Configuration  ← AQUÍ
   ```

6. **Click en "URL Configuration"**

---

## 🎯 OPCIÓN 2: Settings → Auth (Alternativa)

Si NO encuentras "URL Configuration" en Authentication:

1. **En el menú lateral IZQUIERDO**, busca ⚙️ **Settings** (abajo del todo)

2. **Click en Settings**

3. **Busca en el submenú lateral:**
   ```
   Settings
   ├── General
   ├── Database
   ├── API
   ├── Auth  ← AQUÍ
   ├── Storage
   └── ...
   ```

4. **Click en "Auth"**

5. **Scroll hacia abajo** hasta encontrar:
   - **"Site URL"**
   - **"Redirect URLs"**

---

## 🎯 OPCIÓN 3: Authentication → Providers → Email

Otra ubicación posible:

1. **Authentication** (menú lateral izquierdo)

2. **Providers** (o "Configuration")

3. **Click en "Email"**

4. **Scroll abajo** en esa página

5. Busca secciones:
   - **"Redirect URLs"**
   - **"Site URL"**

---

## 🖼️ GUÍA VISUAL - Cómo Se Ve

### La Página de URL Configuration se ve así:

```
╔════════════════════════════════════════════════════════╗
║  URL Configuration                                      ║
╠════════════════════════════════════════════════════════╣
║                                                         ║
║  Site URL                                               ║
║  ┌─────────────────────────────────────────────────┐  ║
║  │ https://yourapp.com                              │  ║
║  └─────────────────────────────────────────────────┘  ║
║                                                         ║
║  Redirect URLs                                          ║
║  ┌─────────────────────────────────────────────────┐  ║
║  │ https://yourapp.com/**                           │  ║
║  │ http://localhost:3000                            │  ║
║  │ + Add another URL                                │  ║
║  └─────────────────────────────────────────────────┘  ║
║                                                         ║
║  Additional Redirect URLs (opcional)                   ║
║  ┌─────────────────────────────────────────────────┐  ║
║  │                                                   │  ║
║  └─────────────────────────────────────────────────┘  ║
║                                                         ║
║                                    [ Save ]             ║
╚════════════════════════════════════════════════════════╝
```

---

## ✅ QUÉ DEBES CONFIGURAR (Sea cual sea la ubicación)

Una vez que encuentres la configuración de URLs:

### 1. **Site URL:**
```
handballstats://auth
```

### 2. **Redirect URLs:** (añade TODAS estas)

Haz click en **"+ Add another URL"** para cada una:

```
handballstats://auth
```
*(Añadir)* ✚

```
handballstats://auth/**
```
*(Añadir)* ✚

```
handballstats://**
```
*(Añadir)* ✚

```
http://localhost:*
```
*(Añadir)* ✚

```
http://localhost:5173
```
*(Añadir)* ✚

```
http://127.0.0.1:*
```
*(Añadir)* ✚

### 3. **GUARDAR** ¡No olvides hacer click en "Save"!

---

## 🔍 SI AÚN NO LO ENCUENTRAS...

### Busca con CTRL+F (o ⌘+F en Mac)

1. En la página del dashboard de Supabase
2. Presiona **Ctrl+F** (o ⌘+F)
3. Busca: **"redirect"** o **"site url"**
4. Te llevará directamente a la configuración

---

## 🆘 ALTERNATIVA: Configurar desde Project Settings

Si realmente no lo encuentras, puedes configurarlo desde aquí:

1. **Settings** (menú lateral izquierdo, abajo)

2. **General**

3. **Scroll hacia abajo** hasta ver:
   ```
   ┌─────────────────────────────────────────────────┐
   │ Configuration                                    │
   ├─────────────────────────────────────────────────┤
   │                                                  │
   │ API Settings                                     │
   │ ├─ Project URL: https://xxx.supabase.co         │
   │ ├─ ...                                           │
   │                                                  │
   │ Auth Settings                                    │
   │ ├─ Site URL: [AQUÍ]                             │
   │ ├─ Redirect URLs: [AQUÍ]                        │
   │ └─ ...                                           │
   └─────────────────────────────────────────────────┘
   ```

---

## 📸 SCREENSHOTS DE REFERENCIA

### Ruta completa visual:

```
Dashboard Principal
    │
    ├─► Seleccionar Proyecto
    │       │
    │       ├─► Menú Lateral Izquierdo
    │              │
    │              ├─► 🔒 Authentication
    │              │       │
    │              │       ├─► Users
    │              │       ├─► Policies
    │              │       ├─► Providers
    │              │       ├─► Email Templates
    │              │       └─► URL Configuration ◄── AQUÍ
    │              │
    │              └─► ⚙️ Settings
    │                      │
    │                      └─► Auth ◄── O AQUÍ
    │
    └─► [Tu proyecto]
```

---

## 💡 TIPS PARA ENCONTRARLO

### 1. **Versión Nueva de Supabase (2024+)**
```
Authentication → URL Configuration
```

### 2. **Versión Anterior**
```
Settings → Auth → Redirect URLs
```

### 3. **Versión Muy Antigua**
```
Authentication → Settings (tab arriba) → Redirect URLs
```

---

## 🎨 INTERFAZ ALTERNATIVA

En algunas versiones, puede haber **TABS (pestañas)** dentro de Authentication:

```
╔════════════════════════════════════════════════════╗
║  Authentication                                     ║
╠════════════════════════════════════════════════════╣
║                                                     ║
║  [Users] [Policies] [Providers] [Templates] [URLs] ║
║    ^                                           ^    ║
║    └─ Tabs horizontales arriba ────────────────┘   ║
║                                                     ║
║  Haz click en la tab "URLs" →                      ║
╚════════════════════════════════════════════════════╝
```

---

## ⚡ SOLUCIÓN RÁPIDA

Si después de todo esto NO lo encuentras, puedes:

### Opción A: Usar la API de Supabase

Configura las URLs directamente contactando con soporte o usando la CLI.

### Opción B: Contactar Soporte

1. En el dashboard, busca el botón de **"Help"** o **"Support"**
2. Pregunta: "¿Dónde configuro Redirect URLs para Auth?"
3. Te darán la ubicación exacta para tu versión

---

## 🎯 CONFIGURACIÓN MÍNIMA NECESARIA

Si encuentras **solo** el campo "Redirect URLs" sin "Site URL", no pasa nada.

**SOLO añade esto en Redirect URLs:**

```
handballstats://auth
handballstats://auth/**
http://localhost:*
```

Eso es **suficiente** para que funcione la autenticación.

---

## 📝 CHECKLIST DE VERIFICACIÓN

Una vez que encuentres y configures:

```
□ He encontrado la sección de URLs
□ He añadido "handballstats://auth" en Site URL (si existe)
□ He añadido todas las Redirect URLs:
  □ handballstats://auth
  □ handballstats://auth/**
  □ http://localhost:*
□ He hecho click en SAVE/Guardar
□ Puedo ver las URLs guardadas cuando recargo la página
```

---

## 🆘 SI SIGUES SIN ENCONTRARLO

**Dime exactamente qué ves en tu pantalla:**

1. ¿Qué opciones ves en el menú lateral izquierdo?
2. ¿Qué opciones ves dentro de "Authentication"?
3. ¿Qué opciones ves dentro de "Settings"?

Con esa información te puedo guiar exactamente. 👍

---

## 🎉 UNA VEZ ENCONTRADO

Cuando lo encuentres:

1. ✅ Configura las URLs como se indica arriba
2. 💾 Guarda los cambios
3. 🧪 Vuelve a la guía principal para continuar con los siguientes pasos

**¡No te rindas! Está ahí, solo que la interfaz varía por versión.** 💪
