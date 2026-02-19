
import React, { useEffect, useState } from 'react';
import { getMatchListFromFirebase, getAllMatchesFullFromFirebase, MatchSummary } from '../services/storageService.ts';
import { MatchState } from '../types.ts';
import { GlobalStatsView } from './GlobalStatsView.tsx';
import { Loader2, ArrowLeft, Calendar, Trophy, BarChart3, Cloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase.ts';
import { onAuthStateChanged } from 'firebase/auth';

export const CloudMatchList: React.FC = () => {
    const [matches, setMatches] = useState<MatchSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'LIST' | 'GLOBAL_STATS'>('LIST');
    const [fullMatches, setFullMatches] = useState<MatchState[]>([]);
    const [loadingFull, setLoadingFull] = useState(false);
    const [user, setUser] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                loadMatches();
            } else {
                setUser(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadMatches = async () => {
        setLoading(true);
        // getMatchListFromFirebase uses the current auth user internally
        const data = await getMatchListFromFirebase();
        setMatches(data);
        setLoading(false);
    };

    const handleOpenGlobalStats = async () => {
        if (!user) return;
        setLoadingFull(true);
        // getAllMatchesFullFromFirebase uses the current auth user internally
        const data = await getAllMatchesFullFromFirebase();
        setFullMatches(data);
        setLoadingFull(false);
        setViewMode('GLOBAL_STATS');
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
            <Loader2 className="animate-spin" size={48} />
            <p className="text-slate-400">Cargando partidos de la nube...</p>
        </div>
    );

    if (!user) {
        return (
            <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
                <Cloud size={64} className="text-slate-600 mb-4" />
                <h2 className="text-2xl font-black text-white mb-2">Inicia Sesión</h2>
                <p className="text-slate-400 mb-6">Necesitas iniciar sesión para ver tus partidos en la nube.</p>
                <button
                    onClick={() => navigate('/login')}
                    className="px-8 py-3 bg-handball-blue hover:bg-blue-600 text-white font-bold uppercase rounded-xl transition-all shadow-lg"
                >
                    Ir a Login
                </button>
            </div>
        );
    }

    if (viewMode === 'GLOBAL_STATS') {
        if (loadingFull) return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
                <Loader2 className="animate-spin" size={48} />
                <p className="text-slate-400">Calculando estadísticas globales...</p>
            </div>
        );

        // We need a teamId/Name for the header, usually we'd pick the first or most common ownerTeamId
        // For now, let's use a generic name or try to infer from the first match
        const teamName = fullMatches.length > 0 ? fullMatches[0].metadata.homeTeam : "Mi Equipo"; // Fallback
        const teamId = fullMatches.length > 0 ? (fullMatches[0].metadata.ownerTeamId || "cloud-team") : "cloud-team";
        const team = user.displayName ? { name: user.displayName } : { name: teamName };

        return (
            <GlobalStatsView
                teamId={teamId}
                teamName={teamName} // Or user.displayName?
                onBack={() => setViewMode('LIST')}
                onLoadMatch={(id) => navigate(`/match/${id}`)}
                preloadedMatches={fullMatches}
            />
        );
    }

    return (
        <div className="h-full bg-slate-900 p-4 sm:p-6 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={32} />
                    </button>
                    <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Cloud className="text-handball-blue w-6 h-6 sm:w-8 sm:h-8" /> Mis Partidos (Nube)
                    </h1>
                </div>
                {matches.length > 0 && (
                    <button
                        onClick={handleOpenGlobalStats}
                        className="flex items-center gap-2 bg-handball-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm"
                    >
                        <BarChart3 size={18} />
                        <span className="hidden sm:inline">Estadísticas Totales</span>
                    </button>
                )}
            </div>

            {matches.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
                    <Cloud size={64} className="opacity-20" />
                    <p>No hay partidos sincronizados en la nube.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matches.map(match => (
                        <div
                            key={match.id}
                            // Navigate to match viewer - using standard view for now, could be cloud view if logic differs
                            // Assuming local viewer can handle loading from cloud or we need to ensure it's saved locally first?
                            // The original code navigated to /match/:id which implies it loads from local or checks cloud
                            onClick={() => {
                                // If we want to view it, we might need to maximize it. 
                                // Actually, standard flow is: click -> loads locally?
                                // If it's a cloud list, usually we load it.
                                // Let's assume /match/:id handles it or we should load it first?
                                // Standard app flow seems to be: 
                                // 1. User sees list. 
                                // 2. User clicks match.
                                // 3. Match loads.
                                navigate(`/match/${match.id}`);
                            }}
                            className="bg-slate-800 rounded-xl border border-slate-700 p-4 cursor-pointer hover:border-handball-blue hover:shadow-lg transition-all group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-slate-400 text-xs font-bold flex items-center gap-1 bg-slate-900/50 px-2 py-1 rounded">
                                    <Calendar size={12} />
                                    {new Date(match.date).toLocaleDateString()}
                                </span>
                                <div className={`text-sm font-black px-2 py-1 rounded ${match.homeScore > match.awayScore ? 'bg-green-500/20 text-green-400' :
                                    match.homeScore < match.awayScore ? 'bg-red-500/20 text-red-400' :
                                        'bg-orange-500/20 text-orange-400'
                                    }`}>
                                    {match.homeScore} - {match.awayScore}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-white font-bold truncate max-w-[70%]">{match.homeTeam}</span>
                                    <span className="text-xl font-mono text-slate-300">{match.homeScore}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white font-bold truncate max-w-[70%]">{match.awayTeam}</span>
                                    <span className="text-xl font-mono text-slate-300">{match.awayScore}</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-end">
                                <span className="text-xs font-bold text-handball-blue group-hover:underline flex items-center gap-1">
                                    VER DETALLES <ArrowLeft className="rotate-180" size={12} />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
