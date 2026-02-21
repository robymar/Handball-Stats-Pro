
export enum Position {
  GK = 'Portero',
  LW = 'Extremo Izq',
  LB = 'Lateral Izq',
  CB = 'Central',
  RB = 'Lateral Der',
  RW = 'Extremo Der',
  PV = 'Pivote',
  STAFF = 'Cuerpo Técnico',
  COACH = 'Entrenador'
}

export interface Player {
  id: string;
  number: number;
  name: string;
  position: Position;
  active: boolean; // currently on court


  // Extra Info
  height?: number; // cm
  weight?: number; // kg
  phone?: string;
  notes?: string;
  playingTime?: number; // seconds played
  playingTimeByPeriod?: Record<number, number>; // seconds played per period
}

// Nueva interfaz para Equipos
export interface Team {
  id: string;
  name: string;
  category: string;
  gender: 'MALE' | 'FEMALE';
  logo?: string;
  players: Player[]; // Plantilla propia del equipo
  createdAt: number;
}

export enum ShotZone {
  WING_L = 'Extremo Izq',
  WING_R = 'Extremo Der',
  NINE_M_L = '9m Izq',
  NINE_M_C = '9m Central',
  NINE_M_R = '9m Der',
  SIX_M_L = '6m Izq',
  SIX_M_C = '6m Central',
  SIX_M_R = '6m Der',
  SEVEN_M = '7m (Penalti)',
  FASTBREAK = 'Contraataque',
}

export enum ShotOutcome {
  GOAL = 'Gol',
  SAVE = 'Parada',
  POST = 'Poste',
  MISS = 'Fuera',
  BLOCK = 'Bloqueado'
}

export enum ShotPlacement {
  TOP_LEFT = 'Arriba Izq',
  TOP_CENTER = 'Arriba Cen',
  TOP_RIGHT = 'Arriba Der',
  MID_LEFT = 'Media Izq',
  MID_CENTER = 'Media Cen',
  MID_RIGHT = 'Media Der',
  LOW_LEFT = 'Abajo Izq',
  LOW_CENTER = 'Abajo Cen',
  LOW_RIGHT = 'Abajo Der'
}

export enum TurnoverType {
  PASS = 'Pase',
  RECEPTION = 'Recepción',
  STEPS = 'Pasos',
  DOUBLE = 'Dobles',
  LINE = 'Pisar',
  OFFENSIVE_FOUL = 'Falta de ataque'
}

export enum PositiveActionType {
  ASSIST = 'Asistencia',
  OFFENSIVE_BLOCK = 'Bloqueo',
  FORCE_PENALTY = "Fuerza 7m-2'",
  STEAL = 'Recuperación',
  GOOD_DEFENSE = 'Buena Df',
  BLOCK_SHOT = 'Blocaje'
}

export enum SanctionType {
  YELLOW = 'Amarilla',
  TWO_MIN = '2 Minutos',
  RED = 'Roja',
  BLUE = 'Azul'
}

export type EventType = 'SHOT' | 'TURNOVER' | 'POSITIVE_ACTION' | 'SANCTION' | 'OPPONENT_GOAL' | 'OPPONENT_SHOT' | 'SUBSTITUTION' | 'TIMEOUT';

export interface MatchEvent {
  id: string;
  timestamp: number; // Game time in seconds
  period: number;    // 1, 2, 3 (OT1), 4 (OT2)...
  type: EventType;
  playerId?: string; // null if opponent event, OR can be our GK id for opponent shots
  opponentPlayerId?: string; // New: ID of the opponent player who performed the action (e.g. shot)
  isOpponent?: boolean; // Flag to mark events belonging to opponent (e.g. shots against us)

  // Substitution details
  playerInId?: string;
  playerOutId?: string;

  // New: ID of the player removed from field due to Staff sanction
  sacrificedPlayerId?: string;

  // Shot details
  shotZone?: ShotZone;
  shotOutcome?: ShotOutcome;
  shotPlacement?: ShotPlacement;

  // Other details
  turnoverType?: TurnoverType;
  positiveActionType?: PositiveActionType;
  sanctionType?: SanctionType;
  sanctionDuration?: number; // minutes

  // Snapshot of score at this moment
  homeScoreSnapshot?: number;
  awayScoreSnapshot?: number;
}

export interface MatchMetadata {
  id: string;
  teamId?: string; // Links to the Team in the club database
  ownerTeamId?: string; // Also links to the Team (kept for backward compatibility with existing data)
  date: string; // ISO string
  homeTeam: string;
  homeTeamLogo?: string; // Base64 string for the logo
  awayTeam: string;
  awayTeamLogo?: string; // Base64 string for the logo
  location: string;
  round: string;
  category?: string; // Nuevo field para evitar mezcla de equipos (Cadete, Infantil, etc.)
  isOurTeamHome?: boolean; // New: Explicitly track if we are home or away
}

export interface MatchConfig {
  regularPeriods: number;
  regularDuration: number;
  otDuration: number;
  timerDirection: 'UP' | 'DOWN';
}

export interface TimerSettings {
  durationMinutes: number;
  direction: 'UP' | 'DOWN';
}

export interface MatchState {
  metadata: MatchMetadata;
  config: MatchConfig;
  timerSettings: TimerSettings; // Settings for the CURRENT active period
  currentPeriod: number; // Tracks 1st half, 2nd half, etc.
  isPaused: boolean;
  gameTime: number; // seconds
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  resolvedSanctionIds: string[]; // Track resolved sanctions to prevent loops
  players: Player[];
  opponentPlayers: Player[]; // New: Roster for the opponent team
}
