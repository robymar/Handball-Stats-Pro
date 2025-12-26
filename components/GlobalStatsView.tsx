import React, { useEffect, useState } from 'react';
import { loadMatch, getMatchHistory, MatchSummary } from '../services/storageService.ts';
import { Player, Position, ShotOutcome, TurnoverType, PositiveActionType, SanctionType, ShotZone, MatchEvent } from '../types.ts';
import { RATING_WEIGHTS } from '../constants.ts';
import { ArrowLeft, Trophy, Calendar, Activity, ShieldAlert, Download, MousePointerClick } from 'lucide-react';

interface GlobalStatsViewProps {
    teamId: string;
    teamName: string;
    onBack: () => void;
    onLoadMatch: (id: string) => void;
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
    visible: boolean; // false if played 0 matches/time?

    // Generales
    matchesPlayed: number;
    playingTime: number; // seconds
    goals: number;
    totalShots: number;
    assists: number;
    steals: number;
    blocks: number;

    // Sanctions
    yellow: number;
    twoMin: number;
    red: number;
    blue: number;

    // Turnovers
    turnovers: number;
    turnoverPass: number;
    turnoverReception: number;
    turnoverSteps: number;
    turnoverDouble: number;
    turnoverLine: number;
    turnoverOffFoul: number;

    // Positive
    penalties: number; // 7m earned
    goodDef: number;

    // Shooting Breakdown
    sixM: BreakdownStats;
    nineM: BreakdownStats;
    wing: BreakdownStats;
    sevenM: BreakdownStats;
    fastbreak: BreakdownStats;

    // GK
    saves: number;
    goalsAgainst: number;
    gkAssists: number; // usually same as assists

    // Rating
    totalRating: number;
}

type SortField = string;
type SortDirection = 'asc' | 'desc';

