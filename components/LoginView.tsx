
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle2, Download, LogOut, Cloud, Upload } from 'lucide-react';
import { saveTeam, saveMatch, getTeams, getMatchHistory, loadMatch } from '../services/storageService';
import { Team, MatchState } from '../types';

interface LoginViewProps {
    onBack: () => void;
    onLoginSuccess: () => void;
    onSync?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onBack, onLoginSuccess, onSync }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        if (!supabase) {
            setError("Error: Supabase no está configurado. Revisa las variables de entorno.");
            setLoading(false);
            return;
        }

        try {
            if (isRegistering) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                    },
                });
                if (error) throw error;
                setMessage("Registro exitoso. ¡Revisa tu email para confirmar!");
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onLoginSuccess();
            }
        } catch (err: any) {
            setError(err.message || "Ocurrió un error");
        } finally {
            setLoading(false);
        }
    };

    const [user, setUser] = useState<any>(null);

    React.useEffect(() => {
        if (supabase) {
            supabase.auth.getUser().then(({ data }) => {
                if (data.user) setUser(data.user);
            });
        }
    }, []);

    const handleSyncDown = async () => {
        if (!supabase || !user) return;
        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            // 1. Sync Teams
            const { data: teams, error: teamsError } = await supabase.from('teams').select('*').eq('user_id', user.id);
            if (teamsError) throw teamsError;

            let teamsCount = 0;
            if (teams) {
                for (const t of teams) {
                    const localTeam: Team = {
                        id: t.id,
                        name: t.name,
                        category: t.category,
                        gender: t.gender,
                        logo: t.logo_url,
                        players: [], // We need to handle players. For now empty or fetching if we had a table.
                        createdAt: new Date(t.created_at).getTime()
                    };
                    // Use skipSync=true to avoid re-uploading immediately
                    await saveTeam(localTeam, true);
                    teamsCount++;
                }
            }

            // 2. Sync Matches
            const { data: matches, error: matchesError } = await supabase.from('matches').select('*').eq('user_id', user.id);
            if (matchesError) throw matchesError;

            let matchesCount = 0;
            if (matches) {
                for (const m of matches) {
                    // match_data column contains the Full JSON
                    if (m.match_data) {
                        await saveMatch(m.match_data as MatchState, true);
                        matchesCount++;
                    }
                }
            }

            setMessage(`Sincronizado: ${teamsCount} equipos y ${matchesCount} partidos descargados.`);
            if (onSync) onSync();
        } catch (err: any) {
            setError(err.message || 'Error al descargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncUp = async () => {
        if (!supabase || !user) return;
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
            // Process in reverse to maintain "Newest First" order in local index if saveMatch modifies it
            const localMatchesSummary = getMatchHistory();
            const matchesToSync = [...localMatchesSummary].reverse();

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
        if (supabase) {
            await supabase.auth.signOut();
            setUser(null);
            setMessage(null);
        }
    };

    if (user) {
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
                        {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
                    </h2>
                    <p className="text-slate-400">
                        {isRegistering
                            ? 'Guarda tus estadísticas en la nube ☁️'
                            : 'Accede a tus datos sincronizados'}
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

                <div className="mt-6 pt-6 border-t border-slate-700 text-center">
                    <button
                        onClick={() => { setIsRegistering(!isRegistering); setError(null); setMessage(null); }}
                        className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        {isRegistering
                            ? '¿Ya tienes cuenta? Inicia sesión'
                            : '¿No tienes cuenta? Regístrate gratis'}
                    </button>
                </div>

                <div className="mt-4 text-center">
                    <button onClick={onBack} className="text-slate-500 hover:text-slate-400 text-xs">
                        Volver a la App Offline
                    </button>
                </div>
            </div>
        </div>
    );
};
