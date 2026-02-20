
import React, { useState, useMemo } from 'react';
import { Player, MatchState, MatchEvent, ShotZone, ShotOutcome, TurnoverType, SanctionType, ShotPlacement, Position, PositiveActionType } from '../types.ts';
import { RATING_WEIGHTS } from '../constants.ts';
import { getPlayingTimeForPeriod } from '../utils/matchUtils.ts';
import { GoalStatsSVG } from './GoalStatsSVG.tsx';
import { PlayerDetailView } from './PlayerDetailView.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { Download } from 'lucide-react';

interface StatsViewProps {
    state: MatchState;
    onExportToExcel: () => void;
    onExportToTemplate: (file: File) => void;
    readOnly?: boolean;
}

export const StatsView: React.FC<StatsViewProps> = ({ state, onExportToExcel, onExportToTemplate, readOnly = false }) => {
    const [periodFilter, setPeriodFilter] = useState<'ALL' | number>('ALL');
    const [statsTab, setStatsTab] = useState<'GENERAL' | 'SHOOTING' | 'PLACEMENT' | 'POSITIVE' | 'TURNOVERS' | 'RIVAL'>('GENERAL');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const handleHeaderClick = (key: string) => {
        setSortConfig(current => {
            if (key === 'PLAYER') {
                if (current?.key === 'PLAYER_NUMBER') return { key: 'PLAYER_NAME', direction: 'asc' };
                return { key: 'PLAYER_NUMBER', direction: 'asc' };
            }

            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const getSortedPlayers = (players: Player[], statsMap: Map<string, any>) => {
        let sorted = [...players];
        if (sortConfig) {
            sorted.sort((a, b) => {
                const statA = statsMap.get(a.id) || {};
                const statB = statsMap.get(b.id) || {};
                let valA: any = 0;
                let valB: any = 0;

                switch (sortConfig.key) {
                    case 'PLAYER_NUMBER': return a.number - b.number;
                    case 'PLAYER_NAME': return a.name.localeCompare(b.name);
                    case 'GOALS': valA = statA.goals || 0; valB = statB.goals || 0; break;
                    case 'PERCENTAGE': valA = statA.percentage || 0; valB = statB.percentage || 0; break;
                    case 'TURNOVERS': valA = statA.turnovers || 0; valB = statB.turnovers || 0; break;
                    case 'POSITIVE': valA = statA.positiveActions || 0; valB = statB.positiveActions || 0; break;
                    case 'SANCTIONS': valA = (statA.yellow || 0) + (statA.twoMin || 0) + (statA.red || 0); valB = (statB.yellow || 0) + (statB.twoMin || 0) + (statB.red || 0); break;
                    case 'TIME': valA = getPlayingTimeForPeriod(a, periodFilter); valB = getPlayingTimeForPeriod(b, periodFilter); break;
                    case 'RATING': valA = statA.rating || 0; valB = statB.rating || 0; break;

                    // Shooting
                    case 'TOTAL_SHOTS': valA = statA.totalShots || 0; valB = statB.totalShots || 0; break;
                    case 'SIX_M': valA = statA.stats?.sixM?.goals || 0; valB = statB.stats?.sixM?.goals || 0; break;
                    case 'NINE_M': valA = statA.stats?.nineM?.goals || 0; valB = statB.stats?.nineM?.goals || 0; break;
                    case 'WING': valA = statA.stats?.wing?.goals || 0; valB = statB.stats?.wing?.goals || 0; break;
                    case 'SEVEN_M': valA = statA.stats?.sevenM?.goals || 0; valB = statB.stats?.sevenM?.goals || 0; break;
                    case 'FASTBREAK': valA = statA.stats?.fastbreak?.goals || 0; valB = statB.stats?.fastbreak?.goals || 0; break;

                    // Positive
                    case 'STEALS': valA = statA.breakdown?.positive?.steals || statA.steals || 0; valB = statB.breakdown?.positive?.steals || statB.steals || 0; break;
                    case 'ASSISTS': valA = statA.breakdown?.positive?.assists || statA.assists || 0; valB = statB.breakdown?.positive?.assists || statB.assists || 0; break;
                    case 'PENALTIES': valA = statA.breakdown?.positive?.penalties || 0; valB = statB.breakdown?.positive?.penalties || 0; break;
                    case 'GOOD_DEF': valA = statA.breakdown?.positive?.goodDef || 0; valB = statB.breakdown?.positive?.goodDef || 0; break;
                    case 'BLOCKS': valA = statA.breakdown?.positive?.blocks || 0; valB = statB.breakdown?.positive?.blocks || 0; break;

                    // Turnovers
                    case 'PASS': valA = statA.breakdown?.turnover?.passBad || 0; valB = statB.breakdown?.turnover?.passBad || 0; break;
                    case 'RECEPTION': valA = statA.breakdown?.turnover?.reception || 0; valB = statB.breakdown?.turnover?.reception || 0; break;
                    case 'STEPS': valA = statA.breakdown?.turnover?.steps || 0; valB = statB.breakdown?.turnover?.steps || 0; break;
                    case 'DOUBLE': valA = statA.breakdown?.turnover?.double || 0; valB = statB.breakdown?.turnover?.double || 0; break;
                    case 'LINE': valA = statA.breakdown?.turnover?.line || 0; valB = statB.breakdown?.turnover?.line || 0; break;
                    case 'OFF_FOUL': valA = statA.breakdown?.turnover?.offFoul || 0; valB = statB.breakdown?.turnover?.offFoul || 0; break;
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default Sort: Position (GK first) -> Number
            sorted.sort((a, b) => (a.position === Position.GK ? 1 : 0) - (b.position === Position.GK ? 1 : 0) || a.number - b.number);
        }
        return sorted;
    };


    const renderStatsTable = (
        players: Player[],
        headers: string[],
        renderRow: (p: Player) => (string | number)[],
        onRowClick: (p: Player) => void
    ) => (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                    <tr>
                        <th className="px-3 py-3 text-left">Jugador</th>
                        {headers.map((h, i) => <th key={i} className="px-2 py-3 text-center">{h}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {players.map(p => {
                        const rowData = renderRow(p);
                        return (
                            <tr key={p.id} className="hover:bg-slate-700/50 cursor-pointer" onClick={() => onRowClick(p)}>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-slate-500 w-5 text-right">{p.number}</span>
                                        <span className="truncate font-medium text-white">{p.name}</span>
                                    </div>
                                </td>
                                {rowData.map((val, i) => (
                                    <td key={i} className="px-2 py-2 text-center text-white font-bold">{val}</td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const maxPeriod = useMemo(() => Math.max(state.currentPeriod, ...state.events.map(e => e.period || 1)), [state.events, state.currentPeriod]);

    const filteredEvents = useMemo(() => {
        return state.events.filter(e => {
            if (periodFilter !== 'ALL' && (e.period || 1) !== periodFilter) return false;
            return true;
        });
    }, [state.events, periodFilter]);

    const getZoneStats = (events: MatchEvent[], playerId: string | undefined, zones: ShotZone[], isRival = false) => {
        const targetEvents = events.filter(e =>
            (isRival ? e.isOpponent : e.playerId === playerId) &&
            (isRival ? e.type === 'OPPONENT_SHOT' : e.type === 'SHOT') &&
            e.shotZone && zones.includes(e.shotZone)
        );
        const goals = targetEvents.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
        return { goals, total: targetEvents.length };
    };

    const getPlacementStats = (events: MatchEvent[], playerId: string | undefined, isRival = false) => {
        const targetEvents = events.filter(e =>
            (isRival ? e.isOpponent : e.playerId === playerId) &&
            (isRival ? e.type === 'OPPONENT_SHOT' : e.type === 'SHOT')
        );
        return targetEvents.reduce((acc, shot) => {
            if (shot.shotPlacement) {
                if (!acc[shot.shotPlacement]) acc[shot.shotPlacement] = { goals: 0, total: 0 };
                acc[shot.shotPlacement].total++;
                if (shot.shotOutcome === ShotOutcome.GOAL) acc[shot.shotPlacement].goals++;
            }
            return acc;
        }, {} as Record<ShotPlacement, { goals: number, total: number }>);
    };

    // Optimization: Calculate stats only when events or player config changes, ignoring time updates
    const fieldPlayersStatsMap = useMemo(() => {
        const stats = new Map();
        state.players.forEach(p => {
            if (p.position === Position.STAFF) return;

            const playerEvents = filteredEvents.filter(e => e.playerId === p.id);
            const shots = playerEvents.filter(e => e.type === 'SHOT');
            const goals = shots.filter(e => e.type === 'SHOT' && e.shotOutcome === ShotOutcome.GOAL).length;
            const totalShots = shots.length;

            const turnoversEvents = playerEvents.filter(e => e.type === 'TURNOVER');
            const turnovers = turnoversEvents.length;
            const passBad = turnoversEvents.filter(e => e.turnoverType === TurnoverType.PASS).length;
            const reception = turnoversEvents.filter(e => e.turnoverType === TurnoverType.RECEPTION).length;
            const steps = turnoversEvents.filter(e => e.turnoverType === TurnoverType.STEPS).length;
            const double = turnoversEvents.filter(e => e.turnoverType === TurnoverType.DOUBLE).length;
            const line = turnoversEvents.filter(e => e.turnoverType === TurnoverType.LINE).length;
            const offFoul = turnoversEvents.filter(e => e.turnoverType === TurnoverType.OFFENSIVE_FOUL).length;

            const positiveEvents = playerEvents.filter(e => e.type === 'POSITIVE_ACTION');
            const positiveActions = positiveEvents.length;
            const steals = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.STEAL).length;
            const assists = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK).length;
            const penalties = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.FORCE_PENALTY).length;
            const goodDef = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.GOOD_DEFENSE).length;
            const blocks = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.BLOCK_SHOT).length;

            const yellow = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.YELLOW).length;
            const twoMin = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length;
            const red = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.RED).length;
            const blue = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.BLUE).length;

            const sixM = getZoneStats(filteredEvents, p.id, [ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]);
            const nineM = getZoneStats(filteredEvents, p.id, [ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]);
            const wing = getZoneStats(filteredEvents, p.id, [ShotZone.WING_L, ShotZone.WING_R]);
            const sevenM = getZoneStats(filteredEvents, p.id, [ShotZone.SEVEN_M]);
            const fastbreak = getZoneStats(filteredEvents, p.id, [ShotZone.FASTBREAK]);
            const placements = getPlacementStats(filteredEvents, p.id);

            // Calculate Rating (MVP)
            let rating = 0;
            rating += goals * RATING_WEIGHTS.GOAL;
            rating += (totalShots - goals) * RATING_WEIGHTS.MISS; // Simplify misses
            rating += assists * RATING_WEIGHTS.ASSIST;
            rating += steals * RATING_WEIGHTS.STEAL;
            rating += blocks * RATING_WEIGHTS.BLOCK;
            rating += penalties * RATING_WEIGHTS.EARNED_7M;
            rating += goodDef * RATING_WEIGHTS.GOOD_ID;
            rating += turnovers * RATING_WEIGHTS.TURNOVER;
            rating += yellow * RATING_WEIGHTS.YELLOW;
            rating += twoMin * RATING_WEIGHTS.TWO_MIN;
            rating += red * RATING_WEIGHTS.RED;
            rating += blue * RATING_WEIGHTS.BLUE;

            // GK Specifics if applicable (though separate map usually used)
            if (p.position === Position.GK) {
                const shotsAgainst = filteredEvents.filter(e => e.isOpponent && e.type === 'OPPONENT_SHOT' && e.playerId === p.id);
                const saves = shotsAgainst.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
                const goalsConc = shotsAgainst.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
                rating += saves * RATING_WEIGHTS.SAVE;
                rating += goalsConc * RATING_WEIGHTS.GOAL_CONCEDED;
            }

            stats.set(p.id, {
                goals, totalShots, percentage: totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0,
                turnovers, positiveActions, yellow, twoMin, red, blue,
                rating: Math.round(rating * 10) / 10, // Round to 1 decimal
                stats: { sixM, nineM, wing, sevenM, fastbreak, placements },
                breakdown: {
                    positive: { steals, assists, penalties, goodDef, blocks },
                    turnover: { passBad, reception, steps, double, line, offFoul }
                }
            });
        });
        return stats;
    }, [state.players.length, state.players.map(p => p.id).join(','), filteredEvents]);

    const maxRating = useMemo(() => {
        let max = -Infinity;
        fieldPlayersStatsMap.forEach(s => {
            if (s.rating > max) max = s.rating;
        });
        return max;
    }, [fieldPlayersStatsMap]);

    // Opponent Stats Detailed
    const opponentStatsMap = useMemo(() => {
        if (!state.opponentPlayers || state.opponentPlayers.length === 0) return new Map();
        const stats = new Map();

        state.opponentPlayers.forEach(p => {
            const playerEvents = filteredEvents.filter(e => e.isOpponent && e.opponentPlayerId === p.id);
            const shots = playerEvents.filter(e => e.type === 'OPPONENT_SHOT' || e.type === 'OPPONENT_GOAL');
            const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL || e.type === 'OPPONENT_GOAL').length;
            const totalShots = shots.length;

            const getZoneGoalsOpp = (zones: ShotZone[]) => {
                const zoneShots = shots.filter(s => s.shotZone && zones.includes(s.shotZone));
                const zoneGoals = zoneShots.filter(s => s.shotOutcome === ShotOutcome.GOAL || s.type === 'OPPONENT_GOAL').length;
                return { goals: zoneGoals, total: zoneShots.length };
            };

            const sixM = getZoneGoalsOpp([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]);
            const nineM = getZoneGoalsOpp([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]);
            const wing = getZoneGoalsOpp([ShotZone.WING_L, ShotZone.WING_R]);
            const sevenM = getZoneGoalsOpp([ShotZone.SEVEN_M]);
            const fastbreak = getZoneGoalsOpp([ShotZone.FASTBREAK]);

            const turnovers = playerEvents.filter(e => e.type === 'TURNOVER').length;
            const assists = playerEvents.filter(e => e.type === 'POSITIVE_ACTION' && (e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK)).length;

            const yellow = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.YELLOW).length;
            const twoMin = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length;
            const red = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.RED).length;
            const blue = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.BLUE).length;

            stats.set(p.id, {
                goals, totalShots, percentage: totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0,
                turnovers, assists, yellow, twoMin, red, blue, stats: { sixM, nineM, wing, sevenM, fastbreak }
            });
        });
        return stats;
    }, [state.opponentPlayers, filteredEvents]);

    const genericRivalStats = useMemo(() => {
        if (state.opponentPlayers && state.opponentPlayers.length > 0) return null;

        const rivalEvents = filteredEvents.filter(e => e.isOpponent);
        const shots = rivalEvents.filter(e => e.type === 'OPPONENT_SHOT' || e.type === 'OPPONENT_GOAL');
        const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL || e.type === 'OPPONENT_GOAL').length;
        const totalShots = shots.length;
        const percentage = totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0;

        const getZoneGoals = (zones: ShotZone[]) => {
            const zoneShots = shots.filter(s => s.shotZone && zones.includes(s.shotZone));
            const zGoals = zoneShots.filter(s => s.shotOutcome === ShotOutcome.GOAL || s.type === 'OPPONENT_GOAL').length;
            return { goals: zGoals, total: zoneShots.length };
        };

        return {
            goals, totalShots, percentage,
            turnovers: rivalEvents.filter(e => e.type === 'TURNOVER').length,
            yellow: rivalEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.YELLOW).length,
            twoMin: rivalEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length,
            red: rivalEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.RED).length,
            blue: rivalEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.BLUE).length,
            stats: {
                sixM: getZoneGoals([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]),
                nineM: getZoneGoals([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]),
                wing: getZoneGoals([ShotZone.WING_L, ShotZone.WING_R]),
                sevenM: getZoneGoals([ShotZone.SEVEN_M]),
                fastbreak: getZoneGoals([ShotZone.FASTBREAK]),
            }
        };
    }, [state.opponentPlayers, filteredEvents]);

    const gkStatsMap = useMemo(() => {
        const stats = new Map();
        state.players.forEach(gk => {
            if (gk.position !== Position.GK) return;
            const shotsAgainst = filteredEvents.filter(e => e.isOpponent && e.type === 'OPPONENT_SHOT' && e.playerId === gk.id);
            const saves = shotsAgainst.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
            const goals = shotsAgainst.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
            const total = saves + goals;
            stats.set(gk.id, { saves, goals, total, percentage: total > 0 ? Math.round((saves / total) * 100) : 0 });
        });
        return stats;
    }, [state.players.length, state.players.map(p => p.id).join(','), filteredEvents]);

    const renderRatioCell = (goals: number, total: number) => (<td className="px-2 py-3 text-center"> <div className="flex flex-col items-center leading-tight"> <span className={`${goals > 0 ? 'text-white font-bold' : 'text-slate-400'}`}>{goals}/{total}</span> {total > 0 && <span className="text-[9px] text-slate-500">{Math.round((goals / total) * 100)}%</span>} </div> </td>);



    // Prepare chart data for general view (Removed as unused or move if needed)

    // If a player is selected, show their detail view
    const selectedPlayer = selectedPlayerId ? (state.players.find(p => p.id === selectedPlayerId) || (state.opponentPlayers || []).find(p => p.id === selectedPlayerId)) : null;
    if (selectedPlayer) {
        return <ErrorBoundary viewName="Detalle Jugador" onReset={() => setSelectedPlayerId(null)}><PlayerDetailView player={selectedPlayer} state={state} onBack={() => setSelectedPlayerId(null)} /></ErrorBoundary>;
    }

    return (
        <div className="flex flex-col min-h-full bg-slate-900">
            {/* Filters */}
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-2 shrink-0 items-stretch sm:items-center justify-between">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 shrink-0">
                        <button onClick={() => setPeriodFilter('ALL')} className={`px-2 sm:px-3 py-1 text-xs font-bold rounded ${periodFilter === 'ALL' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>Todo</button>
                        {Array.from({ length: maxPeriod }).map((_, i) => (
                            <button key={i} onClick={() => setPeriodFilter(i + 1)} className={`px-2 sm:px-3 py-1 text-xs font-bold rounded ${periodFilter === i + 1 ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>P{i + 1}</button>
                        ))}
                    </div>
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 items-center">
                        <button onClick={() => setStatsTab('GENERAL')} className={`px-2 sm:px-3 py-1 text-xs font-bold rounded whitespace-nowrap ${statsTab === 'GENERAL' ? 'bg-handball-blue text-white' : 'text-slate-400 hover:text-white'}`}>General</button>
                        <button onClick={() => setStatsTab('SHOOTING')} className={`px-2 sm:px-3 py-1 text-xs font-bold rounded whitespace-nowrap ${statsTab === 'SHOOTING' ? 'bg-handball-blue text-white' : 'text-slate-400 hover:text-white'}`}>Tiro</button>
                        <button onClick={() => setStatsTab('PLACEMENT')} className={`px-2 sm:px-3 py-1 text-xs font-bold rounded whitespace-nowrap ${statsTab === 'PLACEMENT' ? 'bg-handball-blue text-white' : 'text-slate-400 hover:text-white'}`}>Portería</button>
                        <button onClick={() => setStatsTab('POSITIVE')} className={`px-2 sm:px-3 py-1 text-xs font-bold rounded whitespace-nowrap ${statsTab === 'POSITIVE' ? 'bg-handball-blue text-white' : 'text-slate-400 hover:text-white'}`}>Aciertos</button>
                        <button onClick={() => setStatsTab('TURNOVERS')} className={`px-2 sm:px-3 py-1 text-xs font-bold rounded whitespace-nowrap ${statsTab === 'TURNOVERS' ? 'bg-handball-blue text-white' : 'text-slate-400 hover:text-white'}`}>Fallos</button>
                        <button onClick={() => setStatsTab('RIVAL')} className={`px-2 sm:px-3 py-1 text-xs font-bold rounded whitespace-nowrap ${statsTab === 'RIVAL' ? 'bg-red-900 text-white' : 'text-slate-400 hover:text-white'}`}>Rival</button>
                    </div>
                </div>
                {!readOnly && (
                    <button
                        onClick={onExportToExcel}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:ml-auto shrink-0"
                    >
                        <Download size={16} />
                        <span className="inline">Exportar</span>
                    </button>
                )}
            </div>


            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto">

                {statsTab === 'GENERAL' && (
                    <div className="space-y-4">
                        {/* Scoreboard Summary */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center relative overflow-hidden">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Local</div>
                                <div className="text-sm font-bold text-slate-300 truncate px-2 mb-1">{state.metadata.homeTeam}</div>
                                <div className="text-4xl font-black text-white">{state.homeScore}</div>
                            </div>
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center relative overflow-hidden">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Visitante</div>
                                <div className="text-sm font-bold text-slate-300 truncate px-2 mb-1">{state.metadata.awayTeam}</div>
                                <div className="text-4xl font-black text-white">{state.awayScore}</div>
                            </div>
                        </div>



                        {/* Players Table */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                            <table className="w-full text-xs sm:text-sm">
                                <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-1 py-2 sm:px-3 sm:py-3 text-left cursor-pointer hover:text-white" onClick={() => handleHeaderClick('PLAYER')}>Jugador {sortConfig?.key.includes('PLAYER') && (sortConfig.key === 'PLAYER_NAME' ? '🔤' : '#️⃣')}</th>
                                        <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('GOALS')}>Gol</th>
                                        <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('PERCENTAGE')}>%</th>
                                        <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('TURNOVERS')}>Pér</th>
                                        <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('POSITIVE')}>Pos</th>
                                        <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-yellow-400 cursor-pointer hover:text-yellow-300" onClick={() => handleHeaderClick('SANCTIONS')}>Sanc</th>
                                        <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('TIME')}>Tiempo</th>
                                        <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-purple-400 cursor-pointer hover:text-purple-300" onClick={() => handleHeaderClick('RATING')}>Val</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {getSortedPlayers(state.players.filter(p => p.position !== Position.STAFF), fieldPlayersStatsMap).map(p => {
                                        const s = fieldPlayersStatsMap.get(p.id) || { goals: 0, totalShots: 0, percentage: 0, turnovers: 0, positiveActions: 0, yellow: 0, twoMin: 0, red: 0, blue: 0 };
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-700/50 cursor-pointer" onClick={() => setSelectedPlayerId(p.id)}>
                                                <td className="px-2 py-2 sm:px-3 sm:py-2">
                                                    <div className="flex items-center gap-1 sm:gap-2">
                                                        <span className="font-mono font-bold text-slate-500 w-4 sm:w-5 text-right">{p.number}</span>
                                                        <span className="truncate max-w-[80px] sm:max-w-[100px] font-medium text-handball-blue hover:text-white transition-colors">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 text-center font-bold text-white">{s.goals}/{s.totalShots}</td>
                                                <td className="px-2 py-2 text-center text-slate-400 text-xs">{s.percentage}%</td>
                                                <td className="px-2 py-2 text-center text-orange-300">{s.turnovers}</td>
                                                <td className="px-2 py-2 text-center text-green-300">{s.positiveActions}</td>
                                                <td className="px-2 py-2 text-center text-xs">
                                                    {s.yellow > 0 && <span className="text-yellow-500 mr-1">{s.yellow}A</span>}
                                                    {s.twoMin > 0 && <span className="text-white mr-1">{s.twoMin}'</span>}
                                                    {s.red > 0 && <span className="text-red-500">R</span>}
                                                </td>
                                                <td className="px-2 py-2 text-center text-xs text-slate-400">
                                                    {(() => {
                                                        const pt = getPlayingTimeForPeriod(p, periodFilter);
                                                        const m = Math.floor(pt / 60);
                                                        const sec = Math.floor(pt % 60);
                                                        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                                                    })()}
                                                </td>
                                                <td className="px-2 py-2 text-center font-bold text-purple-400">
                                                    {s.rating}
                                                    {s.rating === maxRating && s.rating > 0 && <span className="ml-1">🏆</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {statsTab === 'SHOOTING' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-3 py-3 text-left sticky left-0 bg-slate-900 z-10 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('PLAYER')}>Jugador</th>
                                    <th className="px-2 py-3 text-center bg-slate-800/50 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('TOTAL_SHOTS')}>Total</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('SIX_M')}>6m</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('NINE_M')}>9m</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('WING')}>Ext</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('SEVEN_M')}>7m</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('FASTBREAK')}>Contra</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {getSortedPlayers(state.players.filter(p => p.position !== Position.STAFF), fieldPlayersStatsMap).map(p => {
                                    const s = fieldPlayersStatsMap.get(p.id) || { goals: 0, totalShots: 0, stats: { sixM: { goals: 0, total: 0 }, nineM: { goals: 0, total: 0 }, wing: { goals: 0, total: 0 }, sevenM: { goals: 0, total: 0 }, fastbreak: { goals: 0, total: 0 } } };
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-700/50 cursor-pointer" onClick={() => setSelectedPlayerId(p.id)}>
                                            <td className="px-2 py-2 sticky left-0 bg-slate-800 z-10 border-r border-slate-700">
                                                <div className="flex items-center gap-1 sm:gap-2">
                                                    <span className="font-mono font-bold text-slate-500 w-4 sm:w-5 text-right">{p.number}</span>
                                                    <span className="truncate max-w-[80px] sm:max-w-none font-medium text-handball-blue hover:text-white transition-colors">{p.name}</span>
                                                </div>
                                            </td>
                                            {renderRatioCell(s.goals, s.totalShots)}
                                            {renderRatioCell(s.stats.sixM.goals, s.stats.sixM.total)}
                                            {renderRatioCell(s.stats.nineM.goals, s.stats.nineM.total)}
                                            {renderRatioCell(s.stats.wing.goals, s.stats.wing.total)}
                                            {renderRatioCell(s.stats.sevenM.goals, s.stats.sevenM.total)}
                                            {renderRatioCell(s.stats.fastbreak.goals, s.stats.fastbreak.total)}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {statsTab === 'PLACEMENT' && (
                    <div className="space-y-6">
                        {(() => {
                            // Sort GKs by appearance (first event index)
                            const gks = state.players.filter(p => p.position === Position.GK);
                            const appearanceTime: Record<string, number> = {};
                            gks.forEach(gk => appearanceTime[gk.id] = -1);

                            // Iterate events from oldest (end of array) to newest (start)
                            // state.events is [newest, ..., oldest]
                            for (let i = state.events.length - 1; i >= 0; i--) {
                                const e = state.events[i];
                                if (e.playerId && appearanceTime[e.playerId] === -1) {
                                    if (gks.some(g => g.id === e.playerId)) {
                                        appearanceTime[e.playerId] = i;
                                    }
                                }
                            }

                            const sortedGKs = [...gks].sort((a, b) => {
                                const timeA = appearanceTime[a.id];
                                const timeB = appearanceTime[b.id];
                                // Higher index = Older event = First appearance
                                return timeB - timeA;
                            });

                            return sortedGKs.map((gk, index) => {
                                const gkEvents = filteredEvents.filter(e =>
                                    e.type === 'OPPONENT_SHOT' &&
                                    e.playerId === gk.id &&
                                    e.shotPlacement
                                );

                                const stats: Partial<Record<ShotPlacement, { goals: number, saves: number }>> = {};
                                let totalSaves = 0;
                                let totalGoals = 0;

                                gkEvents.forEach(e => {
                                    if (!e.shotPlacement) return;
                                    if (!stats[e.shotPlacement]) stats[e.shotPlacement] = { goals: 0, saves: 0 };

                                    if (e.shotOutcome === ShotOutcome.GOAL) {
                                        stats[e.shotPlacement]!.goals++;
                                        totalGoals++;
                                    } else if (e.shotOutcome === ShotOutcome.SAVE) {
                                        stats[e.shotPlacement]!.saves++;
                                        totalSaves++;
                                    }
                                });

                                const totalShots = totalSaves + totalGoals;
                                const savePercent = totalShots > 0 ? Math.round((totalSaves / totalShots) * 100) : 0;

                                // Also include goals that didn't have placement if any? 
                                // Usually we want to match the total stats. 
                                // But for the visual, we only show placed shots.
                                // The header stats (Total/Percent) should probably reflect ALL shots faced by this GK.
                                const allGkEvents = filteredEvents.filter(e =>
                                    e.type === 'OPPONENT_SHOT' &&
                                    e.playerId === gk.id
                                );
                                const realTotalSaves = allGkEvents.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
                                const realTotalGoals = allGkEvents.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
                                const realTotal = realTotalSaves + realTotalGoals;
                                const realPercent = realTotal > 0 ? Math.round((realTotalSaves / realTotal) * 100) : 0;

                                return (
                                    <GoalStatsSVG
                                        key={gk.id}
                                        stats={stats}
                                        title={`Portero ${index + 1}`}
                                        playerName={`#${gk.number} ${gk.name} (${(() => {
                                            const pt = getPlayingTimeForPeriod(gk, periodFilter);
                                            const m = Math.floor(pt / 60);
                                            const s = Math.floor(pt % 60);
                                            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                        })()})`}
                                        totalShots={realTotal}
                                        savePercent={realPercent}
                                    />
                                );
                            });
                        })()}
                        {state.players.filter(p => p.position === Position.GK).length === 0 && (
                            <div className="text-center text-slate-500 italic p-4">No hay porteros registrados.</div>
                        )}
                    </div>
                )}

                {statsTab === 'POSITIVE' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-3 py-3 text-left cursor-pointer hover:text-white" onClick={() => handleHeaderClick('PLAYER')}>Jugador</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('POSITIVE')}>Total</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('STEALS')}>Recup</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('ASSISTS')}>Asist</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('PENALTIES')}>7m/2'</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('GOOD_DEF')}>Buena Df</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('BLOCKS')}>Blocaje</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {getSortedPlayers(state.players.filter(p => p.position !== Position.STAFF), fieldPlayersStatsMap).map(p => {
                                    const s = fieldPlayersStatsMap.get(p.id);
                                    if (!s || s.positiveActions === 0) return null;
                                    const { steals, assists, penalties, goodDef, blocks } = s.breakdown.positive;

                                    return (
                                        <tr key={p.id} className="hover:bg-slate-700/50">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-slate-500 w-5 text-right">{p.number}</span>
                                                    <span className="truncate font-medium text-white">{p.name.split(' ')[0]}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-center font-bold text-white">{s.positiveActions}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{steals}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{assists}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{penalties}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{goodDef}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{blocks}</td>
                                        </tr>
                                    );
                                })}
                                {!Array.from(fieldPlayersStatsMap.values()).some(s => s.positiveActions > 0) && (
                                    <tr><td colSpan={7} className="p-4 text-center text-slate-500 italic">No hay acciones positivas registradas.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {statsTab === 'TURNOVERS' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-3 py-3 text-left cursor-pointer hover:text-white" onClick={() => handleHeaderClick('PLAYER')}>Jugador</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('TURNOVERS')}>Total</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('PASS')}>Pase</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('RECEPTION')}>Recep</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('STEPS')}>Pasos</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('DOUBLE')}>Dobles</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('LINE')}>Pisar</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('OFF_FOUL')}>F. Ataque</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {getSortedPlayers(state.players.filter(p => p.position !== Position.STAFF), fieldPlayersStatsMap).map(p => {
                                    const s = fieldPlayersStatsMap.get(p.id);
                                    if (!s || s.turnovers === 0) return null;
                                    const { passBad, reception, steps, double, line, offFoul } = s.breakdown.turnover;

                                    return (
                                        <tr key={p.id} className="hover:bg-slate-700/50">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-slate-500 w-5 text-right">{p.number}</span>
                                                    <span className="truncate font-medium text-white">{p.name.split(' ')[0]}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-center font-bold text-white">{s.turnovers}</td>
                                            <td className="px-2 py-2 text-center text-orange-300">{passBad}</td>
                                            <td className="px-2 py-2 text-center text-orange-300">{reception}</td>
                                            <td className="px-2 py-2 text-center text-orange-300">{steps}</td>
                                            <td className="px-2 py-2 text-center text-orange-300">{double}</td>
                                            <td className="px-2 py-2 text-center text-orange-300">{line}</td>
                                            <td className="px-2 py-2 text-center text-orange-300">{offFoul}</td>
                                        </tr>
                                    );
                                })}
                                {!Array.from(fieldPlayersStatsMap.values()).some(s => s.turnovers > 0) && (
                                    <tr><td colSpan={8} className="p-4 text-center text-slate-500 italic">No hay fallos registrados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {statsTab === 'RIVAL' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-1 py-2 sm:px-3 sm:py-3 text-left sticky left-0 bg-slate-900 z-10 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('PLAYER')}>Jugador</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center bg-slate-800/50 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('TOTAL_SHOTS')}>Total</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('SIX_M')}>6m</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('NINE_M')}>9m</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('WING')}>Ext</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('SEVEN_M')}>7m</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('FASTBREAK')}>Contra</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('TURNOVERS')}>Pér</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-yellow-400 cursor-pointer hover:text-yellow-300" onClick={() => handleHeaderClick('SANCTIONS')}>Sanc</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {opponentStatsMap.size > 0 ? (
                                    getSortedPlayers(state.opponentPlayers || [], opponentStatsMap).map(p => {
                                        const s = opponentStatsMap.get(p.id) || { goals: 0, totalShots: 0, percentage: 0, turnovers: 0, assists: 0, yellow: 0, twoMin: 0, red: 0, blue: 0, stats: { sixM: { goals: 0, total: 0 }, nineM: { goals: 0, total: 0 }, wing: { goals: 0, total: 0 }, sevenM: { goals: 0, total: 0 }, fastbreak: { goals: 0, total: 0 } } };
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-700/50 cursor-pointer" onClick={() => setSelectedPlayerId(p.id)}>
                                                <td className="px-3 py-2 sticky left-0 bg-slate-800 z-10 border-r border-slate-700">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-slate-500 w-5 text-right">{p.number}</span>
                                                        <span className="truncate max-w-[100px] font-medium text-white">{p.name}</span>
                                                    </div>
                                                </td>
                                                {renderRatioCell(s.goals, s.totalShots)}
                                                {renderRatioCell(s.stats.sixM.goals, s.stats.sixM.total)}
                                                {renderRatioCell(s.stats.nineM.goals, s.stats.nineM.total)}
                                                {renderRatioCell(s.stats.wing.goals, s.stats.wing.total)}
                                                {renderRatioCell(s.stats.sevenM.goals, s.stats.sevenM.total)}
                                                {renderRatioCell(s.stats.fastbreak.goals, s.stats.fastbreak.total)}
                                                <td className="px-2 py-2 text-center text-orange-300">{s.turnovers}</td>
                                                <td className="px-2 py-2 text-center text-xs">
                                                    {s.yellow > 0 && <span className="text-yellow-500 mr-1">{s.yellow}A</span>}
                                                    {s.twoMin > 0 && <span className="text-white mr-1">{s.twoMin}'</span>}
                                                    {s.red > 0 && <span className="text-red-500">R</span>}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : genericRivalStats ? (
                                    <tr className="hover:bg-slate-700/50">
                                        <td className="px-3 py-2 sticky left-0 bg-slate-800 z-10 border-r border-slate-700">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-slate-500 w-5 text-right">0</span>
                                                <span className="truncate font-medium text-white">Rival (Total)</span>
                                            </div>
                                        </td>
                                        {renderRatioCell(genericRivalStats.goals, genericRivalStats.totalShots)}
                                        {renderRatioCell(genericRivalStats.stats.sixM.goals, genericRivalStats.stats.sixM.total)}
                                        {renderRatioCell(genericRivalStats.stats.nineM.goals, genericRivalStats.stats.nineM.total)}
                                        {renderRatioCell(genericRivalStats.stats.wing.goals, genericRivalStats.stats.wing.total)}
                                        {renderRatioCell(genericRivalStats.stats.sevenM.goals, genericRivalStats.stats.sevenM.total)}
                                        {renderRatioCell(genericRivalStats.stats.fastbreak.goals, genericRivalStats.stats.fastbreak.total)}
                                        <td className="px-2 py-2 text-center text-orange-300">{genericRivalStats.turnovers}</td>
                                        <td className="px-2 py-2 text-center text-xs">
                                            {genericRivalStats.yellow > 0 && <span className="text-yellow-500 mr-1">{genericRivalStats.yellow}A</span>}
                                            {genericRivalStats.twoMin > 0 && <span className="text-white mr-1">{genericRivalStats.twoMin}'</span>}
                                            {genericRivalStats.red > 0 && <span className="text-red-500">R</span>}
                                        </td>
                                    </tr>
                                ) : (
                                    <tr><td colSpan={10} className="p-4 text-center text-slate-500">No hay datos del rival.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div >
    );
};
