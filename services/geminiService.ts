import { GoogleGenAI } from "@google/genai";
import { MatchState, MatchEvent, Player, EventType, ShotOutcome, Position } from "../types.ts";

// Use a dummy key if explicitly requested not to use env, but standard instructions say use process.env.API_KEY.
// If it fails in the preview environment without a key, it will just throw an error which we handle in UI.
// VITE: Use import.meta.env instead of process.env
const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || ''; // Ensure VITE_ prefix in .env
const ai = new GoogleGenAI({ apiKey });

export const generateMatchReport = async (matchState: MatchState): Promise<string> => {
  if (!apiKey) {
    return "Error: API Key no configurada para generar informes (VITE_GOOGLE_API_KEY).";
  }

  // Prepare data for the prompt
  const activeEvents = matchState.events.filter(e => e.type === 'SHOT' || e.type === 'TURNOVER');
  const totalShots = activeEvents.filter(e => e.type === 'SHOT').length;
  const goals = activeEvents.filter(e => e.type === 'SHOT' && e.shotOutcome === ShotOutcome.GOAL).length;
  const turnovers = activeEvents.filter(e => e.type === 'TURNOVER').length;

  // Summarize player stats for the prompt
  let playerSummary = '';
  matchState.players.forEach(p => {
    const playerEvents = matchState.events.filter(e => e.playerId === p.id);

    if (p.position === Position.GK) {
      // GK specific stats
      const shotsAgainst = matchState.events.filter(e => e.isOpponent && e.type === 'OPPONENT_SHOT' && e.playerId === p.id);
      const saves = shotsAgainst.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
      const goalsAllowed = shotsAgainst.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
      const totalAgainst = saves + goalsAllowed;
      if (totalAgainst > 0) {
        const savePercent = Math.round((saves / totalAgainst) * 100);
        playerSummary += `- #${p.number} ${p.name} (PORTERO): ${saves} paradas de ${totalAgainst} tiros (${savePercent}%).\n`;
      }
    } else {
      // Field player stats
      const playerShots = playerEvents.filter(e => e.type === 'SHOT').length;
      const playerGoals = playerEvents.filter(e => e.type === 'SHOT' && e.shotOutcome === ShotOutcome.GOAL).length;
      const playerTurnovers = playerEvents.filter(e => e.type === 'TURNOVER').length;
      if (playerShots > 0 || playerTurnovers > 0) {
        playerSummary += `- #${p.number} ${p.name} (${p.position}): ${playerGoals}/${playerShots} goles, ${playerTurnovers} pérdidas.\n`;
      }
    }
  });

  const prompt = `
  Actúa como un entrenador experto de balonmano. Genera un breve informe táctico post-partido (o al descanso) basado en las siguientes estadísticas.
  El informe debe ser en español, constructivo, destacando lo bueno y lo que hay que mejorar. Sé conciso.

  Marcador: Nuestro Equipo ${matchState.homeScore} - ${matchState.awayScore} Rival
  Tiempo de juego: ${Math.floor(matchState.gameTime / 60)} minutos.

  Estadísticas Generales:
  - Tiros totales: ${totalShots}
  - Goles: ${goals}
  - Efectividad de tiro: ${totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0}%
  - Pérdidas de balón: ${turnovers}

  Rendimiento Individual Destacado:
  ${playerSummary}

  Proporciona:
  1. Resumen general del partido.
  2. Puntos fuertes clave (menciona jugadores destacados si los hay, incluyendo porteros).
  3. Áreas urgentes de mejora.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No se pudo generar el informe. Inténtalo de nuevo.";
  } catch (error) {
    console.error("Error generating report:", error);
    return "No se pudo generar el informe táctico en este momento. Verifica tu conexión o la clave API.";
  }
};