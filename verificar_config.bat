@echo off
echo ========================================
echo VERIFICACION DE CONFIGURACION SUPABASE
echo ========================================
echo.

REM Verificar si existe .env
if exist .env (
    echo [OK] Archivo .env encontrado
    echo.
    echo Contenido del .env:
    echo -----------------------------------
    type .env
    echo -----------------------------------
    echo.
) else (
    echo [ERROR] Archivo .env NO encontrado
    echo.
    echo SOLUCION:
    echo 1. Copia el archivo .env de tu otro ordenador
    echo 2. O crea uno nuevo basado en .env.example
    echo 3. Rellena con tus credenciales de Supabase
    echo.
    echo Para crear .env desde .env.example:
    echo    copy .env.example .env
    echo.
    pause
    exit /b 1
)

REM Verificar que las variables no estén vacías
findstr /C:"VITE_SUPABASE_URL=YOUR_SUPABASE" .env >nul
if %errorlevel% equ 0 (
    echo [ERROR] VITE_SUPABASE_URL no esta configurada
    echo Por favor edita .env y agrega tu URL de Supabase
    echo.
)

findstr /C:"VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE" .env >nul
if %errorlevel% equ 0 (
    echo [ERROR] VITE_SUPABASE_ANON_KEY no esta configurada
    echo Por favor edita .env y agrega tu clave de Supabase
    echo.
)

REM Verificar AndroidManifest.xml
echo Verificando AndroidManifest.xml...
if exist android\app\src\main\AndroidManifest.xml (
    findstr /C:"handballstats" android\app\src\main\AndroidManifest.xml >nul
    if %errorlevel% equ 0 (
        echo [OK] Deep link 'handballstats://' configurado en AndroidManifest.xml
    ) else (
        echo [ERROR] Deep link NO encontrado en AndroidManifest.xml
    )
) else (
    echo [ERROR] AndroidManifest.xml no encontrado
)
echo.

REM Verificar que supabase.ts existe
if exist services\supabase.ts (
    echo [OK] Archivo services\supabase.ts encontrado
) else (
    echo [ERROR] Archivo services\supabase.ts NO encontrado
)
echo.

echo ========================================
echo PROXIMOS PASOS:
echo ========================================
echo.
echo 1. Si falta .env: Copialo de tu otro ordenador o crealo
echo 2. Configura Redirect URLs en Supabase Dashboard:
echo    - Ve a Authentication ^> URL Configuration
echo    - Agrega: handballstats://auth
echo.
echo 3. Compila la app:
echo    npm run build
echo    npx cap sync android
echo.
echo 4. Prueba el registro con un email real
echo.
echo 5. Si sigue sin funcionar, ejecuta:
echo    npx cap run android
echo    Y mira los logs en Android Studio
echo.
pause
