
import { MatchState, Team } from '../types.ts';
import { supabase } from './supabase.ts';

const STORAGE_KEY_PREFIX = 'hb_match_';
const INDEX_KEY = 'hb_matches_index';
const TEAMS_KEY = 'hb_teams_list';

export interface MatchSummary {
  id: string;
  ownerTeamId?: string; // Added to filter by team
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

// --- TEAM MANAGEMENT ---

export const getTeams = (): Team[] => {
  try {
    const teamsJson = localStorage.getItem(TEAMS_KEY);
    return teamsJson ? JSON.parse(teamsJson) : [];
  } catch (e) {
    console.error('Error loading teams from localStorage:', e);
    return [];
  }
};

export const saveTeam = async (team: Team, skipSync: boolean = false): Promise<void> => {
  // 1. Save Local
  try {
    const teams = getTeams();
    const existingIndex = teams.findIndex(t => t.id === team.id);
    if (existingIndex >= 0) {
      teams[existingIndex] = team;
    } else {
      teams.push(team);
    }
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  } catch (e) {
    console.error("Error saving team locally:", e);
  }

  // 2. Sync to Supabase
  if (supabase && !skipSync) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('teams')
          .upsert({
            id: team.id,
            user_id: user.id,
            name: team.name,
            category: team.category,
            gender: team.gender,
            logo_url: team.logo,
            // Not syncing players individually yet, keeping it simple or storing as json if schema allows?
            // Schema defined 'teams' with explicit columns but not players JSON.
            // Wait, schema in step 152 creates 'teams' table WITHOUT players column.
            // We should probably store players in a related table OR add a jsonb column 'roster' to teams.
            // Let's assume for now we just sync the basic info.
          });
        if (error) console.error("Supabase team sync error:", error);
        else console.log("Team synced to cloud");
      }
    } catch (err) {
      console.error("Supabase sync failed:", err);
    }
  }
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  // 1. Local Delete
  try {
    const teams = getTeams();
    const newTeams = teams.filter(t => t.id !== teamId);
    localStorage.setItem(TEAMS_KEY, JSON.stringify(newTeams));
  } catch (e) {
    console.error("Error deleting team locally:", e);
  }

  // 2. Cloud Delete
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', teamId)
          .eq('user_id', user.id); // Security check
        if (error) console.error('Supabase delete error:', error);
      }
    } catch (err) { }
  }
}

// --- MATCH MANAGEMENT ---

export const saveMatch = async (state: MatchState, skipSync: boolean = false): Promise<void> => {
  // 1. Local Save
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${state.metadata.id}`, JSON.stringify(state));

    const indexJson = localStorage.getItem(INDEX_KEY);
    let index: MatchSummary[] = indexJson ? JSON.parse(indexJson) : [];

    index = index.filter(m => m.id !== state.metadata.id);

    index.unshift({
      id: state.metadata.id,
      ownerTeamId: state.metadata.ownerTeamId,
      date: state.metadata.date,
      homeTeam: state.metadata.homeTeam,
      awayTeam: state.metadata.awayTeam,
      homeScore: state.homeScore,
      awayScore: state.awayScore,
    });

    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.error("Error saving match locally:", e);
  }

  // 2. Cloud Save
  if (supabase && !skipSync) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('matches')
          .upsert({
            id: state.metadata.id,
            user_id: user.id,
            team_id: state.metadata.ownerTeamId || null,
            home_team: state.metadata.homeTeam,
            away_team: state.metadata.awayTeam,
            home_score: state.homeScore,
            away_score: state.awayScore,
            date: state.metadata.date,
            location: state.metadata.location,
            match_data: state // Saving full JSON
          });
        if (error) console.error("Match sync Error:", error);
        else console.log("Match synced to cloud");
      }
    } catch (err) {
      // Silent fail if offline
    }
  }
};

export const getMatchHistory = (teamId?: string): MatchSummary[] => {
  try {
    const indexJson = localStorage.getItem(INDEX_KEY);
    const allMatches: MatchSummary[] = indexJson ? JSON.parse(indexJson) : [];

    // Filter matches by teamId if provided
    if (teamId) {
      return allMatches.filter(m => m.ownerTeamId === teamId);
    }
    // If no teamId provided, return ALL matches (for "View All" mode)
    return allMatches;
  } catch (e) {
    return [];
  }
};

export const loadMatch = (id: string): MatchState | null => {
  try {
    const matchJson = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    return matchJson ? JSON.parse(matchJson) : null;
  } catch (e) {
    return null;
  }
};

export const deleteMatch = (id: string): void => {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
    const indexJson = localStorage.getItem(INDEX_KEY);
    if (indexJson) {
      let index: MatchSummary[] = JSON.parse(indexJson);
      index = index.filter(m => m.id !== id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
  } catch (e) {
    console.error("Error deleting match:", e);
  }
}

export const importMatchState = (matchData: any): boolean => {
  try {
    // Basic validation to ensure it's a valid match object
    if (!matchData || !matchData.metadata || !matchData.events || !Array.isArray(matchData.players)) {
      return false;
    }

    // Save it using the existing logic which handles index update
    saveMatch(matchData as MatchState);
    return true;
  } catch (e) {
    console.error("Error importing match:", e);
    return false;
  }
};
