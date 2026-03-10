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

export const GoalStatsSVG: React.FC<GoalStatsSVGProps & { showContainer?: boolean }> = React.memo(({ stats, title, playerName, totalShots, savePercent, shootingPercent, mode = 'GK', showContainer = true }) => {
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

    const content = (
        <>
            {title && <h4 className="text-slate-400 text-xs font-black uppercase mb-3 tracking-widest">{title}</h4>}
            {playerName && (
                <div className="text-center mb-6">
                    <div className="text-white font-black text-3xl mb-1">{playerName}</div>
                    <div className="text-base text-slate-400 flex gap-4 justify-center font-bold">
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

            <div className="relative w-full max-w-[500px] aspect-[3/2] bg-slate-800/50 rounded-xl overflow-hidden border-2 border-slate-700 p-4">
                {/* Goal Frame */}
                <div className="absolute inset-2 sm:inset-4 border-[4px] sm:border-[8px] border-white border-b-0 flex">
                    <div className="w-full h-full relative bg-white/5 grid grid-cols-3 grid-rows-3">
                        {/* Net Pattern */}
                        <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 pointer-events-none opacity-[0.03]">
                            {Array.from({ length: 96 }).map((_, i) => (
                                <div key={i} className="border-[0.5px] border-white"></div>
                            ))}
                        </div>

                        {zones.map(zone => {
                            const zoneStats = stats[zone.id] || { goals: 0, saves: 0 };
                            const total = zoneStats.goals + zoneStats.saves;
                            const greenValue = isGK ? zoneStats.saves : zoneStats.goals;
                            const redValue = isGK ? zoneStats.goals : zoneStats.saves;

                            return (
                                <div key={zone.id} className="relative flex flex-col items-center justify-center border border-white/5">
                                    {total > 0 ? (
                                        <div className="flex flex-col items-center bg-slate-950/80 rounded-lg px-1.5 py-0.5 sm:py-1 backdrop-blur-md border border-white/10 min-w-[28px] sm:min-w-[40px] scale-90 sm:scale-100">
                                            <div className="flex gap-0.5 text-xs sm:text-sm md:text-base font-black leading-none">
                                                <span className="text-green-400">{greenValue}</span>
                                                <span className="text-white/20">/</span>
                                                <span className="text-red-500">{redValue}</span>
                                            </div>
                                            <div className="text-[6px] sm:text-[8px] text-slate-500 font-black mt-0.5">
                                                {Math.round((greenValue / total) * 100)}%
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-white/5 text-lg sm:text-2xl font-black select-none opacity-20">{zone.label}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* Floor line */}
                <div className="absolute bottom-4 left-2 right-2 h-[8px] bg-handball-blue/50 rounded-full"></div>
            </div>

            <div className="flex gap-4 sm:gap-8 mt-6 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.4)]"></div> 
                    {isGK ? 'Paradas' : 'Goles'}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div> 
                    {isGK ? 'Goles Rec.' : 'Fallos'}
                </div>
            </div>
        </>
    );

    if (!showContainer) return content;

    return (
        <div className="flex flex-col items-center bg-slate-800/50 p-4 sm:p-6 rounded-3xl border border-white/5 shadow-2xl w-full">
            {content}
        </div>
    );
});
