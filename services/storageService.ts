
import { MatchState, Team } from '../types.ts';
import { db, auth } from './firebase.ts';
import { onAuthStateChanged } from 'firebase/auth'; // Added for reactive auth check if needed
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  collectionGroup,
  documentId,
  QueryDocumentSnapshot
} from 'firebase/firestore';

const STORAGE_KEY_PREFIX = 'hb_match_';
const INDEX_KEY = 'hb_matches_index';
const TEAMS_KEY = 'hb_teams_list';

export interface MatchSummary {
  id: string;
  ownerTeamId?: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  location?: string;
  category?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
}

export interface ActiveTeamInfo {
  id: string;
  name: string;
  category: string;
}

const ACTIVE_TEAM_KEY = 'hb_active_team';

export const setActiveTeam = (team: ActiveTeamInfo | null): void => {
  if (team) {
    localStorage.setItem(ACTIVE_TEAM_KEY, JSON.stringify(team));
  } else {
    localStorage.removeItem(ACTIVE_TEAM_KEY);
  }
};

export const clearLocalData = (): void => {
  localStorage.removeItem(TEAMS_KEY);
  localStorage.removeItem(INDEX_KEY);
  localStorage.removeItem(ACTIVE_TEAM_KEY);
  // Optional: clear match details themselves (prefixed with hb_match_)
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
};

export const getActiveTeam = (): ActiveTeamInfo | null => {
  try {
    const activeJson = localStorage.getItem(ACTIVE_TEAM_KEY);
    return activeJson ? JSON.parse(activeJson) : null;
  } catch (e) {
    return null;
  }
};

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

  // 2. Sync to Firebase
  if (!skipSync && auth.currentUser) {
    try {
      const user = auth.currentUser;
      const teamRef = doc(db, 'users', user.uid, 'teams', team.id);

      await setDoc(teamRef, {
        id: team.id,
        name: team.name,
        category: team.category,
        gender: team.gender,
        logoUrl: team.logo,
        players: team.players,
        ownerUid: team.ownerUid || user.uid,
        shareCode: team.shareCode || null,
        sharedUids: team.sharedUids || [],
        updatedAt: Timestamp.now()
      });

      console.log("Team synced to Firebase");
    } catch (err) {
      console.error("Firebase sync failed:", err);
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
  if (auth.currentUser) {
    try {
      const user = auth.currentUser;
      const teamRef = doc(db, 'users', user.uid, 'teams', teamId);
      await deleteDoc(teamRef);
      console.log("Team deleted from Firebase");
    } catch (err) {
      console.error("Firebase delete error:", err);
    }
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
      category: state.metadata.category,
    });

    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.error("Error saving match locally:", e);
  }

  // 2. Cloud Save
  if (!skipSync && auth.currentUser) {
    try {
      const user = auth.currentUser;
      const matchRef = doc(db, 'users', user.uid, 'matches', state.metadata.id);
      await setDoc(matchRef, {
        id: state.metadata.id,
        teamId: state.metadata.ownerTeamId || state.metadata.teamId || null,
        ownerTeamId: state.metadata.ownerTeamId || state.metadata.teamId || null,
        ownerUid: user.uid, // Track who uploaded the match
        homeTeam: state.metadata.homeTeam,
        awayTeam: state.metadata.awayTeam,
        homeScore: state.homeScore,
        awayScore: state.awayScore,
        date: state.metadata.date,
        location: state.metadata.location,
        category: state.metadata.category || null,
        matchData: state, // Saving full JSON
        updatedAt: Timestamp.now()
      });

      console.log("Match synced to Firebase");
    } catch (err) {
      console.error("Match sync Error:", err);
    }
  }
};

