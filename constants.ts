
import { Player, Position, ShotZone } from './types.ts';

export const INITIAL_PLAYERS: Player[] = [
  // Titulares (7 iniciales para cubrir posiciones)
  { id: '1', number: 59, name: 'JUAN', position: Position.GK, active: false, playingTime: 0 },
  { id: '2', number: 97, name: 'MARCOS', position: Position.LW, active: false, playingTime: 0 },
  { id: '3', number: 18, name: 'ALEJO', position: Position.LB, active: false, playingTime: 0 },
  { id: '4', number: 73, name: 'IÑIGO', position: Position.CB, active: false, playingTime: 0 },
  { id: '5', number: 5, name: 'DIEGO', position: Position.RB, active: false, playingTime: 0 },
  { id: '6', number: 95, name: 'CHRISTIAN', position: Position.RW, active: false, playingTime: 0 },
  { id: '7', number: 96, name: 'JOEL', position: Position.PV, active: false, playingTime: 0 },

  // Cuerpo Técnico (Activo por defecto)
  { id: 'staff_1', number: 0, name: 'Entrenador', position: Position.STAFF, active: false, playingTime: 0 },

  // Banquillo
  { id: '8', number: 66, name: 'IKER', position: Position.LB, active: false, playingTime: 0 },
  { id: '9', number: 69, name: 'LUIS', position: Position.PV, active: false, playingTime: 0 },
  { id: '10', number: 7, name: 'MATEO', position: Position.RB, active: false, playingTime: 0 },
  { id: '11', number: 57, name: 'PEDRO', position: Position.PV, active: false, playingTime: 0 },
  { id: '12', number: 93, name: 'SAMUEL', position: Position.CB, active: false, playingTime: 0 },
  { id: '13', number: 4, name: 'NICO', position: Position.GK, active: false, playingTime: 0 },
  { id: '14', number: 3, name: 'RAUL', position: Position.GK, active: false, playingTime: 0 },
];

// Court coordinate mapping for click zones (simplified relative percentages)
export const COURT_ZONES: { id: ShotZone; x: number; y: number; width: number; height: number; label: string }[] = [
  // Attack direction is UP
  { id: ShotZone.WING_L, x: 0, y: 0, width: 20, height: 40, label: 'Ext Izq' },
  { id: ShotZone.SIX_M_L, x: 20, y: 0, width: 20, height: 25, label: '6m Izq' },
  { id: ShotZone.SIX_M_C, x: 40, y: 0, width: 20, height: 25, label: '6m Cen' },
  { id: ShotZone.SIX_M_R, x: 60, y: 0, width: 20, height: 25, label: '6m Der' },
  { id: ShotZone.WING_R, x: 80, y: 0, width: 20, height: 40, label: 'Ext Der' },

  { id: ShotZone.NINE_M_L, x: 20, y: 25, width: 20, height: 30, label: '9m Izq' },
  { id: ShotZone.NINE_M_C, x: 40, y: 40, width: 20, height: 25, label: '9m Cen' },
  { id: ShotZone.NINE_M_R, x: 60, y: 25, width: 20, height: 30, label: '9m Der' },

  { id: ShotZone.SEVEN_M, x: 45, y: 25, width: 10, height: 5, label: '7m' },
];

// Professional Coach Rating Weights
export const RATING_WEIGHTS = {
  // Positive Actions
  GOAL: 4,
  ASSIST: 2,
  STEAL: 3,
  BLOCK: 3,
  EARNED_7M: 2,
  GOOD_ID: 1, // Good defense (Indiv)
  SAVE: 3, // GK Save

  // Negative Actions
  MISS: -1,
  POST: -0.5,
  BLOCKED: -1,
  TURNOVER: -2,
  GOAL_CONCEDED: -0.5, // GK

  // Sanctions
  YELLOW: -1,
  TWO_MIN: -3,
  RED: -6,
  BLUE: -10,
};
