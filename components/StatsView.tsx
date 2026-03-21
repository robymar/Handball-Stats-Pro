
import React, { useState, useMemo } from 'react';
import { Player, MatchState, MatchEvent, ShotZone, ShotOutcome, TurnoverType, SanctionType, ShotPlacement, Position, PositiveActionType } from '../types.ts';
import { RATING_WEIGHTS } from '../constants.ts';
import { getPlayingTimeForPeriod } from '../utils/matchUtils.ts';
import { GoalStatsSVG } from './GoalStatsSVG.tsx';
import { PlayerDetailView } from './PlayerDetailView.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { Download, Target, Zap, AlertTriangle, Clock, Star, ChevronUp, ChevronDown, TrendingUp, Shield, Globe } from 'lucide-react';

interface StatsViewProps {
    state: MatchState;
    onExportToExcel: () => void;
    onExportToTemplate: (file: File) => void;
    readOnly?: boolean;
    onViewOnWeb?: () => void;
}

type StatsTab = 'GENERAL' | 'SHOOTING' | 'PLACEMENT' | 'POSITIVE' | 'TURNOVERS' | 'RIVAL';

const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) =>
    active ? (dir === 'desc' ? <ChevronDown size={10} className="inline ml-0.5 text-blue-400" /> : <ChevronUp size={10} className="inline ml-0.5 text-blue-400" />) : null;