export const GlobalStatsView: React.FC<GlobalStatsViewProps> = ({ teamId, teamName, onBack, onLoadMatch }) => {
    const [stats, setStats] = useState<AggregatedPlayerStats[]>([]);
    const [includedMatches, setIncludedMatches] = useState<MatchSummary[]>([]);
    const [loading, setLoading] = useState(true);

    // Header Stats
    const [matchCount, setMatchCount] = useState(0);
    const [wins, setWins] = useState(0);
    const [draws, setDraws] = useState(0);
    const [losses, setLosses] = useState(0);

    // Tab State
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'SHOOTING' | 'GOALKEEPERS' | 'POSITIVE' | 'TURNOVERS'>('GENERAL');

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: SortDirection }>({ key: 'goals', direction: 'desc' });

    const handleHeaderClick = (key: string) => {
        setSortConfig(current => {
            if (current.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const history = getMatchHistory(teamId);
            setMatchCount(history.length);

            const playerStatsMap = new Map<string, AggregatedPlayerStats>();
            const processedMatches: MatchSummary[] = [];

            let winCount = 0;
            let drawCount = 0;
            let lossCount = 0;

            const initStats = (p: Player): AggregatedPlayerStats => ({
                playerId: p.id,
                name: p.name,
                number: p.number,
                position: p.position,
                visible: true,
                matchesPlayed: 0,
                playingTime: 0,
                goals: 0,
                totalShots: 0,
                assists: 0,
                steals: 0,
                blocks: 0,
                yellow: 0,
                twoMin: 0,
                red: 0,
                blue: 0,
                turnovers: 0,
                turnoverPass: 0,
                turnoverReception: 0,
                turnoverSteps: 0,
                turnoverDouble: 0,
                turnoverLine: 0,
                turnoverOffFoul: 0,
                penalties: 0,
                goodDef: 0,
                sixM: { goals: 0, total: 0 },
                nineM: { goals: 0, total: 0 },
                wing: { goals: 0, total: 0 },
                sevenM: { goals: 0, total: 0 },
                fastbreak: { goals: 0, total: 0 },
                saves: 0,
                goalsAgainst: 0,
                gkAssists: 0,
                totalRating: 0
            });

            // Helper to get entries by name+number (merging players across matches)
            const getEntry = (p: Player): AggregatedPlayerStats => {
                const key = `${p.number}-${p.name.trim().toLowerCase()}`;
                if (!playerStatsMap.has(key)) {
                    playerStatsMap.set(key, initStats(p));
                }
                const entry = playerStatsMap.get(key)!;
                // Update basic info in case it changed
                entry.name = p.name;
                entry.position = p.position;
                return entry;
            };

            for (const summary of history) {
                const match = loadMatch(summary.id);
                if (!match) continue;
                processedMatches.push(summary);

                // Result
                // Fallback: If isOurTeamHome missing, guess by name
                const isHome = match.metadata.isOurTeamHome ?? (match.metadata.homeTeam === teamName);
                const ourScore = isHome ? match.homeScore : match.awayScore;
                const oppScore = isHome ? match.awayScore : match.homeScore;

                if (ourScore > oppScore) winCount++;
                else if (ourScore === oppScore) drawCount++;
                else lossCount++;

                match.players.forEach(p => {
                    const entry = getEntry(p);
                    // Assume played if in roster? Or check events?
                    // Let's count as played if time > 0 OR present in list (simple participation)
                    entry.matchesPlayed++;
                    entry.playingTime += (p.playingTime || 0);

                    // Calculate Match Rating
                    const pEvents = match.events.filter(e => e.playerId === p.id);
                    // We can reuse the aggregation logic below to sum up rating components, 
                    // or calculate rating per match and sum it.
                    // Aggregation is cleaner.
                });

                // Events
                match.events.forEach(e => {
                    if (e.isOpponent || !e.playerId) return;
                    const p = match.players.find(pl => pl.id === e.playerId);
                    if (!p) return;

                    const entry = getEntry(p);

                    // --- SCORING & SHOOTING ---
                    if (e.type === 'SHOT') {
                        entry.totalShots++;
                        const isGoal = e.shotOutcome === ShotOutcome.GOAL;
                        if (isGoal) entry.goals++;

                        // Breakdowns
                        if (e.shotZone) {
                            if ([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R].includes(e.shotZone)) {
                                entry.sixM.total++;
                                if (isGoal) entry.sixM.goals++;
                            } else if ([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R].includes(e.shotZone)) {
                                entry.nineM.total++;
                                if (isGoal) entry.nineM.goals++;
                            } else if ([ShotZone.WING_L, ShotZone.WING_R].includes(e.shotZone)) {
                                entry.wing.total++;
                                if (isGoal) entry.wing.goals++;
                            } else if (e.shotZone === ShotZone.SEVEN_M) {
                                entry.sevenM.total++;
                                if (isGoal) entry.sevenM.goals++;
                            } else if (e.shotZone === ShotZone.FASTBREAK) {
                                entry.fastbreak.total++;
                                if (isGoal) entry.fastbreak.goals++;
                            }
                        }
                    }

                    // --- TURNOVERS ---
                    if (e.type === 'TURNOVER') {
                        entry.turnovers++;
                        if (e.turnoverType === TurnoverType.PASS) entry.turnoverPass++;
                        if (e.turnoverType === TurnoverType.RECEPTION) entry.turnoverReception++;
                        if (e.turnoverType === TurnoverType.STEPS) entry.turnoverSteps++;
                        if (e.turnoverType === TurnoverType.DOUBLE) entry.turnoverDouble++;
                        if (e.turnoverType === TurnoverType.LINE) entry.turnoverLine++;
                        if (e.turnoverType === TurnoverType.OFFENSIVE_FOUL) entry.turnoverOffFoul++;
                    }

                    // --- POSITIVE ACTIONS ---
                    if (e.type === 'POSITIVE_ACTION') {
                        if (e.positiveActionType === PositiveActionType.ASSIST_BLOCK) entry.assists++;
                        if (e.positiveActionType === PositiveActionType.STEAL) entry.steals++;
                        if (e.positiveActionType === PositiveActionType.BLOCK_SHOT) entry.blocks++;
                        if (e.positiveActionType === PositiveActionType.FORCE_PENALTY) entry.penalties++;
                        if (e.positiveActionType === PositiveActionType.GOOD_DEFENSE) entry.goodDef++;
                    }

                    // --- SANCTIONS ---
                    if (e.type === 'SANCTION') {
                        if (e.sanctionType === SanctionType.YELLOW) entry.yellow++;
                        if (e.sanctionType === SanctionType.TWO_MIN) entry.twoMin++;
                        if (e.sanctionType === SanctionType.RED) entry.red++;
                        if (e.sanctionType === SanctionType.BLUE) entry.blue++;
                    }
                });

                // --- GK SCORING AGAINST ---
                match.events.forEach(e => {
                    if (e.type === 'OPPONENT_SHOT' && e.isOpponent && e.playerId) {
                        const p = match.players.find(pl => pl.id === e.playerId);
                        if (!p) return;
                        const entry = getEntry(p);

                        if (e.shotOutcome === ShotOutcome.SAVE) entry.saves++;
                        if (e.shotOutcome === ShotOutcome.GOAL) entry.goalsAgainst++;
                    }
                });
            }

            // --- CALCULATE RATINGS ---
            playerStatsMap.forEach(s => {
                let r = 0;
                r += s.goals * RATING_WEIGHTS.GOAL;
                r += (s.totalShots - s.goals) * RATING_WEIGHTS.MISS;
                r += s.assists * RATING_WEIGHTS.ASSIST;
                r += s.steals * RATING_WEIGHTS.STEAL;
                r += s.blocks * RATING_WEIGHTS.BLOCK;
                r += s.penalties * RATING_WEIGHTS.EARNED_7M;
                r += s.goodDef * RATING_WEIGHTS.GOOD_ID;
                r += s.turnovers * RATING_WEIGHTS.TURNOVER;
                r += s.yellow * RATING_WEIGHTS.YELLOW;
                r += s.twoMin * RATING_WEIGHTS.TWO_MIN;
                r += s.red * RATING_WEIGHTS.RED;
                r += s.blue * RATING_WEIGHTS.BLUE;

                // GK Rating
                if (s.position === Position.GK) {
                    r += s.saves * RATING_WEIGHTS.SAVE;
                    r += s.goalsAgainst * RATING_WEIGHTS.GOAL_CONCEDED;
                }

                s.totalRating = r;
            });

            setWins(winCount);
            setDraws(drawCount);
            setLosses(lossCount);
            setStats(Array.from(playerStatsMap.values()).sort((a, b) => a.number - b.number));
            setIncludedMatches(processedMatches);
            setLoading(false);
        };

        loadData();
    }, [teamId, teamName]);

    const getSortedStats = (players: AggregatedPlayerStats[]) => {
        return [...players].sort((a, b) => {
            let valA: any = 0;
            let valB: any = 0;
            const k = sortConfig.key;

            switch (k) {
                case 'number': valA = a.number; valB = b.number; break;
                case 'matchesPlayed': valA = a.matchesPlayed; valB = b.matchesPlayed; break;
                case 'playingTime': valA = a.playingTime; valB = b.playingTime; break;
                case 'goals': valA = a.goals; valB = b.goals; break;
                case 'shots': valA = a.totalShots; valB = b.totalShots; break;
                case 'percentage':
                    valA = a.totalShots > 0 ? (a.goals / a.totalShots) : 0;
                    valB = b.totalShots > 0 ? (b.goals / b.totalShots) : 0;
                    break;
                case 'assists': valA = a.assists; valB = b.assists; break;
                case 'steals': valA = a.steals; valB = b.steals; break;
                case 'turnovers': valA = a.turnovers; valB = b.turnovers; break;
                case 'positive': valA = (a.steals + a.assists + a.blocks + a.penalties + a.goodDef); valB = (b.steals + b.assists + b.blocks + b.penalties + b.goodDef); break;
                case 'sanctions': valA = (a.yellow + a.twoMin + a.red); valB = (b.yellow + b.twoMin + b.red); break;
                case 'rating':
                    // Sort by Average Rating (Total / Matches)
                    valA = a.matchesPlayed > 0 ? (a.totalRating / a.matchesPlayed) : 0;
                    valB = b.matchesPlayed > 0 ? (b.totalRating / b.matchesPlayed) : 0;
                    break;
                // Shooting
                case 'sixM': valA = a.sixM.goals; valB = b.sixM.goals; break;
                case 'nineM': valA = a.nineM.goals; valB = b.nineM.goals; break;
                case 'wing': valA = a.wing.goals; valB = b.wing.goals; break;
                case 'sevenM': valA = a.sevenM.goals; valB = b.sevenM.goals; break;
                case 'fastbreak': valA = a.fastbreak.goals; valB = b.fastbreak.goals; break;
                // GK
                case 'saves': valA = a.saves; valB = b.saves; break;
                case 'goalsAgainst': valA = a.goalsAgainst; valB = b.goalsAgainst; break;
                case 'savePercent':
                    valA = (a.saves + a.goalsAgainst) > 0 ? (a.saves / (a.saves + a.goalsAgainst)) : 0;
                    valB = (b.saves + b.goalsAgainst) > 0 ? (b.saves / (b.saves + b.goalsAgainst)) : 0;
                    break;
                // Positive
                case 'penalties': valA = a.penalties; valB = b.penalties; break;
                case 'goodDef': valA = a.goodDef; valB = b.goodDef; break;
                case 'blocks': valA = a.blocks; valB = b.blocks; break;
                // Turnovers
                case 'pass': valA = a.turnoverPass; valB = b.turnoverPass; break;
                case 'reception': valA = a.turnoverReception; valB = b.turnoverReception; break;
                case 'steps': valA = a.turnoverSteps; valB = b.turnoverSteps; break;
                case 'double': valA = a.turnoverDouble; valB = b.turnoverDouble; break;
                case 'line': valA = a.turnoverLine; valB = b.turnoverLine; break;
                case 'offFoul': valA = a.turnoverOffFoul; valB = b.turnoverOffFoul; break;
                default: valA = 0; valB = 0;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const renderRatioCell = (goals: number, total: number) => {
        const pct = total > 0 ? Math.round((goals / total) * 100) : 0;
        let colorClass = 'text-slate-400';
        if (total > 0) {
            if (pct >= 80) colorClass = 'text-green-500 font-bold';
            else if (pct >= 50) colorClass = 'text-yellow-500';
            else colorClass = 'text-red-500';
        }
        return (
            <td className="px-2 py-2 text-center">
                <div className="flex flex-col">
                    <span className="text-white font-bold">{goals}/{total}</span>
                    <span className={`text-[10px] ${colorClass}`}>{pct}%</span>
                </div>
            </td>
        );
    };

    if (loading) return <div className="h-full flex items-center justify-center text-white">Cargando estadísticas...</div>;

    const filteredPlayers = stats.filter(p => p.position !== Position.STAFF); // General list excludes staff
    const goalkeepers = stats.filter(p => p.position === Position.GK);

    return (
        <div className="h-full bg-slate-900 p-4 sm:p-6 overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={32} />
                    </button>
                    <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Trophy className="text-handball-orange w-6 h-6 sm:w-8 sm:h-8" /> Estadísticas Globales
                    </h1>
                </div>
            </div>

            {/* Team Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 shrink-0">
                <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700">
                    <div className="text-slate-400 text-xs uppercase font-bold">Partidos</div>
                    <div className="text-2xl sm:text-3xl font-black text-white">{matchCount}</div>
                </div>
                <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700">
                    <div className="text-slate-400 text-xs uppercase font-bold">Victorias</div>
                    <div className="text-2xl sm:text-3xl font-black text-green-500">{wins}</div>
                </div>
                <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700">
                    <div className="text-slate-400 text-xs uppercase font-bold">Empates</div>
                    <div className="text-2xl sm:text-3xl font-black text-orange-500">{draws}</div>
                </div>
                <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700">
                    <div className="text-slate-400 text-xs uppercase font-bold">Derrotas</div>
                    <div className="text-2xl sm:text-3xl font-black text-red-500">{losses}</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4 shrink-0 overflow-x-auto no-scrollbar pb-2">
                <button onClick={() => setActiveTab('GENERAL')} className={`px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 border ${activeTab === 'GENERAL' ? 'border-handball-blue text-white bg-slate-700' : 'border-slate-700 text-slate-400 hover:text-white'}`}>General</button>
                <button onClick={() => setActiveTab('SHOOTING')} className={`px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 border ${activeTab === 'SHOOTING' ? 'border-handball-blue text-white bg-slate-700' : 'border-slate-700 text-slate-400 hover:text-white'}`}>Tiro</button>
                <button onClick={() => setActiveTab('GOALKEEPERS')} className={`px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 border ${activeTab === 'GOALKEEPERS' ? 'border-handball-blue text-white bg-slate-700' : 'border-slate-700 text-slate-400 hover:text-white'}`}>Portería</button>
                <button onClick={() => setActiveTab('POSITIVE')} className={`px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 border ${activeTab === 'POSITIVE' ? 'border-handball-blue text-white bg-slate-700' : 'border-slate-700 text-slate-400 hover:text-white'}`}>Aciertos</button>
                <button onClick={() => setActiveTab('TURNOVERS')} className={`px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 border ${activeTab === 'TURNOVERS' ? 'border-handball-blue text-white bg-slate-700' : 'border-slate-700 text-slate-400 hover:text-white'}`}>Fallos</button>
            </div>

            {/* Content Area */}
            <div className="min-h-[300px] overflow-auto bg-slate-800 rounded-xl border border-slate-700 mb-6 shrink-0">
                <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold sticky top-0 z-10">
                        <tr>
                            <th className="px-2 py-2 sm:px-3 sm:py-3 text-left cursor-pointer hover:text-white" onClick={() => handleHeaderClick('number')}>Jugador</th>
                            {activeTab === 'GENERAL' && (
                                <>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('matchesPlayed')}>PJ</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('goals')}>Goles</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('percentage')}>%</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('playingTime')}>Tm/P</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('turnovers')}>Pér</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('positive')}>Pos</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-yellow-400 cursor-pointer hover:text-yellow-300" onClick={() => handleHeaderClick('sanctions')}>Sanc</th>
                                    <th className="px-1 py-2 sm:px-2 sm:py-3 text-center text-purple-400 cursor-pointer hover:text-purple-300" onClick={() => handleHeaderClick('rating')}>Val/P</th>
                                </>
                            )}
                            {activeTab === 'SHOOTING' && (
                                <>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('shots')}>Total</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('sixM')}>6m</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('nineM')}>9m</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('wing')}>Ext</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('sevenM')}>7m</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('fastbreak')}>Contra</th>
                                </>
                            )}
                            {activeTab === 'GOALKEEPERS' && (
                                <>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('matchesPlayed')}>PJ</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('playingTime')}>Tiempo/P</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('saves')}>Paradas</th>
                                    <th className="px-2 py-3 text-center text-red-400 cursor-pointer hover:text-red-300" onClick={() => handleHeaderClick('goalsAgainst')}>Goles Rec.</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('savePercent')}>%</th>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('assists')}>Asist</th>
                                </>
                            )}
                            {activeTab === 'POSITIVE' && (
                                <>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('positive')}>Total</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('steals')}>Recup</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('assists')}>Asist</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('penalties')}>7m Prov</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('goodDef')}>Buena Df</th>
                                    <th className="px-2 py-3 text-center text-green-400 cursor-pointer hover:text-green-300" onClick={() => handleHeaderClick('blocks')}>Blocaje</th>
                                </>
                            )}
                            {activeTab === 'TURNOVERS' && (
                                <>
                                    <th className="px-2 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleHeaderClick('turnovers')}>Total</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('pass')}>Pase</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('reception')}>Recep</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('steps')}>Pasos</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('double')}>Dobles</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('line')}>Pisar</th>
                                    <th className="px-2 py-3 text-center text-orange-400 cursor-pointer hover:text-orange-300" onClick={() => handleHeaderClick('offFoul')}>F. Ataq</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {getSortedStats(activeTab === 'GOALKEEPERS' ? goalkeepers : filteredPlayers).map(p => {
                            const percent = p.totalShots > 0 ? Math.round((p.goals / p.totalShots) * 100) : 0;
                            const gkPercent = (p.saves + p.goalsAgainst) > 0 ? Math.round((p.saves / (p.saves + p.goalsAgainst)) * 100) : 0;

                            return (
                                <tr key={p.playerId} className="hover:bg-slate-700/50">
                                    <td className="px-2 py-2 sm:px-3 sm:py-2">
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <span className="font-mono font-bold text-slate-500 w-4 sm:w-5 text-right">{p.number}</span>
                                            <span className="truncate max-w-[80px] sm:max-w-none font-medium text-white">{p.name}</span>
                                        </div>
                                    </td>

                                    {activeTab === 'GENERAL' && (
                                        <>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.matchesPlayed}</td>
                                            <td className="px-2 py-2 text-center font-bold text-white">{p.goals}/{p.totalShots}</td>
                                            <td className={`px-2 py-2 text-center text-xs ${percent >= 70 ? 'text-green-400' : percent < 50 ? 'text-red-400' : 'text-slate-400'}`}>{percent}%</td>
                                            <td className="px-2 py-2 text-center text-xs text-slate-400">
                                                {(() => {
                                                    const totalMinutes = Math.floor(p.playingTime / 60);
                                                    const avg = p.matchesPlayed > 0 ? (totalMinutes / p.matchesPlayed).toFixed(1) : '0';
                                                    return `${avg}'`;
                                                })()}
                                            </td>
                                            <td className="px-2 py-2 text-center text-orange-300">{p.turnovers}</td>
                                            <td className="px-2 py-2 text-center text-green-300">{(p.steals + p.assists + p.blocks + p.penalties + p.goodDef)}</td>
                                            <td className="px-2 py-2 text-center text-xs">
                                                {p.yellow > 0 && <span className="text-yellow-500 mr-1">{p.yellow}A</span>}
                                                {p.twoMin > 0 && <span className="text-white mr-1">{p.twoMin}'</span>}
                                                {p.red > 0 && <span className="text-red-500">R</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center font-bold text-purple-400">
                                                {p.matchesPlayed > 0 ? (p.totalRating / p.matchesPlayed).toFixed(1) : '-'}
                                            </td>
                                        </>
                                    )}

                                    {activeTab === 'SHOOTING' && (
                                        <>
                                            {renderRatioCell(p.goals, p.totalShots)}
                                            {renderRatioCell(p.sixM.goals, p.sixM.total)}
                                            {renderRatioCell(p.nineM.goals, p.nineM.total)}
                                            {renderRatioCell(p.wing.goals, p.wing.total)}
                                            {renderRatioCell(p.sevenM.goals, p.sevenM.total)}
                                            {renderRatioCell(p.fastbreak.goals, p.fastbreak.total)}
                                        </>
                                    )}

                                    {activeTab === 'GOALKEEPERS' && (
                                        <>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.matchesPlayed}</td>
                                            <td className="px-2 py-2 text-center text-xs text-slate-400">
                                                {(() => {
                                                    const totalMinutes = Math.floor(p.playingTime / 60);
                                                    const avg = p.matchesPlayed > 0 ? (totalMinutes / p.matchesPlayed).toFixed(1) : '0';
                                                    return `${avg}'`;
                                                })()}
                                            </td>
                                            <td className="px-2 py-2 text-center font-bold text-white">{p.saves}</td>
                                            <td className="px-2 py-2 text-center text-red-400">{p.goalsAgainst}</td>
                                            <td className={`px-2 py-2 text-center font-bold ${gkPercent >= 30 ? 'text-green-500' : gkPercent >= 20 ? 'text-yellow-500' : 'text-red-500'}`}>{gkPercent}%</td>
                                            <td className="px-2 py-2 text-center text-slate-300">{p.assists}</td>
                                        </>
                                    )}

                                    {activeTab === 'POSITIVE' && (
                                        <>
                                            <td className="px-2 py-2 text-center font-bold text-white">{(p.steals + p.assists + p.blocks + p.penalties + p.goodDef)}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.steals}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.assists}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.penalties}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.goodDef}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.blocks}</td>
                                        </>
                                    )}

                                    {activeTab === 'TURNOVERS' && (
                                        <>
                                            <td className="px-2 py-2 text-center font-bold text-white">{p.turnovers}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.turnoverPass}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.turnoverReception}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.turnoverSteps}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.turnoverDouble}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.turnoverLine}</td>
                                            <td className="px-2 py-2 text-center text-slate-400">{p.turnoverOffFoul}</td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                        {filteredPlayers.length === 0 && <tr className="text-center text-slate-500 italic"><td colSpan={10} className="p-4">No hay datos disponibles.</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Included Matches List */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shrink-0 z-0">
                <h2 className="text-lg font-bold text-slate-300 uppercase mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-slate-500" /> Partidos Incluidos ({includedMatches.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {includedMatches.map(m => (
                        <div
                            key={m.id}
                            onClick={() => onLoadMatch(m.id)}
                            className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 text-sm cursor-pointer hover:bg-slate-800 hover:border-handball-blue transition-all active:scale-95"
                        >
                            <div className="font-bold text-white mb-1 flex justify-between">
                                <span>{new Date(m.date).toLocaleDateString()}</span>
                                <span className={m.homeScore > m.awayScore ? 'text-green-500' : m.homeScore < m.awayScore ? 'text-red-500' : 'text-orange-500'}>
                                    {m.homeScore} - {m.awayScore}
                                </span>
                            </div>
                            <div className="text-slate-400 truncate">
                                {m.homeTeam} vs {m.awayTeam}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
