
import React, { useEffect, useState } from 'react';
import { getMatchListFromFirebase, getAllMatchesFullFromFirebase, MatchSummary } from '../services/storageService.ts';
import { MatchState } from '../types.ts';
import { GlobalStatsView } from './GlobalStatsView.tsx';
import { Loader2, ArrowLeft, Calendar, Trophy, BarChart3, Cloud, Search, ChevronRight, Share2, Filter } from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
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
        const data = await getMatchListFromFirebase();
        setMatches(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setLoading(false);
    };

    const teamList = Array.from(new Set(matches.map(m => JSON.stringify({ name: m.homeTeam, category: m.category }))))
        .map(s => JSON.parse(s))
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleOpenGlobalStats = async () => {
        if (!user) return;
        setLoadingFull(true);
        let data = await getAllMatchesFullFromFirebase();

        if (selectedTeam !== 'ALL') {
            const [selName, selCat] = selectedTeam.split('|');
            data = data.filter(m => m.metadata.homeTeam === selName && (selCat === 'undefined' || m.metadata.category === selCat));
        }

        setFullMatches(data);
        setLoadingFull(false);
        setViewMode('GLOBAL_STATS');
    };

    const filteredMatches = matches.filter(m => {
        const matchesSearch = m.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.location || '').toLowerCase().includes(searchTerm.toLowerCase());

        let matchesTeam = true;
        if (selectedTeam !== 'ALL') {
            const [selName, selCat] = selectedTeam.split('|');
            matchesTeam = m.homeTeam === selName && (selCat === 'undefined' || m.category === selCat);
        }
        return matchesSearch && matchesTeam;
    });

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-[#0df259]">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="font-bold tracking-widest uppercase text-xs">Sincronizando Cloud...</p>
        </div>
    );

    if (!user) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8 border border-white/5">
                    <Cloud size={40} className="text-[#0df259]" />
                </div>
                <h2 className="text-4xl font-black text-white mb-4 italic tracking-tight">ACCESO A LA <span className="text-[#0df259]">NUBE</span></h2>
                <p className="text-slate-500 mb-8 max-w-sm font-medium leading-relaxed">Inicia sesión para acceder a tu biblioteca personal de partidos y estadísticas avanzadas.</p>
                <button
                    onClick={() => navigate('/login')}
                    className="px-8 py-4 bg-[#0df259] text-black font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(13,242,89,0.3)]"
                >
                    Identificarse
                </button>
            </div>
        );
    }

    if (viewMode === 'GLOBAL_STATS') {
        if (loadingFull) return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-[#0df259]">
                <Loader2 className="animate-spin mb-4" size={40} />
                <p className="font-bold text-xs uppercase tracking-widest">Compilando Estadísticas Globales...</p>
            </div>
        );
        const teamName = fullMatches.length > 0 ? fullMatches[0].metadata.homeTeam : "Mi Equipo";
        const teamId = fullMatches.length > 0 ? (fullMatches[0].metadata.ownerTeamId || "cloud-team") : "cloud-team";
        return (
            <div className="min-h-screen bg-[#050505]">
                <GlobalStatsView
                    teamId={teamId}
                    teamName={teamName}
                    onBack={() => setViewMode('LIST')}
                    onLoadMatch={(id) => navigate(`/match/${id}`)}
                    preloadedMatches={fullMatches}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col">
            {/* Header section */}
            <div className="bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/')} className="p-2 text-slate-500 hover:text-white transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                                <Cloud className="text-[#0df259]" size={20} /> MIS PARTIDOS
                            </h1>
                            <p className="text-[10px] font-black text-[#0df259]/60 uppercase tracking-widest leading-none">BIBLIOTECA EN LA NUBE</p>
                        </div>
                    </div>
                    {matches.length > 0 && (
                        <button
                            onClick={handleOpenGlobalStats}
                            className="bg-white/5 border border-white/10 hover:border-[#0df259]/50 hover:bg-[#0df259]/5 px-4 py-2 rounded-xl flex items-center gap-2 transition-all group"
                        >
                            <BarChart3 size={16} className="text-[#0df259]" />
                            <span className="text-xs font-black uppercase text-white tracking-widest">Global Stats</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Sub-header/Filters */}
            <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-[#0df259] transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por equipo o localización..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 focus:border-[#0df259]/30 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none transition-all placeholder:text-slate-700"
                    />
                </div>

                {teamList.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        <button
                            onClick={() => setSelectedTeam('ALL')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${selectedTeam === 'ALL' ? 'bg-[#0df259] text-black border-[#0df259]' : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/10'}`}
                        >
                            Todos
                        </button>
                        {teamList.map((t: any) => {
                            const id = `${t.name}|${t.category}`;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setSelectedTeam(id)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${selectedTeam === id ? 'bg-[#0df259] text-black border-[#0df259]' : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/10'}`}
                                >
                                    {t.name} {t.category ? `(${t.category})` : ''}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* List */}
            <div className="max-w-7xl mx-auto w-full px-4 flex-1 pb-10">
                {filteredMatches.length === 0 ? (
                    <div className="h-96 flex flex-col items-center justify-center text-center opacity-40">
                        <div className="w-16 h-16 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center mb-4">
                            <Search size={24} />
                        </div>
                        <p className="font-bold text-sm tracking-widest text-white">NO SE HAN ENCONTRADO RESULTADOS</p>
                        <p className="text-xs">Prueba con otra búsqueda o sincroniza nuevos partidos</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredMatches.map(match => (
                            <div
                                key={match.id}
                                onClick={() => navigate(`/match/${match.id}`)}
                                className="group relative bg-[#0f0f0f] border border-white/5 rounded-[2rem] p-6 cursor-pointer hover:border-[#0df259]/30 hover:bg-[#151515] transition-all overflow-hidden"
                            >
                                {/* Highlight effect */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0df259]/5 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <Calendar size={10} /> {new Date(match.date).toLocaleDateString()}
                                        </span>
                                        <span className="text-xs font-bold text-[#0df259]/80 truncate max-w-[120px]">{match.location || 'HANDBALL ARENA'}</span>
                                    </div>
                                    <div className="p-2 bg-white/5 rounded-xl border border-white/5 group-hover:border-[#0df259]/20 group-hover:text-[#0df259] transition-all">
                                        <ChevronRight size={16} />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {match.homeTeamLogo ? <img src={match.homeTeamLogo} className="w-8 h-8 object-contain" /> : <div className="w-8 h-8 bg-slate-900 rounded-lg" />}
                                            <span className="font-black tracking-tight text-white group-hover:text-[#0df259] transition-colors">{match.homeTeam}</span>
                                        </div>
                                        <span className={`text-2xl font-black tabular-nums ${match.homeScore > match.awayScore ? 'text-[#0df259]' : 'text-slate-700'}`}>{match.homeScore}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {match.awayTeamLogo ? <img src={match.awayTeamLogo} className="w-8 h-8 object-contain" /> : <div className="w-8 h-8 bg-slate-900 rounded-lg" />}
                                            <span className="font-black tracking-tight text-white group-hover:text-[#0df259] transition-colors">{match.awayTeam}</span>
                                        </div>
                                        <span className={`text-2xl font-black tabular-nums ${match.awayScore > match.homeScore ? 'text-[#0df259]' : 'text-slate-700'}`}>{match.awayScore}</span>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex -space-x-2">
                                        {/* Placeholder for small stats or user avatars */}
                                        <div className="w-6 h-6 rounded-full bg-white/5 border border-[#050505] flex items-center justify-center text-[8px] font-bold text-slate-500">MVP</div>
                                        <div className="w-6 h-6 rounded-full bg-[#0df259]/10 border border-[#050505] flex items-center justify-center text-[8px] font-bold text-[#0df259]">#00</div>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-white transition-colors">Ver Detalles</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="py-10 text-center opacity-20">
                <p className="text-[10px] font-black tracking-[0.5em] uppercase">Handball Stats Pro · Cloud Architecture</p>
            </footer>
        </div>
    );
};
