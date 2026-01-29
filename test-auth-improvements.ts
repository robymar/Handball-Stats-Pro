/**
 * 🧪 TEST DE VERIFICACIÓN - Sistema de Autenticación Cloud
 * 
 * Este script verifica que todas las mejoras de autenticación
 * estén correctamente implementadas en el código.
 */

import { supabase } from './services/supabase';
import * as fs from 'fs';
import * as path from 'path';

// Colores para la salida
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logTitle(title: string) {
    console.log('\n');
    log('═'.repeat(60), colors.blue);
    log(`  ${title}`, colors.bold + colors.blue);
    log('═'.repeat(60), colors.blue);
}

function checkSuccess(test: string) {
    log(`  ✅ ${test}`, colors.green);
}

function checkWarning(test: string) {
    log(`  ⚠️  ${test}`, colors.yellow);
}

function checkError(test: string) {
    log(`  ❌ ${test}`, colors.red);
}

// Tests
let totalTests = 0;
let passedTests = 0;
let warnings = 0;

logTitle('TEST DE VERIFICACIÓN - AUTENTICACIÓN CLOUD');

// TEST 1: Verificar configuración del cliente Supabase
logTitle('1. Verificando Cliente de Supabase');
totalTests++;

try {
    const supabaseFile = fs.readFileSync('./services/supabase.ts', 'utf-8');

    // Verificar PKCE flow
    if (supabaseFile.includes("flowType: 'pkce'")) {
        checkSuccess('PKCE flow configurado');
        passedTests++;
    } else {
        checkError('PKCE flow NO configurado');
    }

    // Verificar detectSessionInUrl
    totalTests++;
    if (supabaseFile.includes('detectSessionInUrl: true')) {
        checkSuccess('detectSessionInUrl habilitado');
        passedTests++;
    } else {
        checkError('detectSessionInUrl NO habilitado');
    }

    // Verificar autoRefreshToken
    totalTests++;
    if (supabaseFile.includes('autoRefreshToken: true')) {
        checkSuccess('autoRefreshToken configurado');
        passedTests++;
    } else {
        checkError('autoRefreshToken NO configurado');
    }

    // Verificar persistSession
    totalTests++;
    if (supabaseFile.includes('persistSession: true')) {
        checkSuccess('persistSession habilitado');
        passedTests++;
    } else {
        checkError('persistSession NO habilitado');
    }

} catch (err) {
    checkError('Error leyendo services/supabase.ts');
}

// TEST 2: Verificar mejoras en LoginView
logTitle('2. Verificando LoginView.tsx');

try {
    const loginViewFile = fs.readFileSync('./components/LoginView.tsx', 'utf-8');

    // Verificar verificación de email en registro
    totalTests++;
    if (loginViewFile.includes('email_confirmed_at') && loginViewFile.includes('identities?.length')) {
        checkSuccess('Verificación de email en registro implementada');
        passedTests++;
    } else {
        checkError('Verificación de email en registro NO encontrada');
    }

    // Verificar verificación en login
    totalTests++;
    if (loginViewFile.includes('Email not confirmed')) {
        checkSuccess('Verificación de email en login implementada');
        passedTests++;
    } else {
        checkError('Verificación de email en login NO encontrada');
    }

    // Verificar manejo de eventos de auth
    totalTests++;
    const authEvents = [
        'SIGNED_IN',
        'SIGNED_OUT',
        'PASSWORD_RECOVERY',
        'USER_UPDATED',
        'TOKEN_REFRESHED',
        'INITIAL_SESSION'
    ];

    let eventsFound = 0;
    authEvents.forEach(event => {
        if (loginViewFile.includes(`case "${event}"`)) {
            eventsFound++;
        }
    });

    if (eventsFound === authEvents.length) {
        checkSuccess(`Todos los eventos de auth manejados (${eventsFound}/${authEvents.length})`);
        passedTests++;
    } else {
        checkWarning(`Solo ${eventsFound}/${authEvents.length} eventos manejados`);
        warnings++;
    }

} catch (err) {
    checkError('Error leyendo components/LoginView.tsx');
}

// TEST 3: Verificar mejoras en Deep Links
logTitle('3. Verificando Deep Links (App.tsx)');

