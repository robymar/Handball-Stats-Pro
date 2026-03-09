
import React, { useEffect, useState } from 'react';
import { loadMatch, getMatchHistory, MatchSummary } from '../services/storageService.ts';
import { Player, Position, ShotOutcome, ShotPlacement, TurnoverType, PositiveActionType, SanctionType, ShotZone, MatchEvent } from '../types.ts';
import { RATING_WEIGHTS } from '../constants.ts';
import { GoalStatsSVG } from './GoalStatsSVG.tsx';
import { ArrowLeft, Trophy, Calendar, Activity, ShieldAlert, Download, BarChart3, Zap, Target, TrendingUp, Loader2, ChevronUp, ChevronDown } from 'lucide-react';

interface GlobalStatsViewProps {
    teamId: string;
    teamName: string;
    onBack: () => void;
    onLoadMatch: (id: string) => void;
    preloadedMatches?: any[];
}

interface BreakdownStats { goals: number; total: number; }
interface AggregatedPlayerStats {
    playerId: string; name: string; number: number; position: Position; visible: boolean;
    matchesPlayed: number; playingTime: number; goals: number; totalShots: number;
    assists: number; steals: number; blocks: number; yellow: number; twoMin: number; red: number; blue: number;
    turnovers: number; turnoverPass: number; turnoverReception: number; turnoverSteps: number;
    turnoverDouble: number; turnoverLine: number; turnoverOffFoul: number;
    penalties: number; goodDef: number;
    sixM: BreakdownStats; nineM: BreakdownStats; wing: BreakdownStats; sevenM: BreakdownStats; fastbreak: BreakdownStats;
    saves: number; goalsAgainst: number; gkAssists: number; totalRating: number;
    gkPlacementMap: Partial<Record<ShotPlacement, { goals: number; saves: number }>>;
}
type GlobalTab = 'GENERAL' | 'SHOOTING' | 'GOALKEEPERS' | 'POSITIVE' | 'TURNOVERS';

const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) =>
    active ? (dir === 'desc' ? <ChevronDown size={9} className="inline text-[#0df259]" /> : <ChevronUp size={9} className="inline text-[#0df259]" />) : null;

