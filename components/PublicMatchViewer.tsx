
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMatchById } from '../services/storageService.ts';
import { MatchState, MatchEvent, Player, ShotZone, ShotOutcome, SanctionType, TurnoverType, PositiveActionType, Position, ShotPlacement } from '../types.ts';
import { RATING_WEIGHTS } from '../constants.ts';
import { getPlayingTimeForPeriod } from '../utils/matchUtils.ts';
import { GoalStatsSVG } from './GoalStatsSVG.tsx';
import { PlayerDetailView } from './PlayerDetailView.tsx';
import { Loader2, Trophy, Target, ShieldAlert, TrendingUp, Clock, Activity, ChevronDown, ArrowLeft, Share2, Users, BarChart3, Zap, Info } from 'lucide-react';

// ─── Stat calculation helpers ───

const getZoneStats = (events: MatchEvent[], playerId: string | undefined, zones: ShotZone[], isRival = false) => {
    const targetEvents = events.filter(e =>
        (isRival ? e.isOpponent : e.playerId === playerId) &&
        (isRival ? e.type === 'OPPONENT_SHOT' : e.type === 'SHOT') &&
        e.shotZone && zones.includes(e.shotZone)
    );
    const goals = targetEvents.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
    return { goals, total: targetEvents.length };
};

const computePlayerStats = (player: Player, events: MatchEvent[]) => {
    const playerEvents = events.filter(e => e.playerId === player.id);
    const shots = playerEvents.filter(e => e.type === 'SHOT');
    const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
    const totalShots = shots.length;

    const turnoversEvents = playerEvents.filter(e => e.type === 'TURNOVER');
    const turnovers = turnoversEvents.length;
    const positiveEvents = playerEvents.filter(e => e.type === 'POSITIVE_ACTION');
    const positiveActions = positiveEvents.length;

    const assists = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK).length;
    const steals = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.STEAL).length;
    const blocks = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.BLOCK_SHOT).length;

    const yellow = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.YELLOW).length;
    const twoMin = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length;
    const red = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.RED).length;
    const blue = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.BLUE).length;

    let rating = 0;
    rating += goals * RATING_WEIGHTS.GOAL;
    rating += (totalShots - goals) * RATING_WEIGHTS.MISS;
    rating += assists * RATING_WEIGHTS.ASSIST;
    rating += steals * RATING_WEIGHTS.STEAL;
    rating += blocks * RATING_WEIGHTS.BLOCK;
    rating += turnovers * RATING_WEIGHTS.TURNOVER;
    rating += yellow * RATING_WEIGHTS.YELLOW;
    rating += twoMin * RATING_WEIGHTS.TWO_MIN;
    rating += red * RATING_WEIGHTS.RED;

    return {
        goals, totalShots, percentage: totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0,
        turnovers, positiveActions, yellow, twoMin, red, blue,
        rating: Math.round(rating * 10) / 10,
        assists, steals, blocks
    };
};

type WebTab = 'OVERVIEW' | 'SHOOTING' | 'POSITIVE' | 'TURNOVERS' | 'GOALKEEPERS' | 'RIVAL';

