
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Timer } from './components/Timer.tsx';
import { CourtSVG } from './components/CourtSVG.tsx';
import { GoalSVG } from './components/GoalSVG.tsx';
import { GoalStatsSVG } from './components/GoalStatsSVG.tsx';
import { BarChart, DonutChart } from './components/ChartComponents.tsx';
import { PlayerDetailView } from './components/PlayerDetailView.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { SplashScreen } from './components/SplashScreen.tsx';
import { INITIAL_PLAYERS, RATING_WEIGHTS } from './constants.ts';
import { MatchState, Player, MatchEvent, ShotZone, ShotOutcome, TurnoverType, SanctionType, ShotPlacement, Position, MatchConfig, MatchMetadata, PositiveActionType, Team } from './types.ts';
import { Activity, ArrowRightLeft, Ban, ClipboardList, History, Undo2, Users, Zap, Settings, ShieldAlert, Clock, Trash2, Image as ImageIcon, Plus, Edit2, Save, X, Target, Footprints, Goal, Swords, FileDown, Check, Archive, BarChart3, Trophy, Download, Upload, PauseCircle, ThumbsUp, LogOut, Briefcase, FileSpreadsheet, ArrowLeft, RefreshCw, Cloud, Minus, Timer as TimerIcon, Play, Pause, RotateCcw, Share2, Search, Calendar, MapPin, AlertTriangle, AlertCircle, FileText, Smartphone, Laptop, Printer, Hash, MoreVertical, Copy } from 'lucide-react';

import { auth } from './services/firebase.ts';
import { applyActionCode } from 'firebase/auth';
import { LoginView } from './components/LoginView.tsx';
import { GlobalStatsView } from './components/GlobalStatsView.tsx';
import { saveMatch, loadMatch, getMatchHistory, deleteMatch, MatchSummary, importMatchState, getTeams, saveTeam, deleteTeam, syncTeamsDown, syncMatchesDown } from './services/storageService.ts';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { StatsView } from './components/StatsView.tsx';
import { PublicMatchViewer } from './components/PublicMatchViewer.tsx';
import { CloudMatchList } from './components/CloudMatchList.tsx';
import { LoginWrapper } from './components/LoginWrapper.tsx';
import { ResetPasswordView } from './components/ResetPasswordView.tsx';
import { getPlayingTimeForPeriod } from './utils/matchUtils.ts';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { App as CapacitorApp } from '@capacitor/app';
import { Toast } from '@capacitor/toast';

import ExcelJS from 'exceljs';
import { parseExcelMatch } from './services/excelImportService.ts';

enum InputMode {
    IDLE,
    // Our Shot Flow
    SELECT_SHOT_OUTCOME,
    SELECT_PLAYER_FOR_SHOT,
    SELECT_SHOT_PLACEMENT_OPTIONAL,

    // Opponent Shot Flow
    SELECT_OPPONENT_SHOT_ZONE,
    SELECT_OPPONENT_SHOT_OUTCOME,
    SELECT_OPPONENT_PLAYER, // New
    SELECT_OPPONENT_SHOT_PLACEMENT,
    SELECT_OUR_GK_FOR_SAVE,

    // Other Flows
    SELECT_TURNOVER_TYPE,
    SELECT_PLAYER_FOR_TURNOVER,
    SELECT_POSITIVE_ACTION_TYPE,
    SELECT_PLAYER_FOR_POSITIVE_ACTION,
    SELECT_SANCTION_TYPE,
    SELECT_PLAYER_FOR_SANCTION,
    SELECT_SANCTION_DURATION,
    SELECT_PLAYER_FOR_SUBSTITUTION_IN,

    // New: Sacrifice flow for Staff sanctions
    SELECT_PLAYER_TO_SACRIFICE,
    // New: Return flow after Staff sanction ends
    SELECT_PLAYER_TO_ENTER_AFTER_STAFF_SANCTION,
    SELECT_PLAYER_TO_ENTER_AFTER_SANCTION,
    // New: Add manual event from timeline
    SELECT_TEAM_FOR_NEW_EVENT,

    // Editing
    EDIT_PLAYER_DETAILS,
    EDIT_EVENT_DETAILS,

    // Import
    IMPORT_ROSTER,
    // Recover
    SELECT_TEAM_FOR_RECOVER,
}

type ViewType = 'TEAM_SELECT' | 'SETUP' | 'MATCH' | 'STATS' | 'TIMELINE' | 'ROSTER' | 'INFO' | 'GLOBAL_STATS' | 'LOGIN' | 'CLOUD' | 'RESET_PASSWORD';

const DEFAULT_CONFIG: MatchConfig = {
    regularPeriods: 2,
    regularDuration: 30,
    otDuration: 5,
    timerDirection: 'UP'
};