export const GlobalStatsView: React.FC<GlobalStatsViewProps> = ({ teamId, teamName, onBack, onLoadMatch, preloadedMatches }) => {
    const [stats, setStats] = useState<AggregatedPlayerStats[]>([]);
    const [includedMatches, setIncludedMatches] = useState<MatchSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchCount, setMatchCount] = useState(0);
    const [wins, setWins] = useState(0);
    const [draws, setDraws] = useState(0);
    const [losses, setLosses] = useState(0);
    const [activeTab, setActiveTab] = useState<GlobalTab>('GENERAL');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'rating', direction: 'desc' });
    const [showHistory, setShowHistory] = useState(false);

    const handleHeaderClick = (key: string) => setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'desc' ? 'asc' : 'desc' }));

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const history = getMatchHistory(teamId);
            setMatchCount(history.length);
            const playerStatsMap = new Map<string, AggregatedPlayerStats>();
            const processedMatches: MatchSummary[] = [];
            let w = 0, d = 0, l = 0;

            const initStats = (p: Player): AggregatedPlayerStats => ({
                playerId: p.id, name: p.name, number: p.number, position: p.position, visible: true,
                matchesPlayed: 0, playingTime: 0, goals: 0, totalShots: 0, assists: 0, steals: 0, blocks: 0,
                yellow: 0, twoMin: 0, red: 0, blue: 0, turnovers: 0, turnoverPass: 0, turnoverReception: 0,
                turnoverSteps: 0, turnoverDouble: 0, turnoverLine: 0, turnoverOffFoul: 0, penalties: 0, goodDef: 0,
                sixM: { goals: 0, total: 0 }, nineM: { goals: 0, total: 0 }, wing: { goals: 0, total: 0 },
                sevenM: { goals: 0, total: 0 }, fastbreak: { goals: 0, total: 0 },
                saves: 0, goalsAgainst: 0, gkAssists: 0, totalRating: 0, gkPlacementMap: {}
            });

            const normalizeName = (name: string) => name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
            const getEntry = (p: Player) => {
                const key = `${p.number}-${normalizeName(p.name)}`;
                if (!playerStatsMap.has(key)) playerStatsMap.set(key, initStats(p));
                const entry = playerStatsMap.get(key)!;
                entry.position = p.position;
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
                    if (p.position === Position.STAFF || p.position === Position.COACH) return;
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
                        if (p) {
                            const entry = getEntry(p);
                            if (e.shotOutcome === ShotOutcome.SAVE) entry.saves++;
                            if (e.shotOutcome === ShotOutcome.GOAL) entry.goalsAgainst++;
                            if (e.shotPlacement) {
                                if (!entry.gkPlacementMap[e.shotPlacement]) entry.gkPlacementMap[e.shotPlacement] = { goals: 0, saves: 0 };
                                if (e.shotOutcome === ShotOutcome.GOAL) entry.gkPlacementMap[e.shotPlacement]!.goals++;
                                else if (e.shotOutcome === ShotOutcome.SAVE) entry.gkPlacementMap[e.shotPlacement]!.saves++;
                            }
                        }
                    }
                });
            };

            if (preloadedMatches) preloadedMatches.forEach(m => processMatch(m));
            else history.forEach(s => { const m = loadMatch(s.id); if (m) processMatch(m, s); });

            playerStatsMap.forEach(s => {
                let r = s.goals * RATING_WEIGHTS.GOAL + (s.totalShots - s.goals) * RATING_WEIGHTS.MISS + s.assists * RATING_WEIGHTS.ASSIST + s.steals * RATING_WEIGHTS.STEAL + s.blocks * RATING_WEIGHTS.BLOCK + s.penalties * RATING_WEIGHTS.EARNED_7M + s.goodDef * RATING_WEIGHTS.GOOD_ID + s.turnovers * RATING_WEIGHTS.TURNOVER + s.yellow * RATING_WEIGHTS.YELLOW + s.twoMin * RATING_WEIGHTS.TWO_MIN + s.red * RATING_WEIGHTS.RED + s.blue * RATING_WEIGHTS.BLUE;
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
            else if (k === 'matchesPlayed') { vA = a.matchesPlayed; vB = b.matchesPlayed; }
            else if (k === 'goals') { vA = a.goals; vB = b.goals; }
            else if (k === 'rating') { vA = a.matchesPlayed > 0 ? a.totalRating / a.matchesPlayed : 0; vB = b.matchesPlayed > 0 ? b.totalRating / b.matchesPlayed : 0; }
            else if (k === 'percentage') { vA = a.totalShots > 0 ? a.goals / a.totalShots : 0; vB = b.totalShots > 0 ? b.goals / b.totalShots : 0; }
            else if (k === 'sixM') { vA = a.sixM.goals; vB = b.sixM.goals; }
            else if (k === 'nineM') { vA = a.nineM.goals; vB = b.nineM.goals; }
            else if (k === 'wing') { vA = a.wing.goals; vB = b.wing.goals; }
            else if (k === 'sevenM') { vA = a.sevenM.goals; vB = b.sevenM.goals; }
            else if (k === 'fastbreak') { vA = a.fastbreak.goals; vB = b.fastbreak.goals; }
            else if (k === 'saves') { vA = a.saves; vB = b.saves; }
            else if (k === 'goalsAgainst') { vA = a.goalsAgainst; vB = b.goalsAgainst; }
            else if (k === 'savePercent') { const tA = a.saves + a.goalsAgainst, tB = b.saves + b.goalsAgainst; vA = tA > 0 ? a.saves / tA : 0; vB = tB > 0 ? b.saves / tB : 0; }
            else if (k === 'assists') { vA = a.assists; vB = b.assists; }
            else if (k === 'steals') { vA = a.steals; vB = b.steals; }
            else if (k === 'turnovers') { vA = a.turnovers; vB = b.turnovers; }
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

    const filteredPlayers = stats.filter(p => p.position !== Position.STAFF && p.position !== Position.COACH);
    const goalkeepers = stats.filter(p => p.position === Position.GK);
    const maxGoals = Math.max(...filteredPlayers.map(p => p.goals), 1);
    const totalGoals = filteredPlayers.reduce((a, p) => a + p.goals, 0);
    const topScorer = filteredPlayers.reduce((best, p) => p.goals > best.goals ? p : best, filteredPlayers[0] || { goals: 0, name: '—', number: 0 });
    const topRated = filteredPlayers.reduce((best, p) => {
        const r = p.matchesPlayed > 0 ? p.totalRating / p.matchesPlayed : 0;
        const br = best.matchesPlayed > 0 ? best.totalRating / best.matchesPlayed : 0;
        return r > br ? p : best;
    }, filteredPlayers[0] || { totalRating: 0, matchesPlayed: 1, name: '—', number: 0 });

    const thCls = "px-3 py-4 text-center text-[9px] sm:text-[11px] uppercase tracking-wider font-black cursor-pointer hover:text-white transition-colors whitespace-nowrap";
    const tdCls = "px-3 py-3 text-center";

    const SortTh = ({ label, sk, cls = '' }: { label: string; sk: string; cls?: string }) => (
        <th className={`${thCls} ${sortConfig.key === sk ? 'text-[#0df259]' : ''} ${cls}`} onClick={() => handleHeaderClick(sk)}>
            {label} <SortIcon active={sortConfig.key === sk} dir={sortConfig.direction} />
        </th>
    );

    const tabBtn = (id: GlobalTab, label: string, icon: React.ReactNode) => (
        <button key={id} onClick={() => { setActiveTab(id); setSortConfig({ key: 'matchesPlayed', direction: 'desc' }); }}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 ${activeTab === id ? 'bg-[#0df259] text-black shadow-lg shadow-[#0df259]/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
            {icon} {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* ── header ── */}
            <header className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 text-slate-500 hover:text-white transition-colors"><ArrowLeft size={22} /></button>
                        <div>
                            <h1 className="text-base sm:text-xl font-black italic tracking-tight">ANALÍTICA <span className="text-[#0df259]">TEMPORADA</span></h1>
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[160px] sm:max-w-none">{teamName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-5">
                        <div className="flex items-center gap-2 sm:gap-4 text-xs font-black uppercase tracking-tighter">
                            <span className="text-emerald-400">{wins} Vic</span>
                            <span className="text-amber-400">{draws} Emp</span>
                            <span className="text-red-400">{losses} Der</span>
                        </div>
                        <button onClick={() => setShowHistory(v => !v)} className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <Calendar size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* slide-in history panel */}
            {showHistory && (
                <div className="max-w-7xl mx-auto px-4 py-4 border-b border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Historial de Partidos</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {includedMatches.map(m => {
                            const isHome = m.isOurTeamHome !== undefined ? m.isOurTeamHome : (m.homeTeam === teamName);
                            const win = (isHome && m.homeScore > m.awayScore) || (!isHome && m.awayScore > m.homeScore);
                            const draw = m.homeScore === m.awayScore;
                            return (
                                <div key={m.id} onClick={() => onLoadMatch(m.id)} className="bg-white/[0.04] border border-white/5 rounded-2xl p-3 cursor-pointer hover:border-[#0df259]/30 hover:bg-white/[0.07] transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black text-slate-600 uppercase">{new Date(m.date).toLocaleDateString()}{m.round && ` · ${m.round}`}</span>
                                        <div className={`text-xs font-black px-2 py-0.5 rounded ${draw ? 'bg-amber-500/10 text-amber-400' : win ? 'bg-[#0df259]/10 text-[#0df259]' : 'bg-red-500/10 text-red-400'}`}>{m.homeScore}:{m.awayScore}</div>
                                    </div>
                                    <p className="text-xs font-bold text-white truncate group-hover:text-[#0df259] transition-colors">{m.homeTeam} vs {m.awayTeam}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-6">
                {/* ── Summary chips ── */}
                <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    {[
                        { icon: Calendar, label: 'Partidos', val: matchCount, sub: `${wins}V ${draws}E ${losses}D`, color: 'text-white' },
                        { icon: TrendingUp, label: 'Efectividad', val: `${Math.round((wins / (matchCount || 1)) * 100)}%`, sub: 'victorias', color: 'text-[#0df259]' },
                        { icon: Target, label: 'Goles/P', val: (totalGoals / (matchCount || 1)).toFixed(1), sub: `${totalGoals} en total`, color: 'text-blue-400' },
                        { icon: ShieldAlert, label: 'Paradas/P', val: (goalkeepers.reduce((a, s) => a + s.saves, 0) / (matchCount || 1)).toFixed(1), sub: 'porteros', color: 'text-violet-400' },
                    ].map(({ icon: Icon, label, val, sub, color }) => (
                        <div key={label} className="bg-[#0f0f0f] border border-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-5 relative overflow-hidden">
                            <Icon size={12} className={`mb-1 ${color} opacity-60`} />
                            <p className={`text-xl sm:text-3xl font-black ${color}`}>{val}</p>
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-600 uppercase tracking-wider mt-0.5">{label}</p>
                            <p className="text-[9px] text-slate-700 mt-0.5">{sub}</p>
                        </div>
                    ))}
                </section>

                {/* MVP cards */}
                {filteredPlayers.length > 0 && (
                    <section className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Top Goleador', val: `${topScorer.goals} goles`, name: `#${topScorer.number} ${topScorer.name}`, color: 'border-blue-800/50 bg-blue-950/20', accent: 'text-blue-400', icon: Target },
                            { label: 'Top Valoración', val: topRated.matchesPlayed > 0 ? (topRated.totalRating / topRated.matchesPlayed).toFixed(1) : '—', name: `#${topRated.number} ${topRated.name}`, color: 'border-[#0df259]/20 bg-[#0df259]/5', accent: 'text-[#0df259]', icon: Trophy },
                        ].map(({ label, val, name, color, accent, icon: Icon }) => (
                            <div key={label} className={`border ${color} rounded-2xl p-3 sm:p-4 flex items-center gap-3`}>
                                <Icon size={20} className={`${accent} shrink-0`} />
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-slate-500 uppercase">{label}</p>
                                    <p className={`text-lg sm:text-2xl font-black ${accent}`}>{val}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{name}</p>
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {/* ── Tab nav ── */}
                <div className="space-y-4">
                    <nav className="flex gap-1 sm:gap-2 bg-white/[0.04] p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                        {tabBtn('GENERAL', 'Resumen', <Activity size={11} />)}
                        {tabBtn('SHOOTING', 'Tiro', <Target size={11} />)}
                        {tabBtn('GOALKEEPERS', 'Portería', <ShieldAlert size={11} />)}
                        {tabBtn('POSITIVE', 'Aciertos', <Zap size={11} />)}
                        {tabBtn('TURNOVERS', 'Pérdidas', <BarChart3 size={11} />)}
                    </nav>

                    {/* ── Player table ── */}
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl sm:rounded-[2.5rem] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white/[0.04] text-slate-500">
                                    <tr>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[9px] sm:text-[11px] uppercase tracking-wider font-black cursor-pointer hover:text-white" onClick={() => handleHeaderClick('number')}>
                                            Jugador {sortConfig.key === 'number' && <SortIcon active dir={sortConfig.direction} />}
                                        </th>
                                        <SortTh label="PJ" sk="matchesPlayed" />
                                        {activeTab === 'GENERAL' && (<>
                                            <SortTh label="Goles" sk="goals" />
                                            <SortTh label="%" sk="percentage" />
                                            <SortTh label="Val" sk="rating" cls="text-[#0df259]" />
                                        </>)}
                                        {activeTab === 'SHOOTING' && (<>
                                            <SortTh label="6m" sk="sixM" />
                                            <SortTh label="9m" sk="nineM" />
                                            <SortTh label="Ext" sk="wing" />
                                            <SortTh label="7m" sk="sevenM" />
                                            <SortTh label="Contra" sk="fastbreak" />
                                        </>)}
                                        {activeTab === 'GOALKEEPERS' && (<>
                                            <SortTh label="Paradas" sk="saves" />
                                            <SortTh label="Goles Rec" sk="goalsAgainst" cls="text-red-400" />
                                            <SortTh label="% Éxito" sk="savePercent" cls="text-[#0df259]" />
                                        </>)}
                                        {activeTab === 'POSITIVE' && (<>
                                            <SortTh label="Asist" sk="assists" />
                                            <SortTh label="Robos" sk="steals" />
                                            <SortTh label="Blocaje" sk="blocks" />
                                        </>)}
                                        {activeTab === 'TURNOVERS' && (<>
                                            <SortTh label="Total" sk="turnovers" cls="text-orange-400" />
                                            <SortTh label="Pase" sk="turnoverPass" />
                                            <SortTh label="Recep" sk="turnoverReception" />
                                            <SortTh label="Pasos" sk="turnoverSteps" />
                                            <SortTh label="Dobles" sk="turnoverDouble" />
                                            <SortTh label="Pisar" sk="turnoverLine" />
                                            <SortTh label="F.Atq" sk="turnoverOffFoul" />
                                        </>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {getSortedStats(activeTab === 'GOALKEEPERS' ? goalkeepers : filteredPlayers).map(p => {
                                        const avgRating = p.matchesPlayed > 0 ? p.totalRating / p.matchesPlayed : 0;
                                        const pct = p.totalShots > 0 ? Math.round((p.goals / p.totalShots) * 100) : 0;
                                        const savePct = (p.saves + p.goalsAgainst) > 0 ? Math.round((p.saves / (p.saves + p.goalsAgainst)) * 100) : 0;
                                        const goalBarWidth = maxGoals > 0 ? `${(p.goals / maxGoals) * 100}%` : '0%';
                                        return (
                                            <tr key={p.playerId} className="hover:bg-white/[0.03] transition-colors group">
                                                <td className="px-3 sm:px-5 py-2.5 sm:py-4">
                                                    <div className="flex items-center gap-2 sm:gap-3">
                                                        <span className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center font-black text-[9px] sm:text-[11px] text-slate-500 shrink-0">{p.number}</span>
                                                        <span className="font-bold tracking-tight text-xs sm:text-sm text-slate-300 group-hover:text-white transition-colors truncate max-w-[80px] sm:max-w-none">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className={`${tdCls} font-bold text-slate-500 text-xs sm:text-sm`}>{p.matchesPlayed}</td>
                                                {activeTab === 'GENERAL' && (<>
                                                    <td className={tdCls}>
                                                        <div className="font-black text-white text-xs sm:text-base">{p.goals}<span className="text-slate-700 text-xs">/{p.totalShots}</span></div>
                                                        <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: goalBarWidth }} /></div>
                                                    </td>
                                                    <td className={tdCls}><span className={`font-black text-xs sm:text-sm ${pct >= 70 ? 'text-[#0df259]' : pct >= 50 ? 'text-yellow-400' : 'text-slate-500'}`}>{p.totalShots > 0 ? `${pct}%` : '—'}</span></td>
                                                    <td className={tdCls}><span className={`inline-flex px-2 py-1 rounded-lg font-black text-xs sm:text-sm ${avgRating > 0 ? 'bg-[#0df259]/10 text-[#0df259]' : 'text-slate-700'}`}>{p.matchesPlayed > 0 ? avgRating.toFixed(1) : '—'}</span></td>
                                                </>)}
                                                {activeTab === 'SHOOTING' && (<>
                                                    {[p.sixM, p.nineM, p.wing, p.sevenM, p.fastbreak].map((z, i) => (
                                                        <td key={i} className={tdCls}>
                                                            {z.total > 0 ? <><span className="font-bold text-white text-xs">{z.goals}</span><span className="text-slate-600 text-xs">/{z.total}</span><div className="text-[8px] text-slate-600">{Math.round((z.goals / z.total) * 100)}%</div></> : <span className="text-slate-700">—</span>}
                                                        </td>
                                                    ))}
                                                </>)}
                                                {activeTab === 'GOALKEEPERS' && (<>
                                                    <td className={`${tdCls} font-black text-white text-xs sm:text-base`}>{p.saves}</td>
                                                    <td className={`${tdCls} font-bold text-red-500/70 text-xs sm:text-base`}>{p.goalsAgainst}</td>
                                                    <td className={tdCls}><span className={`font-black text-sm sm:text-base ${savePct >= 50 ? 'text-[#0df259]' : 'text-red-400'}`}>{(p.saves + p.goalsAgainst) > 0 ? `${savePct}%` : '—'}</span></td>
                                                </>)}
                                                {activeTab === 'POSITIVE' && (<>
                                                    <td className={`${tdCls} font-bold text-slate-300 text-xs sm:text-sm`}>{p.assists}</td>
                                                    <td className={`${tdCls} font-bold text-slate-300 text-xs sm:text-sm`}>{p.steals}</td>
                                                    <td className={`${tdCls} font-bold text-slate-300 text-xs sm:text-sm`}>{p.blocks}</td>
                                                </>)}
                                                {activeTab === 'TURNOVERS' && (<>
                                                    <td className={`${tdCls} font-black text-orange-400 text-xs sm:text-base`}>{p.turnovers}</td>
                                                    {[p.turnoverPass, p.turnoverReception, p.turnoverSteps, p.turnoverDouble, p.turnoverLine, p.turnoverOffFoul].map((v, i) => (
                                                        <td key={i} className={`${tdCls} font-bold text-slate-400 text-xs sm:text-sm`}>{v}</td>
                                                    ))}
                                                </>)}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* GK heatmaps */}
                    {activeTab === 'GOALKEEPERS' && goalkeepers.length > 0 && (
                        <div className="space-y-5">
                            {goalkeepers.map(gk => {
                                const total = gk.saves + gk.goalsAgainst;
                                const sp = total > 0 ? Math.round((gk.saves / total) * 100) : 0;
                                return (
                                    <div key={gk.playerId} className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-4">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-violet-900/40 border border-violet-700/30 flex items-center justify-center font-black text-violet-300 text-lg">{gk.number}</div>
                                            <div>
                                                <div className="font-black text-white">{gk.name}</div>
                                                <div className={`text-sm font-black ${sp >= 50 ? 'text-[#0df259]' : 'text-red-400'}`}>{sp}% paradas · {gk.saves}P / {gk.goalsAgainst}G</div>
                                            </div>
                                        </div>
                                        <GoalStatsSVG stats={gk.gkPlacementMap} title="Mapa · Temporada" playerName={`#${gk.number} ${gk.name}`} totalShots={total} savePercent={sp} mode="GK" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