try {
    const appFile = fs.readFileSync('./App.tsx', 'utf-8');

    // Verificar manejo de errores en deep links
    totalTests++;
    if (appFile.includes("params.get('error')") && appFile.includes("error_description")) {
        checkSuccess('Manejo de errores en deep links implementado');
        passedTests++;
    } else {
        checkError('Manejo de errores en deep links NO encontrado');
    }

    // Verificar diferenciación de tipos
    totalTests++;
    if (appFile.includes("type === 'signup'") && appFile.includes("type === 'recovery'")) {
        checkSuccess('Diferenciación de tipos de confirmación implementada');
        passedTests++;
    } else {
        checkError('Diferenciación de tipos NO encontrada');
    }

    // Verificar feedback con Toast
    totalTests++;
    if (appFile.includes('Toast.show')) {
        checkSuccess('Feedback visual con Toast implementado');
        passedTests++;
    } else {
        checkWarning('Toast no encontrado (puede estar comentado)');
        warnings++;
    }

    // Verificar PKCE flow
    totalTests++;
    if (appFile.includes('exchangeCodeForSession')) {
        checkSuccess('Soporte PKCE flow implementado');
        passedTests++;
    } else {
        checkError('PKCE flow NO encontrado');
    }

    // Verificar redirección automática
    totalTests++;
    if (appFile.includes("setView('LOGIN')")) {
        checkSuccess('Redirección automática implementada');
        passedTests++;
    } else {
        checkWarning('Redirección automática no encontrada');
        warnings++;
    }

} catch (err) {
    checkError('Error leyendo App.tsx');
}

// TEST 4: Verificar variables de entorno
logTitle('4. Verificando Variables de Entorno');

totalTests++;
if (fs.existsSync('.env') || fs.existsSync('.env.local')) {
    checkSuccess('Archivo .env encontrado');
    passedTests++;

    try {
        const envFile = fs.existsSync('.env')
            ? fs.readFileSync('.env', 'utf-8')
            : fs.readFileSync('.env.local', 'utf-8');

        totalTests++;
        if (envFile.includes('VITE_SUPABASE_URL')) {
            checkSuccess('VITE_SUPABASE_URL definida');
            passedTests++;
        } else {
            checkWarning('VITE_SUPABASE_URL no encontrada');
            warnings++;
        }

        totalTests++;
        if (envFile.includes('VITE_SUPABASE_ANON_KEY')) {
            checkSuccess('VITE_SUPABASE_ANON_KEY definida');
            passedTests++;
        } else {
            checkWarning('VITE_SUPABASE_ANON_KEY no encontrada');
            warnings++;
        }
    } catch (err) {
        checkWarning('No se pudo leer archivo .env');
        warnings++;
    }
} else {
    checkWarning('Archivo .env NO encontrado (se usarán valores por defecto)');
    warnings++;
}

// TEST 5: Verificar configuración de AndroidManifest
logTitle('5. Verificando Deep Link en AndroidManifest.xml');

try {
    const manifestFile = fs.readFileSync('./android/app/src/main/AndroidManifest.xml', 'utf-8');

    totalTests++;
    if (manifestFile.includes('handballstats://')) {
        checkSuccess('Deep link scheme configurado en AndroidManifest.xml');
        passedTests++;
    } else {
        checkWarning('Deep link scheme NO encontrado en AndroidManifest.xml');
        warnings++;
    }
} catch (err) {
    checkWarning('No se pudo leer AndroidManifest.xml');
    warnings++;
}

// RESULTADOS FINALES
logTitle('RESULTADOS FINALES');

const percentage = ((passedTests / totalTests) * 100).toFixed(1);

log(`\n  Total de Tests:     ${totalTests}`, colors.blue);
log(`  Tests Exitosos:     ${passedTests}`, colors.green);
log(`  Advertencias:       ${warnings}`, colors.yellow);
log(`  Porcentaje:         ${percentage}%`, colors.bold);

if (percentage === '100.0') {
    log('\n  🎉 ¡PERFECTO! Todas las mejoras están correctamente implementadas.', colors.green + colors.bold);
} else if (parseFloat(percentage) >= 80) {
    log('\n  ✅ ¡MUY BIEN! La mayoría de mejoras están implementadas.', colors.green);
} else if (parseFloat(percentage) >= 60) {
    log('\n  ⚠️  ACEPTABLE. Algunas mejoras necesitan atención.', colors.yellow);
} else {
    log('\n  ❌ NECESITA TRABAJO. Revisa las mejoras faltantes.', colors.red);
}

logTitle('PRÓXIMOS PASOS');

if (warnings > 0) {
    log('\n  1. Revisa las advertencias arriba', colors.yellow);
    log('  2. Corrige los problemas encontrados', colors.yellow);
    log('  3. Ejecuta este test nuevamente', colors.yellow);
}

log('\n  4. Configura Supabase Dashboard:', colors.blue);
log('     • Authentication → Providers → Email', colors.blue);
log('     • Settings → Auth → Redirect URLs', colors.blue);
log('\n  5. Compila la app:', colors.blue);
log('     npm run build', colors.blue);
log('     npx cap sync android', colors.blue);
log('\n  6. Prueba el flujo completo:', colors.blue);
log('     • Registro → Email → Confirmación → Login', colors.blue);

log('\n');
log('═'.repeat(60), colors.blue);
log('  Documentación en: .agent/MEJORAS_IMPLEMENTADAS_CLOUD.md', colors.blue);
log('═'.repeat(60), colors.blue);
log('\n');
