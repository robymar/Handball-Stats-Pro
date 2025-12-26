import React from 'react';
import { ShotPlacement } from '../types.ts';

interface GoalSVGProps {
  onPlacementClick: (placement: ShotPlacement) => void;
}

export const GoalSVG: React.FC<GoalSVGProps> = ({ onPlacementClick }) => {
  const zones = [
    { id: ShotPlacement.TOP_LEFT, x: 0, y: 0, label: '↗' },
    { id: ShotPlacement.TOP_CENTER, x: 33.3, y: 0, label: '↑' },
    { id: ShotPlacement.TOP_RIGHT, x: 66.6, y: 0, label: '↖' },
    { id: ShotPlacement.MID_LEFT, x: 0, y: 33.3, label: '→' },
    { id: ShotPlacement.MID_CENTER, x: 33.3, y: 33.3, label: '•' },
    { id: ShotPlacement.MID_RIGHT, x: 66.6, y: 33.3, label: '←' },
    { id: ShotPlacement.LOW_LEFT, x: 0, y: 66.6, label: '↘' },
    { id: ShotPlacement.LOW_CENTER, x: 33.3, y: 66.6, label: '↓' },
    { id: ShotPlacement.LOW_RIGHT, x: 66.6, y: 66.6, label: '↙' },
  ];

  return (
    <div className="relative w-full aspect-[3/2] bg-slate-800/50 rounded-xl overflow-hidden border-2 border-slate-700 p-4">
      {/* Goal Frame Visual */}
      <div className="absolute inset-4 border-[8px] border-white border-b-0 flex">
         <div className="w-full h-full relative bg-white/5 grid grid-cols-3 grid-rows-3">
             {/* Net pattern */}
             <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 pointer-events-none opacity-20">
                 {Array.from({ length: 96 }).map((_, i) => (
                     <div key={i} className="border-[0.5px] border-slate-300"></div>
                 ))}
             </div>

             {zones.map(zone => (
                 <button
                     key={zone.id}
                     onClick={() => onPlacementClick(zone.id)}
                     className="relative flex items-center justify-center text-2xl font-black text-white/0 hover:text-white/80 hover:bg-white/20 transition-all active:bg-white/40 border border-white/10"
                 >
                     {zone.label}
                 </button>
             ))}
         </div>
      </div>
       {/* Floor Line */}
      <div className="absolute bottom-4 left-2 right-2 h-[8px] bg-handball-blue/50 rounded-full"></div>
    </div>
  );
};