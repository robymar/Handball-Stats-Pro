import React, { useState } from 'react';
import { Play, Pause, Check, X } from 'lucide-react';
import { TimerSettings } from '../types.ts';

interface TimerProps {
  time: number;
  isPaused: boolean;
  settings: TimerSettings;
  onTogglePause: () => void;
  onTimeUpdate: (newTime: number) => void;
}

export const Timer: React.FC<TimerProps> = ({ time, isPaused, settings, onTogglePause, onTimeUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editMin, setEditMin] = useState('00');
  const [editSec, setEditSec] = useState('00');

  const formatTime = (seconds: number) => {
    const m = Math.floor(Math.abs(seconds) / 60);
    const s = Math.abs(seconds) % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Lógica para determinar si quedan menos de 30 segundos
  const totalSeconds = settings.durationMinutes * 60;
  
  // Si cuenta hacia ABAJO: alerta si tiempo <= 30 y > 0
  // Si cuenta hacia ARRIBA: alerta si tiempo >= total - 30 y < total
  const isWarning = settings.direction === 'DOWN'
      ? time <= 30 && time > 0
      : time >= totalSeconds - 30 && time < totalSeconds;

  const handleStartEdit = () => {
    const m = Math.floor(Math.abs(time) / 60);
    const s = Math.abs(time) % 60;
    setEditMin(m.toString().padStart(2, '0'));
    setEditSec(s.toString().padStart(2, '0'));
    setIsEditing(true);
    if (!isPaused) onTogglePause(); // Pause when editing
  };

  const handleSaveEdit = () => {
    const m = parseInt(editMin, 10) || 0;
    const s = parseInt(editSec, 10) || 0;
    onTimeUpdate(m * 60 + s);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
       <div className="flex items-center space-x-2 bg-slate-800 px-2 py-2 rounded-lg border border-slate-700">
         <input
           type="number"
           value={editMin}
           onChange={(e) => setEditMin(e.target.value)}
           className="w-12 bg-slate-700 text-white text-xl font-mono text-center rounded p-1"
           min="0" max="60"
         />
         <span className="text-white font-bold">:</span>
         <input
           type="number"
           value={editSec}
           onChange={(e) => setEditSec(e.target.value)}
           className="w-12 bg-slate-700 text-white text-xl font-mono text-center rounded p-1"
           min="0" max="59"
         />
         <button onClick={handleSaveEdit} className="p-1 bg-green-600 rounded text-white"><Check size={16} /></button>
         <button onClick={handleCancelEdit} className="p-1 bg-red-600 rounded text-white"><X size={16} /></button>
       </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 bg-slate-800 px-4 py-2 rounded-lg border relative group transition-all duration-300 ${isWarning ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-slate-700'}`}>
      <button 
        onClick={handleStartEdit} 
        className={`font-mono text-3xl font-bold tracking-wider transition-colors flex items-center gap-2
            ${isWarning ? 'text-red-500 animate-pulse' : 'text-white hover:text-handball-blue'}
        `}
      >
        {formatTime(time)}
      </button>
      <button
        onClick={onTogglePause}
        className={`p-2 rounded-full ${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white transition-colors`}
      >
        {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
      </button>
    </div>
  );
};
