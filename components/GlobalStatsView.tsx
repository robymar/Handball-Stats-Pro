
import React, { useEffect, useState } from 'react';
import { loadMatch, getMatchHistory, MatchSummary } from '../services/storageService.ts';
import { Player, Position, ShotOutcome, TurnoverType, PositiveActionType, SanctionType, ShotZone, MatchEvent } from '../types.ts';
import { RATING_WEIGHTS } from '../constants.ts';
import { ArrowLeft, Trophy, Calendar, Activity, ShieldAlert, Download, MousePointerClick, BarChart3, Zap, Target, TrendingUp, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface GlobalStatsViewProps {
    teamId: string;
    teamName: string;
    onBack: () => void;
    onLoadMatch: (id: string) => void;
    preloadedMatches?: any[];
}

interface BreakdownStats {
    goals: number;
    total: number;
}

interface AggregatedPlayerStats {
    playerId: string;
    name: string;
    number: number;
    position: Position;
    visible: boolean;
    matchesPlayed: number;
    playingTime: number;
    goals: number;
    totalShots: number;
    assists: number;
    steals: number;
    blocks: number;
    yellow: number;
    twoMin: number;
    red: number;
    blue: number;
    turnovers: number;
    turnoverPass: number;
    turnoverReception: number;
    turnoverSteps: number;
    turnoverDouble: number;
    turnoverLine: number;
    turnoverOffFoul: number;
    penalties: number;
    goodDef: number;
    sixM: BreakdownStats;
    nineM: BreakdownStats;
    wing: BreakdownStats;
    sevenM: BreakdownStats;
    fastbreak: BreakdownStats;
    saves: number;
    goalsAgainst: number;
    gkAssists: number;
    totalRating: number;
}

type GlobalTab = 'GENERAL' | 'SHOOTING' | 'GOALKEEPERS' | 'POSITIVE' | 'TURNOVERS';

export const GlobalStatsView: React.FC<GlobalStatsViewProps> = ({ teamId, teamName, onBack, onLoadMatch, preloadedMatches }) => {
    const [stats, setStats] = useState<AggregatedPlayerStats[]>([]);
    const [includedMatches, setIncludedMatches] = useState<MatchSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchCount, setMatchCount] = useState(0);
    const [wins, setWins] = useState(0);
    const [draws, setDraws] = useState(0);
    const [losses, setLosses] = useState(0);
    const [activeTab, setActiveTab] = useState<GlobalTab>('GENERAL');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'rating', direction: 'desc' });

    const handleHeaderClick = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const history = getMatchHistory(teamId);
            setMatchCount(history.length);
            const playerStatsMap = new Map<string, AggregatedPlayerStats>();
            const processedMatches: MatchSummary[] = [];
            let w = 0, d = 0, l = 0;

            const initStats = (p: Player): AggregatedPlayerStats => ({
                playerId: p.id, name: p.name, number: p.number, position: p.position, visible: true, matchesPlayed: 0, playingTime: 0,
                goals: 0, totalShots: 0, assists: 0, steals: 0, blocks: 0, yellow: 0, twoMin: 0, red: 0, blue: 0,
                turnovers: 0, turnoverPass: 0, turnoverReception: 0, turnoverSteps: 0, turnoverDouble: 0, turnoverLine: 0, turnoverOffFoul: 0,
                penalties: 0, goodDef: 0, sixM: { goals: 0, total: 0 }, nineM: { goals: 0, total: 0 }, wing: { goals: 0, total: 0 },
                sevenM: { goals: 0, total: 0 }, fastbreak: { goals: 0, total: 0 }, saves: 0, goalsAgainst: 0, gkAssists: 0, totalRating: 0
            });

            const getEntry = (p: Player): AggregatedPlayerStats => {
                const key = `${p.number}-${p.name.trim().toLowerCase()}`;
                if (!playerStatsMap.has(key)) playerStatsMap.set(key, initStats(p));
                const entry = playerStatsMap.get(key)!;
                entry.name = p.name; entry.position = p.position;
                return entry;
            };

            const processMatch = (match: any, summary?: MatchSummary) => {
                if (!summary) processedMatches.push({ id: match.metadata.id, date: match.metadata.date || new Date().toISOString(), homeTeam: match.metadata.homeTeam, awayTeam: match.metadata.awayTeam, homeScore: match.homeScore, awayScore: match.awayScore });
                else processedMatches.push(summary);

                const isHome = match.metadata.isOurTeamHome ?? (match.metadata.homeTeam === teamName);
                const ourScore = isHome ? match.homeScore : match.awayScore;
                const oppScore = isHome ? match.awayScore : match.homeScore;
                if (ourScore > oppScore) w++; else if (ourScore === oppScore) d++; else l++;

                match.players.forEach((p: Player) => {
                    const entry = getEntry(p);
                    entry.matchesPlayed++;
                    entry.playingTime += (p.playingTime || 0);
                });

                match.events.forEach((e: MatchEvent) => {
                    if (e.isOpponent || !e.playerId) return;
                    const p = match.players.find((pl: Player) => pl.id === e.playerId);
                    if (!p) return;
                    const entry = getEntry(p);
                    if (e.type === 'SHOT') {
                        entry.totalShots++;
                        const isGoal = e.shotOutcome === ShotOutcome.GOAL;
                        if (isGoal) entry.goals++;
                        if (e.shotZone) {
                            if ([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R].includes(e.shotZone)) { entry.sixM.total++; if (isGoal) entry.sixM.goals++; }
                            else if ([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R].includes(e.shotZone)) { entry.nineM.total++; if (isGoal) entry.nineM.goals++; }
                            else if ([ShotZone.WING_L, ShotZone.WING_R].includes(e.shotZone)) { entry.wing.total++; if (isGoal) entry.wing.goals++; }
                            else if (e.shotZone === ShotZone.SEVEN_M) { entry.sevenM.total++; if (isGoal) entry.sevenM.goals++; }
                            else if (e.shotZone === ShotZone.FASTBREAK) { entry.fastbreak.total++; if (isGoal) entry.fastbreak.goals++; }
                        }
                    }
                    if (e.type === 'TURNOVER') {
                        entry.turnovers++;
                        if (e.turnoverType === TurnoverType.PASS) entry.turnoverPass++;
                        if (e.turnoverType === TurnoverType.RECEPTION) entry.turnoverReception++;
                        if (e.turnoverType === TurnoverType.STEPS) entry.turnoverSteps++;
                        if (e.turnoverType === TurnoverType.DOUBLE) entry.turnoverDouble++;
                        if (e.turnoverType === TurnoverType.LINE) entry.turnoverLine++;
                        if (e.turnoverType === TurnoverType.OFFENSIVE_FOUL) entry.turnoverOffFoul++;
                    }
                    if (e.type === 'POSITIVE_ACTION') {
                        if (e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK) entry.assists++;
                        if (e.positiveActionType === PositiveActionType.STEAL) entry.steals++;
                        if (e.positiveActionType === PositiveActionType.BLOCK_SHOT) entry.blocks++;
                        if (e.positiveActionType === PositiveActionType.FORCE_PENALTY) entry.penalties++;
                        if (e.positiveActionType === PositiveActionType.GOOD_DEFENSE) entry.goodDef++;
                    }
                    if (e.type === 'SANCTION') {
                        if (e.sanctionType === SanctionType.YELLOW) entry.yellow++;
                        if (e.sanctionType === SanctionType.TWO_MIN) entry.twoMin++;
                        if (e.sanctionType === SanctionType.RED) entry.red++;
                        if (e.sanctionType === SanctionType.BLUE) entry.blue++;
                    }
                });
                match.events.forEach((e: MatchEvent) => {
                    if (e.type === 'OPPONENT_SHOT' && e.isOpponent && e.playerId) {
                        const p = match.players.find((pl: Player) => pl.id === e.playerId);
                        if (p) { const entry = getEntry(p); if (e.shotOutcome === ShotOutcome.SAVE) entry.saves++; if (e.shotOutcome === ShotOutcome.GOAL) entry.goalsAgainst++; }
                    }
                });
            };

            if (preloadedMatches) preloadedMatches.forEach(m => processMatch(m));
            else history.forEach(s => { const m = loadMatch(s.id); if (m) processMatch(m, s); });

            playerStatsMap.forEach(s => {
                let r = 0;
                r += s.goals * RATING_WEIGHTS.GOAL; r += (s.totalShots - s.goals) * RATING_WEIGHTS.MISS;
                r += s.assists * RATING_WEIGHTS.ASSIST; r += s.steals * RATING_WEIGHTS.STEAL;
                r += s.blocks * RATING_WEIGHTS.BLOCK; r += s.penalties * RATING_WEIGHTS.EARNED_7M;
                r += s.goodDef * RATING_WEIGHTS.GOOD_ID; r += s.turnovers * RATING_WEIGHTS.TURNOVER;
                r += s.yellow * RATING_WEIGHTS.YELLOW; r += s.twoMin * RATING_WEIGHTS.TWO_MIN;
                r += s.red * RATING_WEIGHTS.RED; r += s.blue * RATING_WEIGHTS.BLUE;
                if (s.position === Position.GK) { r += s.saves * RATING_WEIGHTS.SAVE; r += s.goalsAgainst * RATING_WEIGHTS.GOAL_CONCEDED; }
                s.totalRating = r;
            });

            setWins(w); setDraws(d); setLosses(l);
            setStats(Array.from(playerStatsMap.values()));
            setIncludedMatches(processedMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setLoading(false);
        };
        loadData();
    }, [teamId, teamName]);

    const getSortedStats = (players: AggregatedPlayerStats[]) => {
        return [...players].sort((a, b) => {
            let vA: any = 0, vB: any = 0;
            const k = sortConfig.key;
            if (k === 'number') { vA = a.number; vB = b.number; }
            else if (k === 'goals') { vA = a.goals; vB = b.goals; }
            else if (k === 'rating') { vA = a.matchesPlayed > 0 ? a.totalRating / a.matchesPlayed : 0; vB = b.matchesPlayed > 0 ? b.totalRating / b.matchesPlayed : 0; }
            else if (k === 'percentage') { vA = a.totalShots > 0 ? a.goals / a.totalShots : 0; vB = b.totalShots > 0 ? b.goals / b.totalShots : 0; }
            else { vA = (a as any)[k] || 0; vB = (b as any)[k] || 0; }
            return sortConfig.direction === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
        });
    };

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-[#0df259]">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="font-black text-xs uppercase tracking-widest">Calculando Algoritmos...</p>
        </div>
    );

    const filteredPlayers = stats.filter(p => p.position !== Position.STAFF);
    const goalkeepers = stats.filter(p => p.position === Position.GK);

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 text-slate-500 hover:text-white transition-colors"><ArrowLeft size={24} /></button>
                        <div>
                            <h1 className="text-xl font-black italic tracking-tight">ANALÍTICA <span className="text-[#0df259]">TEMPORADA</span></h1>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{teamName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-4 text-xs font-black uppercase tracking-tighter">
                            <span className="text-emerald-500">{wins}W</span>
                            <span className="text-amber-500">{draws}D</span>
                            <span className="text-red-500">{losses}L</span>
                        </div>
                        <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-[#0df259] hover:bg-[#0df259]/10 transition-all"><Download size={20} /></button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Stats Grid */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {[
                        { label: 'Partidos', val: matchCount, color: 'text-white', icon: Calendar },
                        { label: 'Efectividad', val: `${Math.round((wins / (matchCount || 1)) * 100)}%`, color: 'text-[#0df259]', icon: TrendingUp },
                        { label: 'Goles/P', val: (stats.reduce((acc, s) => acc + s.goals, 0) / (matchCount || 1)).toFixed(1), color: 'text-blue-400', icon: Target },
                        { label: 'Paradas/P', val: (goalkeepers.reduce((acc, s) => acc + s.saves, 0) / (matchCount || 1)).toFixed(1), color: 'text-purple-400', icon: ShieldAlert }
                    ].map((idx, i) => (
                        <div key={i} className="bg-[#0f0f0f] border border-white/5 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-5 group-hover:opacity-20 transition-opacity"><idx.icon size={32} className="sm:w-12 sm:h-12" /></div>
                            <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{idx.label}</p>
                            <p className={`text-xl sm:text-3xl font-black ${idx.color}`}>{idx.val}</p>
                        </div>
                    ))}
                </section>

                <div className="space-y-6">
                    <nav className="flex gap-1 sm:gap-2 bg-white/5 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar scroll-smooth">
                        {[
                            { id: 'GENERAL', label: 'Resumen', icon: Activity },
                            { id: 'SHOOTING', label: 'Tiro', icon: Target },
                            { id: 'GOALKEEPERS', label: 'Portería', icon: ShieldAlert },
                            { id: 'POSITIVE', label: 'Aciertos', icon: Zap },
                            { id: 'TURNOVERS', label: 'Pérdidas', icon: BarChart3 }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as GlobalTab)}
                                className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 ${activeTab === tab.id ? 'bg-[#0df259] text-black shadow-lg shadow-[#0df259]/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <tab.icon size={12} className="sm:w-3.5 sm:h-3.5" /> {tab.label}
                            </button>
                        ))}
                    </nav>

                    <div className="bg-[#0f0f0f] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-6 py-5 text-left cursor-pointer hover:text-white" onClick={() => handleHeaderClick('number')}>Jugador</th>
                                        <th className="px-4 py-5 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('matchesPlayed')}>Partidos</th>
                                        {activeTab === 'GENERAL' && (
                                            <>
                                                <th className="px-4 py-5 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('goals')}>Goles</th>
                                                <th className="px-4 py-5 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('percentage')}>%</th>
                                                <th className="px-4 py-5 text-center text-[#0df259]" onClick={() => handleHeaderClick('rating')}>Valoración</th>
                                            </>
                                        )}
                                        {activeTab === 'SHOOTING' && (
                                            <>
                                                <th className="px-4 py-5 text-center">6m</th>
                                                <th className="px-4 py-5 text-center">9m</th>
                                                <th className="px-4 py-5 text-center">Ext</th>
                                                <th className="px-4 py-5 text-center">7m</th>
                                            </>
                                        )}
                                        {activeTab === 'GOALKEEPERS' && (
                                            <>
                                                <th className="px-4 py-5 text-center">Paradas</th>
                                                <th className="px-4 py-5 text-center text-red-500">Goles Rec</th>
                                                <th className="px-4 py-5 text-center text-[#0df259]">% Exito</th>
                                            </>
                                        )}
                                        {activeTab === 'POSITIVE' && (
                                            <>
                                                <th className="px-4 py-5 text-center">Asist</th>
                                                <th className="px-4 py-5 text-center">Robos</th>
                                                <th className="px-4 py-5 text-center">7m Prov</th>
                                            </>
                                        )}
                                        {activeTab === 'TURNOVERS' && (
                                            <>
                                                <th className="px-4 py-5 text-center text-orange-400">Total Pérdidas</th>
                                                <th className="px-4 py-5 text-center text-slate-600">Pases</th>
                                                <th className="px-4 py-5 text-center text-slate-600">Atención</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {getSortedStats(activeTab === 'GOALKEEPERS' ? goalkeepers : filteredPlayers).map(p => (
                                        <tr key={p.playerId} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-black text-[10px] text-slate-500 group-hover:border-[#0df259]/30 transition-colors">{p.number}</span>
                                                    <span className="font-bold tracking-tight group-hover:text-white transition-colors">{p.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center font-bold text-slate-400">{p.matchesPlayed}</td>
                                            {activeTab === 'GENERAL' && (
                                                <>
                                                    <td className="px-4 py-4 text-center font-black">{p.goals}<span className="text-slate-700 mx-1">/</span>{p.totalShots}</td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`font-black ${p.totalShots > 0 && (p.goals / p.totalShots >= 0.7) ? 'text-[#0df259]' : 'text-slate-500'}`}>
                                                            {p.totalShots > 0 ? Math.round((p.goals / p.totalShots) * 100) : 0}%
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="inline-flex px-3 py-1 bg-[#0df259]/10 text-[#0df259] rounded-lg font-black text-xs">
                                                            {p.matchesPlayed > 0 ? (p.totalRating / p.matchesPlayed).toFixed(1) : '—'}
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                            {activeTab === 'SHOOTING' && (
                                                <>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-300">{p.sixM.goals}/{p.sixM.total}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-300">{p.nineM.goals}/{p.nineM.total}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-300">{p.wing.goals}/{p.wing.total}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-300">{p.sevenM.goals}/{p.sevenM.total}</td>
                                                </>
                                            )}
                                            {activeTab === 'GOALKEEPERS' && (
                                                <>
                                                    <td className="px-4 py-4 text-center font-black text-white">{p.saves}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-red-500/60">{p.goalsAgainst}</td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="font-black text-[#0df259] text-base">
                                                            {(p.saves + p.goalsAgainst > 0) ? Math.round((p.saves / (p.saves + p.goalsAgainst)) * 100) : 0}%
                                                        </span>
                                                    </td>
                                                </>
                                            )}
                                            {activeTab === 'POSITIVE' && (
                                                <>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-300">{p.assists}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-300">{p.steals}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-300">{p.penalties}</td>
                                                </>
                                            )}
                                            {activeTab === 'TURNOVERS' && (
                                                <>
                                                    <td className="px-4 py-4 text-center font-black text-orange-500">{p.turnovers}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-600">{p.turnoverPass}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-slate-600">{p.turnoverSteps + p.turnoverDouble}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Match History Tray */}
                <section className="space-y-4">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Calendar size={14} /> Historial de Partidos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {includedMatches.map(m => (
                            <div key={m.id} onClick={() => onLoadMatch(m.id)} className="bg-white/5 border border-white/5 rounded-2xl p-4 cursor-pointer hover:border-[#0df259]/30 hover:bg-white/[0.07] transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{new Date(m.date).toLocaleDateString()}</span>
                                    <div className={`text-xs font-black px-2 py-0.5 rounded ${m.homeScore > m.awayScore ? 'bg-[#0df259]/10 text-[#0df259]' : 'bg-red-500/10 text-red-500'}`}>
                                        {m.homeScore}:{m.awayScore}
                                    </div>
                                </div>
                                <p className="text-xs font-bold text-white truncate group-hover:text-[#0df259] transition-colors">{m.homeTeam} vs {m.awayTeam}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};