const Bar = ({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) => (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mt-0.5">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: max > 0 ? `${Math.min(100, (value / max) * 100)}%` : '0%' }} />
    </div>
);

export const StatsView: React.FC<StatsViewProps> = ({ state, onExportToExcel, onExportToTemplate, readOnly = false, onViewOnWeb }) => {
    const [periodFilter, setPeriodFilter] = useState<'ALL' | number>('ALL');
    const [statsTab, setStatsTab] = useState<StatsTab>('GENERAL');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        setSortConfig(c => {
            if (key === 'PLAYER') return { key: c?.key === 'PLAYER_NUMBER' ? 'PLAYER_NAME' : 'PLAYER_NUMBER', direction: 'asc' };
            if (c?.key === key) return { key, direction: c.direction === 'asc' ? 'desc' : 'asc' };
            return { key, direction: 'desc' };
        });
    };

    const maxPeriod = useMemo(() => Math.max(state.currentPeriod, ...state.events.map(e => e.period || 1)), [state.events, state.currentPeriod]);

    const filteredEvents = useMemo(() => state.events.filter(e => periodFilter === 'ALL' || (e.period || 1) === periodFilter), [state.events, periodFilter]);

    const getZoneStats = (events: MatchEvent[], playerId: string | undefined, zones: ShotZone[], isRival = false) => {
        const evs = events.filter(e => (isRival ? e.isOpponent : e.playerId === playerId) && (isRival ? e.type === 'OPPONENT_SHOT' : e.type === 'SHOT') && e.shotZone && zones.includes(e.shotZone));
        return { goals: evs.filter(e => e.shotOutcome === ShotOutcome.GOAL).length, total: evs.length };
    };

    const fieldPlayersStatsMap = useMemo(() => {
        const stats = new Map<string, any>();
        state.players.forEach(p => {
            if (p.position === Position.STAFF || p.position === Position.COACH) return;
            const pe = filteredEvents.filter(e => e.playerId === p.id);
            const shots = pe.filter(e => e.type === 'SHOT');
            const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
            const totalShots = shots.length;
            const turnoversEvents = pe.filter(e => e.type === 'TURNOVER');
            const turnovers = turnoversEvents.length;
            const positiveEvents = pe.filter(e => e.type === 'POSITIVE_ACTION');
            const positiveActions = positiveEvents.length;
            const steals = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.STEAL).length;
            const assists = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK).length;
            const penalties = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.FORCE_PENALTY).length;
            const goodDef = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.GOOD_DEFENSE).length;
            const blocks = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.BLOCK_SHOT).length;
            const yellow = pe.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.YELLOW).length;
            const twoMin = pe.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length;
            const red = pe.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.RED).length;
            const blue = pe.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.BLUE).length;
            const sixM = getZoneStats(filteredEvents, p.id, [ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]);
            const nineM = getZoneStats(filteredEvents, p.id, [ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]);
            const wing = getZoneStats(filteredEvents, p.id, [ShotZone.WING_L, ShotZone.WING_R]);
            const sevenM = getZoneStats(filteredEvents, p.id, [ShotZone.SEVEN_M]);
            const fastbreak = getZoneStats(filteredEvents, p.id, [ShotZone.FASTBREAK]);
            let rating = goals * RATING_WEIGHTS.GOAL + (totalShots - goals) * RATING_WEIGHTS.MISS + assists * RATING_WEIGHTS.ASSIST + steals * RATING_WEIGHTS.STEAL + blocks * RATING_WEIGHTS.BLOCK + penalties * RATING_WEIGHTS.EARNED_7M + goodDef * RATING_WEIGHTS.GOOD_ID + turnovers * RATING_WEIGHTS.TURNOVER + yellow * RATING_WEIGHTS.YELLOW + twoMin * RATING_WEIGHTS.TWO_MIN + red * RATING_WEIGHTS.RED + blue * RATING_WEIGHTS.BLUE;
            if (p.position === Position.GK) {
                const sa = filteredEvents.filter(e => e.isOpponent && e.type === 'OPPONENT_SHOT' && e.playerId === p.id);
                rating += sa.filter(e => e.shotOutcome === ShotOutcome.SAVE).length * RATING_WEIGHTS.SAVE;
                rating += sa.filter(e => e.shotOutcome === ShotOutcome.GOAL).length * RATING_WEIGHTS.GOAL_CONCEDED;
            }
            stats.set(p.id, { goals, totalShots, percentage: totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0, turnovers, positiveActions, yellow, twoMin, red, blue, rating: Math.round(rating * 10) / 10, stats: { sixM, nineM, wing, sevenM, fastbreak }, breakdown: { positive: { steals, assists, penalties, goodDef, blocks }, turnover: { passBad: turnoversEvents.filter(e => e.turnoverType === TurnoverType.PASS).length, reception: turnoversEvents.filter(e => e.turnoverType === TurnoverType.RECEPTION).length, steps: turnoversEvents.filter(e => e.turnoverType === TurnoverType.STEPS).length, double: turnoversEvents.filter(e => e.turnoverType === TurnoverType.DOUBLE).length, line: turnoversEvents.filter(e => e.turnoverType === TurnoverType.LINE).length, offFoul: turnoversEvents.filter(e => e.turnoverType === TurnoverType.OFFENSIVE_FOUL).length } } });
        });
        return stats;
    }, [state.players.length, state.players.map(p => p.id).join(','), filteredEvents]);

    const maxRating = useMemo(() => { let m = -Infinity; fieldPlayersStatsMap.forEach(s => { if (s.rating > m) m = s.rating; }); return m; }, [fieldPlayersStatsMap]);
    const maxGoals = useMemo(() => { let m = 0; fieldPlayersStatsMap.forEach(s => { if (s.goals > m) m = s.goals; }); return m; }, [fieldPlayersStatsMap]);

    const opponentStatsMap = useMemo(() => {
        const stats = new Map<string, any>();
        if (!state.opponentPlayers?.length) return stats;
        state.opponentPlayers.forEach(p => {
            const pe = filteredEvents.filter(e => e.isOpponent && e.opponentPlayerId === p.id);
            const shots = pe.filter(e => e.type === 'OPPONENT_SHOT' || e.type === 'OPPONENT_GOAL');
            const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL || e.type === 'OPPONENT_GOAL').length;
            const totalShots = shots.length;
            const getOZ = (zones: ShotZone[]) => { const zs = shots.filter(s => s.shotZone && zones.includes(s.shotZone)); return { goals: zs.filter(s => s.shotOutcome === ShotOutcome.GOAL || s.type === 'OPPONENT_GOAL').length, total: zs.length }; };
            stats.set(p.id, { goals, totalShots, percentage: totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0, turnovers: pe.filter(e => e.type === 'TURNOVER').length, assists: pe.filter(e => e.type === 'POSITIVE_ACTION' && (e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK)).length, yellow: pe.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.YELLOW).length, twoMin: pe.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length, red: pe.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.RED).length, blue: pe.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.BLUE).length, stats: { sixM: getOZ([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]), nineM: getOZ([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]), wing: getOZ([ShotZone.WING_L, ShotZone.WING_R]), sevenM: getOZ([ShotZone.SEVEN_M]), fastbreak: getOZ([ShotZone.FASTBREAK]) } });
        });
        return stats;
    }, [state.opponentPlayers, filteredEvents]);

    const genericRivalStats = useMemo(() => {
        if (state.opponentPlayers?.length) return null;
        const re = filteredEvents.filter(e => e.isOpponent);
        const shots = re.filter(e => e.type === 'OPPONENT_SHOT' || e.type === 'OPPONENT_GOAL');
        const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL || e.type === 'OPPONENT_GOAL').length;
        const total = shots.length;
        const getOZ = (zones: ShotZone[]) => { const zs = shots.filter(s => s.shotZone && zones.includes(s.shotZone)); return { goals: zs.filter(s => s.shotOutcome === ShotOutcome.GOAL || s.type === 'OPPONENT_GOAL').length, total: zs.length }; };
        return { goals, totalShots: total, percentage: total > 0 ? Math.round((goals / total) * 100) : 0, turnovers: re.filter(e => e.type === 'TURNOVER').length, yellow: re.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.YELLOW).length, twoMin: re.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length, red: re.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.RED).length, blue: re.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.BLUE).length, stats: { sixM: getOZ([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]), nineM: getOZ([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]), wing: getOZ([ShotZone.WING_L, ShotZone.WING_R]), sevenM: getOZ([ShotZone.SEVEN_M]), fastbreak: getOZ([ShotZone.FASTBREAK]) } };
    }, [state.opponentPlayers, filteredEvents]);

    const gkStatsMap = useMemo(() => {
        const stats = new Map<string, any>();
        state.players.forEach(gk => {
            if (gk.position !== Position.GK) return;
            const sa = filteredEvents.filter(e => e.isOpponent && e.type === 'OPPONENT_SHOT' && e.playerId === gk.id);
            const saves = sa.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
            const goals = sa.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
            const total = saves + goals;
            stats.set(gk.id, { saves, goals, total, percentage: total > 0 ? Math.round((saves / total) * 100) : 0 });
        });
        return stats;
    }, [state.players.length, state.players.map(p => p.id).join(','), filteredEvents]);

    const getSortedPlayers = (players: Player[], statsMap: Map<string, any>) => {
        const sorted = [...players];
        if (!sortConfig) return sorted.sort((a, b) => (a.position === Position.GK ? 1 : 0) - (b.position === Position.GK ? 1 : 0) || a.number - b.number);
        return sorted.sort((a, b) => {
            const sa = statsMap.get(a.id) || {}; const sb = statsMap.get(b.id) || {};
            let vA: any = 0, vB: any = 0;
            switch (sortConfig.key) {
                case 'PLAYER_NUMBER': return a.number - b.number;
                case 'PLAYER_NAME': return a.name.localeCompare(b.name);
                case 'GOALS': vA = sa.goals || 0; vB = sb.goals || 0; break;
                case 'PERCENTAGE': vA = sa.percentage || 0; vB = sb.percentage || 0; break;
                case 'TURNOVERS': vA = sa.turnovers || 0; vB = sb.turnovers || 0; break;
                case 'POSITIVE': vA = sa.positiveActions || 0; vB = sb.positiveActions || 0; break;
                case 'SANCTIONS': vA = (sa.yellow || 0) + (sa.twoMin || 0) + (sa.red || 0); vB = (sb.yellow || 0) + (sb.twoMin || 0) + (sb.red || 0); break;
                case 'TIME': vA = getPlayingTimeForPeriod(a, periodFilter); vB = getPlayingTimeForPeriod(b, periodFilter); break;
                case 'RATING': vA = sa.rating || 0; vB = sb.rating || 0; break;
                case 'SIX_M': vA = sa.stats?.sixM?.goals || 0; vB = sb.stats?.sixM?.goals || 0; break;
                case 'NINE_M': vA = sa.stats?.nineM?.goals || 0; vB = sb.stats?.nineM?.goals || 0; break;
                case 'WING': vA = sa.stats?.wing?.goals || 0; vB = sb.stats?.wing?.goals || 0; break;
                case 'SEVEN_M': vA = sa.stats?.sevenM?.goals || 0; vB = sb.stats?.sevenM?.goals || 0; break;
                case 'FASTBREAK': vA = sa.stats?.fastbreak?.goals || 0; vB = sb.stats?.fastbreak?.goals || 0; break;
                case 'STEALS': vA = sa.breakdown?.positive?.steals || 0; vB = sb.breakdown?.positive?.steals || 0; break;
                case 'ASSISTS': vA = sa.breakdown?.positive?.assists || 0; vB = sb.breakdown?.positive?.assists || 0; break;
                default: vA = (sa as any)[sortConfig.key] || 0; vB = (sb as any)[sortConfig.key] || 0;
            }
            return sortConfig.direction === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
        });
    };

    const teamGoals = useMemo(() => filteredEvents.filter(e => e.type === 'SHOT' && e.shotOutcome === ShotOutcome.GOAL).length, [filteredEvents]);
    const teamShots = useMemo(() => filteredEvents.filter(e => e.type === 'SHOT').length, [filteredEvents]);
    const teamTurnovers = useMemo(() => filteredEvents.filter(e => e.type === 'TURNOVER').length, [filteredEvents]);
    const teamPositive = useMemo(() => filteredEvents.filter(e => e.type === 'POSITIVE_ACTION').length, [filteredEvents]);
    const totalGkSaves = useMemo(() => { let s = 0; gkStatsMap.forEach(g => { s += g.saves; }); return s; }, [gkStatsMap]);
    const totalGkFaced = useMemo(() => { let s = 0; gkStatsMap.forEach(g => { s += g.total; }); return s; }, [gkStatsMap]);

    const fieldPlayers = state.players.filter(p => p.position !== Position.STAFF && p.position !== Position.COACH);

    const selectedPlayer = selectedPlayerId ? (state.players.find(p => p.id === selectedPlayerId) || (state.opponentPlayers || []).find(p => p.id === selectedPlayerId)) : null;
    if (selectedPlayer) return <ErrorBoundary viewName="Detalle Jugador" onReset={() => setSelectedPlayerId(null)}><PlayerDetailView player={selectedPlayer} state={state} onBack={() => setSelectedPlayerId(null)} /></ErrorBoundary>;

    const thClass = "px-2 py-3 text-center text-[9px] sm:text-[11px] uppercase tracking-wide font-black cursor-pointer select-none hover:text-white transition-colors";
    const tdClass = "px-2 py-2.5 text-center";
    const tabBtn = (id: StatsTab, label: string, accent = 'bg-blue-600') => (
        <button key={id} onClick={() => setStatsTab(id)} className={`px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg whitespace-nowrap transition-all ${statsTab === id ? `${accent} text-white shadow-lg` : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>{label}</button>
    );

    const renderZoneBar = (label: string, zone: { goals: number; total: number }, color: string) => (
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase">{label}</span>
                <span className="text-[10px] font-bold text-white">{zone.goals}/{zone.total}</span>
            </div>
            <div className="h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: zone.total > 0 ? `${(zone.goals / zone.total) * 100}%` : '0%' }} />
            </div>
        </div>
    );

    return (
        <div className="bg-slate-900 min-h-full">
            {/* ── HEADER TOOLBAR ── sticky so it stays visible while scrolling */}
            <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-3 pt-3 pb-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                        <button onClick={() => setPeriodFilter('ALL')} className={`px-2.5 py-1.5 text-[10px] font-black uppercase rounded transition-all ${periodFilter === 'ALL' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Todo</button>
                        {Array.from({ length: maxPeriod }).map((_, i) => (
                            <button key={i} onClick={() => setPeriodFilter(i + 1)} className={`px-2.5 py-1.5 text-[10px] font-black uppercase rounded transition-all ${periodFilter === i + 1 ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>P{i + 1}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {onViewOnWeb && (
                            <button onClick={onViewOnWeb} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg transition-colors">
                                <Globe size={13} /><span className="hidden sm:inline">Ver en Web</span>
                            </button>
                        )}
                        {!readOnly && (
                            <button onClick={onExportToExcel} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg transition-colors">
                                <Download size={13} /><span className="hidden sm:inline">Exportar</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                    {tabBtn('GENERAL', 'Resumen')}
                    {tabBtn('SHOOTING', 'Tiro')}
                    {tabBtn('PLACEMENT', 'Portería', 'bg-violet-600')}
                    {tabBtn('POSITIVE', 'Aciertos', 'bg-emerald-600')}
                    {tabBtn('TURNOVERS', 'Fallos', 'bg-orange-600')}
                    {tabBtn('RIVAL', 'Rival', 'bg-red-700')}
                </div>
            </div>

            {/* ── CONTENT ── no internal scroll; parent (.app-content) handles scrolling */}
            <div className="p-3 sm:p-4 space-y-4 pb-24">

                {/* ══ GENERAL ══ */}
                {statsTab === 'GENERAL' && (
                    <div className="space-y-4">
                        {/* Score banner */}
                        <div className="bg-gradient-to-r from-slate-800 via-slate-800/90 to-slate-800 rounded-2xl border border-slate-700 p-4 flex items-center justify-between gap-3">
                            <div className="text-center flex-1">
                                <p className="text-[10px] font-black text-slate-500 uppercase truncate">{state.metadata.homeTeam}</p>
                                <p className="text-4xl sm:text-5xl font-black text-white leading-none mt-1">{state.homeScore}</p>
                            </div>
                            <div className="text-slate-600 font-black text-xl">—</div>
                            <div className="text-center flex-1">
                                <p className="text-[10px] font-black text-slate-500 uppercase truncate">{state.metadata.awayTeam}</p>
                                <p className="text-4xl sm:text-5xl font-black text-white leading-none mt-1">{state.awayScore}</p>
                            </div>
                        </div>

                        {/* Stat chips */}
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { icon: Target, label: 'Goles', val: `${teamGoals}/${teamShots}`, sub: teamShots > 0 ? `${Math.round((teamGoals / teamShots) * 100)}%` : '—', color: 'text-blue-400' },
                                { icon: Shield, label: 'Paradas', val: `${totalGkSaves}/${totalGkFaced}`, sub: totalGkFaced > 0 ? `${Math.round((totalGkSaves / totalGkFaced) * 100)}%` : '—', color: 'text-violet-400' },
                                { icon: Zap, label: 'Aciertos', val: teamPositive, sub: '', color: 'text-emerald-400' },
                                { icon: AlertTriangle, label: 'Fallos', val: teamTurnovers, sub: '', color: 'text-orange-400' },
                            ].map(({ icon: Icon, label, val, sub, color }) => (
                                <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-2 sm:p-3 text-center">
                                    <Icon size={14} className={`mx-auto mb-1 ${color}`} />
                                    <div className={`text-base sm:text-xl font-black ${color}`}>{val}</div>
                                    <div className="text-[8px] sm:text-[10px] text-slate-500 uppercase font-bold">{label}</div>
                                    {sub && <div className="text-[8px] text-slate-600 font-bold">{sub}</div>}
                                </div>
                            ))}
                        </div>

                        {/* Zone breakdown */}
                        {teamShots > 0 && (() => {
                            const sixM = getZoneStats(filteredEvents, undefined, [ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]);
                            const nineM = getZoneStats(filteredEvents, undefined, [ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]);
                            const wing = getZoneStats(filteredEvents, undefined, [ShotZone.WING_L, ShotZone.WING_R]);
                            const sevenM = getZoneStats(filteredEvents, undefined, [ShotZone.SEVEN_M]);
                            const fb = getZoneStats(filteredEvents, undefined, [ShotZone.FASTBREAK]);
                            return (
                                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Disparo por Zona</p>
                                    <div className="flex gap-3 flex-wrap">
                                        {renderZoneBar('6m', sixM, 'bg-blue-500')}
                                        {renderZoneBar('9m', nineM, 'bg-indigo-500')}
                                        {renderZoneBar('Ext', wing, 'bg-cyan-500')}
                                        {renderZoneBar('7m', sevenM, 'bg-yellow-500')}
                                        {renderZoneBar('Contra', fb, 'bg-emerald-500')}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Player table */}
                        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead className="bg-slate-900/80 text-slate-500">
                                        <tr>
                                            <th className="px-3 py-3 text-left text-[9px] sm:text-[11px] uppercase tracking-wide font-black cursor-pointer hover:text-white" onClick={() => handleSort('PLAYER')}>Jugador</th>
                                            <th className={thClass} onClick={() => handleSort('GOALS')}>Gol <SortIcon active={sortConfig?.key === 'GOALS'} dir={sortConfig?.direction || 'desc'} /></th>
                                            <th className={thClass} onClick={() => handleSort('PERCENTAGE')}>% <SortIcon active={sortConfig?.key === 'PERCENTAGE'} dir={sortConfig?.direction || 'desc'} /></th>
                                            <th className={`${thClass} text-orange-400`} onClick={() => handleSort('TURNOVERS')}>Pér <SortIcon active={sortConfig?.key === 'TURNOVERS'} dir={sortConfig?.direction || 'desc'} /></th>
                                            <th className={`${thClass} text-emerald-400`} onClick={() => handleSort('POSITIVE')}>+Ac <SortIcon active={sortConfig?.key === 'POSITIVE'} dir={sortConfig?.direction || 'desc'} /></th>
                                            <th className={thClass} onClick={() => handleSort('TIME')}>⏱ <SortIcon active={sortConfig?.key === 'TIME'} dir={sortConfig?.direction || 'desc'} /></th>
                                            <th className={`${thClass} text-violet-400`} onClick={() => handleSort('RATING')}>Val <SortIcon active={sortConfig?.key === 'RATING'} dir={sortConfig?.direction || 'desc'} /></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {getSortedPlayers(fieldPlayers, fieldPlayersStatsMap).map(p => {
                                            const s = fieldPlayersStatsMap.get(p.id) || { goals: 0, totalShots: 0, percentage: 0, turnovers: 0, positiveActions: 0, yellow: 0, twoMin: 0, red: 0, blue: 0, rating: 0 };
                                            const isTopScorer = s.goals > 0 && s.goals === maxGoals;
                                            const pt = getPlayingTimeForPeriod(p, periodFilter);
                                            return (
                                                <tr key={p.id} onClick={() => setSelectedPlayerId(p.id)} className="hover:bg-slate-700/40 cursor-pointer transition-colors group">
                                                    <td className="px-3 py-2 border-r border-slate-700/30">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-[9px] font-black text-slate-400">{p.number}</span>
                                                            <div className="min-w-0">
                                                                <span className="font-bold text-slate-200 group-hover:text-white transition-colors text-xs sm:text-sm truncate block max-w-[80px] sm:max-w-[140px]">{p.name}</span>
                                                                {p.position === Position.GK && <span className="text-[8px] font-black text-violet-400 uppercase">Port</span>}
                                                            </div>
                                                            {isTopScorer && <span title="Máximo Goleador">⭐</span>}
                                                        </div>
                                                    </td>
                                                    <td className={tdClass}>
                                                        <span className="font-black text-white">{s.goals}</span>
                                                        <span className="text-slate-600">/{s.totalShots}</span>
                                                        <Bar value={s.goals} max={maxGoals} color="bg-blue-500" />
                                                    </td>
                                                    <td className={tdClass}>
                                                        <span className={`font-bold text-xs ${s.percentage >= 70 ? 'text-emerald-400' : s.percentage >= 50 ? 'text-yellow-400' : 'text-slate-400'}`}>{s.totalShots > 0 ? `${s.percentage}%` : '—'}</span>
                                                    </td>
                                                    <td className={tdClass}><span className={`font-bold ${s.turnovers > 2 ? 'text-orange-400' : 'text-slate-400'}`}>{s.turnovers}</span></td>
                                                    <td className={tdClass}><span className={`font-bold ${s.positiveActions > 2 ? 'text-emerald-400' : 'text-slate-400'}`}>{s.positiveActions}</span></td>
                                                    <td className={tdClass}><span className="font-mono text-[10px] text-slate-500">{`${Math.floor(pt / 60)}:${String(Math.floor(pt % 60)).padStart(2, '0')}`}</span></td>
                                                    <td className={tdClass}>
                                                        <span className={`font-black text-sm ${s.rating === maxRating && s.rating > 0 ? 'text-violet-400' : 'text-slate-400'}`}>{s.rating > 0 ? s.rating : '—'}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-600 text-center">Toca un jugador para ver su detalle completo</p>
                    </div>
                )}

                {/* ══ SHOOTING ══ */}
                {statsTab === 'SHOOTING' && (
                    <div className="space-y-3">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead className="bg-slate-900/80 text-slate-500">
                                        <tr>
                                            <th className="px-3 py-3 text-left text-[9px] sm:text-[11px] uppercase tracking-wide font-black cursor-pointer hover:text-white" onClick={() => handleSort('PLAYER')}>Jugador</th>
                                            <th className={thClass} onClick={() => handleSort('PERCENTAGE')}><span className="text-blue-400">%</span></th>
                                            <th className={thClass} onClick={() => handleSort('SIX_M')}>6m</th>
                                            <th className={thClass} onClick={() => handleSort('NINE_M')}>9m</th>
                                            <th className={thClass} onClick={() => handleSort('WING')}>Ext</th>
                                            <th className={thClass} onClick={() => handleSort('SEVEN_M')}>7m</th>
                                            <th className={thClass} onClick={() => handleSort('FASTBREAK')}>Contra</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {getSortedPlayers(fieldPlayers, fieldPlayersStatsMap).map(p => {
                                            const s = fieldPlayersStatsMap.get(p.id) || { goals: 0, totalShots: 0, percentage: 0, stats: { sixM: { goals: 0, total: 0 }, nineM: { goals: 0, total: 0 }, wing: { goals: 0, total: 0 }, sevenM: { goals: 0, total: 0 }, fastbreak: { goals: 0, total: 0 } } };
                                            const pct = s.percentage;
                                            const RZ = ({ z }: { z: { goals: number; total: number } }) => z.total > 0 ? (
                                                <td className={tdClass}>
                                                    <div className="font-bold text-white text-xs">{z.goals}<span className="text-slate-600 font-normal">/{z.total}</span></div>
                                                    <div className="text-[8px] text-slate-500">{Math.round((z.goals / z.total) * 100)}%</div>
                                                </td>
                                            ) : <td className={`${tdClass} text-slate-700`}>—</td>;
                                            return (
                                                <tr key={p.id} onClick={() => setSelectedPlayerId(p.id)} className="hover:bg-slate-700/40 cursor-pointer">
                                                    <td className="px-3 py-2.5 border-r border-slate-700/30">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-slate-500 w-5 text-right">{p.number}</span>
                                                            <div>
                                                                <div className="font-bold text-slate-200 text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[130px]">{p.name}</div>
                                                                <div className="text-[8px] text-slate-600 font-bold">{s.goals}G / {s.totalShots}T</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className={tdClass}>
                                                        <span className={`font-black text-sm ${pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : s.totalShots > 0 ? 'text-red-400' : 'text-slate-600'}`}>{s.totalShots > 0 ? `${pct}%` : '—'}</span>
                                                    </td>
                                                    <RZ z={s.stats.sixM} />
                                                    <RZ z={s.stats.nineM} />
                                                    <RZ z={s.stats.wing} />
                                                    <RZ z={s.stats.sevenM} />
                                                    <RZ z={s.stats.fastbreak} />
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══ PLACEMENT / PORTERÍA ══ */}
                {statsTab === 'PLACEMENT' && (
                    <div className="space-y-6">
                        {(() => {
                            const gks = state.players.filter(p => p.position === Position.GK);
                            if (gks.length === 0) return <div className="text-center text-slate-500 py-10">No hay porteros registrados.</div>;
                            return gks.map((gk, idx) => {
                                const gkEvents = filteredEvents.filter(e => e.type === 'OPPONENT_SHOT' && e.playerId === gk.id && e.shotPlacement);
                                const stats: Partial<Record<ShotPlacement, { goals: number; saves: number }>> = {};
                                gkEvents.forEach(e => {
                                    if (!e.shotPlacement) return;
                                    if (!stats[e.shotPlacement]) stats[e.shotPlacement] = { goals: 0, saves: 0 };
                                    if (e.shotOutcome === ShotOutcome.GOAL) stats[e.shotPlacement]!.goals++;
                                    else if (e.shotOutcome === ShotOutcome.SAVE) stats[e.shotPlacement]!.saves++;
                                });
                                const all = filteredEvents.filter(e => e.type === 'OPPONENT_SHOT' && e.playerId === gk.id);
                                const realSaves = all.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
                                const realGoals = all.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
                                const realTotal = realSaves + realGoals;
                                const realPct = realTotal > 0 ? Math.round((realSaves / realTotal) * 100) : 0;
                                const pt = getPlayingTimeForPeriod(gk, periodFilter);
                                return (
                                    <div key={gk.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-3 sm:p-4">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-violet-900/50 border border-violet-700/50 flex items-center justify-center font-black text-violet-300 text-lg">{gk.number}</div>
                                            <div>
                                                <div className="font-black text-white">{gk.name}</div>
                                                <div className="text-[10px] text-slate-500 flex gap-3">
                                                    <span>⏱ {Math.floor(pt / 60)}:{String(Math.floor(pt % 60)).padStart(2, '0')}</span>
                                                    <span className={`font-bold ${realPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{realPct}% paradas</span>
                                                    <span>{realSaves}P / {realGoals}G</span>
                                                </div>
                                            </div>
                                        </div>
                                        <GoalStatsSVG stats={stats} title={`Portero ${idx + 1}`} playerName={`#${gk.number} ${gk.name}`} totalShots={realTotal} savePercent={realPct} />
                                    </div>
                                );
                            });
                        })()}
                    </div>
                )}

                {/* ══ POSITIVE / ACIERTOS ══ */}
                {statsTab === 'POSITIVE' && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm">
                                <thead className="bg-slate-900/80 text-slate-500">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-[9px] sm:text-[11px] uppercase tracking-wide font-black cursor-pointer hover:text-white" onClick={() => handleSort('PLAYER')}>Jugador</th>
                                        <th className={`${thClass} text-emerald-400`} onClick={() => handleSort('POSITIVE')}>Tot</th>
                                        <th className={`${thClass} text-emerald-300`} onClick={() => handleSort('ASSISTS')}>Asist</th>
                                        <th className={`${thClass} text-emerald-300`} onClick={() => handleSort('STEALS')}>Robo</th>
                                        <th className={`${thClass} text-emerald-300`}>Bloc</th>
                                        <th className={`${thClass} text-emerald-300`}>7mP</th>
                                        <th className={`${thClass} text-emerald-300`}>BDef</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {getSortedPlayers(fieldPlayers, fieldPlayersStatsMap).map(p => {
                                        const s = fieldPlayersStatsMap.get(p.id);
                                        if (!s || s.positiveActions === 0) return null;
                                        const { steals, assists, penalties, goodDef, blocks } = s.breakdown.positive;
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-700/40">
                                                <td className="px-3 py-2.5 border-r border-slate-700/30 font-bold text-slate-200">
                                                    <span className="text-slate-500 text-[10px] mr-1.5">{p.number}</span>{p.name.split(' ').pop()}
                                                </td>
                                                <td className={`${tdClass} font-black text-emerald-400`}>{s.positiveActions}</td>
                                                <td className={tdClass}><span className="font-bold text-slate-300">{assists}</span></td>
                                                <td className={tdClass}><span className="font-bold text-slate-300">{steals}</span></td>
                                                <td className={tdClass}><span className="font-bold text-slate-300">{blocks}</span></td>
                                                <td className={tdClass}><span className="font-bold text-slate-300">{penalties}</span></td>
                                                <td className={tdClass}><span className="font-bold text-slate-300">{goodDef}</span></td>
                                            </tr>
                                        );
                                    })}
                                    {!Array.from(fieldPlayersStatsMap.values()).some(s => s.positiveActions > 0) && <tr><td colSpan={7} className="p-6 text-center text-slate-600">No hay aciertos registrados.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ══ TURNOVERS / FALLOS ══ */}
                {statsTab === 'TURNOVERS' && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm">
                                <thead className="bg-slate-900/80 text-slate-500">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-[9px] sm:text-[11px] uppercase tracking-wide font-black cursor-pointer hover:text-white" onClick={() => handleSort('PLAYER')}>Jugador</th>
                                        <th className={`${thClass} text-orange-400`} onClick={() => handleSort('TURNOVERS')}>Tot</th>
                                        <th className={thClass}>Pas</th>
                                        <th className={thClass}>Rec</th>
                                        <th className={thClass}>Pas</th>
                                        <th className={thClass}>Dob</th>
                                        <th className={thClass}>Pis</th>
                                        <th className={thClass}>F.A</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {getSortedPlayers(fieldPlayers, fieldPlayersStatsMap).map(p => {
                                        const s = fieldPlayersStatsMap.get(p.id);
                                        if (!s || s.turnovers === 0) return null;
                                        const { passBad, reception, steps, double, line, offFoul } = s.breakdown.turnover;
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-700/40">
                                                <td className="px-3 py-2.5 border-r border-slate-700/30 font-bold text-slate-200">
                                                    <span className="text-slate-500 text-[10px] mr-1.5">{p.number}</span>{p.name.split(' ').pop()}
                                                </td>
                                                <td className={`${tdClass} font-black text-orange-400`}>{s.turnovers}</td>
                                                <td className={`${tdClass} text-orange-300 font-bold`}>{passBad}</td>
                                                <td className={`${tdClass} text-orange-300 font-bold`}>{reception}</td>
                                                <td className={`${tdClass} text-orange-300 font-bold`}>{steps}</td>
                                                <td className={`${tdClass} text-orange-300 font-bold`}>{double}</td>
                                                <td className={`${tdClass} text-orange-300 font-bold`}>{line}</td>
                                                <td className={`${tdClass} text-orange-300 font-bold`}>{offFoul}</td>
                                            </tr>
                                        );
                                    })}
                                    {!Array.from(fieldPlayersStatsMap.values()).some(s => s.turnovers > 0) && <tr><td colSpan={8} className="p-6 text-center text-slate-600">No hay fallos registrados.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ══ RIVAL ══ */}
                {statsTab === 'RIVAL' && (
                    <div className="space-y-6">
                        {/* PORTERÍA RIVAL */}
                        {(() => {
                            const rivalGkEvents = filteredEvents.filter(e => e.type === 'SHOT' && !e.isOpponent && (e.shotOutcome === ShotOutcome.SAVE || e.shotOutcome === ShotOutcome.GOAL) && e.shotPlacement);
                            const realSaves = rivalGkEvents.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
                            const realGoals = rivalGkEvents.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
                            const realTotal = realSaves + realGoals;
                            
                            if (realTotal === 0) return null;

                            const stats: Partial<Record<ShotPlacement, { goals: number; saves: number }>> = {};
                            rivalGkEvents.forEach(e => {
                                if (!e.shotPlacement) return;
                                if (!stats[e.shotPlacement]) stats[e.shotPlacement] = { goals: 0, saves: 0 };
                                if (e.shotOutcome === ShotOutcome.GOAL) stats[e.shotPlacement]!.goals++;
                                else if (e.shotOutcome === ShotOutcome.SAVE) stats[e.shotPlacement]!.saves++;
                            });
                            
                            const shootPct = realTotal > 0 ? Math.round((realGoals / realTotal) * 100) : 0;
                            
                            return (
                                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 sm:p-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-900/50 border border-red-700/50 flex items-center justify-center font-black text-red-300 text-lg">
                                            <Shield size={20} />
                                        </div>
                                        <div>
                                            <div className="font-black text-white">Portería Rival</div>
                                            <div className="text-[10px] text-slate-500 flex gap-3">
                                                <span className={`font-bold ${shootPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{shootPct}% acierto</span>
                                                <span>{realGoals}G / {realSaves}P</span>
                                            </div>
                                        </div>
                                    </div>
                                    <GoalStatsSVG stats={stats} title="Portería Rival" playerName="Oponente" totalShots={realTotal} shootingPercent={shootPct} mode="PLAYER" />
                                </div>
                            );
                        })()}

                        {/* rival summary chip */}
                        {(genericRivalStats || opponentStatsMap.size > 0) && (() => {
                            const rGoals = genericRivalStats ? genericRivalStats.goals : Array.from(opponentStatsMap.values()).reduce((a, s) => a + s.goals, 0);
                            const rShots = genericRivalStats ? genericRivalStats.totalShots : Array.from(opponentStatsMap.values()).reduce((a, s) => a + s.totalShots, 0);
                            const rPct = rShots > 0 ? Math.round((rGoals / rShots) * 100) : 0;
                            return (
                                <div className="bg-red-950/40 border border-red-900/40 rounded-xl p-3 flex gap-4 items-center flex-wrap">
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-red-400">{rGoals}<span className="text-slate-600 text-xl">/{rShots}</span></div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Goles totales</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-2xl font-black ${rPct >= 60 ? 'text-red-400' : 'text-yellow-400'}`}>{rPct}%</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Efectividad</div>
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead className="bg-slate-900/80 text-slate-500">
                                        <tr>
                                            <th className="px-3 py-3 text-left text-[9px] uppercase tracking-wide font-black">Jugador</th>
                                            <th className={thClass}>Gol</th>
                                            <th className={thClass}>%</th>
                                            <th className={thClass}>6m</th>
                                            <th className={thClass}>9m</th>
                                            <th className={thClass}>Ext</th>
                                            <th className={thClass}>7m</th>
                                            <th className={`${thClass} text-orange-400`}>Pér</th>
                                            <th className={`${thClass} text-yellow-400`}>Snc</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {opponentStatsMap.size > 0 ? getSortedPlayers(state.opponentPlayers || [], opponentStatsMap).map(p => {
                                            const s = opponentStatsMap.get(p.id) || { goals: 0, totalShots: 0, percentage: 0, turnovers: 0, yellow: 0, twoMin: 0, red: 0, blue: 0, stats: { sixM: { goals: 0, total: 0 }, nineM: { goals: 0, total: 0 }, wing: { goals: 0, total: 0 }, sevenM: { goals: 0, total: 0 }, fastbreak: { goals: 0, total: 0 } } };
                                            const RZ2 = ({ z }: { z: { goals: number; total: number } }) => z.total > 0 ? <td className={tdClass}><span className="font-bold text-white text-xs">{z.goals}</span><span className="text-slate-600">/{z.total}</span></td> : <td className={`${tdClass} text-slate-700`}>—</td>;
                                            return (
                                                <tr key={p.id} onClick={() => setSelectedPlayerId(p.id)} className="hover:bg-slate-700/40 cursor-pointer">
                                                    <td className="px-3 py-2.5 border-r border-slate-700/30 font-bold text-slate-200">
                                                        <span className="text-slate-500 text-[10px] mr-1.5">{p.number}</span>{p.name}
                                                    </td>
                                                    <td className={tdClass}><span className="font-black text-white">{s.goals}</span><span className="text-slate-600">/{s.totalShots}</span></td>
                                                    <td className={tdClass}><span className={`font-bold ${s.percentage >= 60 ? 'text-red-400' : 'text-slate-400'}`}>{s.totalShots > 0 ? `${s.percentage}%` : '—'}</span></td>
                                                    <RZ2 z={s.stats.sixM} />
                                                    <RZ2 z={s.stats.nineM} />
                                                    <RZ2 z={s.stats.wing} />
                                                    <RZ2 z={s.stats.sevenM} />
                                                    <td className={`${tdClass} text-orange-300 font-bold`}>{s.turnovers || '—'}</td>
                                                    <td className={tdClass}>
                                                        <div className="flex gap-0.5 justify-center flex-wrap">
                                                            {s.yellow > 0 && <span className="bg-yellow-400 text-black text-[8px] font-black px-1 rounded">{s.yellow}A</span>}
                                                            {s.twoMin > 0 && <span className="bg-white text-black text-[8px] font-black px-1 rounded">{s.twoMin}×2'</span>}
                                                            {s.red > 0 && <span className="bg-red-600 text-white text-[8px] font-black px-1 rounded">R</span>}
                                                            {s.blue > 0 && <span className="bg-blue-600 text-white text-[8px] font-black px-1 rounded">A</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }) : genericRivalStats ? (
                                            <tr className="hover:bg-slate-700/40">
                                                <td className="px-3 py-2.5 border-r border-slate-700/30 font-bold text-slate-200">Rival (Total)</td>
                                                <td className={tdClass}><span className="font-black text-white">{genericRivalStats.goals}</span><span className="text-slate-600">/{genericRivalStats.totalShots}</span></td>
                                                <td className={tdClass}><span className="font-bold text-slate-400">{genericRivalStats.totalShots > 0 ? `${genericRivalStats.percentage}%` : '—'}</span></td>
                                                <td className={tdClass}>{genericRivalStats.stats.sixM.goals}/{genericRivalStats.stats.sixM.total}</td>
                                                <td className={tdClass}>{genericRivalStats.stats.nineM.goals}/{genericRivalStats.stats.nineM.total}</td>
                                                <td className={tdClass}>{genericRivalStats.stats.wing.goals}/{genericRivalStats.stats.wing.total}</td>
                                                <td className={tdClass}>{genericRivalStats.stats.sevenM.goals}/{genericRivalStats.stats.sevenM.total}</td>
                                                <td className={`${tdClass} text-orange-300 font-bold`}>{genericRivalStats.turnovers}</td>
                                                <td className={tdClass}>—</td>
                                            </tr>
                                        ) : (
                                            <tr><td colSpan={9} className="p-6 text-center text-slate-600">No hay datos del rival.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
