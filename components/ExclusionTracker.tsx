import React from 'react';
import { Ban } from 'lucide-react';

export interface ActiveExclusion {
  id: string;
  playerId: string;
  team: 'OUR' | 'OPPONENT';
  startTime: number;
  endTime: number;
  duration: number;
}

interface ExclusionTrackerProps {
  exclusions: ActiveExclusion[];
  gameTime: number;
  ourTeamName?: string;
  opponentTeamName?: string;
}

export const ExclusionTracker: React.FC<ExclusionTrackerProps> = ({ exclusions, gameTime, ourTeamName = 'Nosotros', opponentTeamName = 'Rival' }) => {
  const active = exclusions.filter(e => gameTime < e.endTime);
  if (active.length === 0) return null;

  const ours = active.filter(e => e.team === 'OUR');
  const theirs = active.filter(e => e.team === 'OPPONENT');

  return (
    <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-300">
      {ours.map(ex => (
        <ExclusionBar key={ex.id} team={ourTeamName} remaining={ex.endTime - gameTime} isOpponent={false} />
      ))}
      {theirs.map(ex => (
        <ExclusionBar key={ex.id} team={opponentTeamName} remaining={ex.endTime - gameTime} isOpponent={true} />
      ))}
    </div>
  );
};

const ExclusionBar: React.FC<{ team: string; remaining: number; isOpponent: boolean }> = ({ team, remaining, isOpponent }) => {
  const pct = Math.max(0, Math.min(100, (remaining / 120) * 100));
  const color = isOpponent ? 'bg-blue-600' : 'bg-red-600';
  const border = isOpponent ? 'border-blue-500/40' : 'border-red-500/40';

  return (
    <div className={`flex items-center gap-2 bg-slate-800/80 border ${border} rounded-lg px-3 py-1.5`}>
      <Ban size={14} className={isOpponent ? 'text-blue-400' : 'text-red-400'} />
      <span className="text-xs font-bold text-slate-200 uppercase truncate flex-1">{team}: Inferioridad</span>
      <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-white w-8 text-right">{formatRemaining(remaining)}</span>
    </div>
  );
};

function formatRemaining(seconds: number) {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
