
import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase.ts';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    User
} from 'firebase/auth';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle2, Download, LogOut, Cloud, Upload, RefreshCw } from 'lucide-react';
import { saveTeam, saveMatch, getTeams, getMatchHistory, loadMatch, syncTeamsDown, syncMatchesDown, clearLocalData } from '../services/storageService.ts';
import { Team, MatchState } from '../types.ts';

interface LoginViewProps {
    onBack: () => void;
    onLoginSuccess: () => void;
    onSync?: () => void;
    onViewCloudMatches?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onBack, onLoginSuccess, onSync, onViewCloudMatches }) => {
    // --- AUTH STATE ---
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);

    // --- NEW: Email confirmation state ---
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

    // --- NEW: Resend confirmation email ---
    const resendConfirmationEmail = async () => {
        if (!auth.currentUser) return;

        setLoading(true);
        setError(null);

        try {
            await sendEmailVerification(auth.currentUser);
            setMessage('📧 Email reenviado correctamente. Revisa tu bandeja de entrada (y spam).');
        } catch (err: any) {
            setError(err.message || 'Error al reenviar email');
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isRegistering) {
                // REGISTRO
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // Actualizar perfil con nombre completo
                if (userCredential.user) {
                    await updateProfile(userCredential.user, {
                        displayName: fullName
                    });

                    // Enviar email de verificación
                    await sendEmailVerification(userCredential.user);

                    setAwaitingConfirmation(true);
                    setMessage(
                        "¡Registro exitoso! 📧\n\n" +
                        "Te hemos enviado un email de confirmación a:\n" +
                        email + "\n\n" +
                        "Por favor revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.\n\n" +
                        "💡 El email puede tardar unos minutos en llegar. No olvides revisar la carpeta de spam."
                    );
                }
            } else {
                // LOGIN
                const userCredential = await signInWithEmailAndPassword(auth, email, password);

                // Verificar si el email está confirmado
                if (!userCredential.user.emailVerified) {
                    setAwaitingConfirmation(true);
                    setError('⚠️ Tu email aún no ha sido confirmado.\n\nRevisa tu bandeja de entrada y haz clic en el enlace de confirmación antes de iniciar sesión.');
                    // Opcional: Cerrar sesión si queremos forzar verificación estricta antes de acceder
                    // await signOut(auth);
                    // return;

                    // Firebase permite login sin verificación por defecto, pero nosotros lo controlamos aquí.
                    // Si queremos bloquear el acceso:
                    await signOut(auth);
                    return;
                }

                // Login exitoso
                setMessage('✅ ¡Sesión iniciada correctamente!');
                setTimeout(() => {
                    onLoginSuccess();
                }, 500);
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            let errorMessage = "Ocurrió un error";
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                errorMessage = 'Email o contraseña incorrectos.';
            } else if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'El email ya está registrado.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage = 'La contraseña es demasiado débil (mínimo 6 caracteres).';
            } else if (err.code === 'auth/too-many-requests') {
                errorMessage = 'Demasiados intentos fallidos. Inténtalo más tarde.';
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // --- PASSWORD RESET STATE ---
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            console.log("Auth State Changed:", currentUser?.email);
            if (currentUser) {
                // Si el usuario está logueado pero no verificado, y estamos en proceso de login, ya lo manejamos en handleAuth.
                // Pero si recarga la página, queremos ver el estado.
                setUser(currentUser);
                if (currentUser.emailVerified) {
                    setAwaitingConfirmation(false);
                } else {
                    // Si hay usuario pero no verificado, podría ser que acaba de registrarse o loguearse sin verificar
                    // No forzamos logout aquí automáticamente para permitir reenvío de email, pero bloqueamos acceso a features
                }
            } else {
                setUser(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Polling para chequear verificación de email si estamos esperando
    useEffect(() => {
        if (!user || !awaitingConfirmation) return;

        const pollInterval = setInterval(async () => {
            try {
                await user.reload(); // Importante: recargar el usuario para actualizar emailVerified
                if (user.emailVerified) {
                    setAwaitingConfirmation(false);
                    setMessage('✅ ¡Email confirmado! Ya puedes iniciar sesión.');
                    setTimeout(() => {
                        setIsRegistering(false); // Ir a login si veníamos de registro
                        // Si ya estábamos logueados (porque firebase mantiene sesión), podríamos auto-entrar
                        // Pero mejor dejar que el usuario haga login explícito o click en "Entrar"
                        onLoginSuccess(); // O auto entrar si ya es válido
                    }, 2000);
                }
            } catch (err) {
                console.error("Error reloading user:", err);
            }
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [user, awaitingConfirmation]);


    const handlePasswordReset = async () => {
        if (!email) {
            setError('Escribe tu email arriba para recuperar la contraseña.');
            return;
        }
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('¡Correo enviado! Revisa tu bandeja de entrada para restablecer tu contraseña.');
            setIsResettingPassword(false);
        } catch (err: any) {
            let errorMessage = 'Error al solicitar recuperación';
            if (err.code === 'auth/user-not-found') errorMessage = 'No existe cuenta con este email.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncDown = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            await syncTeamsDown();
            await syncMatchesDown();
            setMessage(`Datos sincronizados correctamente desde la nube.`);
            if (onSync) onSync();
        } catch (err: any) {
            setError(err.message || 'Error al descargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncUp = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            // 1. Upload Teams
            const localTeams = getTeams();
            let teamsCount = 0;
            for (const t of localTeams) {
                await saveTeam(t); // Triggers sync
                teamsCount++;
            }

            // 2. Upload Matches
            const localMatchesSummary = getMatchHistory();
            // Process in reverse to maintain order logic if needed, though for sync it matters less
            const matchesToSync = [...localMatchesSummary];

            let matchesCount = 0;
            for (const m of matchesToSync) {
                const fullMatch = loadMatch(m.id);
                if (fullMatch) {
                    await saveMatch(fullMatch);
                    matchesCount++;
                }
            }

            setMessage(`Subida completada: ${teamsCount} equipos y ${matchesCount} partidos subidos.`);
        } catch (err: any) {
            setError(err.message || 'Error al subir datos');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        clearLocalData();
        setUser(null);
        setMessage(null);
        if (onSync) onSync(); // Refresh parent state (teams, currentTeam)
    };

    if (user && user.emailVerified && !isResettingPassword) {
        return (
            <div className="h-full flex items-center justify-center p-4 bg-slate-900">
                <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="p-4 bg-indigo-500/20 rounded-full text-indigo-400">
                            <Cloud size={48} />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-2">Cloud Sync</h2>
                    <p className="text-slate-400 mb-6">{user.email}</p>

                    {message && (
                        <div className="mb-6 p-4 bg-green-900/50 border border-green-500/50 rounded-xl flex items-center gap-3 text-green-200 text-left">
                            <CheckCircle2 className="shrink-0" />
                            <span className="text-sm">{message}</span>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-left">
                            <AlertCircle className="shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <div className="space-y-3">
                        <button
                            onClick={handleSyncUp}
                            disabled={loading}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold uppercase rounded-xl transition-all shadow-lg flex items-center justify-center gap-3"
                        >
                            <Upload size={24} />
                            {loading ? 'Subiendo...' : 'Subir Todo a la Nube'}
                        </button>

                        <button
                            onClick={handleSyncDown}
                            disabled={loading}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold uppercase rounded-xl transition-all shadow-lg flex items-center justify-center gap-3"
                        >
                            <Download size={24} />
                            {loading ? 'Descargando...' : 'Descargar Todo de la Nube'}
                        </button>

                        <button
                            onClick={() => onViewCloudMatches && onViewCloudMatches()}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase rounded-xl transition-all shadow-lg flex items-center justify-center gap-3"
                        >
                            <Cloud size={24} /> Ver Mis Partidos en Nube
                        </button>

                        <button
                            onClick={onBack}
                            className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold uppercase rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            Volver a Archivo
                        </button>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="mt-8 text-red-400 hover:text-red-300 text-sm font-medium flex items-center justify-center gap-2 w-full"
                    >
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex items-center justify-center p-4 bg-slate-900">
            <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-white mb-2">
                        {isResettingPassword ? 'Recuperar Contraseña' : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}
                    </h2>
                    <p className="text-slate-400">
                        {isResettingPassword
                            ? 'Introduce tu email para enviarte un enlace'
                            : (isRegistering
                                ? 'Guarda tus estadísticas en la nube ☁️'
                                : 'Accede a tus datos sincronizados')}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-900/50 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200">
                        <AlertCircle className="shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {message && (
                    <div className="mb-4 p-4 bg-green-900/50 border border-green-500/50 rounded-xl flex items-center gap-3 text-green-200">
                        <CheckCircle2 className="shrink-0" />
                        <span className="text-sm">{message}</span>
                    </div>
                )}

                {isResettingPassword ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-handball-blue outline-none transition-colors"
                                    placeholder="ejemplo@email.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handlePasswordReset}
                            disabled={loading}
                            className="w-full py-4 bg-handball-blue hover:bg-blue-600 disabled:opacity-50 text-white font-bold uppercase rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-6"
                        >
                            {loading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsResettingPassword(false)}
                            className="text-xs text-slate-400 hover:text-white mt-4 text-center w-full block transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleAuth} className="space-y-4">
                        {isRegistering && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre Completo</label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-handball-blue outline-none transition-colors"
                                        placeholder="Tu Nombre"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-handball-blue outline-none transition-colors"
                                    placeholder="ejemplo@email.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-handball-blue outline-none transition-colors"
                                    placeholder="••••••••"
                                    minLength={6}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsResettingPassword(true)}
                                className="text-xs text-handball-blue hover:text-blue-400 mt-2 text-right w-full block transition-colors"
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-handball-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-6"
                        >
                            {loading ? 'Procesando...' : (isRegistering ? 'Registrarse' : 'Entrar')}
                            {!loading && <LogIn size={20} />}
                        </button>
                    </form>
                )}

                <div className="mt-6 pt-6 border-t border-slate-700 text-center">
                    {!isResettingPassword && (
                        <button
                            onClick={() => { setIsRegistering(!isRegistering); setError(null); setMessage(null); }}
                            className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            {isRegistering
                                ? '¿Ya tienes cuenta? Inicia sesión'
                                : '¿No tienes cuenta? Regístrate gratis'}
                        </button>
                    )}
                </div>

                {/* Resend and skip buttons when awaiting confirmation */}
                {(awaitingConfirmation || (user && !user.emailVerified)) && (
                    <div className="mt-4 space-y-3 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                        <p className="text-xs text-blue-200 text-center mb-3">
                            ⏳ Esperando confirmación de email...
                        </p>
                        <button
                            onClick={resendConfirmationEmail}
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} />
                            {loading ? 'Enviando...' : 'Reenviar Email de Confirmación'}
                        </button>

                        {!user?.emailVerified && (
                            <button
                                onClick={async () => {
                                    setAwaitingConfirmation(false);
                                    setMessage(null);
                                    if (auth.currentUser) await signOut(auth);
                                    onBack();
                                }}
                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Cloud size={16} />
                                Usar App Offline (Confirmar Más Tarde)
                            </button>
                        )}
                    </div>
                )}

                <div className="mt-4 text-center">
                    <button onClick={onBack} className="text-slate-500 hover:text-slate-400 text-xs">
                        Volver a la App Offline
                    </button>
                </div>
            </div>
        </div>
    );
};