export const PublicMatchViewer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [matchData, setMatchData] = useState<MatchState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WebTab>('OVERVIEW');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const data = await getMatchById(id);
                if (data) setMatchData(data);
                else setError("Partido no encontrado");
            } catch (err) { setError("Error cargando el partido"); }
            finally { setLoading(false); }
        };
        load();
    }, [id]);

    const playerStatsMap = useMemo(() => {
        if (!matchData) return new Map();
        const map = new Map();
        matchData.players.filter(p => !p.position.includes('STAFF')).forEach(p => {
            map.set(p.id, computePlayerStats(p, matchData.events));
        });
        return map;
    }, [matchData]);

    const handleShare = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-[#0df259]">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="font-bold tracking-widest uppercase text-sm animate-pulse">Analizando Datos...</p>
        </div>
    );

    if (error || !matchData) return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl max-w-md">
                <ShieldAlert className="text-red-500 mx-auto mb-4" size={48} />
                <h2 className="text-2xl font-black text-white mb-2">Error</h2>
                <p className="text-slate-400 mb-6">{error || "No se cargaron los datos"}</p>
                <button onClick={() => navigate('/')} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold hover:bg-white/10 transition-all">Volver</button>
            </div>
        </div>
    );

    const sortedPlayers = [...matchData.players.filter(p => !p.position.includes('STAFF'))].sort((a, b) => (playerStatsMap.get(b.id)?.rating || 0) - (playerStatsMap.get(a.id)?.rating || 0));
    const mvp = sortedPlayers[0];
    const mvpStats = playerStatsMap.get(mvp?.id);

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-20 selection:bg-[#0df259]/30">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white"><ArrowLeft size={20} /></button>
                        <h1 className="font-black italic text-lg tracking-tighter">HANDBALL<span className="text-[#0df259]">STATS</span>PRO</h1>
                    </div>
                    <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-[#0df259]/10 border border-[#0df259]/20 rounded-xl text-xs font-bold text-[#0df259] hover:bg-[#0df259]/20 transition-all">
                        <Share2 size={14} /> {copied ? 'Copiado' : 'Compartir'}
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Scoreboard Hero */}
                <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-black border border-white/5 shadow-2xl">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#0df259]/10 blur-[120px] -mr-48 -mt-48" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] -ml-32 -mb-32" />

                    <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                        <div className="flex-1 flex flex-col items-center md:items-end gap-4">
                            {matchData.metadata.homeTeamLogo && <img src={matchData.metadata.homeTeamLogo} className="w-20 h-20 object-contain drop-shadow-2xl" />}
                            <div className="md:text-right">
                                <h2 className="text-3xl md:text-5xl font-black">{matchData.metadata.homeTeam}</h2>
                                <p className="text-[#0df259] font-bold text-sm tracking-widest uppercase">Local</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-6 font-black text-6xl md:text-8xl tabular-nums">
                                <span className={matchData.homeScore > matchData.awayScore ? "text-[#0df259]" : "text-white"}>{matchData.homeScore}</span>
                                <span className="text-slate-800">:</span>
                                <span className={matchData.awayScore > matchData.homeScore ? "text-[#0df259]" : "text-white text-opacity-80"}>{matchData.awayScore}</span>
                            </div>
                            <div className="px-4 py-1.5 bg-white/5 rounded-full border border-white/5 text-xs font-mono text-slate-500">FINALIZADO</div>
                        </div>

                        <div className="flex-1 flex flex-col items-center md:items-start gap-4">
                            {matchData.metadata.awayTeamLogo && <img src={matchData.metadata.awayTeamLogo} className="w-20 h-20 object-contain drop-shadow-2xl" />}
                            <div>
                                <h2 className="text-3xl md:text-5xl font-black text-white/80">{matchData.metadata.awayTeam}</h2>
                                <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">Visitante</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/5 p-6 bg-black/20 flex flex-wrap justify-center gap-6 md:gap-12">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mb-1">Efectividad</span>
                            <span className="text-xl font-bold">{Math.round((matchData.homeScore / (matchData.events.filter(e => !e.isOpponent && e.type === 'SHOT').length || 1)) * 100)}%</span>
                        </div>
                        <div className="w-px h-8 bg-white/5 hidden md:block" />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mb-1">Localización</span>
                            <span className="text-sm font-bold truncate max-w-[150px]">{matchData.metadata.location || 'N/A'}</span>
                        </div>
                        <div className="w-px h-8 bg-white/5 hidden md:block" />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mb-1">Fecha</span>
                            <span className="text-sm font-bold">{matchData.metadata.date || 'N/A'}</span>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* MVP Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-[#0f0f0f] border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-100 transition-opacity">
                                <Trophy className="text-[#0df259]" size={64} />
                            </div>
                            <h3 className="text-xs font-black text-[#0df259] uppercase tracking-[0.3em] mb-4">Most Valuable Player</h3>
                            {mvp ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-2xl bg-[#0df259]/10 flex items-center justify-center text-[#0df259] text-4xl font-black">#{mvp.number}</div>
                                        <div>
                                            <p className="text-2xl font-black tracking-tight">{mvp.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-bold text-slate-300">{mvp.position}</span>
                                                <span className="text-[#0df259] text-[10px] font-black tracking-widest uppercase">MVP RATIO: {mvpStats?.rating}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/5 p-4 rounded-2xl">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Goles</p>
                                            <p className="text-2xl font-black">{mvpStats?.goals} / {mvpStats?.totalShots}</p>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-2xl">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Aciertos</p>
                                            <p className="text-2xl font-black">{mvpStats?.positiveActions}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : <p className="text-slate-500 italic">No hay datos suficientes</p>}
                        </div>

                        {/* Quick Insights */}
                        <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Info size={14} /> Match Insights
                            </h4>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-400">Total Lanzamientos</span>
                                    <span className="font-bold">{matchData.events.filter(e => !e.isOpponent && e.type === 'SHOT').length}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-400">Pérdidas de Balón</span>
                                    <span className="font-bold text-orange-400">{matchData.events.filter(e => !e.isOpponent && e.type === 'TURNOVER').length}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-400">Sanciones 2m</span>
                                    <span className="font-bold text-red-400">{matchData.events.filter(e => !e.isOpponent && e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length}</span>
                                </div>
                                <div className="h-px bg-white/5" />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-400">Paradas Portería</span>
                                    <span className="font-bold text-blue-400">{matchData.events.filter(e => !e.isOpponent && e.shotOutcome === ShotOutcome.SAVE).length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs & Main Tables */}
                    <div className="lg:col-span-2 space-y-6">
                        <nav className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'OVERVIEW', label: 'Resumen', icon: Activity },
                                { id: 'SHOOTING', label: 'Zonas', icon: Target },
                                { id: 'POSITIVE', label: 'Aciertos', icon: Zap },
                                { id: 'TURNOVERS', label: 'Fallos', icon: BarChart3 },
                                { id: 'GOALKEEPERS', label: 'Porteros', icon: Users },
                                { id: 'RIVAL', label: 'Rival', icon: ShieldAlert }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as WebTab)}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#0df259] text-black shadow-lg shadow-[#0df259]/20' : 'text-slate-500 hover:text-white'}`}
                                >
                                    <tab.icon size={14} /> {tab.label}
                                </button>
                            ))}
                        </nav>

                        <div className="bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'OVERVIEW' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                                <th className="px-6 py-5 text-left font-bold">Jugador</th>
                                                <th className="px-4 py-5 text-center font-bold">G / T</th>
                                                <th className="px-4 py-5 text-center font-bold">%</th>
                                                <th className="px-4 py-5 text-center font-bold">Asist</th>
                                                <th className="px-4 py-5 text-center font-bold text-orange-400">Pér</th>
                                                <th className="px-4 py-5 text-center font-bold">Val</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {sortedPlayers.map(p => {
                                                const s = playerStatsMap.get(p.id);
                                                return (
                                                    <tr key={p.id} className="hover:bg-[#151515] transition-colors group cursor-pointer" onClick={() => setSelectedPlayerId(p.id)}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center font-black text-xs text-slate-400 group-hover:border-[#0df259]/30 transition-colors">{p.number}</span>
                                                                <span className="font-bold tracking-tight group-hover:text-[#0df259] transition-colors">{p.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-center font-black">{s?.goals} <span className="text-slate-700 mx-1">/</span> {s?.totalShots}</td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className={`font-bold ${s?.percentage >= 70 ? 'text-[#0df259]' : s?.percentage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                {s?.percentage}%
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-center text-slate-400 font-bold">{s?.assists || '—'}</td>
                                                        <td className="px-4 py-4 text-center text-orange-400/80 font-bold">{s?.turnovers || '—'}</td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className={`inline-flex px-2 py-0.5 rounded font-black text-[10px] ${s?.rating >= 10 ? 'bg-[#0df259]/10 text-[#0df259]' : 'bg-white/5 text-slate-500'}`}>{s?.rating}</div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === 'SHOOTING' && (
                                <div className="p-8 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {sortedPlayers.filter(p => (playerStatsMap.get(p.id)?.totalShots || 0) > 0).map(p => {
                                            const s = playerStatsMap.get(p.id);
                                            return (
                                                <div key={p.id} className="bg-white/5 p-6 rounded-3xl border border-white/5">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <span className="font-black">#{p.number} {p.name}</span>
                                                        <span className="text-[#0df259] font-black">{s?.percentage}%</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {[
                                                            { label: '6 Metros', val: getZoneStats(matchData.events, p.id, [ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]) },
                                                            { label: '9 Metros', val: getZoneStats(matchData.events, p.id, [ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]) },
                                                            { label: 'Extremos', val: getZoneStats(matchData.events, p.id, [ShotZone.WING_L, ShotZone.WING_R]) },
                                                            { label: '7 m / Contra', val: getZoneStats(matchData.events, p.id, [ShotZone.SEVEN_M, ShotZone.FASTBREAK]) }
                                                        ].map(z => z.val.total > 0 && (
                                                            <div key={z.label} className="flex flex-col gap-1">
                                                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                                    <span>{z.label}</span>
                                                                    <span>{z.val.goals}/{z.val.total}</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-[#0df259]" style={{ width: `${(z.val.goals / z.val.total) * 100}%` }} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'GOALKEEPERS' && (
                                <div className="p-8 space-y-8">
                                    {matchData.players.filter(p => p.position === Position.GK).map((gk, i) => {
                                        const allGkEvents = matchData.events.filter(e => e.type === 'OPPONENT_SHOT' && e.playerId === gk.id);
                                        const saves = allGkEvents.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
                                        const total = allGkEvents.length;
                                        const pct = total > 0 ? Math.round((saves / total) * 100) : 0;

                                        const placementStats: Partial<Record<ShotPlacement, { goals: number, saves: number }>> = {};
                                        allGkEvents.forEach(e => {
                                            if (!e.shotPlacement) return;
                                            if (!placementStats[e.shotPlacement]) placementStats[e.shotPlacement] = { goals: 0, saves: 0 };
                                            if (e.shotOutcome === ShotOutcome.GOAL) placementStats[e.shotPlacement]!.goals++;
                                            else if (e.shotOutcome === ShotOutcome.SAVE) placementStats[e.shotPlacement]!.saves++;
                                        });

                                        return (
                                            <div key={gk.id} className="space-y-6">
                                                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                                    <div>
                                                        <h3 className="text-xl font-black">Portero: {gk.name}</h3>
                                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Dorsal #{gk.number}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-3xl font-black text-blue-400">{pct}%</p>
                                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{saves} Paradas de {total}</p>
                                                    </div>
                                                </div>
                                                <div className="bg-white/5 rounded-3xl p-8 flex justify-center">
                                                    <GoalStatsSVG stats={placementStats} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {activeTab === 'RIVAL' && (
                                <div className="p-8 space-y-8">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-center">
                                            <p className="text-3xl font-black text-red-500">{matchData.awayScore}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Goles Rival</p>
                                        </div>
                                        {/* Más métricas del rival aquí... */}
                                    </div>
                                    <div className="bg-white/5 rounded-3xl overflow-hidden border border-white/5">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-red-900/10 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                                    <th className="px-6 py-4 text-left">Jugador Rival</th>
                                                    <th className="px-4 py-4 text-center">Goles</th>
                                                    <th className="px-4 py-4 text-center">Sanciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {matchData.opponentPlayers?.map(p => {
                                                    const goals = matchData.events.filter(e => e.isOpponent && e.opponentPlayerId === p.id && (e.type === 'OPPONENT_SHOT' && e.shotOutcome === ShotOutcome.GOAL || e.type === 'OPPONENT_GOAL')).length;
                                                    const sans = matchData.events.filter(e => e.isOpponent && e.opponentPlayerId === p.id && e.type === 'SANCTION').length;
                                                    if (goals === 0 && sans === 0) return null;
                                                    return (
                                                        <tr key={p.id}>
                                                            <td className="px-6 py-4 flex items-center gap-3">
                                                                <span className="w-8 h-8 rounded-lg bg-red-950 text-red-400 flex items-center justify-center font-black text-xs">{p.number}</span>
                                                                <span className="font-bold">{p.name}</span>
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-black">{goals}</td>
                                                            <td className="px-4 py-4 text-center">
                                                                {Array.from({ length: sans }).map((_, i) => <span key={i} className="inline-block w-2 h-3 bg-yellow-400 rounded-sm mx-0.5" />)}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Mobile Tab Bar (Floating) */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden z-50">
                <div className="bg-[#0f0f0f]/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex items-center gap-1 shadow-2xl">
                    <button onClick={() => setActiveTab('OVERVIEW')} className={`p-3 rounded-xl ${activeTab === 'OVERVIEW' ? 'bg-[#0df259] text-black' : 'text-slate-400'}`}>
                        <Activity size={20} />
                    </button>
                    <button onClick={() => setActiveTab('SHOOTING')} className={`p-3 rounded-xl ${activeTab === 'SHOOTING' ? 'bg-[#0df259] text-black' : 'text-slate-400'}`}>
                        <Target size={20} />
                    </button>
                    <button onClick={() => setActiveTab('GOALKEEPERS')} className={`p-3 rounded-xl ${activeTab === 'GOALKEEPERS' ? 'bg-[#0df259] text-black' : 'text-slate-400'}`}>
                        <Users size={20} />
                    </button>
                </div>
            </div>

            {selectedPlayerId && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="max-w-4xl mx-auto mt-10">
                        <PlayerDetailView
                            player={matchData.players.find(p => p.id === selectedPlayerId) || matchData.opponentPlayers?.find(p => p.id === selectedPlayerId)!}
                            state={matchData}
                            onBack={() => setSelectedPlayerId(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
