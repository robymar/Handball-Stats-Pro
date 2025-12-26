import React, { useMemo } from 'react';
import { Player, MatchEvent, MatchState, ShotZone, ShotOutcome, ShotPlacement, Position, SanctionType } from '../types.ts';
import { BarChart, DonutChart, RadarChart } from './ChartComponents.tsx';
import { ArrowLeft, Target, Activity, AlertCircle, ThumbsUp } from 'lucide-react';
import { GoalStatsSVG } from './GoalStatsSVG.tsx';
import { CourtSVG } from './CourtSVG.tsx';

interface PlayerDetailViewProps {
    player: Player;
    state: MatchState;
    onBack: () => void;
}

export const PlayerDetailView: React.FC<PlayerDetailViewProps> = ({ player, state, onBack }) => {
    const isGoalkeeper = player.position === Position.GK;

    // Filter events for this player
    const playerEvents = useMemo(() => {
        return state.events.filter(e => e.playerId === player.id);
    }, [state.events, player.id]);

    // Calculate stats
    const stats = useMemo(() => {
        if (isGoalkeeper) {
            // Goalkeeper stats
            const shotsAgainst = playerEvents.filter(e => e.isOpponent && e.type === 'OPPONENT_SHOT');
            const saves = shotsAgainst.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
            const goals = shotsAgainst.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
            const total = saves + goals;
            const percentage = total > 0 ? Math.round((saves / total) * 100) : 0;

            return {
                saves,
                goalsAgainst: goals,
                totalShots: total,
                savePercentage: percentage,
            };
        } else {
            // Field player stats
            const shots = playerEvents.filter(e => e.type === 'SHOT');
            const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
            const turnovers = playerEvents.filter(e => e.type === 'TURNOVER').length;
            const positiveActions = playerEvents.filter(e => e.type === 'POSITIVE_ACTION').length;
            const sanctions = playerEvents.filter(e => e.type === 'SANCTION');
            const yellow = sanctions.filter(e => e.sanctionType === SanctionType.YELLOW).length;
            const twoMin = sanctions.filter(e => e.sanctionType === SanctionType.TWO_MIN).length;
            const red = sanctions.filter(e => e.sanctionType === SanctionType.RED).length;

            // Zone stats
            const zoneStats = {
                sixM: shots.filter(e => [ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R].includes(e.shotZone!)),
                nineM: shots.filter(e => [ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R].includes(e.shotZone!)),
                wing: shots.filter(e => [ShotZone.WING_L, ShotZone.WING_R].includes(e.shotZone!)),
                sevenM: shots.filter(e => e.shotZone === ShotZone.SEVEN_M),
                fastbreak: shots.filter(e => e.shotZone === ShotZone.FASTBREAK),
            };

            // Placement stats
            const placementStats: Record<ShotPlacement, number> = {} as any;
            shots.forEach(shot => {
                if (shot.shotPlacement) {
                    placementStats[shot.shotPlacement] = (placementStats[shot.shotPlacement] || 0) + 1;
                }
            });

            return {
                goals,
                totalShots: shots.length,
                shootingPercentage: shots.length > 0 ? Math.round((goals / shots.length) * 100) : 0,
                turnovers,
                positiveActions,
                yellow,
                twoMin,
                red,
                zoneStats,
                placementStats,
            };
        }
    }, [playerEvents, isGoalkeeper]);

    // Prepare visualization data
    const zoneStatsVisual = useMemo(() => {
        if (isGoalkeeper) return undefined;

        const visual: Record<ShotZone, { goals: number, total: number }> = {} as any;
        const shots = playerEvents.filter(e => e.type === 'SHOT');

        Object.values(ShotZone).forEach(z => {
            const zoneEvents = shots.filter(e => e.shotZone === z);
            if (zoneEvents.length > 0) {
                visual[z] = {
                    goals: zoneEvents.filter(e => e.shotOutcome === ShotOutcome.GOAL).length,
                    total: zoneEvents.length
                };
            }
        });
        return visual;
    }, [playerEvents, isGoalkeeper]);

    const placementStatsVisual = useMemo(() => {
        if (isGoalkeeper) return undefined;

        const visual: Record<ShotPlacement, { goals: number, saves: number }> = {} as any;
        const shots = playerEvents.filter(e => e.type === 'SHOT' && e.shotPlacement);

        shots.forEach(s => {
            if (!s.shotPlacement) return;
            if (!visual[s.shotPlacement]) visual[s.shotPlacement] = { goals: 0, saves: 0 };

            if (s.shotOutcome === ShotOutcome.GOAL) {
                visual[s.shotPlacement].goals++;
            } else {
                visual[s.shotPlacement].saves++; // Misses/Saves count differently for player view
            }
        });
        return visual;
    }, [playerEvents, isGoalkeeper]);

    // Format time for timeline
    const formatTime = (timestamp: number, period: number) => {
        const min = Math.floor(Math.abs(timestamp) / 60).toString().padStart(2, '0');
        const sec = Math.floor(Math.abs(timestamp) % 60).toString().padStart(2, '0');
        const periodLabel = period > state.config.regularPeriods ? `OT${period - state.config.regularPeriods}` : `P${period}`;
        return `${min}:${sec} (${periodLabel})`;
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 p-4 pb-24 overflow-y-auto">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-handball-blue hover:text-white transition-colors mb-4"
                >
                    <ArrowLeft size={20} />
                    <span className="font-bold">Volver a Estadísticas</span>
                </button>

                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-handball-blue flex items-center justify-center">
                            <span className="text-3xl font-black text-white">{player.number}</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white">{player.name}</h1>
                            <p className="text-slate-400">{player.position}</p>
                            <p className="text-xs text-slate-500">Tiempo: {Math.floor((player.playingTime || 0) / 60)}min</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            {isGoalkeeper ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                        <div className="text-3xl font-black text-handball-blue">{stats.saves}</div>
                        <div className="text-xs text-slate-400 uppercase">Paradas</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                        <div className="text-3xl font-black text-red-400">{stats.goalsAgainst}</div>
                        <div className="text-xs text-slate-400 uppercase">Goles Rec.</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                        <div className="text-3xl font-black text-white">{stats.totalShots}</div>
                        <div className="text-xs text-slate-400 uppercase">Tiros Totales</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                        <div className="text-3xl font-black text-green-400">{stats.savePercentage}%</div>
                        <div className="text-xs text-slate-400 uppercase">Efectividad</div>
                    </div>
                </div>
            ) : (
                <React.Fragment>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                            <div className="text-3xl font-black text-green-400">{stats.goals}</div>
                            <div className="text-xs text-slate-400 uppercase">Goles</div>
                        </div>
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                            <div className="text-3xl font-black text-white">{stats.totalShots}</div>
                            <div className="text-xs text-slate-400 uppercase">Tiros</div>
                        </div>
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                            <div className="text-3xl font-black text-handball-blue">{stats.shootingPercentage}%</div>
                            <div className="text-xs text-slate-400 uppercase">Efectividad</div>
                        </div>
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                            <div className="text-3xl font-black text-orange-400">{stats.turnovers}</div>
                            <div className="text-xs text-slate-400 uppercase">Pérdidas</div>
                        </div>
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                            <div className="text-3xl font-black text-emerald-400">{stats.positiveActions}</div>
                            <div className="text-xs text-slate-400 uppercase">Acc. Positivas</div>
                        </div>
                    </div>

                    {/* Visual Stats */}
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                        {/* Shooting Visual */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col items-center">
                            <h3 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2">
                                <Activity size={16} className="text-handball-blue" />
                                Mapa de Tiros
                            </h3>
                            <div className="w-full max-w-sm">
                                <GoalStatsSVG
                                    stats={placementStatsVisual || {}}
                                    totalShots={stats.totalShots}
                                    shootingPercent={stats.shootingPercentage}
                                    mode="PLAYER"
                                />
                            </div>
                        </div>

                        {/* Court Visual */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col items-center">
                            <h3 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2">
                                <Target size={16} className="text-handball-blue" />
                                Zonas de Lanzamiento
                            </h3>
                            <div className="w-full max-w-sm">
                                <CourtSVG
                                    readOnly
                                    zoneStats={zoneStatsVisual}
                                />
                            </div>
                        </div>
                    </div>
                </React.Fragment>
            )}

            {/* Timeline */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase mb-4">Timeline de Eventos</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto pb-4">
                    {playerEvents.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-4">No hay eventos registrados</p>
                    ) : (
                        playerEvents.map(event => {
                            let icon = '•';
                            let text = '';
                            let colorClass = 'text-slate-400';

                            switch (event.type) {
                                case 'SHOT':
                                    if (event.shotOutcome === ShotOutcome.GOAL) {
                                        icon = '⚽';
                                        text = `GOL (${event.shotZone})`;
                                        colorClass = 'text-green-400';
                                    } else {
                                        icon = '🚫';
                                        text = `Tiro ${event.shotOutcome} (${event.shotZone})`;
                                        colorClass = 'text-slate-400';
                                    }
                                    break;
                                case 'OPPONENT_SHOT':
                                    if (event.shotOutcome === ShotOutcome.SAVE) {
                                        icon = '🧤';
                                        text = 'PARADA';
                                        colorClass = 'text-handball-blue';
                                    } else {
                                        icon = '❌';
                                        text = `Gol recibido`;
                                        colorClass = 'text-red-400';
                                    }
                                    break;
                                case 'TURNOVER':
                                    icon = '⚠️';
                                    text = `Pérdida (${event.turnoverType})`;
                                    colorClass = 'text-orange-400';
                                    break;
                                case 'POSITIVE_ACTION':
                                    icon = '👍';
                                    text = `${event.positiveActionType}`;
                                    colorClass = 'text-emerald-400';
                                    break;
                                case 'SANCTION':
                                    icon = '🟨';
                                    text = `Sanción ${event.sanctionType}`;
                                    colorClass = 'text-yellow-400';
                                    break;
                                case 'SUBSTITUTION':
                                    if (event.playerInId === player.id) {
                                        icon = '🔼';
                                        text = 'Entra al campo';
                                        colorClass = 'text-sky-400';
                                    } else {
                                        icon = '🔽';
                                        text = 'Sale del campo';
                                        colorClass = 'text-slate-500';
                                    }
                                    break;
                            }

                            return (
                                <div key={event.id} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg">
                                    <span className="text-xs font-mono text-slate-500 w-20">
                                        {formatTime(event.timestamp, event.period || 1)}
                                    </span>
                                    <span className="text-lg">{icon}</span>
                                    <span className={`text-sm flex-1 ${colorClass}`}>{text}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