// Optimized with React.memo to prevent unnecessary re-renders
const NavButton = React.memo(({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
    <button onClick={onClick} className={`flex flex-col items-center p-2 rounded-lg transition-colors w-16 ${active ? 'text-handball-blue bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}>
        <div className="mb-1">{icon}</div><span className="text-[9px] font-bold uppercase">{label}</span>
    </button>
), (prevProps, nextProps) => {
    // Only re-render if active or label changes (icon and onClick are stable)
    return prevProps.active === nextProps.active && prevProps.label === nextProps.label;
});

// --- HELPER FUNCTIONS ---
let idCounter = 0;
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).substring(2)}`;
};

// Helper function to convert ArrayBuffer to Base64 (browser compatible)
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

// Helper to update playing time for active players
const updatePlayingTime = (players: Player[], delta: number, currentPeriod: number): Player[] => {
    return players.map(p => {
        if (!p.active) return p;
        const currentPeriodStats = p.playingTimeByPeriod || {};
        const periodTime = (currentPeriodStats[currentPeriod] || 0) + delta;
        return {
            ...p,
            playingTime: (p.playingTime || 0) + delta,
            playingTimeByPeriod: {
                ...currentPeriodStats,
                [currentPeriod]: periodTime
            }
        };
    });
};

const processLogo = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 150;
                const MAX_HEIGHT = 150;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png', 0.8));
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const recalculateMatchState = (currentState: MatchState): MatchState => {
    let home = 0;
    let away = 0;

    // Improved sorting: First by Period, then by Timestamp based on direction
    const sortedEvents = [...currentState.events].sort((a, b) => {
        if (a.period !== b.period) return a.period - b.period;

        // Within same period, sort by time
        if (currentState.config.timerDirection === 'UP') {
            return a.timestamp - b.timestamp;
        } else {
            return b.timestamp - a.timestamp;
        }
    });

    const updatedEvents = sortedEvents.map(e => {
        const isOurTeamHome = currentState.metadata.isOurTeamHome !== undefined ? currentState.metadata.isOurTeamHome : true;

        if (e.type === 'SHOT' && e.shotOutcome === ShotOutcome.GOAL && !e.isOpponent) {
            // Our Goal: Increment Home if we are Home, Away if we are Away
            if (isOurTeamHome) home++; else away++;
        } else if ((e.type === 'OPPONENT_SHOT' && e.shotOutcome === ShotOutcome.GOAL) || e.type === 'OPPONENT_GOAL') {
            // Opponent Goal: Increment Away if we are Home, Home if we are Away
            if (isOurTeamHome) away++; else home++;
        }
        return { ...e, homeScoreSnapshot: home, awayScoreSnapshot: away };
    });

    // Store events in reverse order for display (Newest first)
    return {
        ...currentState,
        homeScore: home,
        awayScore: away,
        events: updatedEvents.reverse()
    };
};

const isPlayerDisqualified = (playerId: string, events: MatchEvent[]): boolean => {
    const playerSanctions = events.filter(e => e.playerId === playerId && e.type === 'SANCTION');
    const hasRed = playerSanctions.some(e => e.sanctionType === SanctionType.RED);
    const hasBlue = playerSanctions.some(e => e.sanctionType === SanctionType.BLUE);
    const yellowCount = playerSanctions.filter(e => e.sanctionType === SanctionType.YELLOW).length;
    const twoMinCount = playerSanctions.filter(e => e.sanctionType === SanctionType.TWO_MIN).length;
    return hasRed || hasBlue || yellowCount >= 2 || twoMinCount >= 3;
};

const getSanctionRemainingTime = (
    event: MatchEvent,
    gameTime: number,
    timerDirection: 'UP' | 'DOWN',
    currentPeriod: number,
    periodConfig: { regularDuration: number; otDuration: number; regularPeriods: number }
) => {
    const duration = (event.sanctionDuration || 2) * 60;

    // Si la sanción ocurrió en el mismo periodo, cálculo normal
    if (!event.period || event.period === currentPeriod) {
        const startTime = event.timestamp;
        let remainingSeconds: number;

        if (timerDirection === 'UP') {
            const elapsed = gameTime - startTime;
            remainingSeconds = duration - elapsed;
        } else {
            const elapsed = startTime - gameTime;
            remainingSeconds = duration - elapsed;
        }
        return { remaining: Math.max(0, Math.ceil(remainingSeconds)), duration };
    }

    // Si la sanción ocurrió en un periodo anterior, calcular tiempo que falta
    if (event.period < currentPeriod) {
        // Determinar la duración del periodo donde ocurrió la sanción
        const sanctionPeriodIsOT = event.period > periodConfig.regularPeriods;
        const sanctionPeriodDuration = sanctionPeriodIsOT ? periodConfig.otDuration : periodConfig.regularDuration;
        const sanctionPeriodDurationSecs = sanctionPeriodDuration * 60;

        const startTime = event.timestamp;

        // Calcular cuánto tiempo se cumplió en el periodo donde ocurrió
        let timeServedInSanctionPeriod: number;
        if (timerDirection === 'UP') {
            // Si el timer va hacia arriba, el periodo termina cuando llega a la duración total
            timeServedInSanctionPeriod = sanctionPeriodDurationSecs - startTime;
        } else {
            // Si el timer va hacia abajo, el periodo termina cuando llega a 0
            timeServedInSanctionPeriod = startTime - 0;
        }

        // Tiempo que falta por cumplir
        const timeRemaining = duration - timeServedInSanctionPeriod;

        // Si ya se cumplió toda la sanción en el periodo anterior
        if (timeRemaining <= 0) {
            return { remaining: 0, duration };
        }

        // Calcular cuánto tiempo se ha cumplido en el periodo actual
        const timeServedInCurrentPeriod = timerDirection === 'UP' ? gameTime : (periodConfig.regularDuration * 60 - gameTime);

        // Tiempo restante = tiempo que faltaba - tiempo servido en periodo actual
        const remainingSeconds = timeRemaining - timeServedInCurrentPeriod;

        return { remaining: Math.max(0, Math.ceil(remainingSeconds)), duration };
    }

    return { remaining: 0, duration };
}

// Helper to map loose position strings to Enum
const mapPositionString = (posStr: string): Position => {
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

// --- COMPONENTS ---

// Optimized Input component helper with React.memo
const SetupInput = React.memo(({ label, ...props }: any) => (
    <div>
        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">{label}</label>
        <input {...props} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none" />
    </div>
));
interface TeamSelectViewProps {
    teams: Team[];
    onSelectTeam: (team: Team) => void;
    onCreateTeam: (name: string, category: string, gender: 'MALE' | 'FEMALE', logo?: string, initialPlayers?: Player[]) => void;
    onDeleteTeam: (id: string) => void;
    onUpdateTeam?: (team: Team) => void;
    onViewCloudMatches?: () => void;
}
const TeamSelectView: React.FC<TeamSelectViewProps> = (props) => {
    const { teams, onSelectTeam, onCreateTeam, onDeleteTeam, onUpdateTeam, onViewCloudMatches } = props;
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newGender, setNewGender] = useState<'MALE' | 'FEMALE' | ''>('');
    const [newLogo, setNewLogo] = useState<string | undefined>(undefined);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [formErrors, setFormErrors] = useState<{ name?: boolean, category?: boolean, gender?: boolean }>({});

    // Optimized with useCallback to prevent recreation on every render
    const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const resized = await processLogo(file);
                setNewLogo(resized);
            } catch (err) {
                console.error(err);
            }
        }
    }, []);

    // Edit Logic
    const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);
    const longPressTimer = React.useRef<any>(null);

    // Optimized with useCallback and proper cleanup
    const handleTouchStart = useCallback((team: Team) => {
        longPressTimer.current = setTimeout(() => {
            setTeamToEdit(team);
            setNewName(team.name);
            setNewCategory(team.category);
            setNewGender(team.gender);
            setNewLogo(team.logo);
            setIsCreating(true);
        }, 1000); // 1 second long press
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors = {
            name: !newName.trim(),
            category: !newCategory.trim(),
            gender: !newGender
        };

        setFormErrors(errors);

        if (errors.name || errors.category || errors.gender) {
            return;
        }

        let parsedPlayers: Player[] | undefined = undefined;

        if (importFile) {
            // Process Excel using ExcelJS
            try {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(await importFile.arrayBuffer());
                const worksheet = workbook.worksheets[0];
                if (!worksheet) throw new Error('No hay hojas en el archivo');

                const headers: string[] = [];
                const json: any[] = [];
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) {
                        // First row: headers
                        row.eachCell({ includeEmpty: false }, (cell) => {
                            headers.push(cell.value?.toString() || '');
                        });
                    } else {
                        const rowData: any = {};
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            const header = headers[colNumber - 1];
                            if (header) rowData[header] = cell.value;
                        });
                        if (Object.keys(rowData).length > 0) json.push(rowData);
                    }
                });

                if (json.length > 0) {
                    parsedPlayers = json.map((row: any) => ({
                        id: generateId(),
                        number: Number(row['Dorsal'] ?? row['dorsal'] ?? row['Number'] ?? 0),
                        name: String(row['Nombre'] ?? row['nombre'] ?? row['Name'] ?? 'Desconocido'),
                        position: mapPositionString(String(row['Posicion'] ?? row['posicion'] ?? row['Position'] ?? '')),
                        active: false,
                        playingTime: 0
                    }));
                    // Ensure staff
                    if (!parsedPlayers.some((p: Player) => p.position === Position.STAFF)) {
                        parsedPlayers.push({ id: generateId(), number: 0, name: 'Entrenador', position: Position.STAFF, active: false, playingTime: 0 });
                    }
                }
            } catch (err) {
                alert("Error al leer el archivo Excel. Se creará el equipo con la plantilla por defecto.");
            }
        }

        if (teamToEdit) {
            // UPDATE EXISTING
            const updatedTeam: Team = {
                ...teamToEdit,
                name: newName,
                category: newCategory,
                gender: newGender as 'MALE' | 'FEMALE',
                logo: newLogo || teamToEdit.logo
                // Players remain same unless we want to allow re-import (disabled for this iteration for simplicity)
            };
            await saveTeam(updatedTeam);
            // We need to refresh parent list. Since onCreateTeam refreshes list in parent, we might need a prop or just rely on state?
            // Actually, parent passes 'teams'. We need to call a prop to update.
            // But onCreateTeam is typed for creation. Let's patch it or add onUpdateTeam.
            // Hack: use onCreateTeam but handle id in parent? No, tricky.
            // Best way: just modify localStorage here and call a refresh callback if available, or force reload.
            // Since we are in child, let's just use window.location.reload() or rely on the fact that saving to LS/Supabase works.
            // But the UI won't update immediately without prop.
            // Let's assume onSelectTeam can handle it or we add onUpdateTeam prop in next iteration.
            // Wait, I can't add prop easily without changing interface.
            // I will assume onCreateTeam logic in parent handles re-fetching if I mock it?
            // No, let's adding onUpdateTeam to props quickly in replacement.
            // Actually, I'll just use the `saveTeam` and then trigger a reload via checking props.
            // Let's modify the interface in chunk 3.

            // For now, let's just trigger a reload of window to be safe and simple, or better:
            // We call onUpdateTeam which I will add to props.
            if (onUpdateTeam) {
                onUpdateTeam(updatedTeam);
            } else {
                window.location.reload();
            }
        } else {
            // CREATE NEW
            onCreateTeam(newName, newCategory, newGender as 'MALE' | 'FEMALE', newLogo, parsedPlayers);
        }

        // Reset
        setNewName('');
        setNewCategory('');
        setNewGender('');
        setNewLogo(undefined);
        setImportFile(null);
        setFormErrors({});
        setIsCreating(false);
        setTeamToEdit(null);
    };

    return (
        <div className="app-container flex flex-col items-center justify-center p-6 bg-slate-900 overflow-y-auto">
            <div className="w-full max-w-2xl space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">HANDBALL<span className="text-handball-blue">STATS</span> PRO</h1>
                    <p className="text-slate-400">Selecciona tu Equipo para comenzar</p>
                </div>

                {isCreating ? (
                    <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 animate-in fade-in zoom-in-95">
                        <h2 className="text-xl font-bold text-white mb-4">{teamToEdit ? 'Editar Equipo' : 'Crear Nuevo Equipo'}</h2>

                        <div className="flex gap-4 mb-4 items-start">
                            <label className="cursor-pointer w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center border-2 border-dashed border-slate-500 hover:border-white transition-colors overflow-hidden relative group shrink-0">
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                {newLogo ? (
                                    <img src={newLogo} className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="text-slate-400" />
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold">LOGO</div>
                            </label>

                            <div className="flex-1 space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nombre del Equipo <span className="text-red-500">*</span></label>
                                    <input
                                        autoFocus
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className={`w-full bg-slate-900 border rounded-lg p-3 text-white focus:outline-none ${formErrors.name ? 'border-red-500' : 'border-slate-600 focus:border-handball-blue'}`}
                                        placeholder="Ej: Balonmano Ciudad..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Categoría <span className="text-red-500">*</span></label>
                                        <select
                                            value={newCategory}
                                            onChange={e => setNewCategory(e.target.value)}
                                            className={`w-full bg-slate-900 border rounded-lg p-3 text-white focus:outline-none ${formErrors.category ? 'border-red-500' : 'border-slate-600 focus:border-handball-blue'}`}
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="Alevin">Alevín</option>
                                            <option value="Infantil">Infantil</option>
                                            <option value="Cadete">Cadete</option>
                                            <option value="Juvenil">Juvenil</option>
                                            <option value="Senior">Senior</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Sexo <span className="text-red-500">*</span></label>
                                        <select
                                            value={newGender}
                                            onChange={e => setNewGender(e.target.value as 'MALE' | 'FEMALE')}
                                            className={`w-full bg-slate-900 border rounded-lg p-3 text-white focus:outline-none ${formErrors.gender ? 'border-red-500' : 'border-slate-600 focus:border-handball-blue'}`}
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="MALE">Masculino</option>
                                            <option value="FEMALE">Femenino</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 p-4 bg-slate-900 rounded-xl border border-slate-700">
                            <label className="block mb-2 text-sm font-bold text-slate-300 flex items-center gap-2">
                                <FileSpreadsheet size={16} /> Importar Plantilla (Opcional)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">Puedes subir un Excel (.xlsx) con columnas: <b>Dorsal, Nombre, Posicion</b>. Si no, se usará una plantilla por defecto.</p>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600"
                            />
                        </div>

                        {(formErrors.name || formErrors.category || formErrors.gender) && (
                            <div className="mb-4 text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-900/50">
                                Por favor, rellena todos los campos obligatorios marcados en rojo.
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button type="button" onClick={() => { setIsCreating(false); setTeamToEdit(null); }} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold hover:bg-slate-600">Cancelar</button>
                            <button type="submit" className="flex-1 py-3 bg-handball-blue text-white rounded-xl font-bold hover:bg-blue-600">{teamToEdit ? 'Guardar Cambios' : 'Crear Equipo'}</button>
                        </div>
                    </form>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {teams.map(team => (
                                <div
                                    key={team.id}
                                    onClick={() => onSelectTeam(team)}
                                    onTouchStart={() => handleTouchStart(team)}
                                    onTouchEnd={handleTouchEnd}
                                    onMouseDown={() => handleTouchStart(team)}
                                    onMouseUp={handleTouchEnd}
                                    onMouseLeave={handleTouchEnd}
                                    className="group relative bg-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-handball-blue cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-900/20 flex items-center gap-4 select-none"
                                >
                                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 shrink-0">
                                        {team.logo ? <img src={team.logo} className="w-full h-full object-cover" /> : <Briefcase className="text-slate-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-bold text-white truncate">{team.name}</h3>
                                        <p className="text-sm text-slate-500">{team.category} {team.gender === 'MALE' ? 'Masc' : 'Fem'}</p>
                                        <p className="text-xs text-slate-600">{team.players.length} jugadores</p>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteTeam(team.id); }}
                                        className="absolute top-2 right-2 p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => setIsCreating(true)} className="bg-slate-800/50 p-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-handball-blue hover:bg-slate-800/80 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white min-h-[120px]">
                                <Plus size={32} />
                                <span className="font-bold">Añadir Equipo</span>
                            </button>
                        </div>

                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={() => onViewCloudMatches && onViewCloudMatches()}
                                className="flex items-center gap-2 px-6 py-3 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 rounded-xl transition-colors border border-indigo-500/30"
                            >
                                <Cloud size={20} />
                                <span className="font-bold">Ver Mis Partidos en Nube (Web)</span>
                            </button>
                        </div>
                    </>
                )}
                <div className="mt-8 text-center text-xs text-slate-600 font-mono">
                    {/* Version text removed */}
                </div>
            </div>
        </div>
    );
};


// Full TimelineView
interface TimelineViewProps {
    state: MatchState;
    onDeleteEvent: (id: string) => void;
    onEditEvent: (event: MatchEvent) => void;
    onAddEvent: () => void;
    onResetMatch: () => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ state, onDeleteEvent, onEditEvent, onAddEvent, onResetMatch }) => (
    <div className="p-4 max-w-xl mx-auto min-h-full">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Clock /> Timeline del Partido</h2>
            <div className="flex gap-2">
                <button
                    onClick={onResetMatch}
                    className="bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-900/50 p-2 rounded-lg transition-colors flex items-center gap-2"
                    title="Resetear Partido"
                >
                    <RefreshCw size={20} />
                    <span className="text-sm font-bold">Reset</span>
                </button>
                <button onClick={onAddEvent} className="bg-handball-blue hover:bg-blue-600 text-white p-2 rounded-lg transition-colors">
                    <Plus size={24} />
                </button>
            </div>
        </div>
        <div className="relative space-y-4">
            {state.events
                .filter(e => {
                    if (e.type === 'SUBSTITUTION') {
                        const isUp = state.config.timerDirection === 'UP';
                        const isOT = e.period > state.config.regularPeriods;
                        const periodDuration = isOT ? state.config.otDuration : state.config.regularDuration;
                        const startTimestamp = isUp ? 0 : periodDuration * 60;
                        if (e.timestamp === startTimestamp) return false;
                    }
                    return true;
                })
                .sort((a, b) => {
                    return 0; // The state.events is already sorted by recalculateMatchState
                })
                .map((e) => {
                    const p = e.isOpponent && e.opponentPlayerId
                        ? state.opponentPlayers?.find(op => op.id === e.opponentPlayerId)
                        : state.players.find(pl => pl.id === e.playerId);

                    const timeMin = Math.floor(Math.abs(e.timestamp) / 60).toString().padStart(2, '0');
                    const timeSec = (Math.abs(e.timestamp) % 60).toString().padStart(2, '0');

                    let icon, colorClass, text;

                    if (e.isOpponent) {
                        colorClass = 'border-red-900 bg-red-900/20 text-red-300';
                        const playerName = p ? p.name : (e.opponentPlayerId ? 'Rival' : 'Rival');

                        if (e.type === 'OPPONENT_GOAL' || (e.type === 'OPPONENT_SHOT' && e.shotOutcome === ShotOutcome.GOAL)) {
                            icon = '⚽'; text = `Gol Rival ${e.shotZone ? `(${e.shotZone})` : ''} - ${playerName}`;
                        } else if (e.shotOutcome === ShotOutcome.SAVE) {
                            const gk = state.players.find(pl => pl.id === e.playerId);
                            colorClass = 'border-handball-blue bg-handball-blue/20 text-handball-blue';
                            icon = '🧤'; text = `¡PARADA! ${gk ? gk.name : 'Portero'}`;
                        } else if (e.type === 'TIMEOUT') {
                            colorClass = 'border-red-500 bg-red-900/40 text-red-200';
                            icon = '⏸️'; text = `Tiempo Muerto Rival`;
                        } else {
                            icon = '❌'; text = `Fallo Rival - ${playerName}`;
                        }
                    } else {
                        switch (e.type) {
                            case 'SHOT':
                                if (e.shotOutcome === ShotOutcome.GOAL) {
                                    colorClass = 'border-green-500 bg-green-500/20 text-green-400';
                                    icon = '⚽'; text = `GOL - ${p?.name} (${e.shotZone})`;
                                } else if (e.shotOutcome === ShotOutcome.POST) {
                                    colorClass = 'border-slate-500 bg-slate-500/20 text-slate-300';
                                    icon = '🥅'; text = `Poste - ${p?.name}`;
                                } else {
                                    colorClass = 'border-slate-500 bg-slate-500/20 text-slate-400';
                                    icon = '🚫'; text = `Tiro fallado (${e.shotOutcome}) - ${p?.name}`;
                                }
                                break;
                            case 'TURNOVER':
                                colorClass = 'border-orange-500 bg-orange-500/20 text-orange-400';
                                icon = '⚠️'; text = `Pérdida (${e.turnoverType}) - ${p?.name}`;
                                break;
                            case 'POSITIVE_ACTION':
                                colorClass = 'border-emerald-500 bg-emerald-500/20 text-emerald-400';
                                icon = '👍'; text = `${e.positiveActionType} - ${p?.name}`;
                                break;
                            case 'SANCTION':
                                colorClass = 'border-yellow-500 bg-yellow-500/20 text-yellow-400';
                                icon = '🟨'; text = `Sanción (${e.sanctionType}${e.sanctionDuration ? ` ${e.sanctionDuration}'` : ''}) - ${p?.name}`;
                                break;
                            case 'SUBSTITUTION':
                                const playerIn = state.players.find(pl => pl.id === e.playerInId);
                                const playerOut = state.players.find(pl => pl.id === e.playerOutId);
                                colorClass = 'border-sky-700 bg-sky-900/40 text-sky-300';
                                icon = '🔄';
                                text = `Cambio: Entra ${playerIn ? `#${playerIn.number} ${playerIn.name.split(' ').pop()}` : '?'} por ${playerOut ? `#${playerOut.number} ${playerOut.name.split(' ').pop()}` : '?'}`;
                                break;
                            case 'TIMEOUT':
                                colorClass = 'border-white/50 bg-white/10 text-white';
                                icon = '⏸️'; text = `Tiempo Muerto`;
                                break;
                            default:
                                colorClass = 'border-slate-600 bg-slate-600/20 text-slate-500';
                                icon = '❓';
                                text = `Evento desconocido`;
                        }
                    }

                    return (
                        <div key={e.id} className="relative flex items-center gap-4 group">
                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg border-2 border-slate-700 bg-slate-800 shrink-0 text-xs font-mono leading-none">
                                <span className="font-bold text-white">{timeMin}:{timeSec}</span>
                                <span className="text-slate-500 text-[10px]">{e.period > state.config.regularPeriods ? `OT${e.period - state.config.regularPeriods}` : `P${e.period}`}</span>
                            </div>
                            <div className={`flex-1 p-3 rounded-xl border ${colorClass} flex justify-between items-center`}>
                                <div className="truncate mr-2 flex items-center gap-3">
                                    <span className="text-xl">{icon}</span>
                                    <span className="font-medium text-sm truncate">{text}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {(e.homeScoreSnapshot !== undefined) && (
                                        <div className="text-xs font-bold bg-slate-900/50 px-2 py-1 rounded-md whitespace-nowrap border border-white/10">
                                            {e.homeScoreSnapshot}-{e.awayScoreSnapshot}
                                        </div>
                                    )}
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => onEditEvent(e)} className="p-1.5 text-slate-400 hover:text-handball-blue bg-slate-900/50 rounded-md transition-colors"><Edit2 size={14} /></button>
                                        <button onClick={() => { if (window.confirm('¿Seguro que quieres borrar este evento?')) onDeleteEvent(e.id); }} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-900/50 rounded-md transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
        </div>
    </div>
);

// SetupForm Data & View
interface SetupFormData {
    homeTeam: string;
    awayTeam: string;
    location: string;
    round: string;
    matchDate: string;
    regularPeriods: number;
    regularDuration: number;
    otDuration: number;
    direction: 'UP' | 'DOWN';
    isOurTeamHome: boolean;
    ownerTeamId?: string;
}

interface SetupViewProps {
    form: SetupFormData;
    setForm: React.Dispatch<React.SetStateAction<SetupFormData>>;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    logo: string | undefined;
    onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onViewArchive: () => void;
    // onViewGlobalStats removed
    onSwitchTeam: () => void;
    currentTeamName: string;
    isEditing: boolean;
    onCancel: () => void;
    // New props for Away Logo
    awayLogo: string | undefined;
    onAwayLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSwitchLocality: (isHome: boolean) => void;
    teams: Team[];
}

const SetupView: React.FC<SetupViewProps> = ({ form, setForm, onSubmit, logo, onLogoUpload, awayLogo, onAwayLogoUpload, onViewArchive, onSwitchTeam, currentTeamName, isEditing, onCancel, teams, onSwitchLocality }) => (
    <div className="h-full flex items-center justify-center p-2 sm:p-4 bg-slate-900 overflow-y-auto">
        <div className="w-full max-w-xl space-y-2 sm:space-y-3">
            {/* Header / Config Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <button onClick={onCancel} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="text-xs font-bold text-slate-500 uppercase">Equipo Activo</div>
                </div>
                {!isEditing && (
                    <button onClick={onSwitchTeam} className="text-sm text-handball-blue font-bold flex items-center gap-1 hover:text-white px-2 py-1">
                        <ArrowRightLeft size={14} /> Cambiar
                    </button>
                )}
            </div>
            <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 flex items-center gap-3 mb-2">
                {logo && <img src={logo} className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />}
                <div className="font-black text-xl sm:text-2xl text-white">{currentTeamName}</div>
            </div>

            <form onSubmit={onSubmit} className="bg-slate-800 p-3 sm:p-5 rounded-xl border border-slate-700 space-y-3 sm:space-y-4">
                <h1 className="text-xl sm:text-2xl font-black text-white text-center uppercase tracking-wider flex items-center justify-center gap-2">
                    <Settings className="text-handball-blue" size={28} /> {isEditing ? 'Editar' : 'Configurar'}
                </h1>


                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Equipo Local</label>
                        <input name="homeTeam" value={form.homeTeam} onChange={(e) => setForm(f => ({ ...f, homeTeam: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none" />
                    </div>
                    <label className="cursor-pointer bg-slate-900 hover:bg-slate-950 p-1 rounded-lg border border-slate-700 flex items-center justify-center w-[50px] h-[50px] sm:w-[60px] sm:h-[60px] overflow-hidden shrink-0 transition-colors group" title="Subir Logo">
                        <input type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
                        {logo ? (
                            <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <ImageIcon size={24} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                        )}
                    </label>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Equipo Visitante</label>
                        <input name="awayTeam" value={form.awayTeam} onChange={(e) => setForm(f => ({ ...f, awayTeam: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none" />
                    </div>
                    <label className="cursor-pointer bg-slate-900 hover:bg-slate-950 p-1 rounded-lg border border-slate-700 flex items-center justify-center w-[50px] h-[50px] sm:w-[60px] sm:h-[60px] overflow-hidden shrink-0 transition-colors group" title="Subir Logo Visitante">
                        <input type="file" accept="image/*" className="hidden" onChange={onAwayLogoUpload} />
                        {awayLogo ? (
                            <img src={awayLogo} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <ImageIcon size={24} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                        )}
                    </label>
                </div>

                {/* Selector Local/Visitante */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-2">¿Dónde juega tu equipo?</label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (!form.isOurTeamHome) onSwitchLocality(true);
                            }}
                            className={`p-2.5 sm:p-3 rounded-lg font-bold text-sm sm:text-base transition-all ${form.isOurTeamHome
                                ? 'bg-handball-blue text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            🏠 Local
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (form.isOurTeamHome) onSwitchLocality(false);
                            }}
                            className={`p-2.5 sm:p-3 rounded-lg font-bold text-sm sm:text-base transition-all ${!form.isOurTeamHome
                                ? 'bg-handball-blue text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            ✈️ Visitante
                        </button>
                    </div>
                </div>

                {/* Team Assignment (Reassign) */}
                {isEditing && teams.length > 1 && (
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 mb-4">
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Asignar a Equipo</label>
                        <select
                            value={form.ownerTeamId}
                            onChange={(e) => setForm(prev => ({ ...prev, ownerTeamId: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:border-handball-blue outline-none"
                        >
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Lugar / Pabellón</label>
                    <input name="location" placeholder="Pabellón..." value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Jornada</label>
                        <input name="round" placeholder="Ej: J5" value={form.round} onChange={(e) => setForm(f => ({ ...f, round: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Fecha</label>
                        <input
                            type="date"
                            name="matchDate"
                            value={form.matchDate}
                            onChange={(e) => setForm(f => ({ ...f, matchDate: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none [color-scheme:dark]"
                        />
                    </div>
                </div>

                <div className="pt-2 sm:pt-3 border-t border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-2 uppercase">Tiempo</h3>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Periodos</label>
                            <input type="number" name="regularPeriods" value={form.regularPeriods} onChange={(e) => setForm(f => ({ ...f, regularPeriods: parseInt(e.target.value, 10) || 2 }))} min="1" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Dur. (min)</label>
                            <div className="flex gap-2">
                                <select
                                    name="regularDuration"
                                    value={[30, 25, 20, 15].includes(form.regularDuration) ? form.regularDuration : 'custom'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val !== 'custom') setForm(f => ({ ...f, regularDuration: parseInt(val, 10) }));
                                    }}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none"
                                >
                                    <option value="30">30 min (Senior)</option>
                                    <option value="25">25 min (Cadete)</option>
                                    <option value="20">20 min (Infantil)</option>
                                    <option value="15">15 min (Alevin)</option>
                                    <option value="custom">Otro...</option>
                                </select>
                                {![30, 25, 20, 15].includes(form.regularDuration) && (
                                    <input
                                        type="number"
                                        value={form.regularDuration}
                                        onChange={(e) => setForm(f => ({ ...f, regularDuration: parseInt(e.target.value, 10) || 0 }))}
                                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-2 text-center text-white font-bold"
                                    />
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Prórroga</label>
                            <select name="otDuration" value={form.otDuration} onChange={(e) => setForm(f => ({ ...f, otDuration: parseInt(e.target.value, 10) }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none">
                                <option value="5">5 min</option>
                                <option value="10">10 min</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Reloj</label>
                            <select name="direction" value={form.direction} onChange={(e) => setForm(f => ({ ...f, direction: e.target.value as 'UP' | 'DOWN' }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-lg text-white focus:border-handball-blue outline-none">
                                <option value="UP">Ascendente (0 &rarr; 30)</option>
                                <option value="DOWN">Descendente (30 &rarr; 0)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
                    {isEditing && (
                        <button type="button" onClick={onCancel} className="flex-1 py-3 sm:py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold uppercase tracking-wider rounded-lg transition-all text-sm sm:text-base">
                            Cancelar
                        </button>
                    )}
                    <button type="submit" className="flex-[2] py-3 sm:py-4 bg-handball-blue hover:bg-blue-600 text-white font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 text-base sm:text-lg shadow-lg">
                        {isEditing ? 'Guardar' : 'Comenzar'}
                    </button>
                </div>
            </form>
            {
                !isEditing && (
                    <button onClick={onViewArchive} className="w-full py-3 sm:py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider rounded-lg transition-all border border-slate-700 flex items-center justify-center gap-2 text-sm sm:text-base">
                        <Archive size={20} /> Ver Archivo
                    </button>
                )
            }
            <div className="mt-6 text-center text-[10px] text-slate-600 uppercase font-bold tracking-widest opacity-50">
                v1.1.69
            </div>

        </div >
    </div >
);

interface InfoViewProps {
    matches: MatchSummary[];
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (id: string) => void;
    currentMatchMetadata: MatchMetadata;
    onNewMatch: () => void;
    onSave: () => void;
    isSaving: boolean;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExport: (id: string) => void;
    onSwitchTeam: () => void;
    onViewGlobalStats: () => void;
    onBack: () => void;
    onRefresh: () => void;
    onLogin: () => void;
    showAllMatches: boolean;
    onToggleShowAll: () => void;
}

const InfoView: React.FC<InfoViewProps> = ({
    matches, onLoad, onDelete, onEdit, currentMatchMetadata, onNewMatch, onSave, isSaving, onImport, onExport, onSwitchTeam, onViewGlobalStats, onBack, onRefresh, onLogin, showAllMatches, onToggleShowAll
}) => {
    return (
        <div className="h-full flex flex-col p-4 bg-slate-900 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={28} className="sm:w-8 sm:h-8" />
                    </button>
                    <h2 className="text-2xl sm:text-4xl font-black text-white flex items-center gap-2 sm:gap-3">
                        <Archive size={28} className="sm:w-8 sm:h-8" />
                        Archivo
                    </h2>
                </div>
                {/* Action Buttons - Force wrap/stack on small screens if crowded */}
                <div className="flex flex-wrap justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <button onClick={onLogin} className="flex-1 sm:flex-none text-sm sm:text-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 px-3 py-2 sm:px-6 sm:py-3 rounded-xl text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20 whitespace-nowrap">
                        <Cloud size={20} className="sm:w-6 sm:h-6" /> Cloud
                    </button>
                    <button onClick={onViewGlobalStats} className="flex-1 sm:flex-none text-sm sm:text-lg bg-slate-800 border border-slate-700 px-3 py-2 sm:px-6 sm:py-3 rounded-xl text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all whitespace-nowrap">
                        <Trophy size={20} className="sm:w-6 sm:h-6" /> Estadísticas Globales
                    </button>
                    <button onClick={onSwitchTeam} className="flex-1 sm:flex-none text-sm sm:text-lg bg-slate-800 border border-slate-700 px-3 py-2 sm:px-6 sm:py-3 rounded-xl text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all whitespace-nowrap">
                        <LogOut size={20} className="sm:w-6 sm:h-6" /> Cambiar
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8">
                {/* Current Match Info */}
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-6">
                    <h3 className="text-lg font-bold text-handball-blue uppercase">Partido Actual</h3>
                    <div className="text-center space-y-2">
                        <p className="font-bold text-4xl text-white">{currentMatchMetadata.homeTeam} <span className="text-slate-500 text-2xl">vs</span> {currentMatchMetadata.awayTeam}</p>
                        <p className="text-xl text-slate-400">{currentMatchMetadata.location} - {currentMatchMetadata.round}</p>
                        <p className="text-base text-slate-500">{new Date(currentMatchMetadata.date).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onNewMatch} className="flex-1 text-center py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold uppercase rounded-xl transition-all active:scale-95 text-lg shadow-lg">
                            Nuevo Partido
                        </button>
                        <button onClick={onSave} disabled={isSaving} className="flex-1 text-center py-4 bg-handball-orange hover:bg-orange-600 disabled:bg-green-600 text-white font-bold uppercase rounded-xl transition-all active:scale-95 text-lg flex items-center justify-center gap-3 shadow-lg">
                            {isSaving ? <><Check size={24} /> Guardado</> : <><Save size={24} /> Guardar</>}
                        </button>
                    </div>
                </div>

                {/* Import Section */}
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Upload size={24} /> Importar Partido</h3>
                    <label className="flex items-center justify-center w-full p-6 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-handball-blue hover:text-handball-blue transition-colors text-slate-400 bg-slate-900/50">
                        <input type="file" accept=".json, .xlsx" className="hidden" onChange={onImport} />
                        <span className="text-xl font-bold">Seleccionar archivo .json o .xlsx</span>
                    </label>
                </div>

                {/* History */}
                <div>
                    <h3 className="text-lg font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                        Historial ({matches.length})
                        <div className="flex gap-2">
                            <button
                                onClick={onToggleShowAll}
                                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-colors border ${showAllMatches ? 'bg-handball-blue text-white border-handball-blue' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                            >
                                {showAllMatches ? 'Viendo Todos' : 'Ver Todos'}
                            </button>
                            <button onClick={onRefresh} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors" title="Actualizar lista">
                                <RefreshCw size={20} />
                            </button>
                        </div>
                    </h3>
                    <div className="space-y-4">
                        {matches.length === 0 ? (
                            <p className="text-slate-500 text-center italic py-10 text-xl">No hay partidos guardados para este equipo.</p>
                        ) : matches.map(m => (
                            <div key={m.id} className="bg-slate-800/50 rounded-2xl border border-slate-700 flex items-stretch group min-h-[100px]">
                                {/* Main clickable area to load */}
                                <div
                                    onClick={() => onLoad(m.id)}
                                    className="flex flex-col flex-1 min-w-0 justify-center cursor-pointer p-3 sm:p-5 hover:bg-slate-800 rounded-l-2xl transition-colors"
                                >
                                    <div className="text-[10px] sm:text-xs text-slate-400 mb-1">{new Date(m.date).toLocaleDateString()}</div>
                                    <div className="font-bold text-white text-base sm:text-lg group-hover:text-handball-blue transition-colors flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-0 leading-tight">
                                        <span className="truncate">{m.homeTeam}</span>
                                        <span className="text-handball-orange mx-0 sm:mx-2 whitespace-nowrap text-sm sm:text-base">{m.homeScore}-{m.awayScore}</span>
                                        <span className="truncate text-sm sm:text-base">{m.awayTeam}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex border-l border-slate-700">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(m.id);
                                        }}
                                        className="px-3 sm:px-4 text-slate-500 hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center border-r border-slate-700"
                                        title="Editar Configuración"
                                    >
                                        <Settings size={16} className="sm:w-5 sm:h-5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onExport(m.id);
                                        }}
                                        className="px-3 sm:px-4 text-slate-500 hover:bg-slate-700 hover:text-handball-blue transition-colors flex items-center justify-center border-r border-slate-700"
                                        title="Exportar (Descargar)"
                                    >
                                        <Download size={16} className="sm:w-5 sm:h-5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(m.id);
                                        }}
                                        className="px-3 sm:px-4 text-slate-500 hover:bg-red-900/50 hover:text-red-400 transition-colors rounded-r-2xl flex items-center justify-center cursor-pointer"
                                        title="Borrar"
                                    >
                                        <Trash2 size={16} className="sm:w-5 sm:h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// function App() { // Renamed below
// function App() { // Renamed below
function MainDashboard() {
    // const navigate = useNavigate(); // Commented out to debug
    const [teams, setTeams] = useState<Team[]>([]);
    const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
    const [showSplash, setShowSplash] = useState(true);
    // const staffSanctionSacrificedRef = useRef<string | null>(null); // REMOVED REF
    const [pendingStaffSanctionSacrificeId, setPendingStaffSanctionSacrificeId] = useState<string | null>(null); // Use State for persistence

    const [state, setState] = useState<MatchState>({
        metadata: { id: generateId(), ownerTeamId: '', date: new Date().toISOString(), homeTeam: 'Nosotros', awayTeam: 'Rival', location: '', round: '' },
        config: DEFAULT_CONFIG,
        timerSettings: { durationMinutes: DEFAULT_CONFIG.regularDuration, direction: DEFAULT_CONFIG.timerDirection },
        currentPeriod: 1,
        isPaused: true,
        gameTime: 0,
        homeScore: 0,
        awayScore: 0,
        events: [],
        resolvedSanctionIds: [], // Init empty
        players: INITIAL_PLAYERS,
        opponentPlayers: [], // Init opponent roster
    });

    const [mode, setMode] = useState<InputMode>(InputMode.IDLE);
    const [pendingEvent, setPendingEvent] = useState<Partial<MatchEvent>>({});
    const [view, setView] = useState<ViewType>('TEAM_SELECT');

    const [matchHistory, setMatchHistory] = useState<MatchSummary[]>([]);

    // Setup & Editing state
    const [isEditingMatch, setIsEditingMatch] = useState(false);
    const [setupHomeLogo, setSetupHomeLogo] = useState<string | undefined>(undefined);
    const [setupAwayLogo, setSetupAwayLogo] = useState<string | undefined>(undefined);
    const [setupForm, setSetupForm] = useState<SetupFormData>({
        homeTeam: 'Nosotros',
        awayTeam: 'Rival',
        location: '',
        round: '',
        matchDate: new Date().toLocaleDateString('sv'), // YYYY-MM-DD
        regularPeriods: 2,
        regularDuration: 30,
        otDuration: 5,
        direction: 'UP',
        isOurTeamHome: true,
        ownerTeamId: ''
    });

    // Temporary state for editing
    const [playerForm, setPlayerForm] = useState<Partial<Player>>({});
    const [eventForm, setEventForm] = useState<Partial<MatchEvent>>({});
    const [pendingSubOut, setPendingSubOut] = useState<Player | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Roster View State
    const [rosterTab, setRosterTab] = useState<'HOME' | 'AWAY'>('HOME');
    const [sanctionEndedPlayerId, setSanctionEndedPlayerId] = useState<string | null>(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);



    const [oobCode, setOobCode] = useState<string | null>(null);


    const processedSanctionIds = useRef<Set<string>>(new Set());
    const sanctionEventIdRef = useRef<string | null>(null); // Track which event triggered the modal
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // --- DEEP LINK LISTENER (Firebase) ---
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
                console.log('📱 App opened with URL:', url);

                // Check for Firebase Auth Action Links (verifyEmail, resetPassword)
                // Firebase sends links like: https://<domain>/__/auth/action?mode=<action>&oobCode=<code>
                // Or if using custom scheme: handballstats://auth?mode=<action>&oobCode=<code>
                if (url.includes('handballstats://auth') || url.includes('mode=')) {
                    try {
                        // ExtractQueryParams
                        const rawQuery = url.split('?')[1];
                        if (!rawQuery) return;

                        const params = new URLSearchParams(rawQuery);
                        const mode = params.get('mode'); // verifyEmail, resetPassword, recoverEmail
                        const oobCode = params.get('oobCode');
                        const error = params.get('error');
                        const errorDescription = params.get('error_description');

                        if (error) {
                            await Toast.show({
                                text: `Error: ${errorDescription || 'Enlace inválido'}`,
                                duration: 'long',
                                position: 'top'
                            });
                            return;
                        }

                        if (oobCode) {
                            if (mode === 'verifyEmail') {
                                await applyActionCode(auth, oobCode);
                                console.log('✅ Email verificado exitosamente');
                                await Toast.show({
                                    text: '✅ Email verificado correctamente. Tu cuenta está activa.',
                                    duration: 'long',
                                    position: 'top'
                                });
                                setView('LOGIN'); // Navigate to Login
                            } else if (mode === 'resetPassword') {
                                console.log('🔑 Reset Password link detected');
                                setOobCode(oobCode);
                                setView('RESET_PASSWORD');
                            }
                        }
                    } catch (err: any) {
                        console.error('❌ Error processing Firebase link:', err);
                        await Toast.show({
                            text: 'Error al procesar el enlace: ' + err.message,
                            duration: 'long',
                            position: 'top'
                        });
                    }
                }
            });
        }
    }, []);


    // --- INIT: LOAD TEAMS ---
    useEffect(() => {
        setTeams(getTeams());
    }, []);

    const [showAllMatches, setShowAllMatches] = useState(false);

    // Update match history when team changes or toggle changes
    useEffect(() => {
        if (showAllMatches) {
            setMatchHistory(getMatchHistory()); // Get ALL
        } else if (currentTeam) {
            setMatchHistory(getMatchHistory(currentTeam.id));
        } else {
            setMatchHistory([]);
        }
    }, [currentTeam, showAllMatches]);

    // Derived state for active sanctions
    const activeSanctions = useMemo(() => {
        const sanctionsMap = new Map<string, { playerId: string, remaining: number, durationInSeconds: number, id: string }>();
        state.events
            .filter(e => e.type === 'SANCTION' && (e.sanctionDuration && e.sanctionDuration > 0))
            .forEach(e => {
                const { remaining } = getSanctionRemainingTime(e, state.gameTime, state.timerSettings.direction, state.currentPeriod, state.config);
                if (remaining > 0) {
                    const existing = sanctionsMap.get(e.playerId!);
                    if (existing) { existing.remaining += remaining; }
                    else { sanctionsMap.set(e.playerId!, { playerId: e.playerId!, id: e.id, remaining, durationInSeconds: (e.sanctionDuration || 0) * 60 }); }
                }
            });
        return Array.from(sanctionsMap.values());
    }, [state.events, state.gameTime, state.timerSettings.direction]);

    const isPlayerSacrificed = (playerId: string) => {
        return state.events.some(e => {
            if (e.type !== 'SANCTION' || !e.sacrificedPlayerId || e.sacrificedPlayerId !== playerId) return false;
            const { remaining } = getSanctionRemainingTime(e, state.gameTime, state.timerSettings.direction, state.currentPeriod, state.config);
            return remaining > 0;
        });
    }
    // Separate memory for Staff sanctions to avoid conflicts with the main loop
    const processedStaffSanctionIds = useRef(new Set<string>());

    // --- EFFECT: Monitor Staff Sanction Expiry ---
    useEffect(() => {
        const staffSanctionsWithDuration = state.events.filter(e =>
            e.type === 'SANCTION' && e.sanctionDuration && e.sanctionDuration > 0 &&
            (state.players.find(p => p.id === e.playerId)?.position === Position.STAFF || state.players.find(p => p.id === e.playerId)?.position === Position.COACH)
        );
        for (const sanction of staffSanctionsWithDuration) {
            const { remaining } = getSanctionRemainingTime(sanction, state.gameTime, state.timerSettings.direction, state.currentPeriod, state.config);
            // Use specialized Set for staff sanctions
            if (remaining <= 0 && !processedStaffSanctionIds.current.has(sanction.id)) {
                // Mark as processed in the specialized Set
                processedStaffSanctionIds.current.add(sanction.id);

                // Store sacrificed player for the handler to swap if needed (Using State now)
                if (sanction.sacrificedPlayerId) {
                    setPendingStaffSanctionSacrificeId(sanction.sacrificedPlayerId);
                }

                // Always ask who enters.
                setMode(InputMode.SELECT_PLAYER_TO_ENTER_AFTER_STAFF_SANCTION);

                break;
            }
        }
    }, [state.gameTime, state.events, state.timerSettings.direction, state.players]);

    useEffect(() => {
        processedSanctionIds.current = new Set();
        processedStaffSanctionIds.current = new Set(); // Reset staff set too on new match/load
    }, [state.metadata.id]);

    const handleManualSave = async () => {
        setIsSaving(true);
        saveMatch(state);

        // Also update the backup file in Downloads if native
        if (Capacitor.isNativePlatform()) {
            try {
                // Ensure state id is valid
                if (state.metadata && state.metadata.id) {
                    await handleExportMatch(state.metadata.id, true);
                }
            } catch (e) {
                console.error("Silent backup failed", e);
            }
        }

        setTimeout(() => { setIsSaving(false); }, 1000);
    };

    useEffect(() => {
        const isMatchActive = view === 'MATCH';
        if (!isMatchActive) return;
        const intervalId = setInterval(() => { saveMatch(stateRef.current); }, 30000);
        const handleBeforeUnload = () => { saveMatch(stateRef.current); };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            saveMatch(stateRef.current);
        };
    }, [view]);

    // TEAM ACTIONS
    const handleCreateTeam = (name: string, category: string, gender: 'MALE' | 'FEMALE', logo?: string, initialPlayers?: Player[]) => {
        const newTeam: Team = {
            id: generateId(),
            name,
            category,
            gender,
            logo,
            players: initialPlayers || INITIAL_PLAYERS.map(p => ({ ...p, id: generateId() })), // Use imported or Clone initial
            createdAt: Date.now()
        };
        saveTeam(newTeam);
        setTeams(getTeams());
        setCurrentTeam(newTeam);
        setSetupHomeLogo(newTeam.logo);
        setSetupForm(prev => ({ ...prev, homeTeam: newTeam.name }));

        // Resetear el estado del partido con los jugadores del nuevo equipo
        // SIEMPRE asignamos al equipo actual a state.players
        const freshPlayers = newTeam.players.map(p => ({
            ...p,
            active: false,
            playingTime: 0,
            playingTimeByPeriod: {}
        }));

        setState({
            metadata: {
                id: generateId(),
                ownerTeamId: newTeam.id,
                date: new Date().toISOString(),
                homeTeam: newTeam.name,
                homeTeamLogo: newTeam.logo,
                awayTeam: 'Rival',
                awayTeamLogo: undefined,
                location: '',
                round: '',
                isOurTeamHome: true,
            },
            config: DEFAULT_CONFIG,
            timerSettings: { durationMinutes: DEFAULT_CONFIG.regularDuration, direction: DEFAULT_CONFIG.timerDirection },
            currentPeriod: 1,
            isPaused: true,
            gameTime: DEFAULT_CONFIG.timerDirection === 'DOWN' ? DEFAULT_CONFIG.regularDuration * 60 : 0,
            homeScore: 0,
            awayScore: 0,
            events: [],
            resolvedSanctionIds: [],
            players: freshPlayers, // SIEMPRE AQUÍ
            opponentPlayers: [],   // Rival siempre vacío al crear
        });

        // Limpiar estados auxiliares
        setPendingEvent({});
        setPlayerForm({});
        setEventForm({});
        setPendingSubOut(null);
        setSanctionEndedPlayerId(null);
        setSelectedPlayerId(null);
        setMode(InputMode.IDLE);
        setRosterTab('HOME');
        processedSanctionIds.current = new Set();

        setView('SETUP');
    };

    const handleSelectTeam = (team: Team) => {
        setCurrentTeam(team);
        setSetupHomeLogo(team.logo);
        setSetupForm(prev => ({ ...prev, homeTeam: team.name }));

        // Resetear el estado del partido con los jugadores del equipo seleccionado
        // SIEMPRE asignamos al equipo actual a state.players, independientemente de si es local o visitante
        const freshPlayers = team.players.map(p => ({
            ...p,
            active: false,
            playingTime: 0,
            playingTimeByPeriod: {}
        }));

        setState({
            metadata: {
                id: generateId(),
                ownerTeamId: team.id,
                date: new Date().toISOString(),
                homeTeam: team.name,
                homeTeamLogo: team.logo,
                awayTeam: 'Rival',
                awayTeamLogo: undefined,
                location: '',
                round: '',
                isOurTeamHome: true,
            },
            config: DEFAULT_CONFIG,
            timerSettings: { durationMinutes: DEFAULT_CONFIG.regularDuration, direction: DEFAULT_CONFIG.timerDirection },
            currentPeriod: 1,
            isPaused: true,
            gameTime: DEFAULT_CONFIG.timerDirection === 'DOWN' ? DEFAULT_CONFIG.regularDuration * 60 : 0,
            homeScore: 0,
            awayScore: 0,
            events: [],
            resolvedSanctionIds: [],
            players: freshPlayers, // SIEMPRE AQUÍ
            opponentPlayers: [],   // Rival siempre empieza vacío
        });

        // Limpiar estados auxiliares
        setPendingEvent({});
        setPlayerForm({});
        setEventForm({});
        setPendingSubOut(null);
        setSanctionEndedPlayerId(null);
        setSelectedPlayerId(null);
        setMode(InputMode.IDLE);
        setRosterTab('HOME');
        processedSanctionIds.current = new Set();

        setView('SETUP');
    };

    const handleDeleteTeam = (id: string) => {
        if (window.confirm("¿Seguro que quieres borrar este equipo?")) {
            deleteTeam(id);
            setTeams(getTeams());
        }
    };

    const handleSwitchTeam = () => {
        setView('TEAM_SELECT');
        setCurrentTeam(null);
    };

    // Setup & Edit Match Handlers
    const handleNewMatch = () => {
        if (!currentTeam) return;

        // Guardar el partido actual antes de crear uno nuevo
        saveMatch(state);

        // Resetear todo el estado excepto la plantilla de jugadores
        // SIEMPRE asignamos al equipo actual a state.players
        const freshPlayers = currentTeam.players.map(p => ({
            ...p,
            active: false,
            playingTime: 0,
            playingTimeByPeriod: {}
        }));

        // NOTA: No importa si jugamos en casa o fuera, "Nuestros Jugadores" siempre van a state.players

        // Crear estado completamente nuevo
        setState({
            metadata: {
                id: generateId(),
                ownerTeamId: currentTeam.id,
                date: new Date().toISOString(),
                homeTeam: currentTeam.name,
                homeTeamLogo: currentTeam.logo,
                awayTeam: 'Rival',
                awayTeamLogo: undefined,
                location: '',
                round: '',
                isOurTeamHome: true, // Por defecto true, se cambia en Setup
            },
            config: DEFAULT_CONFIG,
            timerSettings: { durationMinutes: DEFAULT_CONFIG.regularDuration, direction: DEFAULT_CONFIG.timerDirection },
            currentPeriod: 1,
            isPaused: true,
            gameTime: DEFAULT_CONFIG.timerDirection === 'DOWN' ? DEFAULT_CONFIG.regularDuration * 60 : 0,
            homeScore: 0,
            awayScore: 0,
            events: [],
            resolvedSanctionIds: [],
            players: freshPlayers, // SIEMPRE AQUÍ
            opponentPlayers: [],   // Rival vacío
        });

        // Resetear todos los estados auxiliares
        setPendingEvent({});
        setPlayerForm({});
        setEventForm({});
        setPendingSubOut(null);
        setSanctionEndedPlayerId(null);
        setSelectedPlayerId(null);
        setMode(InputMode.IDLE);
        setRosterTab('HOME');
        processedSanctionIds.current = new Set();

        // Resetear formulario de setup con valores predeterminados
        setSetupForm({
            homeTeam: currentTeam.name,
            awayTeam: 'Rival',
            location: '',
            round: '',
            matchDate: new Date().toLocaleDateString('sv'),
            regularPeriods: 2,
            regularDuration: 30,
            otDuration: 5,
            direction: 'UP',
            isOurTeamHome: true,
            ownerTeamId: currentTeam.id
        });
        setSetupHomeLogo(currentTeam.logo);
        setSetupAwayLogo(undefined);
        setIsEditingMatch(false);

        // Actualizar historial
        if (currentTeam) setMatchHistory(getMatchHistory(currentTeam.id));

        // Ir a la vista de configuración
        setView('SETUP');
    };

    const handleEditCurrentMatch = () => {
        const { metadata, config } = state;
        const wasHome = metadata.isOurTeamHome !== undefined
            ? metadata.isOurTeamHome
            : (currentTeam ? metadata.homeTeam === currentTeam.name : true);
        setSetupForm({
            homeTeam: metadata.homeTeam,
            awayTeam: metadata.awayTeam,
            location: metadata.location,
            round: metadata.round,
            matchDate: metadata.date.split('T')[0],
            regularPeriods: config.regularPeriods,
            regularDuration: config.regularDuration,
            otDuration: config.otDuration,
            direction: config.timerDirection,
            isOurTeamHome: wasHome !== undefined ? wasHome : true,
            ownerTeamId: metadata.ownerTeamId || (currentTeam ? currentTeam.id : '')
        });
        setSetupHomeLogo(metadata.homeTeamLogo);
        setSetupAwayLogo(metadata.awayTeamLogo);
        setIsEditingMatch(true);
        setView('SETUP');
    };

    const handleEditArchivedMatch = (id: string) => {
        const loaded = loadMatch(id);
        if (!loaded) return;

        const wasHome = loaded.metadata.isOurTeamHome !== undefined
            ? loaded.metadata.isOurTeamHome
            : (currentTeam ? loaded.metadata.homeTeam === currentTeam.name : true);
        setState(recalculateMatchState(loaded)); // Load into state to edit
        setSetupForm({
            homeTeam: loaded.metadata.homeTeam,
            awayTeam: loaded.metadata.awayTeam,
            location: loaded.metadata.location,
            round: loaded.metadata.round,
            matchDate: loaded.metadata.date.split('T')[0],
            regularPeriods: loaded.config.regularPeriods,
            regularDuration: loaded.config.regularDuration,
            otDuration: loaded.config.otDuration,
            direction: loaded.config.timerDirection,
            isOurTeamHome: wasHome !== undefined ? wasHome : true,
            ownerTeamId: loaded.metadata.ownerTeamId || (currentTeam ? currentTeam.id : '')
        });
        setSetupHomeLogo(loaded.metadata.homeTeamLogo);
        setSetupAwayLogo(loaded.metadata.awayTeamLogo);
        setIsEditingMatch(true);
        setView('SETUP');
    };

    const handleSetupSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!currentTeam) return;

        const config: MatchConfig = {
            regularPeriods: setupForm.regularPeriods,
            regularDuration: setupForm.regularDuration,
            otDuration: setupForm.otDuration,
            timerDirection: setupForm.direction,
        };

        const matchDate = setupForm.matchDate ? new Date(`${setupForm.matchDate}T12:00:00`) : new Date();

        if (isEditingMatch) {
            // UPDATE EXISTING MATCH
            setState(prev => {
                const oldDirection = prev.config.timerDirection;
                const newDirection = config.timerDirection;
                let newGameTime = prev.gameTime;
                let updatedEvents = [...prev.events];

                // If timer direction changed, flip the current time AND event timestamps
                if (oldDirection !== newDirection) {
                    const isOT = prev.currentPeriod > config.regularPeriods;
                    const durationMins = isOT ? config.otDuration : config.regularDuration;
                    const totalSeconds = durationMins * 60;

                    // 1. Flip Game Time
                    newGameTime = totalSeconds - prev.gameTime;
                    if (newGameTime < 0) newGameTime = 0;
                    if (newGameTime > totalSeconds) newGameTime = totalSeconds;

                    // 2. Flip Event Timestamps
                    updatedEvents = updatedEvents.map(e => {
                        const isEventOT = e.period > config.regularPeriods;
                        const evtDuration = isEventOT ? config.otDuration : config.regularDuration;
                        const evtTotalSeconds = evtDuration * 60;

                        // Invert timestamp
                        let newTimestamp = evtTotalSeconds - e.timestamp;
                        if (newTimestamp < 0) newTimestamp = 0;

                        return { ...e, timestamp: newTimestamp };
                    });
                }

                // If Home/Away status changed, flip scores and score snapshots
                const homeAwayChanged = prev.metadata.isOurTeamHome !== setupForm.isOurTeamHome;
                let finalHomeScore = prev.homeScore;
                let finalAwayScore = prev.awayScore;

                if (homeAwayChanged) {
                    finalHomeScore = prev.awayScore;
                    finalAwayScore = prev.homeScore;

                    updatedEvents = updatedEvents.map(e => ({
                        ...e,
                        homeScoreSnapshot: e.awayScoreSnapshot,
                        awayScoreSnapshot: e.homeScoreSnapshot
                    }));
                }

                const updated = {
                    ...prev,
                    metadata: {
                        ...prev.metadata,
                        date: matchDate.toISOString(),
                        homeTeam: setupForm.homeTeam,
                        homeTeamLogo: setupHomeLogo,
                        awayTeam: setupForm.awayTeam,
                        awayTeamLogo: setupAwayLogo,
                        location: setupForm.location,
                        round: setupForm.round,
                        isOurTeamHome: setupForm.isOurTeamHome,
                        ownerTeamId: setupForm.ownerTeamId || prev.metadata.ownerTeamId
                    },
                    config: config,
                    gameTime: newGameTime,
                    homeScore: finalHomeScore, // Explicitly set new score
                    awayScore: finalAwayScore, // Explicitly set new score
                    events: updatedEvents,
                    timerSettings: {
                        ...prev.timerSettings,
                        direction: newDirection,
                        durationMinutes: (prev.currentPeriod > config.regularPeriods) ? config.otDuration : config.regularDuration
                    }
                };
                saveMatch(updated); // This updates the specific match file AND the index file with new names/scores
                // Manually update the match history state to reflect changes immediately without wait for reload
                if (currentTeam) setMatchHistory(getMatchHistory(currentTeam.id));

                return updated;
            });
            setIsEditingMatch(false);
            setView('MATCH');
        } else {
            // CREATE NEW MATCH
            setPendingEvent({});
            setPlayerForm({});
            setEventForm({});
            setPendingSubOut(null);
            setSanctionEndedPlayerId(null);
            setSelectedPlayerId(null);
            setMode(InputMode.IDLE);
            setRosterTab('HOME');
            processedSanctionIds.current = new Set();

            // Aquí NO modificamos players ni opponentPlayers basándonos en local/visitante.
            // Los jugadores YA están cargados en state.players desde handleNewMatch o handleSelectTeam.
            // Solo necesitamos resetear tiempos si fuera necesario, pero handleNewMatch ya lo hizo.

            // Re-aplicamos el reset por seguridad, pero SIEMPRE sobre state.players
            const matchPlayers = currentTeam.players.map(p => ({ ...p, active: false, playingTime: 0, playingTimeByPeriod: {} }));

            setState({
                metadata: {
                    id: generateId(),
                    ownerTeamId: currentTeam.id,
                    date: matchDate.toISOString(),
                    homeTeam: setupForm.homeTeam,
                    homeTeamLogo: setupHomeLogo,
                    awayTeam: setupForm.awayTeam,
                    awayTeamLogo: setupAwayLogo,
                    location: setupForm.location || '',
                    round: setupForm.round || '',
                    isOurTeamHome: setupForm.isOurTeamHome,
                },
                config,
                timerSettings: { durationMinutes: config.regularDuration, direction: config.timerDirection },
                currentPeriod: 1,
                isPaused: true,
                gameTime: config.timerDirection === 'DOWN' ? config.regularDuration * 60 : 0,
                homeScore: 0,
                awayScore: 0,
                events: [],
                resolvedSanctionIds: [],
                players: matchPlayers, // SIEMPRE AQUÍ
                opponentPlayers: [],   // Rival empieza vacío
            });
            setView('MATCH');
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setSetupHomeLogo(await processLogo(file));
    };

    const handleAwayLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setSetupAwayLogo(await processLogo(file));
    };

    const handleLoadMatch = (id: string, targetView: ViewType = 'MATCH') => {
        const loadedState = loadMatch(id);
        if (loadedState) {
            if (!loadedState.metadata.ownerTeamId && currentTeam) {
                loadedState.metadata.ownerTeamId = currentTeam.id;
            }
            if (!loadedState.config) {
                loadedState.config = { regularPeriods: 2, regularDuration: loadedState.timerSettings.durationMinutes || 30, otDuration: 5, timerDirection: loadedState.timerSettings.direction || 'UP' };
            }
            if (!loadedState.currentPeriod) loadedState.currentPeriod = 1;
            // Initialise opponentPlayers if missing
            if (!loadedState.opponentPlayers) loadedState.opponentPlayers = [];
            // Initialize resolvedSanctionIds if missing
            if (!loadedState.resolvedSanctionIds) loadedState.resolvedSanctionIds = [];

            loadedState.events = loadedState.events.map(e => ({ ...e, period: e.period || 1 }));

            setState(recalculateMatchState(loadedState));
            const wasHome = loadedState.metadata.isOurTeamHome !== undefined ? loadedState.metadata.isOurTeamHome : (currentTeam ? loadedState.metadata.homeTeam === currentTeam.name : true);
            setSetupHomeLogo(wasHome ? loadedState.metadata.homeTeamLogo : loadedState.metadata.awayTeamLogo);
            setSetupAwayLogo(wasHome ? loadedState.metadata.awayTeamLogo : loadedState.metadata.homeTeamLogo);
            setView(targetView);
        }
    };

    const handleDeleteArchivedMatch = (id: string) => {
        if (window.confirm('⚠️ ¿Borrar partido permanentemente?')) {
            deleteMatch(id);
            if (currentTeam) setMatchHistory(getMatchHistory(currentTeam.id));
        }
    };

    const handleExportMatch = async (id: string, silent: boolean = false) => {
        const matchData = loadMatch(id);
        if (!matchData) { alert("Error al cargar."); return; }
        // Usar siempre Local vs Visitante para el nombre del archivo
        const localTeamName = matchData.metadata.homeTeam;
        const visitorTeamName = matchData.metadata.awayTeam;
        const filename = `partido_${localTeamName}_vs_${visitorTeamName}_${new Date(matchData.metadata.date).toLocaleDateString('es-ES').replace(/\//g, '-')}.json`;
        const jsonString = JSON.stringify(matchData, null, 2);

        if (Capacitor.isNativePlatform()) {
            try {
                try {
                    await Filesystem.mkdir({
                        path: 'Download/partidos',
                        directory: Directory.ExternalStorage,
                        recursive: true
                    });
                } catch (e) { console.log('Directory create error (might exist)', e); }

                const result = await Filesystem.writeFile({
                    path: `Download/partidos/${filename}`,
                    data: jsonString,
                    directory: Directory.ExternalStorage,
                    encoding: Encoding.UTF8
                });

                if (!silent) {
                    await Share.share({
                        title: 'Exportar Partido',
                        text: 'Archivo de datos del partido (JSON)',
                        url: result.uri,
                        dialogTitle: 'Guardar Partido',
                    });
                }
            } catch (e) {
                console.error('Error exporting match', e);
                alert('Error al exportar partido: ' + (e as any).message);
            }
        } else {
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', filename);
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);
        }
    };

    const handleImportMatch = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.xlsx')) {
            // Excel Import
            try {
                const parsedState = await parseExcelMatch(file);
                if (parsedState) {
                    if (currentTeam) {
                        parsedState.metadata.ownerTeamId = currentTeam.id;
                    }
                    if (importMatchState(parsedState)) {
                        alert("Partido importado desde Excel correctamente.");
                        if (currentTeam) setMatchHistory(getMatchHistory(currentTeam.id));
                    } else {
                        alert("Error al importar el estado del partido desde Excel.");
                    }
                } else {
                    alert("No se pudo leer el archivo Excel o formato inválido.");
                }
            } catch (err) {
                console.error(err);
                alert("Error procesando Excel.");
            }
        } else {
            // JSON Import (Legacy)
            const fileReader = new FileReader();
            fileReader.readAsText(file, "UTF-8");
            fileReader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target?.result as string);
                    if (currentTeam) {
                        parsed.metadata.ownerTeamId = currentTeam.id;
                    }
                    if (importMatchState(parsed)) {
                        alert("Partido importado y asignado al equipo actual.");
                        if (currentTeam) setMatchHistory(getMatchHistory(currentTeam.id));
                    } else {
                        alert("Archivo inválido.");
                    }
                } catch (error) {
                    alert("Error JSON.");
                }
            };
        }
        e.target.value = '';
    };

    // --- SYNC HANDLER ---
    const handleSyncSuccess = () => {
        const updatedTeams = getTeams();
        setTeams(updatedTeams);

        // Refresh matches
        if (showAllMatches) {
            setMatchHistory(getMatchHistory());
        } else if (currentTeam) {
            // Update current team reference if it exists in new list
            const refreshedTeam = updatedTeams.find(t => t.id === currentTeam.id);
            if (refreshedTeam) setCurrentTeam(refreshedTeam);

            setMatchHistory(getMatchHistory(currentTeam.id));
        } else if (updatedTeams.length > 0) {
            // Auto-select first team if none selected
            setCurrentTeam(updatedTeams[0]);
            setMatchHistory(getMatchHistory(updatedTeams[0].id));
        } else {
            setMatchHistory([]);
        }
    };

    // --- EXPORT HELPERS ---
    const saveAndShareExcelJS = async (buffer: ArrayBuffer, filename: string) => {
        if (Capacitor.isNativePlatform()) {
            try {
                try {
                    await Filesystem.mkdir({
                        path: 'Download/partidos',
                        directory: Directory.ExternalStorage,
                        recursive: true
                    });
                } catch (e) { console.log('Directory create error (might exist)', e); }

                const base64Data = arrayBufferToBase64(buffer);
                const result = await Filesystem.writeFile({
                    path: `Download/partidos/${filename}`,
                    data: base64Data,
                    directory: Directory.ExternalStorage
                });

                await Share.share({
                    title: 'Exportar Estadísticas',
                    text: 'Estadísticas del partido',
                    url: result.uri,
                    dialogTitle: 'Guardar Excel',
                });
            } catch (e) {
                console.error('Error saving file on Android', e);
                alert('Error al guardar el archivo en Android: ' + (e as any).message);
            }
        } else {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    };

    const handleExportStatsToExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'HandballStats Pro';
            workbook.created = new Date();

            // Get team info
            const localTeamName = state.metadata.homeTeam;
            const visitorTeamName = state.metadata.awayTeam;
            // Opponent name is still needed for the Rival Sheet title
            const opponentTeamName = state.metadata.isOurTeamHome ? state.metadata.awayTeam : state.metadata.homeTeam;
            const matchDate = new Date(state.metadata.date).toLocaleDateString('es-ES');

            // ============ SHEET 1: General Stats ============
            const wsGeneral = workbook.addWorksheet('General');

            // Colors
            const DARK_BLUE = 'FF1E3A5F';
            const LIGHT_BLUE = 'FF3B82F6';
            const GREEN = 'FF10B981';
            const ORANGE = 'FFF59E0B';
            const RED = 'FFEF4444';
            const GRAY = 'FF6B7280';
            const LIGHT_GRAY = 'FFF3F4F6';

            // Title Row
            wsGeneral.mergeCells('A1:N1');
            const titleCell = wsGeneral.getCell('A1');
            titleCell.value = `📊 ESTADÍSTICAS - ${localTeamName} vs ${visitorTeamName}`;
            titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            wsGeneral.getRow(1).height = 30;

            // Match Info Row
            wsGeneral.mergeCells('A2:N2');
            const infoCell = wsGeneral.getCell('A2');
            infoCell.value = `${state.metadata.round || 'Partido'} | ${matchDate} | ${state.metadata.location || ''}`;
            infoCell.font = { size: 11, color: { argb: GRAY } };
            infoCell.alignment = { horizontal: 'center' };

            // Score Row
            wsGeneral.mergeCells('A3:N3');
            const scoreCell = wsGeneral.getCell('A3');
            const isWin = (state.metadata.isOurTeamHome ? state.homeScore > state.awayScore : state.awayScore > state.homeScore);
            const isDraw = state.homeScore === state.awayScore;
            scoreCell.value = `RESULTADO: ${state.homeScore} - ${state.awayScore} ${isWin ? '✅ VICTORIA' : isDraw ? '🤝 EMPATE' : '❌ DERROTA'}`;
            scoreCell.font = { bold: true, size: 14, color: { argb: isWin ? GREEN : isDraw ? ORANGE : RED } };
            scoreCell.alignment = { horizontal: 'center' };
            wsGeneral.getRow(3).height = 25;

            // Empty row
            wsGeneral.getRow(4).height = 10;

            // Header style function
            const applyHeaderStyle = (row: ExcelJS.Row, color: string) => {
                row.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FF000000' } },
                        left: { style: 'thin', color: { argb: 'FF000000' } },
                        bottom: { style: 'thin', color: { argb: 'FF000000' } },
                        right: { style: 'thin', color: { argb: 'FF000000' } }
                    };
                });
                row.height = 22;
            };

            const applyDataStyle = (row: ExcelJS.Row, isEven: boolean) => {
                row.eachCell((cell) => {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                    if (isEven) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
                    }
                });
            };

            // Column widths
            wsGeneral.columns = [
                { width: 5 },  // #
                { width: 18 }, // Nombre
                { width: 10 }, // Pos
                { width: 8 },  // Goles
                { width: 8 },  // Lanz
                { width: 8 },  // %
                { width: 8 },  // 6m
                { width: 8 },  // 9m
                { width: 8 },  // Ext
                { width: 8 },  // 7m
                { width: 8 },  // Contra
                { width: 8 },  // Pérd
                { width: 8 },  // Asis
                { width: 8 }   // Tiempo
            ];

            // Field Players Header
            const headerRow = wsGeneral.getRow(5);
            headerRow.values = ['#', 'Nombre', 'Pos', 'Gol', 'Lanz', '%', '6m', '9m', 'Ext', '7m', 'Contra', 'Pérd', 'Asist', 'Tiempo'];
            applyHeaderStyle(headerRow, LIGHT_BLUE);

            // Field players data
            const fieldPlayers = state.players.filter(p => p.position !== Position.GK && p.position !== Position.STAFF).sort((a, b) => a.number - b.number);
            let rowIndex = 6;

            fieldPlayers.forEach((player, idx) => {
                const playerEvents = state.events.filter(e => e.playerId === player.id);
                const shots = playerEvents.filter(e => e.type === 'SHOT');
                const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
                const totalShots = shots.length;
                const percentage = totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0;

                // Zone stats
                const getZoneGoals = (zones: ShotZone[]) => {
                    const zoneShots = shots.filter(s => s.shotZone && zones.includes(s.shotZone));
                    const zoneGoals = zoneShots.filter(s => s.shotOutcome === ShotOutcome.GOAL).length;
                    return zoneShots.length > 0 ? `${zoneGoals}/${zoneShots.length}` : '-';
                };

                const sixM = getZoneGoals([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]);
                const nineM = getZoneGoals([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]);
                const wing = getZoneGoals([ShotZone.WING_L, ShotZone.WING_R]);
                const sevenM = getZoneGoals([ShotZone.SEVEN_M]);
                const fastbreak = getZoneGoals([ShotZone.FASTBREAK]);

                const turnovers = playerEvents.filter(e => e.type === 'TURNOVER').length;
                const assists = playerEvents.filter(e => e.type === 'POSITIVE_ACTION' && (e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK)).length;
                const pt = player.playingTime || 0;
                const ptMin = Math.floor(pt / 60);
                const ptSec = Math.floor(pt % 60);
                const playingTimeStr = `${ptMin.toString().padStart(2, '0')}:${ptSec.toString().padStart(2, '0')}`;

                const row = wsGeneral.getRow(rowIndex);
                row.values = [
                    player.number,
                    player.name,
                    player.position,
                    goals,
                    totalShots,
                    `${percentage}%`,
                    sixM,
                    nineM,
                    wing,
                    sevenM,
                    fastbreak,
                    turnovers,
                    assists,
                    playingTimeStr
                ];
                applyDataStyle(row, idx % 2 === 0);

                // Highlight top scorer
                if (goals > 0) {
                    row.getCell(4).font = { bold: true, color: { argb: GREEN } };
                }
                if (turnovers > 2) {
                    row.getCell(12).font = { color: { argb: RED } };
                }
                rowIndex++;
            });

            // Empty row
            rowIndex++;

            // Goalkeepers section
            const gkHeaderRow = wsGeneral.getRow(rowIndex);
            gkHeaderRow.values = ['#', 'Portero', '', 'Paradas', 'Goles', '%', '', '', '', '', '', '', '', 'Tiempo'];
            applyHeaderStyle(gkHeaderRow, GREEN);
            rowIndex++;

            const goalkeepers = state.players.filter(p => p.position === Position.GK).sort((a, b) => a.number - b.number);
            goalkeepers.forEach((gk, idx) => {
                const gkEvents = state.events.filter(e => e.isOpponent && e.type === 'OPPONENT_SHOT' && e.playerId === gk.id);
                const saves = gkEvents.filter(e => e.shotOutcome === ShotOutcome.SAVE).length;
                const goalsAgainst = gkEvents.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
                const total = saves + goalsAgainst;
                const savePercent = total > 0 ? Math.round((saves / total) * 100) : 0;
                const pt = gk.playingTime || 0;
                const ptMin = Math.floor(pt / 60);
                const ptSec = Math.floor(pt % 60);
                const playingTimeStr = `${ptMin.toString().padStart(2, '0')}:${ptSec.toString().padStart(2, '0')}`;

                const row = wsGeneral.getRow(rowIndex);
                row.values = [
                    gk.number,
                    gk.name,
                    'GK',
                    saves,
                    goalsAgainst,
                    `${savePercent}%`,
                    '', '', '', '', '', '', '',
                    playingTimeStr
                ];
                applyDataStyle(row, idx % 2 === 0);

                if (savePercent >= 30) {
                    row.getCell(6).font = { bold: true, color: { argb: GREEN } };
                }
                rowIndex++;
            });

            // ============ SHEET 2: Sanciones ============
            const wsSanctions = workbook.addWorksheet('Sanciones');
            wsSanctions.columns = [
                { width: 5 },
                { width: 18 },
                { width: 10 },
                { width: 12 },
                { width: 10 },
                { width: 10 }
            ];

            wsSanctions.mergeCells('A1:F1');
            const sanctionTitle = wsSanctions.getCell('A1');
            sanctionTitle.value = '🟨 SANCIONES';
            sanctionTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
            sanctionTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
            sanctionTitle.alignment = { horizontal: 'center' };
            wsSanctions.getRow(1).height = 25;

            const sanctionHeader = wsSanctions.getRow(3);
            sanctionHeader.values = ['#', 'Nombre', 'Pos', 'Amarillas', '2 Min', 'Roja'];
            applyHeaderStyle(sanctionHeader, ORANGE);

            let sanctionRow = 4;
            state.players.forEach((player, idx) => {
                const playerEvents = state.events.filter(e => e.playerId === player.id && e.type === 'SANCTION');
                if (playerEvents.length === 0) return;

                const yellow = playerEvents.filter(e => e.sanctionType === SanctionType.YELLOW).length;
                const twoMin = playerEvents.filter(e => e.sanctionType === SanctionType.TWO_MIN).length;
                const red = playerEvents.filter(e => e.sanctionType === SanctionType.RED).length;
                const blue = playerEvents.filter(e => e.sanctionType === SanctionType.BLUE).length;

                const row = wsSanctions.getRow(sanctionRow);
                row.values = [
                    player.number,
                    player.name,
                    player.position,
                    yellow || '',
                    twoMin || '',
                    red || blue ? (red ? 'ROJA' : 'AZUL') : ''
                ];
                applyDataStyle(row, sanctionRow % 2 === 0);

                if (yellow > 0) row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } };
                if (twoMin > 0) row.getCell(5).font = { bold: true };
                if (red || blue) row.getCell(6).font = { bold: true, color: { argb: red ? RED : 'FF3B82F6' } };

                sanctionRow++;
            });

            // ============ SHEET 3: Acciones ============
            const wsActions = workbook.addWorksheet('Acciones');
            wsActions.columns = [
                { width: 5 },
                { width: 18 },
                { width: 10 },
                { width: 10 },
                { width: 10 },
                { width: 10 },
                { width: 10 },
                { width: 10 }
            ];

            wsActions.mergeCells('A1:H1');
            const actionsTitle = wsActions.getCell('A1');
            actionsTitle.value = '✅ ACCIONES POSITIVAS / ❌ PÉRDIDAS';
            actionsTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
            actionsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } };
            actionsTitle.alignment = { horizontal: 'center' };
            wsActions.getRow(1).height = 25;

            const actionsHeader = wsActions.getRow(3);
            actionsHeader.values = ['#', 'Nombre', 'Recup', 'Asist', '7m/2\'', 'Pase', 'Recep', 'Pasos'];
            applyHeaderStyle(actionsHeader, DARK_BLUE);

            let actionsRow = 4;
            state.players.filter(p => p.position !== Position.STAFF).forEach((player, idx) => {
                const playerEvents = state.events.filter(e => e.playerId === player.id);
                const positiveEvents = playerEvents.filter(e => e.type === 'POSITIVE_ACTION');
                const turnoverEvents = playerEvents.filter(e => e.type === 'TURNOVER');

                if (positiveEvents.length === 0 && turnoverEvents.length === 0) return;

                const steals = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.STEAL).length;
                const assists = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK).length;
                const penalties = positiveEvents.filter(e => e.positiveActionType === PositiveActionType.FORCE_PENALTY).length;

                const passBad = turnoverEvents.filter(e => e.turnoverType === TurnoverType.PASS).length;
                const reception = turnoverEvents.filter(e => e.turnoverType === TurnoverType.RECEPTION).length;
                const steps = turnoverEvents.filter(e => e.turnoverType === TurnoverType.STEPS).length;

                const row = wsActions.getRow(actionsRow);
                row.values = [
                    player.number,
                    player.name,
                    steals || '',
                    assists || '',
                    penalties || '',
                    passBad || '',
                    reception || '',
                    steps || ''
                ];
                applyDataStyle(row, actionsRow % 2 === 0);

                // Color positive actions green
                if (steals) row.getCell(3).font = { color: { argb: GREEN } };
                if (assists) row.getCell(4).font = { color: { argb: GREEN } };
                if (penalties) row.getCell(5).font = { color: { argb: GREEN } };
                // Color turnovers red
                if (passBad) row.getCell(6).font = { color: { argb: RED } };
                if (reception) row.getCell(7).font = { color: { argb: RED } };
                if (steps) row.getCell(8).font = { color: { argb: RED } };

                actionsRow++;
            });

            // ... (Después de generar la hoja General, Sanciones y Acciones del equipo propio)

            // ============ SHEET 4: General Rival ============
            const wsGeneralOpponent = workbook.addWorksheet('General Rival');

            // Title Row
            wsGeneralOpponent.mergeCells('A1:N1');
            const titleCellOpp = wsGeneralOpponent.getCell('A1');
            titleCellOpp.value = `📊 ESTADÍSTICAS RIVAL - ${opponentTeamName}`;
            titleCellOpp.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
            titleCellOpp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }; // Usar rojo para el rival
            titleCellOpp.alignment = { horizontal: 'center', vertical: 'middle' };
            wsGeneralOpponent.getRow(1).height = 30;

            // Match Info Row
            wsGeneralOpponent.mergeCells('A2:N2');
            const infoCellOpp = wsGeneralOpponent.getCell('A2');
            infoCellOpp.value = `${state.metadata.round || 'Partido'} | ${matchDate} | ${state.metadata.location || ''}`;
            infoCellOpp.font = { size: 11, color: { argb: GRAY } };
            infoCellOpp.alignment = { horizontal: 'center' };

            // Score Row
            wsGeneralOpponent.mergeCells('A3:N3');
            const scoreCellOpp = wsGeneralOpponent.getCell('A3');
            scoreCellOpp.value = `RESULTADO: ${state.homeScore} - ${state.awayScore}`;
            scoreCellOpp.font = { bold: true, size: 14, color: { argb: isWin ? GREEN : isDraw ? ORANGE : RED } };
            scoreCellOpp.alignment = { horizontal: 'center' };
            wsGeneralOpponent.getRow(3).height = 25;

            // Empty row
            wsGeneralOpponent.getRow(4).height = 10;

            // Column widths
            wsGeneralOpponent.columns = [
                { width: 5 },  // #
                { width: 18 }, // Nombre
                { width: 10 }, // Pos
                { width: 8 },  // Goles
                { width: 8 },  // Lanz
                { width: 8 },  // %
                { width: 8 },  // 6m
                { width: 8 },  // 9m
                { width: 8 },  // Ext
                { width: 8 },  // 7m
                { width: 8 },  // Contra
                { width: 8 },  // Pérd
                { width: 8 },  // Asis
                { width: 8 }   // Tiempo
            ];

            // Header
            const headerRowOpp = wsGeneralOpponent.getRow(5);
            headerRowOpp.values = ['#', 'Nombre', 'Pos', 'Gol', 'Lanz', '%', '6m', '9m', 'Ext', '7m', 'Contra', 'Pérd', 'Asist', 'Tiempo'];
            applyHeaderStyle(headerRowOpp, RED);

            // Rival Players Data
            const opponentFieldPlayers = (state.opponentPlayers || []).filter(p => p.position !== Position.GK && p.position !== Position.STAFF).sort((a, b) => a.number - b.number);
            let rowIndexOpp = 6;

            if (opponentFieldPlayers.length === 0) {
                // GENERIC RIVAL ROW
                const rivalEvents = state.events.filter(e => e.isOpponent);
                const shots = rivalEvents.filter(e => e.type === 'OPPONENT_SHOT' || e.type === 'OPPONENT_GOAL');
                const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL || e.type === 'OPPONENT_GOAL').length;
                const totalShots = shots.length;
                const percentage = totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0;

                const getZoneGoalsOpp = (zones: ShotZone[]) => {
                    const zoneShots = shots.filter(s => s.shotZone && zones.includes(s.shotZone));
                    const zoneGoals = zoneShots.filter(s => s.shotOutcome === ShotOutcome.GOAL || s.type === 'OPPONENT_GOAL').length;
                    return zoneShots.length > 0 ? `${zoneGoals}/${zoneShots.length}` : '-';
                };

                const sixM = getZoneGoalsOpp([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]);
                const nineM = getZoneGoalsOpp([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]);
                const wing = getZoneGoalsOpp([ShotZone.WING_L, ShotZone.WING_R]);
                const sevenM = getZoneGoalsOpp([ShotZone.SEVEN_M]);
                const fastbreak = getZoneGoalsOpp([ShotZone.FASTBREAK]);

                const turnovers = rivalEvents.filter(e => e.type === 'TURNOVER').length;
                const assists = rivalEvents.filter(e => e.type === 'POSITIVE_ACTION' && (e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK)).length;

                const row = wsGeneralOpponent.getRow(rowIndexOpp);
                row.values = [
                    '-',
                    'Rival (Total)',
                    'Eq',
                    goals,
                    totalShots,
                    `${percentage}%`,
                    sixM,
                    nineM,
                    wing,
                    sevenM,
                    fastbreak,
                    turnovers,
                    assists,
                    '-'
                ];
                applyDataStyle(row, true);
                rowIndexOpp++;
            }

            opponentFieldPlayers.forEach((player, idx) => {
                // Filter events where opponentPlayerId matches AND isOpponent is true
                const playerEvents = state.events.filter(e => e.isOpponent && e.opponentPlayerId === player.id);
                // Note: Opponent shots are type 'OPPONENT_SHOT'
                const shots = playerEvents.filter(e => e.type === 'OPPONENT_SHOT');
                const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
                const totalShots = shots.length;
                const percentage = totalShots > 0 ? Math.round((goals / totalShots) * 100) : 0;

                // Zone stats for opponent
                const getZoneGoalsOpp = (zones: ShotZone[]) => {
                    const zoneShots = shots.filter(s => s.shotZone && zones.includes(s.shotZone));
                    const zoneGoals = zoneShots.filter(s => s.shotOutcome === ShotOutcome.GOAL).length;
                    return zoneShots.length > 0 ? `${zoneGoals}/${zoneShots.length}` : '-';
                };

                const sixM = getZoneGoalsOpp([ShotZone.SIX_M_L, ShotZone.SIX_M_C, ShotZone.SIX_M_R]);
                const nineM = getZoneGoalsOpp([ShotZone.NINE_M_L, ShotZone.NINE_M_C, ShotZone.NINE_M_R]);
                const wing = getZoneGoalsOpp([ShotZone.WING_L, ShotZone.WING_R]);
                const sevenM = getZoneGoalsOpp([ShotZone.SEVEN_M]);
                const fastbreak = getZoneGoalsOpp([ShotZone.FASTBREAK]);

                const turnovers = playerEvents.filter(e => e.type === 'TURNOVER').length;
                // Positive actions for opponent might not be fully tracked, but if they are:
                const assists = playerEvents.filter(e => e.type === 'POSITIVE_ACTION' && (e.positiveActionType === PositiveActionType.ASSIST || e.positiveActionType === PositiveActionType.OFFENSIVE_BLOCK)).length;
                // Playing time for opponent might not be tracked accurately, but we include it if valid
                const pt = player.playingTime || 0;
                const ptMin = Math.floor(pt / 60);
                const ptSec = Math.floor(pt % 60);
                const playingTimeStr = `${ptMin.toString().padStart(2, '0')}:${ptSec.toString().padStart(2, '0')}`;

                const row = wsGeneralOpponent.getRow(rowIndexOpp);
                row.values = [
                    player.number,
                    player.name,
                    player.position,
                    goals,
                    totalShots,
                    `${percentage}%`,
                    sixM,
                    nineM,
                    wing,
                    sevenM,
                    fastbreak,
                    turnovers,
                    assists,
                    playingTimeStr
                ];
                applyDataStyle(row, idx % 2 === 0);

                if (goals > 0) row.getCell(4).font = { bold: true, color: { argb: RED } }; // Red for opponent goals
                rowIndexOpp++;
            });

            // Empty row
            rowIndexOpp++;

            // Rival Goalkeepers
            const gkHeaderRowOpp = wsGeneralOpponent.getRow(rowIndexOpp);
            gkHeaderRowOpp.values = ['#', 'Portero', '', 'Paradas', 'Goles', '%', '', '', '', '', '', '', '', 'Tiempo'];
            applyHeaderStyle(gkHeaderRowOpp, ORANGE); // Use Orange/Red for opponent GK
            rowIndexOpp++;

            const opponentGKs = (state.opponentPlayers || []).filter(p => p.position === Position.GK);
            opponentGKs.forEach((gk, idx) => {
                // For opponent GK, events are OUR shots (isOpponent: false) against them? 
                // NO, technically opponent GK stats come from our shots.
                // Logic: Events where type is SHOT (our shot) -> 'SAVE' (outcome).
                // But we don't usually link 'SHOT' to an opponent GK ID unless 'SELECT_OPPONENT_PLAYER' was used in a specific flow?
                // Actually, standard stats flow handles "Our Shot" -> "Outcome".
                // We might not have the specific Opponent GK ID in 'SHOT' events unless added recently.
                // I will output what I can, or just generic if IDs missing.
                // Wait, if I look at 'state.events', 'opponentPlayerId' is for who DID the action.
                // So for opponent GK making a save, it would be an event where opponent did something?
                // Usually we track OUR shots. 
                // Let's stick to what we have: Events where opponentPlayerId matches the GK.
                // Does opponent have 'SAVE' events? Likely not, we track 'SHOT' (us) -> 'SAVE' (outcome).
                // So I will calculate stats based on OUR shots being SAVED.
                // But I can't link to specific Opp GK. So I will skip individual GK stats for now or just show dashes to avoid fake data.

                // Correction: If user assigns opponent player in flows, maybe we have it.
                // Let's just create the rows.

                const row = wsGeneralOpponent.getRow(rowIndexOpp);
                row.values = [gk.number, gk.name, 'GK', '-', '-', '-', '', '', '', '', '', '', '', ''];
                applyDataStyle(row, idx % 2 === 0);
                rowIndexOpp++;
            });

            // ============ SHEET 5: Sanciones Rival ============
            const wsSanctionsOpp = workbook.addWorksheet('Sanciones Rival');
            wsSanctionsOpp.columns = [{ width: 5 }, { width: 18 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 }];

            wsSanctionsOpp.mergeCells('A1:F1');
            const sanctionTitleOpp = wsSanctionsOpp.getCell('A1');
            sanctionTitleOpp.value = '🟨 SANCIONES RIVAL';
            sanctionTitleOpp.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
            sanctionTitleOpp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
            sanctionTitleOpp.alignment = { horizontal: 'center' };
            wsSanctionsOpp.getRow(1).height = 25;

            const sanctionHeaderOpp = wsSanctionsOpp.getRow(3);
            sanctionHeaderOpp.values = ['#', 'Nombre', 'Pos', 'Amarillas', '2 Min', 'Roja'];
            applyHeaderStyle(sanctionHeaderOpp, ORANGE);

            let sanctionRowOpp = 4;
            (state.opponentPlayers || []).forEach((player, idx) => {
                const playerEvents = state.events.filter(e => e.isOpponent && e.opponentPlayerId === player.id && e.type === 'SANCTION');
                if (playerEvents.length === 0) return;

                const yellow = playerEvents.filter(e => e.sanctionType === SanctionType.YELLOW).length;
                const twoMin = playerEvents.filter(e => e.sanctionType === SanctionType.TWO_MIN).length;
                const red = playerEvents.filter(e => e.sanctionType === SanctionType.RED).length;
                const blue = playerEvents.filter(e => e.sanctionType === SanctionType.BLUE).length;

                const row = wsSanctionsOpp.getRow(sanctionRowOpp);
                row.values = [player.number, player.name, player.position, yellow || '', twoMin || '', red || blue ? (red ? 'ROJA' : 'AZUL') : ''];
                applyDataStyle(row, sanctionRowOpp % 2 === 0);

                if (yellow > 0) row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } };
                if (twoMin > 0) row.getCell(5).font = { bold: true };
                if (red || blue) row.getCell(6).font = { bold: true, color: { argb: red ? RED : 'FF3B82F6' } };

                sanctionRowOpp++;
            });

            // Generate file
            const outBuffer = await workbook.xlsx.writeBuffer();

            // File name
            const round = state.metadata.round || 'partido';
            const filename = `estadisticas_${localTeamName}_vs_${visitorTeamName}_${round}.xlsx`
                .replace(/[^a-zA-Z0-9_\-\.áéíóúÁÉÍÓÚñÑ]/g, '_');

            if (Capacitor.isNativePlatform()) {
                try {
                    await Filesystem.mkdir({
                        path: 'Download/partidos',
                        directory: Directory.ExternalStorage,
                        recursive: true
                    });
                } catch (e) { console.log('Directory create error (might exist)', e); }

                const base64Data = arrayBufferToBase64(outBuffer as ArrayBuffer);
                const result = await Filesystem.writeFile({
                    path: `Download/partidos/${filename}`,
                    data: base64Data,
                    directory: Directory.ExternalStorage
                });

                await Share.share({
                    title: 'Exportar Estadísticas',
                    text: 'Estadísticas del partido',
                    url: result.uri,
                    dialogTitle: 'Guardar Excel',
                });
            } else {
                // Browser download
                const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                window.URL.revokeObjectURL(url);
            }

        } catch (err) {
            console.error("Error exporting Excel:", err);
            alert("Error al exportar: " + (err as any).message);
        }
    };

    const handleExportToTemplate = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const buffer = e.target?.result as ArrayBuffer;
            try {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);

                // Determine Sheet Name
                const round = state.metadata.round || '1';
                const sheetName = `J${round}`;
                let worksheet = workbook.getWorksheet(sheetName);

                if (!worksheet) {
                    alert(`No se encontró la hoja "${sheetName}" en la plantilla. Asegúrate de que la jornada coincide (ej: J10).`);
                    return;
                }

                // Constants (1-based index in ExcelJS)
                const COL_DORSAL = 5; // E
                const COL_NOMBRE = 6; // F

                const COL_TOTAL_LANZ = 16; // P
                const COL_TOTAL_GOL = 17; // Q

                const COL_AMARILLA = 57; // BE
                const COL_2MIN = 58; // BF
                const COL_ROJA = 60; // BH
                const COL_AZUL = 61; // BI

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber < 10) return; // Skip header
                    const dorsalVal = row.getCell(COL_DORSAL).value;
                    const nombreVal = row.getCell(COL_NOMBRE).value;
                    if (!dorsalVal && !nombreVal) return;

                    const player = state.players.find(p =>
                        (dorsalVal && p.number == dorsalVal) ||
                        (nombreVal && p.name.toLowerCase().includes(String(nombreVal).toLowerCase()))
                    );

                    if (player) {
                        const playerEvents = state.events.filter(e => e.playerId === player.id);
                        const shots = playerEvents.filter(e => e.type === 'SHOT');
                        const goals = shots.filter(e => e.shotOutcome === ShotOutcome.GOAL).length;
                        const totalShots = shots.length;
                        const amarillas = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.YELLOW).length;
                        const dosMin = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.TWO_MIN).length;
                        const rojas = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.RED).length;
                        const azules = playerEvents.filter(e => e.type === 'SANCTION' && e.sanctionType === SanctionType.BLUE).length;

                        row.getCell(COL_TOTAL_LANZ).value = totalShots;
                        row.getCell(COL_TOTAL_GOL).value = goals;
                        if (amarillas > 0) row.getCell(COL_AMARILLA).value = amarillas;
                        if (dosMin > 0) row.getCell(COL_2MIN).value = dosMin;
                        if (rojas > 0) row.getCell(COL_ROJA).value = rojas;
                        if (azules > 0) row.getCell(COL_AZUL).value = azules;
                    }
                });

                // Save
                const outBuffer = await workbook.xlsx.writeBuffer();
                const ourTeamName = state.metadata.isOurTeamHome ? state.metadata.homeTeam : state.metadata.awayTeam;
                const opponentTeamName = state.metadata.isOurTeamHome ? state.metadata.awayTeam : state.metadata.homeTeam;
                const filename = `estadisticas_${ourTeamName}_vs_${opponentTeamName}_${sheetName}.xlsx`;

                // Use Capacitor Filesystem to save
                const base64Data = arrayBufferToBase64(outBuffer as ArrayBuffer);

                if (Capacitor.isNativePlatform()) {
                    try {
                        await Filesystem.mkdir({
                            path: 'Download/partidos',
                            directory: Directory.ExternalStorage,
                            recursive: true
                        });
                    } catch (e) { console.log('Directory create error (might exist)', e); }

                    const result = await Filesystem.writeFile({
                        path: `Download/partidos/${filename}`,
                        data: base64Data,
                        directory: Directory.ExternalStorage
                    });

                    await Share.share({
                        title: 'Exportar Estadísticas',
                        text: 'Estadísticas del partido',
                        url: result.uri,
                        dialogTitle: 'Guardar Excel',
                    });
                } else {
                    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    window.URL.revokeObjectURL(url);
                }

            } catch (err) {
                console.error("Error processing template:", err);
                const errorMessage = (err as any).message || '';
                if (errorMessage.includes('Shared Formula') || errorMessage.includes('shared formula')) {
                    alert("Error: La plantilla contiene fórmulas compartidas que no son compatibles. Por favor, guarda la plantilla en Excel sin fórmulas compartidas o usa el botón 'Exportar' para generar un archivo nuevo.");
                } else {
                    alert("Error al procesar la plantilla: " + errorMessage);
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // --- Import Roster from Excel ---
    const handleImportRosterExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const buffer = evt.target?.result as ArrayBuffer;
            const workbook = new ExcelJS.Workbook();
            workbook.xlsx.load(buffer).then(() => {
                const worksheet = workbook.worksheets[0];
                const data: any[][] = [];
                worksheet.eachRow((row, rowNumber) => {
                    const rowValues = row.values as any[];
                    // ExcelJS row.values is 1-based index, so index 1 is the first cell
                    // We want to normalize to 0-based array for the logic below
                    // rowValues might be [empty, val1, val2, ...]
                    data.push(rowValues.slice(1));
                });

                // Assuming format: Number | Name | Position
                const parsedPlayers: Player[] = [];
                // Skip header
                for (let i = 1; i < data.length; i++) {
                    const row = data[i] as any[];
                    if (row && row.length >= 2) {
                        const num = parseInt(row[0]);
                        const name = String(row[1]);
                        const posRaw = row[2] ? String(row[2]) : '';

                        let pos = Position.CB; // Default
                        // Simple mapping logic could go here
                        if (posRaw.includes('Portero')) pos = Position.GK;
                        else if (posRaw.includes('Extremo')) pos = posRaw.includes('Izq') ? Position.LW : Position.RW;
                        else if (posRaw.includes('Lateral')) pos = posRaw.includes('Izq') ? Position.LB : Position.RB;
                        else if (posRaw.includes('Pivote')) pos = Position.PV;

                        if (!isNaN(num) && name) {
                            parsedPlayers.push({
                                id: generateId(),
                                number: num,
                                name: name,
                                position: pos,
                                active: false,
                                playingTime: 0
                            });
                        }
                    }
                }

                if (parsedPlayers.length > 0) {
                    if (view === 'ROSTER') { // Check if we are in the ROSTER view
                        // Import to current team roster
                        setState(prev => {
                            const isHome = rosterTab === 'HOME';
                            if (isHome) {
                                const updatedState = { ...prev, players: parsedPlayers };
                                if (currentTeam) {
                                    const updatedTeam = { ...currentTeam, players: parsedPlayers };
                                    saveTeam(updatedTeam);
                                    setTeams(prevTeams => prevTeams.map(t => t.id === updatedTeam.id ? updatedTeam : t));
                                    setCurrentTeam(updatedTeam);
                                }
                                return updatedState;
                            } else {
                                return { ...prev, opponentPlayers: parsedPlayers };
                            }
                        });
                    } else {
                        // Fallback, though should be handled by ROSTER view
                        setState(prev => ({ ...prev, players: parsedPlayers }));
                    }
                    setMode(InputMode.IDLE);
                    alert(`Importados ${parsedPlayers.length} jugadores.`);
                } else {
                    alert('No se encontraron jugadores válidos en el Excel.');
                }
            }).catch(error => {
                console.error(error);
                alert("Error al leer el archivo Excel.");
            });
        };
        reader.readAsArrayBuffer(file);
    };

    // --- Roster Management Extras ---
    const handleSaveRosterToTeam = async () => {
        if (rosterTab !== 'HOME') {
            alert("Solo puedes guardar la plantilla de 'Mi Equipo'.");
            return;
        }
        const teamId = state.metadata.teamId || state.metadata.ownerTeamId;
        if (!teamId) {
            alert("Este partido no tiene un equipo vinculado. No se puede guardar la plantilla.");
            return;
        }
        const currentTeam = teams.find(t => t.id === teamId);
        if (!currentTeam) {
            alert("No se encontró el equipo original en la base de datos.");
            return;
        }

        if (confirm(`¿Estás seguro de que deseas sobrescribir la plantilla del equipo "${currentTeam.name}" con los jugadores actuales? Esto actualizará la plantilla Maestra para futuros partidos.`)) {
            try {
                const updatedTeam: Team = { ...currentTeam, players: state.players };
                await saveTeam(updatedTeam);
                setTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
                alert("Plantilla Maestra actualizada correctamente.");
            } catch (error) {
                console.error("Error saving roster:", error);
                alert("Error al guardar.");
            }
        }
    };

    const handleRecoverRosterFromTeam = () => {
        if (rosterTab !== 'HOME') {
            alert("Solo puedes recuperar la plantilla de 'Mi Equipo'.");
            return;
        }
        setMode(InputMode.SELECT_TEAM_FOR_RECOVER);
    };

    const handleConfirmRecoverTeam = (team: Team) => {
        if (confirm(`¿Cargar la plantilla de "${team.name}"? Se perderán los jugadores actuales y se actualizará el equipo local del partido.`)) {
            setState(prev => ({
                ...prev,
                players: team.players || [],
                metadata: {
                    ...prev.metadata,
                    teamId: team.id,
                    ownerTeamId: team.id,
                    homeTeam: team.name,
                    homeTeamLogo: team.logo
                }
            }));
            alert(`Plantilla de "${team.name}" cargada.`);
            setMode(InputMode.IDLE);
        }
    };

    // --- Match Logic ---
    const lastTickRef = useRef<number>(0);
    useEffect(() => {
        let interval: number | undefined;
        if (!state.isPaused) {
            lastTickRef.current = Date.now();
            interval = window.setInterval(() => {
                const now = Date.now();
                const delta = Math.floor((now - lastTickRef.current) / 1000);
                if (delta >= 1) {
                    setState(s => {
                        if (s.isPaused) return s;

                        const periodDurationSecs = s.timerSettings.durationMinutes * 60;
                        let newTime = s.gameTime;
                        let isPeriodFinished = false;

                        if (s.timerSettings.direction === 'UP') {
                            newTime += delta;
                            if (newTime >= periodDurationSecs) { newTime = periodDurationSecs; isPeriodFinished = true; }
                        } else {
                            newTime -= delta;
                            if (newTime <= 0) { newTime = 0; isPeriodFinished = true; }
                        }

                        if (isPeriodFinished) {
                            // Force sync for all active players to ensure they get the FULL duration
                            // This fixes the "29:59" issue if delta didn't align perfectly or started late.
                            // The "29:59" likely comes from manual interventions or missed ticks.
                            // STRATEGY: If isPeriodFinished, find ACTIVE players and ROUND UP their period time to the nearest second 
                            // OR simply Ensure they have played the full 'available' minutes if they were active the whole time? 
                            // Best safest fix: If active at finish, and time is e.g. 29:59, bump to 30:00.
                        }

                        // We check pause AFTER updating players
                        const shouldPause = isPeriodFinished;

                        const updatedPlayers = updatePlayingTime(s.players, delta, s.currentPeriod);




                        const updatedOpponentPlayers = updatePlayingTime(s.opponentPlayers || [], delta, s.currentPeriod);

                        // Check for expired sanctions
                        const activeSanctionEvents = s.events.filter(e => e.type === 'SANCTION' && e.sanctionDuration && e.sanctionDuration > 0);

                        activeSanctionEvents.forEach(e => {
                            if (processedSanctionIds.current.has(e.id)) return;

                            const { remaining } = getSanctionRemainingTime(e, newTime, s.timerSettings.direction, s.currentPeriod, s.config);
                            if (remaining <= 0) {
                                processedSanctionIds.current.add(e.id);
                                // Trigger modal to ask who enters
                            }
                        });


                        return { ...s, gameTime: newTime, players: updatedPlayers, opponentPlayers: updatedOpponentPlayers, isPaused: shouldPause ? true : s.isPaused };
                    });

                    // Check for expired sanctions AFTER time update (using the new time would be best, but we can approximate)
                    // We need access to the *latest* state to check sanctions.
                    // The setState above is async. 
                    // Let's use a separate check or a ref for the game time?
                    // Actually, we can just check against the `lastTickRef` or similar?
                    // No, `setState` is the only way to get latest state reliably in closure if not using a ref for state.
                    // But we can't setMode inside setState.
                    // Workaround: Use a second useEffect that watches `state.gameTime`?
                    // Yes, `useEffect(() => { checkSanctions() }, [state.gameTime])`.

                    lastTickRef.current += delta * 1000;
                }
            }, 1000);
        }
        return () => window.clearInterval(interval);
    }, [state.isPaused, state.timerSettings.direction]);

    // New Effect to handle sanction expiration prompts
    // Unified Effect to monitor Sanction Expiry
    useEffect(() => {
        // Filter sanctions that have a duration (excludes Yellow cards which are permanent)
        // CRITICAL FIX v1.3.3: Exclude Staff/Coach. They have their own dedicated useEffect handler.
        const fieldPlayerSanctions = state.events.filter(e =>
            e.type === 'SANCTION' &&
            e.sanctionDuration &&
            e.sanctionDuration > 0 &&
            // Check if player is NOT staff/coach
            state.players.find(p => p.id === e.playerId)?.position !== Position.STAFF &&
            state.players.find(p => p.id === e.playerId)?.position !== Position.COACH
        );



        let triggerEvent = null;

        for (const sanc of fieldPlayerSanctions) {
            // Check if already processed OR RESOLVED
            const isProcessed = processedSanctionIds.current.has(sanc.id);
            const isResolved = state.resolvedSanctionIds.includes(sanc.id); // Check permanent state

            if (isResolved) continue; // Ignore forever

            const { remaining } = getSanctionRemainingTime(
                sanc,
                state.gameTime,
                state.timerSettings.direction,
                state.currentPeriod,
                state.config
            );



            // Case 1: Standard Expiration (Not processed yet)
            if (!isProcessed && remaining <= 0) {
                triggerEvent = sanc;

                break;
            }

            // Case 2: Recovery (Processed but NOT Resolved)
            if (isProcessed && !isResolved && remaining <= 0) {
                if (!sanctionEndedPlayerId || sanctionEndedPlayerId === sanc.playerId) {
                    triggerEvent = sanc;

                    break;
                }
            }


        }

        if (triggerEvent && triggerEvent.playerId) {
            // Mark as processed immediately
            processedSanctionIds.current.add(triggerEvent.id);

            // Check if player is disqualified (Red/Blue/3rd 2-min)
            // Explicitly check the triggering event type for robustness
            const isRed = triggerEvent.sanctionType === SanctionType.RED;
            const isBlue = triggerEvent.sanctionType === SanctionType.BLUE;
            const isDisqualified = isRed || isBlue || isPlayerDisqualified(triggerEvent.playerId, state.events);

            // CRITICAL FIX: Ignore Staff/Coach sanctions here. They are handled by a separate useEffect hook.
            // If we let this fall through, it triggers the generic 'Fin Sanción' modal which purely activates a player
            // without handling the 'sacrificed' swap logic, causing 8 players on field.
            const p = state.players.find(pl => pl.id === triggerEvent.playerId);
            const isStaffOrCoach = p?.position === Position.STAFF || p?.position === Position.COACH;

            if (isStaffOrCoach) {
                // Just mark as processed so the useEffect can pick it up (or has already picked it up)
                // But DO NOT trigger the generic modal state
                processedSanctionIds.current.add(triggerEvent.id);
            } else {
                // Update state: pause game and deactivate player if disqualified
                setState(prev => {
                    let updatedPlayers = prev.players;

                    // CRITICAL: If disqualified, Force Deactivation
                    if (isDisqualified) {
                        updatedPlayers = prev.players.map(p =>
                            p.id === triggerEvent.playerId ? { ...p, active: false } : p
                        );
                    }

                    return {
                        ...prev,
                        players: updatedPlayers
                    };
                });

                // Trigger Modal (via Declarative State)
                sanctionEventIdRef.current = triggerEvent.id; // STORE EVENT ID
                setSanctionEndedPlayerId(triggerEvent.playerId || null);
            }




        }

    }, [state.gameTime, state.events, state.currentPeriod]);


    // Ensure modal opens when a player needs to enter - DELETED (Using declarative render)

    const handleTimeUpdate = useCallback((newTime: number) => {
        setState(s => {
            const delta = newTime - s.gameTime;

            // Si no hay cambio, no hacer nada
            if (delta === 0) return { ...s, gameTime: newTime };

            // Actualizar tiempo de jugadores activos
            const updatedPlayers = updatePlayingTime(s.players, delta, s.currentPeriod);

            // Actualizar tiempo de jugadores rivales activos
            const updatedOpponentPlayers = updatePlayingTime(s.opponentPlayers || [], delta, s.currentPeriod);



            return {
                ...s,
                gameTime: newTime,
                players: updatedPlayers,
                opponentPlayers: updatedOpponentPlayers
            };
        });
    }, []);
    const togglePause = useCallback(() => { setState(s => ({ ...s, isPaused: !s.isPaused })); }, []);
    const nextPeriod = () => {
        const periodDurationSecs = state.timerSettings.durationMinutes * 60;
        const isPeriodFinished = ((state.timerSettings.direction === 'UP' && state.gameTime >= periodDurationSecs) || (state.timerSettings.direction === 'DOWN' && state.gameTime <= 0));
        if (!isPeriodFinished) return;
        const nextPeriodNum = state.currentPeriod + 1;
        const isOT = nextPeriodNum > state.config.regularPeriods;
        const nextDuration = isOT ? state.config.otDuration : state.config.regularDuration;
        if (state.currentPeriod === state.config.regularPeriods) {
            // Si hay empate, termina el partido sin prórroga por defecto.
            if (state.homeScore === state.awayScore) {
                alert("Final del Partido (Empate).");
                return;
            } else {
                alert("Final del Partido.");
                return;
            }
        }
        console.log(`[PERIOD CHANGE] Cambiando de P${state.currentPeriod} a P${nextPeriodNum}`);
        setState(s => ({ ...s, currentPeriod: nextPeriodNum, isPaused: true, gameTime: s.config.timerDirection === 'DOWN' ? nextDuration * 60 : 0, timerSettings: { ...s.timerSettings, durationMinutes: nextDuration } }));
    };

    const recordEvent = (eventData: MatchEvent, updateActiveStatus: boolean = true) => {
        setState(s => {
            let newHomeScore = s.homeScore;
            let newAwayScore = s.awayScore;
            const isOurTeamHome = s.metadata.isOurTeamHome !== undefined ? s.metadata.isOurTeamHome : true;

            if (eventData.type === 'SHOT' && eventData.shotOutcome === ShotOutcome.GOAL && !eventData.isOpponent) {
                if (isOurTeamHome) newHomeScore++; else newAwayScore++;
            }
            else if ((eventData.type === 'OPPONENT_SHOT' && eventData.shotOutcome === ShotOutcome.GOAL) || eventData.type === 'OPPONENT_GOAL') {
                if (isOurTeamHome) newAwayScore++; else newHomeScore++;
            }
            let updatedPlayers = s.players;
            if (updateActiveStatus && eventData.type === 'SANCTION' && eventData.playerId) {
                // Remove: Do not deactivate Immediately for RED/BLUE. They serve 2-min wait.
                // Logic moved to End of Sanction (handlePlayerEnterAfterSanction)
            } const fullEvent: MatchEvent = { ...eventData, period: s.currentPeriod, homeScoreSnapshot: newHomeScore, awayScoreSnapshot: newAwayScore };
            return { ...s, homeScore: newHomeScore, awayScore: newAwayScore, events: [fullEvent, ...s.events], players: updatedPlayers };
        });
        setMode(InputMode.IDLE);
        setPendingEvent({});
    };

    const handleTimeout = (isOpponent: boolean) => {
        // Rule: No timeouts in Overtime
        if (state.currentPeriod > state.config.regularPeriods) {
            alert("No se permiten tiempos muertos en la prórroga (Regla 2:10).");
            return;
        }

        const teamEvents = state.events.filter(e => e.type === 'TIMEOUT' && (isOpponent ? e.isOpponent : !e.isOpponent));
        const periodTimeouts = teamEvents.filter(e => e.period === state.currentPeriod).length;

        // Basic Rule: 3 timeouts per match, max 2 per half. (Advanced rules like 'max 1 in last 5 mins' excluded for simplicity unless requested)
        if (teamEvents.length >= 3) { alert(`Límite total de tiempos muertos (3) alcanzado.`); return; }
        if (periodTimeouts >= 2) { alert(`Límite de tiempos muertos por periodo (2) alcanzado.`); return; }

        setState(s => ({ ...s, isPaused: true, events: [{ id: generateId(), type: 'TIMEOUT', timestamp: s.gameTime, period: s.currentPeriod, isOpponent: isOpponent, homeScoreSnapshot: s.homeScore, awayScoreSnapshot: s.awayScore }, ...s.events] }));
    };
    const undoLastEvent = () => {
        setState(s => {
            if (s.events.length === 0) return s;
            const [lastEvent, ...remainingEvents] = s.events;
            let newState = { ...s, events: remainingEvents };
            if (lastEvent.type === 'SUBSTITUTION' && lastEvent.playerInId && lastEvent.playerOutId) {
                newState.players = newState.players.map(p => p.id === lastEvent.playerInId ? { ...p, active: false } : p.id === lastEvent.playerOutId ? { ...p, active: true } : p);
            }
            if (lastEvent.type === 'SANCTION' && (lastEvent.sanctionType === SanctionType.RED || lastEvent.sanctionType === SanctionType.BLUE) && lastEvent.playerId) {
                newState.players = newState.players.map(p => p.id === lastEvent.playerId ? { ...p, active: true } : p);
            }
            if (lastEvent.type === 'SANCTION' && lastEvent.sacrificedPlayerId) {
                newState.players = newState.players.map(p => p.id === lastEvent.sacrificedPlayerId ? { ...p, active: true } : p);
            }
            return recalculateMatchState(newState);
        });
    };

    const handleResetMatch = () => {
        if (!window.confirm('⚠️ ¿Estás seguro de que quieres resetear el partido?\n\nEsto eliminará todos los eventos, marcadores y tiempos, pero conservará la configuración del partido y los jugadores.')) {
            return;
        }

        setState(s => {
            // Resetear todos los jugadores a inactivos y limpiar tiempos de juego
            const resetPlayers = s.players.map(p => ({
                ...p,
                active: false,
                playingTime: 0,
                playingTimeByPeriod: {}
            }));

            const resetOpponentPlayers = (s.opponentPlayers || []).map(p => ({
                ...p,
                active: false,
                playingTime: 0,
                playingTimeByPeriod: {}
            }));

            return {
                ...s,
                currentPeriod: 1,
                isPaused: true,
                gameTime: s.config.timerDirection === 'DOWN' ? s.config.regularDuration * 60 : 0,
                homeScore: 0,
                awayScore: 0,
                events: [],
                resolvedSanctionIds: [],
                players: resetPlayers,
                opponentPlayers: resetOpponentPlayers,
                timerSettings: {
                    durationMinutes: s.config.regularDuration,
                    direction: s.config.timerDirection
                }
            };
        });

        // Limpiar estados auxiliares
        processedSanctionIds.current = new Set();
        setSanctionEndedPlayerId(null);
        setPendingEvent({});
        setPendingSubOut(null);
        setMode(InputMode.IDLE);
    };

    // Flows
    const handleStartAddEvent = () => {
        setMode(InputMode.SELECT_TEAM_FOR_NEW_EVENT);
    };

    const handleTeamSelectForNewEvent = (isOpponent: boolean) => {
        const initialEvent: MatchEvent = {
            id: generateId(),
            type: 'SHOT', // Default
            timestamp: state.gameTime,
            period: state.currentPeriod,
            isOpponent: isOpponent,
            homeScoreSnapshot: state.homeScore,
            awayScoreSnapshot: state.awayScore
        };
        setEventForm(initialEvent);
        setMode(InputMode.EDIT_EVENT_DETAILS);
    };

    const handleDeleteEvent = (eventId: string) => { setState(s => recalculateMatchState({ ...s, events: s.events.filter(e => e.id !== eventId) })); };
    const openEditEventModal = (event: MatchEvent) => { setEventForm({ ...event }); setMode(InputMode.EDIT_EVENT_DETAILS); };

    const handleSaveEditedEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventForm.id) return;

        setState(s => {
            // Check if it's a new event (not in current list)
            const exists = s.events.some(ev => ev.id === eventForm.id);
            let newEvents = [...s.events];

            if (exists) {
                newEvents = newEvents.map(ev => ev.id === eventForm.id ? { ...ev, ...eventForm } as MatchEvent : ev);
            } else {
                newEvents.push(eventForm as MatchEvent);
            }

            return recalculateMatchState({ ...s, events: newEvents });
        });
        setMode(InputMode.IDLE);
    };

    // Interaction Handlers (Simplified wiring)
    const handleOurAttackZoneClick = (zone: ShotZone) => { setPendingEvent({ type: 'SHOT', shotZone: zone, timestamp: state.gameTime, isOpponent: false }); setMode(InputMode.SELECT_SHOT_OUTCOME); };
    const handleShotOutcomeSelect = (outcome: ShotOutcome) => { setPendingEvent(prev => ({ ...prev, shotOutcome: outcome })); setMode(InputMode.SELECT_PLAYER_FOR_SHOT); };
    const handlePlayerSelect = (player: Player) => {
        const playerId = player.id;
        if (!pendingEvent.type && mode !== InputMode.SELECT_OUR_GK_FOR_SAVE) return;

        // Check if selecting Opponent Player
        if (mode === InputMode.SELECT_OPPONENT_PLAYER) {
            setPendingEvent(prev => ({ ...prev, opponentPlayerId: playerId }));
            if (pendingEvent.shotOutcome === ShotOutcome.GOAL || pendingEvent.shotOutcome === ShotOutcome.SAVE) {
                setMode(InputMode.SELECT_OPPONENT_SHOT_PLACEMENT);
            } else {
                recordEvent({ id: generateId(), ...pendingEvent, opponentPlayerId: playerId } as any);
            }
            return;
        }

        if (mode === InputMode.SELECT_OUR_GK_FOR_SAVE) { recordEvent({ ...pendingEvent, id: generateId(), playerId } as any); return; }
        if (pendingEvent.type === 'SANCTION') {
            if (pendingEvent.sanctionType === SanctionType.TWO_MIN) {
                const isStaff = player.position === Position.STAFF || player.position === Position.COACH;
                const eventToRecord = { ...pendingEvent, playerId, sanctionDuration: 2 };
                if (isStaff) { setPendingEvent(eventToRecord); setMode(InputMode.SELECT_PLAYER_TO_SACRIFICE); }
                else { recordEvent({ ...eventToRecord, id: generateId() } as any); }
                return;
            }
            setPendingEvent(prev => ({ ...prev, playerId })); setMode(InputMode.SELECT_SANCTION_DURATION); return;
        }
        if (pendingEvent.type === 'SHOT') {
            if (pendingEvent.shotOutcome === ShotOutcome.GOAL || pendingEvent.shotOutcome === ShotOutcome.SAVE) {
                setPendingEvent(prev => ({ ...prev, playerId }));
                setMode(InputMode.SELECT_SHOT_PLACEMENT_OPTIONAL);
                return;
            } else if ([ShotOutcome.MISS, ShotOutcome.POST, ShotOutcome.BLOCK].includes(pendingEvent.shotOutcome!)) {
                recordEvent({ ...pendingEvent, id: generateId(), playerId } as any);
                return;
            }
        }
        recordEvent({ ...pendingEvent, id: generateId(), playerId } as any);
    };
    const handleOurShotPlacementSelect = (placement: ShotPlacement) => { recordEvent({ ...pendingEvent, id: generateId(), shotPlacement: placement } as any); }
    const startOpponentShotFlow = () => { setPendingEvent({ type: 'OPPONENT_SHOT', timestamp: state.gameTime, isOpponent: true }); setMode(InputMode.SELECT_OPPONENT_SHOT_ZONE); };
    const handleOpponentAttackZoneClick = (zone: ShotZone) => { setPendingEvent(prev => ({ ...prev, shotZone: zone })); setMode(InputMode.SELECT_OPPONENT_SHOT_OUTCOME); };
    const handleOpponentShotOutcomeSelect = (outcome: ShotOutcome) => {
        setPendingEvent(prev => ({ ...prev, shotOutcome: outcome }));

        // If we have opponent players, ask who shot
        if (state.opponentPlayers && state.opponentPlayers.length > 0) {
            setMode(InputMode.SELECT_OPPONENT_PLAYER);
            return;
        }

        // Default flow if no opponent players
        if (outcome === ShotOutcome.GOAL || outcome === ShotOutcome.SAVE) {
            setMode(InputMode.SELECT_OPPONENT_SHOT_PLACEMENT);
        } else {
            recordEvent({ ...pendingEvent, id: generateId(), shotOutcome: outcome } as any);
        }
    };
    const handleOpponentShotPlacementSelect = (placement: ShotPlacement) => {
        // For both GOAL and SAVE, we want to assign the GK (playerId)
        // If multiple GKs, ask user. If one, auto-assign.
        state.players.filter(p => p.active && p.position === Position.GK).length > 1
            ? setMode(InputMode.SELECT_OUR_GK_FOR_SAVE)
            : recordEvent({
                ...pendingEvent,
                id: generateId(),
                shotPlacement: placement,
                playerId: state.players.find(p => p.active && p.position === Position.GK)?.id
            } as any);
    }

    const startTurnoverFlow = () => { setPendingEvent({ type: 'TURNOVER', timestamp: state.gameTime, isOpponent: false }); setMode(InputMode.SELECT_TURNOVER_TYPE); }
    const handleTurnoverTypeSelect = (type: TurnoverType) => { setPendingEvent(prev => ({ ...prev, turnoverType: type })); setMode(InputMode.SELECT_PLAYER_FOR_TURNOVER); }
    const startPositiveActionFlow = () => { setPendingEvent({ type: 'POSITIVE_ACTION', timestamp: state.gameTime, isOpponent: false }); setMode(InputMode.SELECT_POSITIVE_ACTION_TYPE); }
    const handlePositiveActionTypeSelect = (type: PositiveActionType) => { setPendingEvent(prev => ({ ...prev, positiveActionType: type })); setMode(InputMode.SELECT_PLAYER_FOR_POSITIVE_ACTION); }
    const startSanctionFlow = () => { setPendingEvent({ type: 'SANCTION', timestamp: state.gameTime, isOpponent: false }); setMode(InputMode.SELECT_SANCTION_TYPE); }
    const handleSanctionTypeSelect = (type: SanctionType) => { setPendingEvent(prev => ({ ...prev, sanctionType: type })); setMode(InputMode.SELECT_PLAYER_FOR_SANCTION); }
    const handleSanctionDurationSelect = (durationStr: string) => {
        const duration = parseInt(durationStr, 10);
        const playerP = state.players.find(p => p.id === pendingEvent.playerId);
        const isStaff = playerP?.position === Position.STAFF || playerP?.position === Position.COACH;
        if (isStaff && duration > 0) { setPendingEvent(prev => ({ ...prev, sanctionDuration: duration })); setMode(InputMode.SELECT_PLAYER_TO_SACRIFICE); }
        else { recordEvent({ ...pendingEvent, id: generateId(), sanctionDuration: duration } as any); }
    }
    const handleSacrificeSelect = (playerToSacrifice: Player) => { recordEvent({ ...pendingEvent, id: generateId(), sacrificedPlayerId: playerToSacrifice.id } as any, false); }
    const handlePlayerEnterAfterStaffSanction = (playerIn: Player) => {
        setState(s => {
            // Find the sacrificed player ID. 
            // Priority 1: The ID stored when the sanction expired.
            // Priority 2: Searching specifically for any player currently marked as sacrificed in the events.
            const sacrificadoId = pendingStaffSanctionSacrificeId || s.players.find(p => {
                return s.events.some(e =>
                    e.type === 'SANCTION' &&
                    e.sacrificedPlayerId === p.id &&
                    getSanctionRemainingTime(e, s.gameTime, s.timerSettings.direction, s.currentPeriod, s.config).remaining >= -2 // Use small buffer
                );
            })?.id;

            const sacrificado = s.players.find(p => p.id === sacrificadoId);

            // Logic check: Will we free a spot?
            // We swap if there's a sacrificed player on field who isn't the one entering.
            const willSwap = !!(sacrificado && sacrificado.active && sacrificado.id !== playerIn.id);

            const currentActiveFieldPlayers = s.players.filter(p => p.active && p.position !== Position.STAFF && p.position !== Position.COACH);
            const currentActiveCount = currentActiveFieldPlayers.length;
            const netChange = (playerIn.active ? 0 : 1) - (willSwap ? 1 : 0);

            if (currentActiveCount + netChange > 7) {
                alert(`CAMPO LLENO: Ya hay ${currentActiveCount} jugadores activos e intentas meter a ${playerIn.name}.\n\nPara evitar exceder los 7 jugadores, realiza un cambio manual sacando a alguien primero.`);
                return s; // Cancel update
            }

            // Atomics swap
            const newPlayers = s.players.map(p => {
                if (p.id === playerIn.id) return { ...p, active: true };
                if (willSwap && p.id === sacrificadoId) return { ...p, active: false };
                return p;
            });

            // Build event
            let newEvents = [...s.events];
            newEvents.unshift({
                id: generateId(),
                type: 'SUBSTITUTION',
                timestamp: s.gameTime,
                playerInId: playerIn.id,
                playerOutId: willSwap ? sacrificadoId : undefined,
                isOpponent: false,
                period: s.currentPeriod,
                homeScoreSnapshot: s.homeScore,
                awayScoreSnapshot: s.awayScore
            } as MatchEvent);

            return { ...s, players: newPlayers, events: newEvents };
        });

        setMode(InputMode.IDLE);
        setPendingStaffSanctionSacrificeId(null); // Clean up state
    }
    const handlePlayerEnterAfterSanction = (player: Player) => {
        // Mark sanction as RESOLVED to prevent loop
        if (sanctionEventIdRef.current) {
            const resolvedId = sanctionEventIdRef.current;
            setState(s => ({
                ...s,
                resolvedSanctionIds: [...(s.resolvedSanctionIds || []), resolvedId]
            }));
        }

        setSanctionEndedPlayerId(null);
        setState(s => {
            let newPlayers = s.players.map(p => p.id === player.id ? { ...p, active: true } : p);
            // If the player entering is NOT the one who was sanctioned, deactivate the sanctioned player
            if (sanctionEndedPlayerId && player.id !== sanctionEndedPlayerId) {
                newPlayers = newPlayers.map(p => {
                    // Do not deactivate STAFF, they just stop being "sanctioned" (timer ends)
                    if (p.id === sanctionEndedPlayerId && p.position !== Position.STAFF) {
                        return { ...p, active: false };
                    }
                    return p;
                });
            }
            return {
                ...s,
                players: newPlayers,
                events: [{
                    id: generateId(),
                    type: 'SUBSTITUTION',
                    timestamp: s.gameTime,
                    playerInId: player.id,
                    isOpponent: false,
                    period: s.currentPeriod,
                    homeScoreSnapshot: s.homeScore,
                    awayScoreSnapshot: s.awayScore
                } as MatchEvent, ...s.events]
            };
        });
        setSanctionEndedPlayerId(null);
        setMode(InputMode.IDLE);
    };

    const startSubstitutionFlow = (playerOut: Player) => { if (isPlayerDisqualified(playerOut.id, state.events)) return; setPendingSubOut(playerOut); setMode(InputMode.SELECT_PLAYER_FOR_SUBSTITUTION_IN); };
    const handleSubstitutionConfirm = (playerIn: Player) => { if (!pendingSubOut) return; setState(s => ({ ...s, players: s.players.map(p => { if (p.id === playerIn.id) return { ...p, active: true }; if (p.id === pendingSubOut.id) return { ...p, active: false }; return p; }) })); recordEvent({ id: generateId(), type: 'SUBSTITUTION', timestamp: state.gameTime, playerInId: playerIn.id, playerOutId: pendingSubOut.id, isOpponent: false, } as MatchEvent); setPendingSubOut(null); setMode(InputMode.IDLE); };
    const togglePlayerActive = (playerId: string) => {
        // Check if it belongs to Home or Away roster
        const isHome = state.players.some(p => p.id === playerId);
        const targetList = isHome ? state.players : state.opponentPlayers;
        if (!targetList) return;
        const player = targetList.find(p => p.id === playerId);
        if (!player) return;

        if (isHome) {
            if (isPlayerDisqualified(playerId, state.events)) { alert("Descalificado."); return; }
            if (isPlayerSacrificed(playerId)) { alert("Sanción CT."); return; }
        }

        // Perform Check Limit BEFORE setting state
        if (!player.active && player.position !== Position.STAFF) {
            // Assuming we also want to limit opponent if we are toggling them?
            // User requested "Como nuestro equipo pero el contrario", so enforce limit for both.
            const activeCount = targetList.filter(p => p.active && p.position !== Position.STAFF).length;
            if (activeCount >= 7) {
                alert(`Máximo 7 jugadores en pista (${isHome ? 'Local' : 'Visitante'}). Desmarca a uno para entrar.`);
                return;
            }
        }

        setState(s => {
            if (isHome) {
                return { ...s, players: s.players.map(p => p.id === playerId ? { ...p, active: !p.active } : p) };
            } else {
                return { ...s, opponentPlayers: s.opponentPlayers.map(p => p.id === playerId ? { ...p, active: !p.active } : p) };
            }
        });
    };

    const openNewPlayerModal = () => { setPlayerForm({ id: generateId(), name: '', number: 0, position: Position.PV, active: false, playingTime: 0 }); setMode(InputMode.EDIT_PLAYER_DETAILS); };
    const openEditPlayerModal = (player: Player, e: React.MouseEvent) => { e.stopPropagation(); setPlayerForm(player); setMode(InputMode.EDIT_PLAYER_DETAILS); };
    const handleSavePlayer = (e: React.FormEvent) => {
        e.preventDefault();
        setState(s => {
            const isHome = rosterTab === 'HOME';
            const targetList = isHome ? s.players : s.opponentPlayers;
            const playerIndex = targetList.findIndex(p => p.id === playerForm.id);
            let newPlayers = [...targetList];
            const playerToSave = { ...playerForm } as Player;
            if (playerToSave.position === Position.STAFF && playerToSave.number === undefined) playerToSave.number = 0;
            if (playerIndex >= 0) { newPlayers[playerIndex] = { ...newPlayers[playerIndex], ...playerToSave }; } else { newPlayers.push(playerToSave); }
            newPlayers.sort((a, b) => a.number - b.number);

            // SINCRONIZACIÓN CON EL EQUIPO (PERSISTENCIA)
            if (isHome && currentTeam) {
                // Crear una copia actualizada del equipo
                const updatedTeam = { ...currentTeam, players: newPlayers };

                // 1. Guardar en LocalStorage / Cloud
                saveTeam(updatedTeam);

                // 2. Actualizar estado local de equipos
                setTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));

                // 3. Actualizar equipo actual en memoria
                setCurrentTeam(updatedTeam);
            }

            if (isHome) {
                return { ...s, players: newPlayers };
            } else {
                return { ...s, opponentPlayers: newPlayers };
            }
        });
        setMode(InputMode.IDLE);
    };
    const handleDeletePlayer = () => {
        if (!playerForm.id) return;
        if (window.confirm(`¿Eliminar?`)) {
            setState(s => {
                const isHome = rosterTab === 'HOME';
                if (isHome) {
                    const newPlayers = s.players.filter(p => p.id !== playerForm.id);

                    // SINCRONIZACIÓN CON EL EQUIPO (PERSISTENCIA)
                    if (currentTeam) {
                        const updatedTeam = { ...currentTeam, players: newPlayers };
                        saveTeam(updatedTeam);
                        setTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
                        setCurrentTeam(updatedTeam);
                    }

                    return { ...s, players: newPlayers };
                } else {
                    return { ...s, opponentPlayers: s.opponentPlayers.filter(p => p.id !== playerForm.id) };
                }
            });
            setMode(InputMode.IDLE);
        }
    };



    // Helpers for Render
    const activePlayers = useMemo(() => state.players.filter(p => p.active).sort((a, b) => {
        if (a.position === Position.COACH && b.position !== Position.COACH) return -1;
        if (a.position !== Position.COACH && b.position === Position.COACH) return 1;
        if (a.position === Position.STAFF && b.position !== Position.STAFF) return -1;
        if (a.position !== Position.STAFF && b.position === Position.STAFF) return 1;
        if (a.position === Position.GK && b.position !== Position.GK) return -1;
        if (a.position !== Position.GK && b.position === Position.GK) return 1;
        return a.number - b.number;
    }), [state.players]);
    const activeFieldPlayers = useMemo(() => state.players.filter(p => p.active && p.position !== Position.STAFF && p.position !== Position.COACH).sort((a, b) => a.number - b.number), [state.players]);
    const benchPlayers = useMemo(() => state.players.filter(p => !p.active).sort((a, b) => a.number - b.number), [state.players]);

    const activeOpponentPlayers = useMemo(() => (state.opponentPlayers || []).filter(p => p.active).sort((a, b) => a.number - b.number), [state.opponentPlayers]);
    const benchOpponentPlayers = useMemo(() => (state.opponentPlayers || []).filter(p => !p.active).sort((a, b) => a.number - b.number), [state.opponentPlayers]);

    // Ensure STAFF always appears in "En Pista" regardless of active status
    const currentRosterActive = useMemo(() => {
        if (rosterTab === 'HOME') {
            const staffPlayers = state.players.filter(p => p.position === Position.STAFF || p.position === Position.COACH);
            const activeNonStaff = state.players.filter(p => p.active && p.position !== Position.STAFF && p.position !== Position.COACH);
            return [...staffPlayers, ...activeNonStaff].sort((a, b) => {
                if (a.position === Position.COACH && b.position !== Position.COACH) return -1;
                if (a.position !== Position.COACH && b.position === Position.COACH) return 1;
                if (a.position === Position.STAFF && b.position !== Position.STAFF) return -1;
                if (a.position !== Position.STAFF && b.position === Position.STAFF) return 1;
                if (a.position === Position.GK && b.position !== Position.GK) return -1;
                if (a.position !== Position.GK && b.position === Position.GK) return 1;
                return a.number - b.number;
            });
        } else {
            return activeOpponentPlayers;
        }
    }, [rosterTab, state.players, activeOpponentPlayers]);

    const currentRosterBench = useMemo(() => {
        if (rosterTab === 'HOME') {
            // Exclude STAFF and COACH from bench since they are always in active list
            return state.players.filter(p => !p.active && p.position !== Position.STAFF && p.position !== Position.COACH).sort((a, b) => a.number - b.number);
        } else {
            return benchOpponentPlayers;
        }
    }, [rosterTab, state.players, benchOpponentPlayers]);

    const sanctionEndOptions = useMemo(() => {
        if (!sanctionEndedPlayerId) return benchPlayers;
        const p = state.players.find(x => x.id === sanctionEndedPlayerId);
        // Include the sanctioned player if they are active (on field) and NOT disqualified
        if (p && p.active && !isPlayerDisqualified(p.id, state.events)) {
            return [...benchPlayers, p].sort((a, b) => a.number - b.number);
        }
        return benchPlayers;
    }, [benchPlayers, sanctionEndedPlayerId, state.players, state.events]);

    const renderModal = (title: string, content: React.ReactNode) => (<div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200"> <div className="bg-slate-800 w-full max-w-2xl p-6 rounded-t-2xl sm:rounded-xl border-t border-slate-700 sm:border shadow-2xl max-h-[90vh] overflow-y-auto"> <h3 className="text-3xl font-bold text-white mb-6 text-center">{title}</h3> {content} {mode !== InputMode.EDIT_PLAYER_DETAILS && mode !== InputMode.EDIT_EVENT_DETAILS && mode !== InputMode.SELECT_PLAYER_TO_ENTER_AFTER_STAFF_SANCTION && mode !== InputMode.SELECT_PLAYER_TO_ENTER_AFTER_SANCTION && (<button onClick={() => { setMode(InputMode.IDLE); setPendingSubOut(null); }} className="w-full mt-8 py-4 text-xl text-slate-400 hover:text-white">Cancelar</button>)} </div> </div>);
    const renderPlayerGrid = (players: Player[], onSelect: (player: Player) => void) => (
        <div className="grid grid-cols-3 gap-3">
            {players.map(p => {
                const disqualified = isPlayerDisqualified(p.id, state.events);
                const sacrificedSanction = state.events.find(e => e.type === 'SANCTION' && e.sacrificedPlayerId === p.id && getSanctionRemainingTime(e, state.gameTime, state.timerSettings.direction, state.currentPeriod, state.config).remaining > 0);
                const sacrificed = !!sacrificedSanction;
                let remainingTimeStr = '';
                if (sacrificedSanction) {
                    const { remaining } = getSanctionRemainingTime(sacrificedSanction, state.gameTime, state.timerSettings.direction, state.currentPeriod, state.config);
                    const m = Math.floor(remaining / 60);
                    const s = remaining % 60;
                    remainingTimeStr = `${m}:${s.toString().padStart(2, '0')}`;
                }
                // Check for active 2-min sanction
                const activeSanction = state.events.find(e => e.type === 'SANCTION' && e.playerId === p.id && e.sanctionType === SanctionType.TWO_MIN && e.sanctionDuration && e.sanctionDuration > 0 && getSanctionRemainingTime(e, state.gameTime, state.timerSettings.direction, state.currentPeriod, state.config).remaining > 0);
                const disabled = disqualified || sacrificed || !!activeSanction;
                const isStaff = p.position === Position.STAFF || p.position === Position.COACH;

                // Sanction History
                const playerSanctions = state.events.filter(e => e.type === 'SANCTION' && e.playerId === p.id);
                const yellowCount = playerSanctions.filter(e => e.sanctionType === SanctionType.YELLOW).length;
                const twoMinCount = playerSanctions.filter(e => e.sanctionType === SanctionType.TWO_MIN).length;
                const isBlue = playerSanctions.some(e => e.sanctionType === SanctionType.BLUE);
                const isRed = playerSanctions.some(e => e.sanctionType === SanctionType.RED) || yellowCount >= 2;

                return (
                    <button
                        key={p.id}
                        onClick={() => !disabled && onSelect(p)}
                        disabled={disabled}
                        className={`p-4 rounded-xl font-bold flex flex-col items-center transition-all active:scale-95 relative overflow-hidden ${disabled
                            ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700'
                            : isStaff ? 'bg-indigo-900 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-700 hover:bg-handball-blue text-white'
                            }`}
                    >


                        {disqualified && <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20"><div className="w-16 h-0.5 bg-red-500 rotate-45 absolute" /><div className="w-16 h-0.5 bg-red-500 -rotate-45 absolute" /></div>}
                        {sacrificed && mode !== InputMode.SELECT_PLAYER_FOR_SANCTION && (
                            <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center z-30 animate-in fade-in backdrop-blur-[1px]">
                                <span className="text-orange-400 font-bold text-[10px] uppercase tracking-wider mb-1 drop-shadow-md">Sanción CT</span>
                                <span className="text-white font-mono text-xl font-black tabular-nums tracking-widest drop-shadow-md">{remainingTimeStr}</span>
                            </div>
                        )}
                        {activeSanction && <div className="absolute bottom-0 inset-x-0 bg-yellow-600/90 text-white text-[10px] py-0.5 text-center z-20">Excluido</div>}

                        <span className="text-2xl mt-1">{p.position === Position.COACH ? 'ENT' : (p.position === Position.STAFF ? 'CT' : p.number)}</span>
                        <span className="text-xs opacity-80 truncate w-full text-center">{p.name}</span>
                        {/* Sanction dots below name */}
                        {/* Sanction dots below name */}
                        {(twoMinCount > 0 || yellowCount > 0 || isRed || isBlue) && (
                            <div className="flex gap-0.5 mt-1 justify-center">
                                {/* Yellow: Hidden if Blue or Red */}
                                {!isBlue && !isRed && yellowCount > 0 && yellowCount < 2 && Array.from({ length: yellowCount }).map((_, i) => (
                                    <div key={`y-${i}`} className="w-2 h-2 bg-yellow-400 rounded-full shadow-sm border border-black/20" />
                                ))}
                                {/* 2 Min: Hidden if Blue or Red */}
                                {!isBlue && !isRed && twoMinCount > 0 && Array.from({ length: twoMinCount }).map((_, i) => (
                                    <div key={`2m-${i}`} className="w-2 h-2 bg-white rounded-full shadow-sm border border-black/20" />
                                ))}
                                {/* Red: Shown if Red (Direct or 3rd 2min) and NOT Blue */}
                                {(isRed || twoMinCount >= 3) && !isBlue && (
                                    <div className="w-2 h-2 bg-red-600 rounded-full shadow-sm border border-black/20" />
                                )}
                                {/* Blue: Shows Blue dot only */}
                                {isBlue && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm border border-black/20" />
                                )}
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
    const renderOptionGrid = <T extends string>(options: T[], onSelect: (opt: T) => void) => (<div className={`grid ${options.length > 4 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}> {options.map(opt => (<button key={opt} onClick={() => onSelect(opt)} className={`p-4 text-lg font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center leading-tight ${opt === ShotOutcome.GOAL ? 'bg-green-600 hover:bg-green-500 text-white' : opt === ShotOutcome.SAVE ? 'bg-red-600 hover:bg-red-500 text-white' : opt === ShotOutcome.POST ? 'bg-slate-600 hover:bg-slate-500 text-white' : opt === ShotOutcome.MISS ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600' : opt === SanctionType.RED ? 'bg-red-700 hover:bg-red-600 text-white' : opt === SanctionType.BLUE ? 'bg-blue-600 hover:bg-blue-500 text-white' : opt === SanctionType.YELLOW ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>{['0', '2', '4'].includes(opt) ? `${opt} min` : opt}</button>))} </div>);
    const renderPlayerForm = () => (<form onSubmit={handleSavePlayer} className="space-y-4"> <div className="grid grid-cols-4 gap-3"> {playerForm.position !== Position.STAFF && playerForm.position !== Position.COACH && (<div className="col-span-1"><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Dorsal</label><input type="number" required value={playerForm.number || ''} onChange={e => setPlayerForm(prev => ({ ...prev, number: parseInt(e.target.value) || 0 }))} className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white text-center font-bold focus:border-handball-blue outline-none" /></div>)} <div className={playerForm.position === Position.STAFF || playerForm.position === Position.COACH ? "col-span-4" : "col-span-3"}><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nombre</label><input required value={playerForm.name || ''} onChange={e => setPlayerForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nombre" className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-handball-blue outline-none" /></div></div> <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Posición</label><select value={playerForm.position} onChange={e => setPlayerForm(prev => ({ ...prev, position: e.target.value as Position }))} className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-handball-blue outline-none">{Object.values(Position).map(pos => <option key={pos} value={pos}>{pos}</option>)}</select></div> <div className="pt-4 border-t border-slate-700"><h4 className="text-sm font-bold text-slate-300 mb-3 uppercase">Info Extra</h4><div className="grid grid-cols-2 gap-3 mb-3"><div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Altura</label><input type="number" value={playerForm.height || ''} onChange={e => setPlayerForm(p => ({ ...p, height: parseInt(e.target.value) }))} className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white outline-none" /></div><div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Peso</label><input type="number" value={playerForm.weight || ''} onChange={e => setPlayerForm(p => ({ ...p, weight: parseInt(e.target.value) }))} className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white outline-none" /></div></div><div className="mb-3"><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Teléfono</label><input type="tel" value={playerForm.phone || ''} onChange={e => setPlayerForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white outline-none" /></div></div> <div className="flex gap-3 pt-4">{/* Check if existing player */} {(rosterTab === 'HOME' ? state.players : state.opponentPlayers || []).some(p => p.id === playerForm.id) && (<button type="button" onClick={handleDeletePlayer} className="flex-1 py-3 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-900/50 font-bold uppercase rounded-xl flex items-center justify-center gap-2"><Trash2 size={18} />Eliminar</button>)}<button type="button" onClick={() => setMode(InputMode.IDLE)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold uppercase rounded-xl">Cancelar</button><button type="submit" className="flex-1 py-3 bg-handball-blue hover:bg-blue-600 text-white font-bold uppercase rounded-xl flex items-center justify-center gap-2"><Save size={18} />Guardar</button></div> </form>);
    const renderEventEditor = () => {
        const currentTimestamp = eventForm.timestamp ?? 0;
        const currentMin = Math.floor(currentTimestamp / 60);
        const currentSec = currentTimestamp % 60;

        const handleTimeChange = (field: 'min' | 'sec', valStr: string) => {
            const val = parseInt(valStr, 10);
            if (isNaN(val) || val < 0) return;
            let newTime = 0;
            if (field === 'min') newTime = (val * 60) + currentSec;
            else { const validSec = Math.min(59, val); newTime = (currentMin * 60) + validSec; }
            setEventForm(prev => ({ ...prev, timestamp: newTime }));
        };

        const renderSelect = (label: string, value: string | undefined, options: string[], onChange: (val: string) => void) => (
            <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">{label}</label>
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-handball-blue"
                >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        );

        const isOpponentEvent = eventForm.isOpponent;
        // Select correct list: Home or Opponent
        const playersList = (isOpponentEvent ? (state.opponentPlayers || []) : state.players).sort((a, b) => a.number - b.number);

        const eventTypeLabels: Record<string, string> = {
            SHOT: 'Tiro',
            TURNOVER: 'Pérdida',
            POSITIVE_ACTION: 'Acierto',
            SANCTION: 'Sanción',
            TIMEOUT: 'Tiempo Muerto',
            SUBSTITUTION: 'Cambio',
            OPPONENT_SHOT: 'Tiro Rival',
            OPPONENT_GOAL: 'Gol Rival'
        };
        const eventTypes = Object.keys(eventTypeLabels);

        return (
            <form onSubmit={handleSaveEditedEvent} className="space-y-4">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-700 mb-4">
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Periodo</label>
                            <select
                                value={eventForm.period || 1}
                                onChange={(e) => setEventForm(prev => ({ ...prev, period: parseInt(e.target.value) }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none"
                            >
                                <option value="1">1ª Parte</option>
                                <option value="2">2ª Parte</option>
                                <option value="3">Prórroga 1</option>
                                <option value="4">Prórroga 2</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Tipo Evento</label>
                            <select
                                value={eventForm.type || 'SHOT'}
                                onChange={(e) => setEventForm(prev => ({ ...prev, type: e.target.value as any }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none"
                            >
                                {eventTypes.map(t => <option key={t} value={t}>{eventTypeLabels[t]}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Time Editor */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900 rounded-xl border border-slate-700">
                    <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Minuto</label><input type="number" min="0" value={currentMin} onChange={(e) => handleTimeChange('min', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-center font-mono font-bold outline-none" /></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Segundo</label><input type="number" min="0" max="59" value={currentSec} onChange={(e) => handleTimeChange('sec', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-center font-mono font-bold outline-none" /></div>
                </div>

                {/* Player Editor - Updated to handle Opponent Players */}
                {/* Note: Opponent events use 'opponentPlayerId', Home events use 'playerId' */}
                {/* We show selector for all types except TIMEOUT or SUBSTITUTION (handled separately below) */}
                {(eventForm.type !== 'TIMEOUT' && eventForm.type !== 'SUBSTITUTION') && (
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                            {isOpponentEvent ? 'Jugador Rival' : 'Jugador'}
                        </label>
                        <select
                            value={(isOpponentEvent ? eventForm.opponentPlayerId : eventForm.playerId) || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                setEventForm(prev => ({
                                    ...prev,
                                    // If opponent, update opponentPlayerId, else playerId
                                    [isOpponentEvent ? 'opponentPlayerId' : 'playerId']: val
                                }))
                            }}
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-handball-blue"
                        >
                            <option value="">-- Seleccionar --</option>
                            {playersList.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.position === Position.STAFF ? 'C.T.' : `#${p.number}`} - {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Event Details Editor */}
                <div className="space-y-3 p-3 bg-slate-900 rounded-xl border border-slate-700">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-2 border-b border-slate-700 pb-1">Detalles del Evento</div>

                    {(eventForm.type === 'SHOT' || eventForm.type === 'OPPONENT_SHOT') && (
                        <>
                            {renderSelect('Resultado', eventForm.shotOutcome, Object.values(ShotOutcome), (val) => setEventForm(prev => ({ ...prev, shotOutcome: val as ShotOutcome })))}
                            {renderSelect('Zona', eventForm.shotZone, Object.values(ShotZone), (val) => setEventForm(prev => ({ ...prev, shotZone: val as ShotZone })))}
                        </>
                    )}

                    {eventForm.type === 'TURNOVER' && (
                        renderSelect('Tipo de Pérdida', eventForm.turnoverType, Object.values(TurnoverType), (val) => setEventForm(prev => ({ ...prev, turnoverType: val as TurnoverType })))
                    )}

                    {eventForm.type === 'POSITIVE_ACTION' && (
                        renderSelect('Tipo Acción', eventForm.positiveActionType, Object.values(PositiveActionType), (val) => setEventForm(prev => ({ ...prev, positiveActionType: val as PositiveActionType })))
                    )}

                    {eventForm.type === 'SANCTION' && (
                        renderSelect('Tipo Sanción', eventForm.sanctionType, Object.values(SanctionType), (val) => setEventForm(prev => ({ ...prev, sanctionType: val as SanctionType })))
                    )}

                    {eventForm.type === 'SUBSTITUTION' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Entra</label>
                                <select value={eventForm.playerInId || ''} onChange={(e) => setEventForm(prev => ({ ...prev, playerInId: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none">
                                    {playersList.map(p => <option key={p.id} value={p.id}>{p.number} - {p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Sale</label>
                                <select value={eventForm.playerOutId || ''} onChange={(e) => setEventForm(prev => ({ ...prev, playerOutId: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none">
                                    {playersList.map(p => <option key={p.id} value={p.id}>{p.number} - {p.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setMode(InputMode.IDLE)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold uppercase rounded-xl">Cancelar</button>
                    <button type="submit" className="flex-1 py-3 bg-handball-blue hover:bg-blue-600 text-white font-bold uppercase rounded-xl">Actualizar</button>
                </div>
            </form>
        );
    };

    const renderImportRosterModal = () => (
        <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 text-sm text-slate-300">
                <p className="mb-3 font-bold text-white">Instrucciones de Formato:</p>
                <p className="mb-2">El archivo Excel (.xlsx) debe tener una primera fila de cabecera con las siguientes columnas:</p>
                <ul className="list-disc list-inside space-y-1 mb-4 text-slate-400">
                    <li><span className="text-white">Dorsal</span> (Número)</li>
                    <li><span className="text-white">Nombre</span> (Texto)</li>
                    <li><span className="text-white">Posicion</span> (Texto)</li>
                </ul>
                <div className="bg-slate-800 p-2 rounded border border-slate-600 mb-3">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Ejemplo:</p>
                    <table className="w-full text-xs text-left">
                        <thead><tr className="border-b border-slate-700 text-slate-400"><th>Dorsal</th><th>Nombre</th><th>Posicion</th></tr></thead>
                        <tbody>
                            <tr><td>16</td><td>Juan</td><td>Portero</td></tr>
                            <tr><td>10</td><td>Dani</td><td>Central</td></tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-slate-500">
                    Posiciones: Portero, Extremo Izq, Lateral Izq, Central, Lateral Der, Extremo Der, Pivote, Cuerpo Técnico.
                </p>
            </div>
            <label className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <FileSpreadsheet size={16} />
                Importar para {rosterTab === 'HOME' ? 'Mi Equipo' : 'Rival'}
                <input type="file" accept=".xlsx, .xls" onChange={handleImportRosterExcel} className="hidden" />
            </label>
        </div>
    );

    // --- Match View Render ---
    const renderMatchView = () => {
        try {
            const periodDurationSecs = state.timerSettings.durationMinutes * 60;
            const isPeriodOver = state.isPaused && (
                (state.timerSettings.direction === 'UP' && state.gameTime >= periodDurationSecs) ||
                (state.timerSettings.direction === 'DOWN' && state.gameTime <= 0)
            );

            const isEndOfRegularTime = isPeriodOver && state.currentPeriod === state.config.regularPeriods;

            let periodButtonText = '';
            let periodButtonClass = 'bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600';

            if (isPeriodOver) {
                periodButtonClass = 'bg-handball-blue text-white font-bold animate-pulse hover:bg-blue-600';
                if (isEndOfRegularTime) {
                    periodButtonText = state.homeScore === state.awayScore ? 'Final Reglamentario (Empate)' : 'Final del Partido';
                } else if (state.currentPeriod >= state.config.regularPeriods) {
                    periodButtonText = 'Fin Prórroga / Siguiente';
                } else {
                    periodButtonText = `Inicio P${state.currentPeriod + 1}`;
                }
            } else {
                if (state.currentPeriod > state.config.regularPeriods) {
                    periodButtonText = `Prórroga ${state.currentPeriod - state.config.regularPeriods}`;
                } else {
                    periodButtonText = `Periodo ${state.currentPeriod}`;
                }
            }

            const homeTimeouts = state.events.filter(e => e.type === 'TIMEOUT' && !e.isOpponent).length;
            const awayTimeouts = state.events.filter(e => e.type === 'TIMEOUT' && e.isOpponent).length;

            return (
                <div className="flex flex-col min-h-full">
                    <div className="bg-slate-800 pt-8 pb-2 px-3 flex justify-between items-start sm:items-center border-b border-slate-700 shrink-0 relative">
                        {/* Status Bar Background */}
                        <div className="absolute top-0 left-0 w-full h-6 bg-black/20" />

                        <div className="text-center w-[25%] flex flex-col items-center">
                            <div className="flex flex-col items-center justify-center mb-1">
                                <div className="flex gap-1 mb-1">{Array.from({ length: homeTimeouts }).map((_, i) => (<div key={i} className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full shadow-sm border border-black/30" />))}</div>
                                <div className="flex items-center gap-1">
                                    {state.metadata.homeTeamLogo && (<img src={state.metadata.homeTeamLogo} alt="Home Logo" className="w-6 h-6 sm:w-10 sm:h-10 object-contain" />)}
                                    <div className="text-[10px] sm:text-xs text-slate-300 uppercase tracking-wider font-bold truncate max-w-[60px] sm:max-w-none">{state.metadata.homeTeam}</div>
                                </div>
                            </div>
                            <div className="text-3xl sm:text-6xl font-black text-white leading-none">{state.homeScore}</div>
                        </div>
                        <div className="flex flex-col items-center gap-1 sm:gap-2 flex-1 mx-2 pt-1">
                            <Timer time={state.gameTime} isPaused={state.isPaused} settings={state.timerSettings} onTogglePause={togglePause} onTimeUpdate={handleTimeUpdate} />
                            <button onClick={nextPeriod} disabled={!isPeriodOver} className={`text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all duration-300 whitespace-nowrap ${periodButtonClass} ${!isPeriodOver ? 'opacity-80 cursor-default' : ''}`}>
                                {periodButtonText}
                            </button>
                        </div>
                        <div className="text-center w-[25%] flex flex-col items-center">
                            <div className="flex flex-col items-center justify-center mb-1">
                                <div className="flex items-center gap-1 mb-1">
                                    <div className="text-[10px] sm:text-xs text-slate-300 uppercase tracking-wider font-bold truncate max-w-[60px] sm:max-w-none">{state.metadata.awayTeam}</div>
                                    {state.metadata.awayTeamLogo && (<img src={state.metadata.awayTeamLogo} alt="Away Logo" className="w-6 h-6 sm:w-10 sm:h-10 object-contain" />)}
                                </div>
                                <div className="flex gap-1">{Array.from({ length: awayTimeouts }).map((_, i) => (<div key={i} className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full shadow-sm border border-black/30" />))}</div>
                            </div>
                            <div className="text-3xl sm:text-6xl font-black text-white leading-none">{state.awayScore}</div>
                        </div>
                    </div>

                    <div className="bg-slate-950/50 py-1.5 px-2 shrink-0 border-b border-slate-800/50 flex flex-col items-center justify-center">
                        <div className="flex gap-2 overflow-x-auto w-full no-scrollbar items-center justify-center px-1">
                            {activePlayers.length === 0 ? (
                                <div className="text-sm text-slate-500 italic text-center w-full py-2">Sin jugadores en pista</div>
                            ) : (
                                activePlayers.filter(p => p.position !== Position.STAFF && p.position !== Position.COACH).map(p => {
                                    const sanction = activeSanctions.find(s => s.playerId === p.id);
                                    const playerSanctions = state.events.filter(e => e.type === 'SANCTION' && e.playerId === p.id);
                                    const yellowCount = playerSanctions.filter(e => e.sanctionType === SanctionType.YELLOW).length;
                                    const twoMinCount = playerSanctions.filter(e => e.sanctionType === SanctionType.TWO_MIN).length;
                                    const explicitRed = playerSanctions.some(e => e.sanctionType === SanctionType.RED);
                                    const isRed = explicitRed || yellowCount >= 2;
                                    const isBlue = playerSanctions.some(e => e.sanctionType === SanctionType.BLUE);
                                    const isDisqualified = isRed || isBlue;
                                    const formatSanctionTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };
                                    const isStaff = p.position === Position.STAFF;

                                    // Sanción CT Logic
                                    const sacrificedSanction = state.events.find(e => e.type === 'SANCTION' && e.sacrificedPlayerId === p.id && getSanctionRemainingTime(e, state.gameTime, state.timerSettings.direction, state.currentPeriod, state.config).remaining > 0);
                                    const sacrificed = !!sacrificedSanction;
                                    let remainingTimeStr = '';
                                    if (sacrificedSanction) {
                                        const { remaining } = getSanctionRemainingTime(sacrificedSanction, state.gameTime, state.timerSettings.direction, state.currentPeriod, state.config);
                                        const m = Math.floor(remaining / 60);
                                        const s = remaining % 60;
                                        remainingTimeStr = `${m}:${s.toString().padStart(2, '0')}`;
                                    }

                                    const baseClasses = isStaff ? 'bg-indigo-900 border-indigo-700' : isDisqualified ? 'bg-slate-900 border-red-900 cursor-not-allowed' : 'bg-slate-800 border-slate-700 hover:border-handball-blue hover:bg-slate-700';

                                    return (
                                        <button key={p.id} onClick={() => { if (isDisqualified || isStaff || sanction || sacrificed) return; startSubstitutionFlow(p); }} disabled={isDisqualified || sacrificed} title={isStaff ? p.name : `Sustituir a ${p.name}`} className={`relative flex flex-col items-center justify-center rounded-lg p-0.5 min-w-[40px] min-h-[40px] sm:min-w-[60px] sm:min-h-[60px] border transition-all shrink-0 ${!isDisqualified && !isStaff && !sacrificed ? 'active:scale-95' : 'cursor-default'} ${sanction ? 'bg-red-900/50 border-red-700 animate-pulse' : baseClasses}`}>

                                            {sacrificed && (
                                                <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center z-30 animate-in fade-in backdrop-blur-[1px] rounded-lg">
                                                    <span className="text-orange-400 font-bold text-[7px] sm:text-[9px] uppercase tracking-wider mb-0.5 drop-shadow-md leading-none">Sanción CT</span>
                                                    <span className="text-white font-mono text-sm sm:text-lg font-black tabular-nums tracking-widest drop-shadow-md leading-none">{remainingTimeStr}</span>
                                                </div>
                                            )}

                                            {!isBlue && !isRed && !(twoMinCount >= 3) && yellowCount > 0 && yellowCount < 2 && (<div className="absolute top-0.5 right-0.5 flex gap-0.5 z-10">{Array.from({ length: yellowCount }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-sm border border-black/20" />))}</div>)}
                                            {isBlue && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-sm border border-black/20 z-20" />}

                                            {sanction ? (<span className="text-[9px] sm:text-lg font-black leading-none text-red-300 font-mono">{formatSanctionTime(sanction.remaining)}</span>) : (<span className={`text-base sm:text-3xl font-black leading-none ${isDisqualified ? 'text-red-500' : (p.position === Position.GK ? 'text-handball-orange' : 'text-white')}`}>{isStaff ? 'CT' : p.number}</span>)}
                                            <span className={`text-[7px] sm:text-[10px] uppercase leading-none mt-0.5 max-w-[35px] sm:max-w-[50px] truncate ${isDisqualified ? 'text-red-400 font-bold' : 'text-slate-400'}`}>{p.name}</span>

                                            {!isBlue && !isRed && !(twoMinCount >= 3) && twoMinCount > 0 && (<div className="flex gap-0.5 mt-0.5">{Array.from({ length: twoMinCount }).map((_, i) => (<div key={i} className="w-1 h-1 bg-white rounded-full shadow-sm" />))}</div>)}
                                            {((isRed || twoMinCount >= 3) && !isBlue) && (<div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-600 rounded-full shadow-sm border border-black/20 z-20"></div>)}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="flex-1 p-2 space-y-2 flex flex-col min-h-0">
                        <div className="grid grid-cols-6 gap-1 h-10 sm:h-auto">
                            <button onClick={startOpponentShotFlow} className="col-span-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-900/50 p-0 sm:p-4 rounded-lg font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all active:scale-95 text-[9px] sm:text-lg leading-tight uppercase">
                                <ShieldAlert size={14} className="sm:w-7 sm:h-7" />
                                <span className="text-center truncate w-full px-1">
                                    {(state.metadata.isOurTeamHome !== false) ? state.metadata.awayTeam : state.metadata.homeTeam}
                                </span>
                            </button>
                            <button onClick={() => setMode(InputMode.SELECT_TEAM_FOR_NEW_EVENT)} className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg flex items-center justify-center transition-all active:scale-95" title="Añadir Evento Manualmente"><Plus size={16} className="sm:w-8 sm:h-8" /></button>
                            <button onClick={handleEditCurrentMatch} className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg flex items-center justify-center transition-all active:scale-95" title="Configuración del Partido"><Settings size={16} className="sm:w-8 sm:h-8" /></button>
                            <button onClick={undoLastEvent} disabled={state.events.length === 0} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg flex items-center justify-center transition-all active:scale-95"><Undo2 size={16} className="sm:w-8 sm:h-8" /></button>
                            <button onClick={handleManualSave} disabled={isSaving} className="bg-slate-700 hover:bg-slate-600 disabled:bg-green-600 disabled:text-white text-slate-300 rounded-lg flex items-center justify-center transition-all active:scale-95" title="Guardar Partido">{isSaving ? <Check size={16} className="sm:w-8 sm:h-8" /> : <Save size={16} className="sm:w-8 sm:h-8" />}</button>
                        </div>

                        <div className="flex-1 relative min-h-0 border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shrink-0">
                            <CourtSVG onZoneClick={handleOurAttackZoneClick} />
                        </div>

                        <div className="flex gap-2 min-h-[50px] sm:min-h-[80px] shrink-0">
                            <button onClick={() => handleTimeout(false)} className="flex-[0.5] bg-slate-700 hover:bg-slate-600 text-white p-1 sm:p-2 rounded-xl font-bold flex flex-col items-center justify-center gap-0 sm:gap-1 transition-all active:scale-95 text-[10px] sm:text-xs leading-none">
                                <PauseCircle size={18} className="sm:w-6 sm:h-6" /> T.M.
                            </button>
                            <button onClick={startTurnoverFlow} className="flex-[1] bg-handball-orange hover:bg-orange-600 text-white p-2 rounded-xl font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all active:scale-95 text-xs sm:text-xl uppercase"><ArrowRightLeft size={16} className="sm:w-7 sm:h-7" /> <span className="inline">Pérd.</span></button>
                            <button onClick={startPositiveActionFlow} className="flex-[1] bg-green-600 hover:bg-green-500 text-white p-2 rounded-xl font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all active:scale-95 text-xs sm:text-xl uppercase"><ThumbsUp size={16} className="sm:w-7 sm:h-7" /> <span className="inline">Ok</span></button>
                            <button onClick={startSanctionFlow} className="flex-[1] bg-yellow-600 hover:bg-yellow-700 text-white p-2 rounded-xl font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all active:scale-95 text-xs sm:text-xl uppercase"><Ban size={16} className="sm:w-7 sm:h-7" /> <span className="inline">Sanc</span></button>
                            <button onClick={() => handleTimeout(true)} className="flex-[0.5] bg-slate-700 hover:bg-slate-600 text-white p-1 sm:p-2 rounded-xl font-bold flex flex-col items-center justify-center gap-0 sm:gap-1 transition-all active:scale-95 text-[10px] sm:text-xs leading-none">
                                <PauseCircle size={18} className="sm:w-6 sm:h-6" /> T.M.
                            </button>
                        </div>
                    </div>
                </div>
            );
        } catch (error) {
            console.error('Error rendering match view:', error);
            return (
                <div className="flex items-center justify-center h-full bg-red-900/20 p-8">
                    <div className="bg-red-900/50 border-2 border-red-500 rounded-xl p-6 max-w-md">
                        <h2 className="text-2xl font-bold text-red-100 mb-4">❌ Error al Cargar Partido</h2>
                        <p className="text-red-200 mb-4">Ocurrió un error al intentar mostrar la vista del partido.</p>
                        <pre className="bg-black/50 p-3 rounded text-xs text-red-300 overflow-auto max-h-40">
                            {error instanceof Error ? error.message : String(error)}
                            {error instanceof Error && error.stack ? `\n\n${error.stack}` : ''}
                        </pre>
                        <button
                            onClick={() => setView('SETUP')}
                            className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl"
                        >
                            Volver a Configuración
                        </button>
                    </div>
                </div>
            );
        }
    };

    // --- MAIN RENDER ---
    if (showSplash) {
        return <SplashScreen onFinish={() => setShowSplash(false)} duration={3000} />;
    }

    if (view === 'TEAM_SELECT') {
        return (
            <TeamSelectView
                teams={teams}
                onSelectTeam={handleSelectTeam}
                onCreateTeam={handleCreateTeam}
                onDeleteTeam={handleDeleteTeam}
                onViewCloudMatches={() => window.location.href = '/cloud'}
            />
        );
    }

    const handleSwitchLocality = (newIsHome: boolean) => {
        // Swap Names
        const oldHome = setupForm.homeTeam;
        const oldAway = setupForm.awayTeam;

        // Swap Logos
        const oldHomeLogo = setupHomeLogo;
        const oldAwayLogo = setupAwayLogo;

        setSetupForm(prev => ({
            ...prev,
            homeTeam: oldAway,
            awayTeam: oldHome,
            isOurTeamHome: newIsHome
        }));

        setSetupHomeLogo(oldAwayLogo);
        setSetupAwayLogo(oldHomeLogo);
    };

    if (view === 'SETUP') return (
        <SetupView
            form={setupForm}
            setForm={setSetupForm}
            onSubmit={handleSetupSubmit}
            logo={setupHomeLogo}
            onLogoUpload={handleLogoUpload}
            awayLogo={setupAwayLogo}
            onAwayLogoUpload={handleAwayLogoUpload}
            onViewArchive={() => setView('INFO')}
            // onViewGlobalStats removed
            onSwitchTeam={handleSwitchTeam}
            currentTeamName={currentTeam?.name || 'Equipo'}
            isEditing={isEditingMatch}
            onCancel={() => { setIsEditingMatch(false); setView('MATCH'); }}
            teams={teams}
            onSwitchLocality={handleSwitchLocality}
        />
    );



    if (view === 'GLOBAL_STATS' && currentTeam) {
        return (
            <GlobalStatsView
                teamId={currentTeam.id}
                teamName={currentTeam.name}
                onBack={() => setView('INFO')}
                onLoadMatch={(id) => handleLoadMatch(id, 'STATS')}
            />
        );
    }

    if (view === 'CLOUD') {
        return <CloudMatchList />;
    }

    if (view === 'INFO') {
        return (
            <InfoView
                matches={matchHistory}
                onLoad={(id) => handleLoadMatch(id, 'MATCH')}
                onDelete={handleDeleteArchivedMatch}
                onEdit={(id) => {
                    // If viewing all, we might edit a match from another team. 
                    // Load it first to verify ownership?
                    // Logic handles metadata.ownerTeamId, so handleEditArchivedMatch should be fine.
                    handleEditArchivedMatch(id);
                }}
                currentMatchMetadata={state.metadata}
                onNewMatch={handleNewMatch}
                onSave={handleManualSave}
                isSaving={isSaving}
                onImport={handleImportMatch}
                onExport={(id) => handleExportMatch(id)}
                onSwitchTeam={handleSwitchTeam}
                onViewGlobalStats={() => setView('GLOBAL_STATS')}
                onBack={() => setView('MATCH')}
                onRefresh={() => {
                    if (showAllMatches) setMatchHistory(getMatchHistory());
                    else if (currentTeam) setMatchHistory(getMatchHistory(currentTeam.id));
                }}
                onLogin={() => setView('LOGIN')}
                showAllMatches={showAllMatches}
                onToggleShowAll={() => setShowAllMatches(!showAllMatches)}
            />
        );
    }

    if (view === 'LOGIN') {
        return (
            <LoginView
                onBack={() => setView('INFO')}
                onLoginSuccess={async () => {
                    // Sync cloud data down before refreshing UI
                    await syncTeamsDown();
                    await syncMatchesDown();
                    setView('INFO');
                }}
                onSync={handleSyncSuccess}
                onViewCloudMatches={() => setView('CLOUD')}
            />
        );
    }

    if (view === 'RESET_PASSWORD' && oobCode) {
        return (
            <ResetPasswordView
                oobCode={oobCode}
                onBack={() => setView('LOGIN')}
                onSuccess={() => setView('LOGIN')}
            />
        );
    }

    return (
        <>
            {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
            <div className="app-container bg-slate-900 text-slate-100">
                <main className="app-content relative">
                    {view === 'MATCH' && renderMatchView()}
                    {view === 'STATS' && (
                        <ErrorBoundary viewName="Stats">
                            <StatsView state={state} onExportToExcel={handleExportStatsToExcel} onExportToTemplate={handleExportToTemplate} />
                        </ErrorBoundary>
                    )}
                    {view === 'TIMELINE' && (
                        <ErrorBoundary viewName="Timeline">
                            <TimelineView state={state} onDeleteEvent={handleDeleteEvent} onEditEvent={openEditEventModal} onAddEvent={handleStartAddEvent} onResetMatch={handleResetMatch} />
                        </ErrorBoundary>
                    )}
                    {view === 'ROSTER' && (
                        <div className="p-4 max-w-xl mx-auto min-h-full">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Users /> Plantilla</h2>

                                {/* Roster Switcher */}
                                <div className="flex bg-slate-800 rounded-lg p-1">
                                    <button
                                        onClick={() => setRosterTab('HOME')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${rosterTab === 'HOME' ? 'bg-handball-blue text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        {state.metadata.homeTeam}
                                    </button>
                                    <button
                                        onClick={() => setRosterTab('AWAY')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${rosterTab === 'AWAY' ? 'bg-handball-blue text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        {state.metadata.awayTeam}
                                    </button>
                                </div>
                            </div>
                            {/* Rest of Roster View code... */}
                            {/* Assuming Roster View is safe or I should wrap the whole return, but Roster View is implicit in the big return block. 
                                Let's just wrap the VIEWS we replaced.
                             */}
                            {/* Wait, I cannot easily replace the whole block because Roster View is inline. */}



                            <div className="flex gap-2 justify-end mb-4 flex-wrap">
                                <button onClick={handleSaveRosterToTeam} className="text-xs bg-slate-700 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-slate-600 transition-colors text-blue-300">
                                    <Save size={16} /> Grabar
                                </button>
                                <button onClick={handleRecoverRosterFromTeam} className="text-xs bg-slate-700 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-slate-600 transition-colors text-orange-300">
                                    <RefreshCw size={16} /> Recuperar
                                </button>
                                <button onClick={() => setMode(InputMode.IMPORT_ROSTER)} className="text-xs bg-slate-700 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-slate-600 transition-colors text-green-400">
                                    <FileSpreadsheet size={16} /> Importar Excel
                                </button>
                                <button onClick={openNewPlayerModal} className="text-xs bg-handball-blue px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-600 transition-colors">
                                    <Plus size={16} /> Nuevo
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-handball-blue uppercase mb-2 flex justify-between">
                                        <span>En Pista ({currentRosterActive.length})</span>
                                    </h3>
                                    {currentRosterActive.length === 0 && <p className="text-slate-500 text-sm italic py-2">Ningún jugador marcado como activo.</p>}
                                    {currentRosterActive.map(p => (
                                        <div key={p.id} className="flex justify-between p-3 bg-slate-800 mb-2 rounded-lg border-l-4 border-green-500 group">
                                            <div className="flex items-center gap-2 flex-1" onClick={() => togglePlayerActive(p.id)}>
                                                <strong className="w-8 inline-block text-lg text-center">{p.position === Position.COACH ? 'ENT' : (p.position === Position.STAFF ? 'CT' : p.number)}</strong>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{p.name}</span>
                                                    <span className="text-slate-400 text-xs">{p.position}</span>
                                                    {/* Sanciones Visuales */}
                                                    {(() => {
                                                        const playerSanctions = state.events.filter(e => e.type === 'SANCTION' && e.playerId === p.id);
                                                        const yellowCount = playerSanctions.filter(e => e.sanctionType === SanctionType.YELLOW).length;
                                                        const twoMinCount = playerSanctions.filter(e => e.sanctionType === SanctionType.TWO_MIN).length;
                                                        const isBlue = playerSanctions.some(e => e.sanctionType === SanctionType.BLUE);
                                                        const isRed = playerSanctions.some(e => e.sanctionType === SanctionType.RED);

                                                        if (yellowCount === 0 && twoMinCount === 0 && !isBlue && !isRed) return null;

                                                        return (
                                                            <div className="flex gap-1 mt-1">
                                                                {!isBlue && !isRed && yellowCount > 0 && <span className="w-2 h-2 bg-yellow-400 rounded-full inline-block" />}
                                                                {!isBlue && !isRed && twoMinCount > 0 && Array.from({ length: twoMinCount }).map((_, i) => <span key={i} className="w-2 h-2 bg-white border border-slate-500 rounded-full inline-block" />)}
                                                                {(isRed || twoMinCount >= 3) && !isBlue && <span className="w-2 h-2 bg-red-600 rounded-full inline-block" />}
                                                                {isBlue && <span className="w-2 h-2 bg-blue-600 rounded-full inline-block" />}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={(e) => openEditPlayerModal(p, e)} className="p-2 text-slate-500 hover:text-handball-blue transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={() => togglePlayerActive(p.id)} className="p-2 text-slate-400 hover:text-white"><ArrowRightLeft size={18} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Banquillo</h3>
                                    {currentRosterBench.length === 0 && <p className="text-slate-500 text-sm italic py-2">Lista vacía.</p>}
                                    {currentRosterBench.map(p => {
                                        const disqualified = isPlayerDisqualified(p.id, state.events);
                                        const sacrificed = isPlayerSacrificed(p.id);
                                        const isStaff = p.position === Position.STAFF;
                                        const disabled = disqualified || sacrificed;

                                        return (
                                            <div key={p.id} className={`relative flex justify-between p-3 bg-slate-800/50 mb-2 rounded-lg transition-all ${disabled ? 'opacity-60 border border-red-900/40' : 'opacity-75 hover:opacity-100'}`}>
                                                <div className="flex items-center gap-2 flex-1" onClick={() => !disabled && togglePlayerActive(p.id)}>
                                                    <strong className={`w-8 inline-block text-lg text-center ${disqualified ? 'text-red-800' : 'text-slate-500'}`}>{isStaff ? 'CT' : p.number}</strong>
                                                    <div className="flex flex-col">
                                                        <span className={`font-medium ${disqualified ? 'line-through decoration-red-500 decoration-2' : ''}`}>{p.name}</span>
                                                        <span className="text-slate-400 text-xs flex items-center gap-1">
                                                            {p.position}
                                                            {disqualified && <span className="text-red-500 ml-1">(Descalificado)</span>}
                                                            {sacrificed && <span className="text-orange-500 ml-1">(Sanción CT)</span>}
                                                        </span>
                                                        {/* Show Sanctions on Bench - Below Name */}
                                                        {(() => {
                                                            const playerSanctions = state.events.filter(e => e.type === 'SANCTION' && e.playerId === p.id);
                                                            const yellowCount = playerSanctions.filter(e => e.sanctionType === SanctionType.YELLOW).length;
                                                            const twoMinCount = playerSanctions.filter(e => e.sanctionType === SanctionType.TWO_MIN).length;
                                                            const isBlue = playerSanctions.some(e => e.sanctionType === SanctionType.BLUE);
                                                            const isRed = playerSanctions.some(e => e.sanctionType === SanctionType.RED);

                                                            if (yellowCount === 0 && twoMinCount === 0 && !isBlue && !isRed) return null;

                                                            return (
                                                                <div className="flex gap-1 mt-1">
                                                                    {yellowCount > 0 && <span className="w-2 h-2 bg-yellow-400 rounded-full inline-block" />}
                                                                    {twoMinCount > 0 && Array.from({ length: twoMinCount }).map((_, i) => <span key={i} className="w-2 h-2 bg-white border border-slate-500 rounded-full inline-block" />)}
                                                                    {isRed && <span className="w-2 h-2 bg-red-600 rounded-full inline-block" />}
                                                                    {isBlue && <span className="w-2 h-2 bg-blue-600 rounded-full inline-block" />}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={(e) => openEditPlayerModal(p, e)} className="p-2 text-slate-500 hover:text-handball-blue transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={() => togglePlayerActive(p.id)} disabled={disabled} className={`p-2 ${disabled ? 'text-slate-600 cursor-not-allowed' : 'text-green-500 hover:text-green-400'}`}><ArrowRightLeft size={18} /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODALS */}
                    {mode === InputMode.SELECT_SHOT_OUTCOME && renderModal('Resultado Tiro', renderOptionGrid(Object.values(ShotOutcome), handleShotOutcomeSelect))}
                    {mode === InputMode.SELECT_PLAYER_FOR_SHOT && renderModal('Lanzador', renderPlayerGrid(activePlayers, handlePlayerSelect))}
                    {mode === InputMode.SELECT_SHOT_PLACEMENT_OPTIONAL && renderModal(pendingEvent.shotOutcome === ShotOutcome.GOAL ? 'Colocación Gol' : 'Zona de Parada', <div className="space-y-4"><GoalSVG onPlacementClick={handleOurShotPlacementSelect} /><button onClick={() => recordEvent({ ...pendingEvent, id: generateId() } as any)} className="w-full py-3 bg-slate-700 text-slate-300 rounded-xl font-bold uppercase">Omitir</button></div>)}
                    {mode === InputMode.SELECT_OPPONENT_SHOT_ZONE && renderModal('Zona Ataque Rival', <div className="min-h-[400px] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center"><CourtSVG onZoneClick={handleOpponentAttackZoneClick} flipped={false} /></div>)}
                    {mode === InputMode.SELECT_OPPONENT_SHOT_OUTCOME && renderModal('Resultado Rival', renderOptionGrid(Object.values(ShotOutcome), handleOpponentShotOutcomeSelect))}
                    {mode === InputMode.SELECT_OPPONENT_PLAYER && renderModal('¿Quién lanzó del rival?', <div className="space-y-4">{renderPlayerGrid(state.opponentPlayers || [], handlePlayerSelect)}<button onClick={() => { setPendingEvent(prev => ({ ...prev, opponentPlayerId: undefined })); setMode(InputMode.SELECT_OPPONENT_SHOT_PLACEMENT); }} className="w-full py-3 bg-slate-700 text-slate-300 rounded-xl font-bold uppercase">Jugador Desconocido</button></div>)}
                    {mode === InputMode.SELECT_OUR_GK_FOR_SAVE && renderModal('¿Quién ha parado?', renderPlayerGrid(activePlayers.filter(p => p.position === Position.GK), handlePlayerSelect))}
                    {mode === InputMode.SELECT_OPPONENT_SHOT_PLACEMENT && renderModal('¿Por dónde fue?', <GoalSVG onPlacementClick={handleOpponentShotPlacementSelect} />)}

                    {mode === InputMode.SELECT_TURNOVER_TYPE && renderModal('Tipo Pérdida', renderOptionGrid(Object.values(TurnoverType), handleTurnoverTypeSelect))}
                    {mode === InputMode.SELECT_PLAYER_FOR_TURNOVER && renderModal('Jugador', renderPlayerGrid(activePlayers, handlePlayerSelect))}

                    {mode === InputMode.SELECT_POSITIVE_ACTION_TYPE && renderModal('Tipo Acierto', renderOptionGrid(Object.values(PositiveActionType), handlePositiveActionTypeSelect))}
                    {mode === InputMode.SELECT_PLAYER_FOR_POSITIVE_ACTION && renderModal('Jugador', renderPlayerGrid(activePlayers, handlePlayerSelect))}

                    {mode === InputMode.SELECT_SANCTION_TYPE && renderModal('Sanción', renderOptionGrid(Object.values(SanctionType), handleSanctionTypeSelect))}
                    {mode === InputMode.SELECT_PLAYER_FOR_SANCTION && renderModal('Jugador Sancionado', renderPlayerGrid(currentRosterActive, handlePlayerSelect))}
                    {mode === InputMode.SELECT_SANCTION_DURATION && renderModal('Duración', renderOptionGrid(['0', '2'], handleSanctionDurationSelect))}
                    {mode === InputMode.SELECT_PLAYER_TO_SACRIFICE && renderModal('¿Quién sale del campo?', renderPlayerGrid(activeFieldPlayers, handleSacrificeSelect))}
                    {mode === InputMode.SELECT_PLAYER_TO_ENTER_AFTER_STAFF_SANCTION && renderModal('Fin Sanción Técnico: ¿Quién entra?', renderPlayerGrid(currentRosterBench, handlePlayerEnterAfterStaffSanction))}

                    {/* Declarative Sanction Modal - Shows whenever ID is set, ignoring Mode */}
                    {sanctionEndedPlayerId && renderModal('Fin Sanción: ¿Quién entra?', renderPlayerGrid(sanctionEndOptions, handlePlayerEnterAfterSanction))}

                    {mode === InputMode.SELECT_PLAYER_FOR_SUBSTITUTION_IN && renderModal(`Sustituir a #${pendingSubOut?.number} ${pendingSubOut?.name}`, renderPlayerGrid(currentRosterBench, handleSubstitutionConfirm))}
                    {mode === InputMode.EDIT_PLAYER_DETAILS && renderModal(playerForm.id && (rosterTab === 'HOME' ? state.players : state.opponentPlayers || []).some(p => p.id === playerForm.id) ? 'Editar Jugador' : 'Nuevo Jugador', renderPlayerForm())}
                    {mode === InputMode.EDIT_EVENT_DETAILS && renderModal('Editar Evento', renderEventEditor())}
                    {mode === InputMode.IMPORT_ROSTER && renderModal('Importar Plantilla', renderImportRosterModal())}
                    {mode === InputMode.SELECT_TEAM_FOR_NEW_EVENT && renderModal('¿De quién es el evento?', <div className="grid grid-cols-2 gap-4"><button onClick={() => handleTeamSelectForNewEvent(false)} className="p-4 bg-slate-700 hover:bg-handball-blue text-white rounded-xl font-bold uppercase">{state.metadata.homeTeam}</button><button onClick={() => handleTeamSelectForNewEvent(true)} className="p-4 bg-red-900/50 hover:bg-red-800 text-white rounded-xl font-bold uppercase">{state.metadata.awayTeam}</button></div>)}

                    {mode === InputMode.SELECT_TEAM_FOR_RECOVER && renderModal('Seleccionar Equipo a Recuperar', (
                        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                            {teams.map(t => (
                                <button key={t.id} onClick={() => handleConfirmRecoverTeam(t)} className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95">
                                    {t.logo ? <img src={t.logo} className="w-12 h-12 object-contain" /> : <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center"><Users className="text-slate-400" /></div>}
                                    <span className="font-bold text-center text-sm text-white">{t.name}</span>
                                    <span className="text-xs text-slate-500">{t.category}</span>
                                </button>
                            ))}
                        </div>
                    ))}



                </main >

                <nav className="bg-slate-950 border-t border-slate-800 p-2 shrink-0 safe-area-bottom flex justify-around">
                    <NavButton icon={<Activity />} label="Partido" active={view === 'MATCH'} onClick={() => setView('MATCH')} />
                    <NavButton icon={<Clock />} label="Timeline" active={view === 'TIMELINE'} onClick={() => setView('TIMELINE')} />
                    <NavButton icon={<ClipboardList />} label="Estadísticas" active={view === 'STATS'} onClick={() => setView('STATS')} />
                    <NavButton icon={<Users />} label="Equipo" active={view === 'ROSTER'} onClick={() => setView('ROSTER')} />
                    <NavButton icon={<Archive />} label="Archivo" active={false} onClick={() => setView('INFO')} />
                </nav>

                {

                }



            </div >
        </>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainDashboard />} />
                <Route path="/match/:id" element={<PublicMatchViewer />} />
                <Route path="/cloud" element={<CloudMatchList />} />
                <Route path="/login" element={<LoginWrapperOnRoute />} />
            </Routes>
        </BrowserRouter>
    );
}

function LoginWrapperOnRoute() {
    // Need a wrapper because LoginView props expects navigation callbacks
    // But wait, LoginWrapper.tsx handles that.
    return <LoginWrapper />;
};


