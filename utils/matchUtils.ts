
import { Player, MatchState, MatchEvent, ShotZone, ShotOutcome } from '../types.ts';
import { RATING_WEIGHTS } from '../constants.ts';

// Helper to handle playing time logic with legacy support
export const getPlayingTimeForPeriod = (p: Player | any, filter: 'ALL' | number): number => {
    const total = p.playingTime || 0;
    if (filter === 'ALL') return total;

    const perPeriod = p.playingTimeByPeriod || {};
    const recordedTotal = (Object.values(perPeriod) as number[]).reduce((a: number, b: number) => a + b, 0);
    const missing = Math.max(0, total - recordedTotal);

    // Attribute missing legacy time to Period 1 ONLY if we have NO period data
    // This prevents dumping "unrecorded P2 time" into P1 if P2 failed to record but Total incremented.
    const hasPeriodData = Object.keys(perPeriod).length > 0;
    let timeInPeriod = (perPeriod[filter] as number) || 0;
    if (filter === 1 && !hasPeriodData) {
        timeInPeriod += missing;
    }

    return timeInPeriod;
};

let idCounter = 0;
export const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).substring(2)}`;
};

export const mapPositionString = (posStr: string, Position: any): any => {
    if (!posStr) return Position.PV;
    const s = posStr.toLowerCase().trim();
    if (s.includes('portero') || s.includes('gk')) return Position.GK;
    if (s.includes('extremo izq') || s.includes('lw')) return Position.LW;
    if (s.includes('extremo der') || s.includes('rw')) return Position.RW;
    if (s.includes('lateral izq') || s.includes('lb')) return Position.LB;
    if (s.includes('lateral der') || s.includes('rb')) return Position.RB;
    if (s.includes('central') || s.includes('cb')) return Position.CB;
    if (s.includes('pivote') || s.includes('pv')) return Position.PV;
    if (s.includes('tecnico') || s.includes('entrenador') || s.includes('staff')) return Position.STAFF;
    return Position.PV;
};