export const getMatchHistory = (teamId?: string): MatchSummary[] => {
  try {
    const indexJson = localStorage.getItem(INDEX_KEY);
    const allMatches: MatchSummary[] = indexJson ? JSON.parse(indexJson) : [];

    if (teamId) {
      return allMatches.filter(m => m.ownerTeamId === teamId);
    }
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

export const deleteMatch = async (id: string): Promise<void> => {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
    const indexJson = localStorage.getItem(INDEX_KEY);
    if (indexJson) {
      let index: MatchSummary[] = JSON.parse(indexJson);
      index = index.filter(m => m.id !== id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }

    // Cloud Delete
    if (auth.currentUser) {
      const user = auth.currentUser;
      const matchRef = doc(db, 'users', user.uid, 'matches', id);
      await deleteDoc(matchRef);
    }

  } catch (e) {
    console.error("Error deleting match:", e);
  }
}

export const importMatchState = (matchData: any): boolean => {
  try {
    if (!matchData || !matchData.metadata || !matchData.events || !Array.isArray(matchData.players)) {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    saveMatch(matchData as MatchState);
    return true;
  } catch (e) {
    console.error("Error importing match:", e);
    return false;
  }
};

export const getMatchFromFirebase = async (id: string): Promise<MatchState | null> => {
  if (!auth.currentUser) return null;
  try {
    const user = auth.currentUser;
    // 1. Direct doc lookup by document ID
    const matchRef = doc(db, 'users', user.uid, 'matches', id);
    const docSnap = await getDoc(matchRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const state = (data.matchData || data) as MatchState;
      if (state.metadata) state.metadata.id = id;
      return state;
    }

    // 2. Fallback: Query by 'id' field within user's matches (for legacy or ID mismatch)
    const q = query(collection(db, 'users', user.uid, 'matches'), where('id', '==', id));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const data = querySnap.docs[0].data();
      const state = (data.matchData || data) as MatchState;
      if (state.metadata) state.metadata.id = id;
      return state;
    }

    console.warn("Match not found in private collection by Doc ID or field ID:", id);
    return null;
  } catch (err) {
    console.error("Firebase fetch exception:", err);
    return null;
  }
};

// This function seems to be intended for getting a list of matches from the cloud
// Adapted to query the subcollection 'matches' of the current user
export const getMatchListFromFirebase = async (): Promise<MatchSummary[]> => {
  if (!auth.currentUser) return [];
  try {
    const user = auth.currentUser;

    // Get all team IDs I have access to (owned or shared)
    // We rely on local teams cache which should be synced before calling this
    const localTeams = getTeams();
    const allTeamIds = localTeams.map(t => t.id);

    if (allTeamIds.length === 0) return [];

    // Query collectionGroup to find matches belonging to any of these teams
    // This allows seeing matches from shared teams
    const q = query(
      collectionGroup(db, 'matches'),
      where('ownerTeamId', 'in', allTeamIds)
    );

    const querySnapshot = await getDocs(q);

    const matches = querySnapshot.docs.map((d: QueryDocumentSnapshot) => {
      const data = d.data();
      return {
        id: d.id,
        date: data.date,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        location: data.location,
        category: data.category || data.matchData?.metadata?.category,
        homeTeamLogo: data.matchData?.metadata?.homeTeamLogo,
        awayTeamLogo: data.matchData?.metadata?.awayTeamLogo,
        ownerTeamId: data.ownerTeamId || data.teamId
      };
    });

    // Sort by date manually as collectionGroup 'in' query with orderBy might require complex indexing
    return matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  } catch (e) {
    console.error("Exception fetching match list:", e);
    return [];
  }
};

export const getAllMatchesFullFromFirebase = async (): Promise<MatchState[]> => {
  if (!auth.currentUser) return [];
  try {
    const user = auth.currentUser;
    const localTeams = getTeams();
    const allTeamIds = localTeams.map(t => t.id);

    if (allTeamIds.length === 0) return [];

    const q = query(
      collectionGroup(db, 'matches'),
      where('ownerTeamId', 'in', allTeamIds)
    );

    const querySnapshot = await getDocs(q);

    const results: MatchState[] = [];
    querySnapshot.forEach((d) => {
      const data = d.data();
      const state = (data.matchData || data) as MatchState;
      if (state.metadata) {
        state.metadata.id = d.id;
        results.push(state);
      }
    });

    return results.sort((a, b) => new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime());
  } catch (e) {
    console.error("Exception fetching full matches:", e);
    return [];
  }
};

// Sync functions implementation (replacing legacy sync logic if needed)
export const syncTeamsDown = async (): Promise<void> => {
  if (!auth.currentUser) return;
  try {
    const user = auth.currentUser;
    const teamsRef = collection(db, 'users', user.uid, 'teams');
    const querySnapshot = await getDocs(teamsRef);

    const cloudTeams: Team[] = [];
    querySnapshot.forEach((d: QueryDocumentSnapshot) => {
      const data = d.data();
      cloudTeams.push({
        id: data.id,
        name: data.name,
        category: data.category,
        gender: data.gender,
        logo: data.logoUrl,
        players: data.players,
        ownerUid: data.ownerUid,
        shareCode: data.shareCode,
        sharedUids: data.sharedUids,
        createdAt: data.updatedAt ? data.updatedAt.toMillis() : Date.now()
      });
    });

    // --- New: Sync Shared Teams (where I am a member) ---
    const sharedQ = query(collectionGroup(db, 'teams'), where('sharedUids', 'array-contains', user.uid));
    const sharedSnap = await getDocs(sharedQ);
    sharedSnap.forEach((d) => {
      const data = d.data();
      cloudTeams.push({
        id: data.id,
        name: data.name,
        category: data.category,
        gender: data.gender,
        logo: data.logoUrl,
        players: data.players,
        ownerUid: data.ownerUid,
        shareCode: data.shareCode,
        sharedUids: data.sharedUids,
        createdAt: data.updatedAt ? data.updatedAt.toMillis() : Date.now()
      });
    });

    // Merge with local teams? Or overwrite? 
    // For simplicity, let's merge: favor cloud if conflict, but keep local only if not in cloud?
    // Usually sync down means "get what's in cloud". 
    // Let's safe save basically.

    const localTeams = getTeams();
    const mergedTeams = [...localTeams];

    cloudTeams.forEach(cloudTeam => {
      const idx = mergedTeams.findIndex(t => t.id === cloudTeam.id);
      if (idx >= 0) {
        mergedTeams[idx] = cloudTeam;
      } else {
        mergedTeams.push(cloudTeam);
      }
    });

    localStorage.setItem(TEAMS_KEY, JSON.stringify(mergedTeams));
    console.log("Teams synced down from Firebase");

  } catch (error) {
    console.error("Error syncing teams down:", error);
  }
}

export const syncMatchesDown = async (): Promise<void> => {
  if (!auth.currentUser) return;
  try {
    const user = auth.currentUser;
    // 1. My matches
    const matches = await getAllMatchesFullFromFirebase();
    for (const match of matches) {
      await saveMatch(match, true);
    }

    // 2. Fetch all matches for ALL teams I have (owned or shared)
    const localTeams = getTeams();
    const allTeamIds = localTeams.map(t => t.id);

    if (allTeamIds.length > 0) {
      // Find matches where ownerTeamId is in our team list
      // This ensures Owners see Delegate matches and vice-versa
      const sharedMatchesQ = query(collectionGroup(db, 'matches'), where('ownerTeamId', 'in', allTeamIds));
      const sharedMatchesSnap = await getDocs(sharedMatchesQ);
      for (const d of sharedMatchesSnap.docs) {
        const data = d.data();
        const matchData = (data.matchData || data) as MatchState;
        await saveMatch(matchData, true);
      }
    }

    console.log("Matches synced down (including shared)");
  } catch (error) {
    console.error("Error syncing matches down:", error);
  }
}

export const joinTeamWithCode = async (code: string): Promise<boolean> => {
  if (!auth.currentUser) return false;
  try {
    const user = auth.currentUser;
    const q = query(collectionGroup(db, 'teams'), where('shareCode', '==', code.toUpperCase()));
    const snap = await getDocs(q);

    if (snap.empty) return false;

    const teamDoc = snap.docs[0];
    const teamData = teamDoc.data();

    // Add me to sharedUids
    const sharedUids = teamData.sharedUids || [];
    if (!sharedUids.includes(user.uid)) {
      sharedUids.push(user.uid);
      await setDoc(teamDoc.ref, { sharedUids }, { merge: true });
    }

    // Sync down everything to update UI
    await syncTeamsDown();
    await syncMatchesDown();

    return true;
  } catch (e) {
    console.error("Join team error:", e);
    return false;
  }
};

export const generateTeamShareCode = async (teamId: string): Promise<string | null> => {
  if (!auth.currentUser) return null;
  try {
    const user = auth.currentUser;
    const teamRef = doc(db, 'users', user.uid, 'teams', teamId);

    // Simple 6-char code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await setDoc(teamRef, { shareCode: code }, { merge: true });

    // Update local cache
    const teams = getTeams();
    const idx = teams.findIndex(t => t.id === teamId);
    if (idx >= 0) {
      teams[idx].shareCode = code;
      localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
    }

    return code;
  } catch (e) {
    return null;
  }
};


export const getPublicMatchFromFirebase = async (matchId: string): Promise<MatchState | null> => {
  try {
    // 1. Try finding by the 'id' field
    const q1 = query(collectionGroup(db, 'matches'), where('id', '==', matchId));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return (snap1.docs[0].data().matchData || snap1.docs[0].data()) as MatchState;

    // 2. Try finding by document id if field query fails (some docs might not have 'id' field)
    const q2 = query(collectionGroup(db, 'matches'), where(documentId(), '==', matchId));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return (snap2.docs[0].data().matchData || snap2.docs[0].data()) as MatchState;

    return null;
  } catch (err) {
    console.error("Error fetching public match:", err);
    return null;
  }
};

/**
 * Universal matcher fetcher:
 * 1. Checks LocalStorage (fastest)
 * 2. Checks User's private collection (if logged in)
 * 3. Checks Global collectionGroup (public share link)
 */
export const getMatchById = async (id: string): Promise<MatchState | null> => {
  // 1. Local
  const local = loadMatch(id);
  if (local) return local;

  // Wait for auth to initialize (max 2 seconds)
  if (!auth.currentUser) {
    await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user);
      });
      setTimeout(resolve, 2000);
    });
  }

  // 2. Private Cloud (if authenticated)
  if (auth.currentUser) {
    const privateMatch = await getMatchFromFirebase(id);
    if (privateMatch) return privateMatch;
  }

  // 3. Public Cloud
  return await getPublicMatchFromFirebase(id);
};
