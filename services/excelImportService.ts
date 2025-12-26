
import ExcelJS from 'exceljs';
import { MatchState, Player, Position, ShotOutcome, ShotZone, MatchEvent, MatchMetadata, MatchConfig, TimerSettings, TurnoverType, PositiveActionType, SanctionType } from '../types.ts';

// Helper to generate IDs (duplicated from App.tsx as it's not exported)
let idCounter = 0;
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).substring(2)}`;
};

export const parseExcelMatch = async (file: File): Promise<MatchState | null> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const wsGeneral = workbook.getWorksheet('General');
        if (!wsGeneral) {
            console.error("No 'General' sheet found");
            return null;
        }

        // 1. Parse Metadata
        // Cell A1: "📊 ESTADÍSTICAS - Local vs Visitante"
        const titleVal = wsGeneral.getCell('A1').text || '';
        const teamsPart = titleVal.split('-')[1]?.trim();
        let homeTeam = 'Local';
        let awayTeam = 'Visitante';
        if (teamsPart && teamsPart.includes('vs')) {
            const parts = teamsPart.split('vs');
            homeTeam = parts[0].trim();
            awayTeam = parts[1].trim();
        }

        // Cell A2: "Jornada 1 | 01/01/2024 | Location"
        const infoVal = wsGeneral.getCell('A2').text || '';
        const infoParts = infoVal.split('|').map(s => s.trim());
        const round = infoParts[0] || 'Partido';
        const dateStr = infoParts[1]; // dd/mm/yyyy
        let dateISO = new Date().toISOString();
        if (dateStr) {
            const [d, m, y] = dateStr.split('/');
            if (d && m && y) {
                const dateObj = new Date(`${y}-${m}-${d}T12:00:00`);
                if (!isNaN(dateObj.getTime())) dateISO = dateObj.toISOString();
            }
        }
        const location = infoParts[2] || '';

        // Cell A3: "RESULTADO: 30 - 25 ..."
        const scoreVal = wsGeneral.getCell('A3').text || ''; // RESULTADO: 30 - 25 ...
        const matchScore = scoreVal.match(/(\d+)\s*-\s*(\d+)/);
        const homeScore = matchScore ? parseInt(matchScore[1]) : 0;
        const awayScore = matchScore ? parseInt(matchScore[2]) : 0;

        const players: Player[] = [];
        const events: MatchEvent[] = [];

        // 2. Scan Rows for Players
        // Header is at row 5 usually.
        // Data starts at row 6.
        let currentRow = 6;
        let isGKSection = false;

        // Arbitrary limit to stop loop
        while (currentRow < 100) {
            const row = wsGeneral.getRow(currentRow);
            const numVal = row.getCell(1).value; // #

            // Check if we hit the GK header (starts with # but has Name 'Portero' and empty Pos, or just detect empty row before it)
            // The export has a header row for GK: ['#', 'Portero', '', 'Paradas', ...]
            // Let's check if the row looks like a player.

            // If cell 1 is empty or not a number, check if it's the GK header or end
            if (!numVal) {
                // Check if next row has data (skip empty row)
                currentRow++;
                const nextRowVal = wsGeneral.getRow(currentRow).getCell(1).value;
                if (!nextRowVal) break; // Two empty rows? Stop.
                // Could be GK Header
                const nextRowName = wsGeneral.getRow(currentRow).getCell(2).text;
                if (nextRowName === 'Portero') {
                    isGKSection = true;
                    currentRow++; // Skip header
                }
                continue;
            }

            const headerCheck = row.getCell(2).text;
            if (headerCheck === 'Portero') {
                isGKSection = true;
                currentRow++;
                continue;
            }

            // Valid Player Row?
            // # | Name | Pos
            const number = parseInt(String(numVal));
            const name = row.getCell(2).text;
            const posRaw = row.getCell(3).text;

            if (!name) { currentRow++; continue; }

            const id = generateId();
            let position: Position = Position.PV; // Default

            if (isGKSection) {
                position = Position.GK;
            } else {
                // Map position string
                const p = posRaw.toLowerCase();
                if (p.includes('ext') && p.includes('izq')) position = Position.LW;
                else if (p.includes('ext') && p.includes('der')) position = Position.RW;
                else if (p.includes('lat') && p.includes('izq')) position = Position.LB;
                else if (p.includes('lat') && p.includes('der')) position = Position.RB;
                else if (p.includes('cen')) position = Position.CB;
                else if (p.includes('piv')) position = Position.PV;
                else if (p.includes('gk') || p.includes('por')) position = Position.GK; // Should be caught by isGKSection usually
            }

            // Extract Time
            const timeStr = row.getCell(14).text; // 00:00
            let playingTime = 0;
            if (timeStr.includes(':')) {
                const [min, sec] = timeStr.split(':').map(Number);
                playingTime = (min * 60) + sec;
            }

            players.push({
                id,
                number,
                name,
                position,
                active: false,
                playingTime
            });

            // 3. Generate Events based on Stats
            // Use sequential timestamps for proper ordering
            let eventTimestamp = 0;

            if (position !== Position.GK) {
                // Parse Zone Stats: "Goals/Total"
                const parseZone = (colIdx: number, zoneList: ShotZone[]) => {
                    const val = row.getCell(colIdx).text; // "3/4" or "-"
                    if (!val || val === '-') return;
                    const [g, t] = val.split('/').map(Number);
                    if (isNaN(g) || isNaN(t)) return;

                    const misses = t - g;
                    // Create GOAL events
                    for (let i = 0; i < g; i++) {
                        events.push({
                            id: generateId(),
                            timestamp: eventTimestamp++,
                            period: 1, // Assume period 1
                            type: 'SHOT',
                            playerId: id,
                            shotOutcome: ShotOutcome.GOAL,
                            shotZone: zoneList[0], // Assign to first zone in list roughly
                            isOpponent: false
                        });
                    }
                    // Create MISS events
                    for (let i = 0; i < misses; i++) {
                        events.push({
                            id: generateId(),
                            timestamp: eventTimestamp++,
                            period: 1,
                            type: 'SHOT',
                            playerId: id,
                            shotOutcome: ShotOutcome.MISS,
                            shotZone: zoneList[0],
                            isOpponent: false
                        });
                    }
                };

                // Cols: 7 (6m), 8 (9m), 9 (Ext), 10 (7m), 11 (Contra)
                parseZone(7, [ShotZone.SIX_M_C]);
                parseZone(8, [ShotZone.NINE_M_C]);
                parseZone(9, [ShotZone.WING_L]); // Just assign a side
                parseZone(10, [ShotZone.SEVEN_M]);
                parseZone(11, [ShotZone.FASTBREAK]);

                // Turnovers (Col 12)
                const turnovers = parseInt(row.getCell(12).text) || 0;
                for (let i = 0; i < turnovers; i++) {
                    events.push({
                        id: generateId(),
                        timestamp: eventTimestamp++,
                        period: 1,
                        type: 'TURNOVER',
                        turnoverType: TurnoverType.PASS, // Generic
                        playerId: id,
                        isOpponent: false
                    });
                }

                // Assists (Col 13)
                const assists = parseInt(row.getCell(13).text) || 0;
                for (let i = 0; i < assists; i++) {
                    events.push({
                        id: generateId(),
                        timestamp: eventTimestamp++,
                        period: 1,
                        type: 'POSITIVE_ACTION',
                        positiveActionType: PositiveActionType.ASSIST_BLOCK,
                        playerId: id,
                        isOpponent: false
                    });
                }

            } else {
                // GK Stats
                // Col 4: Paradas (Saves), Col 5: Goles (Goals Against)
                const saves = parseInt(row.getCell(4).text) || 0;
                const goalsConc = parseInt(row.getCell(5).text) || 0;

                for (let i = 0; i < saves; i++) {
                    events.push({
                        id: generateId(),
                        timestamp: eventTimestamp++,
                        period: 1,
                        type: 'OPPONENT_SHOT',
                        playerId: id, // GK Id
                        shotOutcome: ShotOutcome.SAVE,
                        isOpponent: true
                    });
                }
                for (let i = 0; i < goalsConc; i++) {
                    events.push({
                        id: generateId(),
                        timestamp: eventTimestamp++,
                        period: 1,
                        type: 'OPPONENT_SHOT',
                        playerId: id,
                        shotOutcome: ShotOutcome.GOAL,
                        isOpponent: true
                    });
                }
            }

            currentRow++;
        }

        // Add dummy events for HOME/AWAY score to match the header score if calculations mismatch?
        // Actually, our event generation creates goals.
        // But we didn't track *Opponent Goals* perfectly (only those causing GK saves/goals).
        // If there are goals against us that didn't go to a specific GK (e.g. empty net), we miss them.
        // Also we generated 'SHOT' events for our team, which will sum up to calculate `homeScore` (or away if we are away).
        // The parser assumes `homeTeam` is OUR team by default.

        // Reconstruct basic Metadata
        const metadata: MatchMetadata = {
            id: generateId(),
            date: dateISO,
            homeTeam,
            awayTeam,
            location,
            round,
            isOurTeamHome: true, // Defaulting to home as standard import behavior
            // We'll set ownerTeamId in the component calling this
        };

        const config: MatchConfig = {
            regularPeriods: 2,
            regularDuration: 30,
            otDuration: 5,
            timerDirection: 'UP'
        };
        const timerSettings: TimerSettings = {
            durationMinutes: 30,
            direction: 'UP'
        };

        const state: MatchState = {
            metadata,
            config,
            timerSettings,
            currentPeriod: 1,
            isPaused: true,
            gameTime: 0,
            homeScore, // Trust header score
            awayScore,
            events,
            resolvedSanctionIds: [],
            players,
            opponentPlayers: [] // Not imported for now
        };

        return state;

    } catch (e) {
        console.error("Error parsing Excel match:", e);
        return null;
    }
};
