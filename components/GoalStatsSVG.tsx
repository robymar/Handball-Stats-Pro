import React from 'react';
import { ShotPlacement } from '../types.ts';

interface GoalStatsSVGProps {
    stats: Partial<Record<ShotPlacement, { goals: number, saves: number }>>;
    title?: string;
    playerName?: string;
    totalShots?: number;
    savePercent?: number; // Para GK
    shootingPercent?: number; // Para Player
    mode?: 'GK' | 'PLAYER';
}

export const GoalStatsSVG: React.FC<GoalStatsSVGProps> = ({ stats, title, playerName, totalShots, savePercent, shootingPercent, mode = 'GK' }) => {
    const isGK = mode === 'GK';

    const zones = [
        { id: ShotPlacement.TOP_LEFT, label: '↗' },
        { id: ShotPlacement.TOP_CENTER, label: '↑' },
        { id: ShotPlacement.TOP_RIGHT, label: '↖' },
        { id: ShotPlacement.MID_LEFT, label: '→' },
        { id: ShotPlacement.MID_CENTER, label: '•' },
        { id: ShotPlacement.MID_RIGHT, label: '←' },
        { id: ShotPlacement.LOW_LEFT, label: '↘' },
        { id: ShotPlacement.LOW_CENTER, label: '↓' },
        { id: ShotPlacement.LOW_RIGHT, label: '↙' },
    ];

    return (
        <div className="flex flex-col items-center bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg w-full">
            {title && <h4 className="text-slate-400 text-sm font-bold uppercase mb-2">{title}</h4>}
            {playerName && (
                <div className="text-center mb-4">
                    <div className="text-white font-black text-2xl mb-1">{playerName}</div>
                    <div className="text-lg text-slate-400 flex gap-4 justify-center">
                        <span>Total: {totalShots}</span>
                        {isGK ? (
                            <span className={savePercent && savePercent > 30 ? "text-green-400" : "text-orange-400"}>
                                {savePercent}% Paradas
                            </span>
                        ) : (
                            <span className={shootingPercent && shootingPercent > 60 ? "text-green-400" : "text-orange-400"}>
                                {shootingPercent}% Acierto
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="relative w-full max-w-[600px] aspect-[3/2] bg-slate-900/50 rounded-lg overflow-hidden border-4 border-slate-600 p-3">
                {/* Goal Frame */}
                <div className="absolute inset-3 border-[8px] border-white border-b-0 flex">
                    <div className="w-full h-full relative bg-white/5 grid grid-cols-3 grid-rows-3">
                        {/* Net */}
                        <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 pointer-events-none opacity-10">
                            {Array.from({ length: 96 }).map((_, i) => (
                                <div key={i} className="border-[0.5px] border-slate-300"></div>
                            ))}
                        </div>

                        {zones.map(zone => {
                            const zoneStats = stats[zone.id] || { goals: 0, saves: 0 };
                            // GK: goals=Encajados(Rojo), saves=Parados(Verde)
                            // Player: goals=Anotados(Verde), saves=Fallados(Rojo) [Le pasare fallos en propiedad saves]
                            const total = zoneStats.goals + zoneStats.saves;

                            const greenValue = isGK ? zoneStats.saves : zoneStats.goals;
                            const redValue = isGK ? zoneStats.goals : zoneStats.saves;

                            return (
                                <div key={zone.id} className="relative flex flex-col items-center justify-center border border-white/10 p-1">
                                    {total > 0 ? (
                                        <div className="flex flex-col items-center bg-slate-900/90 rounded px-2 py-1 backdrop-blur-sm min-w-[50px]">
                                            <div className="flex gap-1 text-xl font-black leading-none">
                                                {/* Left number (Green for GK, Green for Player) - Wait. Usually format is Good/Bad? 
                                                    GK: Saves/Goals.
                                                    Player: Goals/Misses.
                                                    So Left is always 'Good'? Or standard format? 
                                                    Let's do: Green / Red.
                                                */}
                                                <span className="text-green-400" title={isGK ? "Paradas" : "Goles"}>{greenValue}</span>
                                                <span className="text-white opacity-50">/</span>
                                                <span className="text-red-500" title={isGK ? "Goles" : "Fallos"}>{redValue}</span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                                {Math.round((greenValue / total) * 100)}%
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-white/5 text-3xl select-none">{zone.label}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* Floor */}
                <div className="absolute bottom-1 left-2 right-2 h-[6px] bg-handball-blue/50 rounded-full"></div>
            </div>

            <div className="flex gap-6 mt-4 text-sm font-bold uppercase text-slate-500">
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-400 rounded-full"></div> {isGK ? 'Paradas' : 'Goles'}</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded-full"></div> {isGK ? 'Goles Rec.' : 'Fallos'}</div>
            </div>
        </div>
    );
};
