import React from 'react';
import { COURT_ZONES } from '../constants.ts';
import { ShotZone } from '../types.ts';

interface ZoneStats {
  goals: number;
  total: number;
}

interface CourtSVGProps {
  onZoneClick?: (zone: ShotZone) => void;
  flipped?: boolean;
  zoneStats?: Partial<Record<ShotZone, ZoneStats>>;
  readOnly?: boolean;
}

export const CourtSVG: React.FC<CourtSVGProps> = ({ onZoneClick, flipped = false, zoneStats, readOnly = false }) => {

  const getZoneStyle = (zone: ShotZone, isFlipped: boolean) => {
    let baseClass = '';

    switch (zone) {
      case ShotZone.WING_L:
      case ShotZone.WING_R:
        baseClass = 'bg-emerald-500/20 border-emerald-500/30 text-emerald-100';
        break;
      case ShotZone.SIX_M_L:
      case ShotZone.SIX_M_C:
      case ShotZone.SIX_M_R:
        baseClass = 'bg-amber-500/20 border-amber-500/30 text-amber-100';
        break;
      case ShotZone.NINE_M_L:
      case ShotZone.NINE_M_C:
      case ShotZone.NINE_M_R:
        baseClass = 'bg-indigo-500/20 border-indigo-500/30 text-indigo-100';
        break;
      case ShotZone.SEVEN_M:
        baseClass = 'bg-fuchsia-500/30 border-fuchsia-500/40 text-fuchsia-100';
        break;
      default:
        baseClass = 'bg-slate-500/20 border-slate-500/20';
    }

    if (readOnly) {
      return `${baseClass} cursor-default`;
    }

    const hoverClass = isFlipped
      ? 'hover:bg-red-500/40 hover:border-red-400/50'
      : 'hover:bg-opacity-40 hover:border-white/30 hover:backdrop-blur-[2px]';

    return `${baseClass} ${hoverClass}`;
  };

  const activeClass = !readOnly
    ? (flipped ? 'active:bg-red-500/60 active:scale-[0.98]' : 'active:scale-[0.98] active:brightness-125')
    : '';

  const handleZoneClick = (zoneId: ShotZone) => {
    if (!readOnly && onZoneClick) {
      onZoneClick(zoneId);
    }
  };

  const renderZoneStats = (stats: ZoneStats) => (
    <div className="flex flex-col items-center leading-none bg-slate-900/80 p-1 rounded backdrop-blur-sm border border-white/10">
      <div className="flex gap-0.5 text-xs font-black">
        <span className="text-green-400">{stats.goals}</span>
        <span className="text-white opacity-50">/</span>
        <span className="text-white">{stats.total}</span>
      </div>
      {stats.total > 0 && (
        <span className={`text-[8px] font-bold ${stats.goals / stats.total > 0.5 ? 'text-green-300' : 'text-orange-300'}`}>
          {Math.round((stats.goals / stats.total) * 100)}%
        </span>
      )}
    </div>
  );

  const fbStats = zoneStats ? zoneStats[ShotZone.FASTBREAK] : undefined;

  return (
    <div className="relative w-full aspect-[4/3] bg-slate-900 overflow-hidden rounded-lg border-2 border-slate-700 shadow-xl group/court select-none">
      <svg width="100%" height="100%" viewBox="0 0 100 100" className={`absolute inset-0 pointer-events-none transition-transform duration-500 ease-in-out ${flipped ? 'rotate-180' : ''} z-0`}>
        <rect x="0" y="0" width="100" height="100" fill="#1e293b" opacity="0.5" />
        <path d="M 10,0 V 10 Q 10,35 50,35 Q 90,35 90,10 V 0" fill="none" stroke="#fcd34d" strokeWidth="0.5" opacity="0.5" />
        <path d="M 5,0 V 15 Q 5,50 50,50 Q 95,50 95,15 V 0" fill="none" stroke="#fff" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
        <line x1="48" y1="27" x2="52" y2="27" stroke="#fff" strokeWidth="1" opacity="0.5" />
        <line x1="48" y1="15" x2="52" y2="15" stroke="#fff" strokeWidth="1" opacity="0.5" />
        <line x1="0" y1="100" x2="100" y2="100" stroke="#fff" strokeWidth="1" />
        <rect x="40" y="-2" width="20" height="2" fill="#000" />
      </svg>

      <div className={`absolute inset-0 transition-transform duration-500 ease-in-out ${flipped ? 'rotate-180' : ''} z-10`}>
        {COURT_ZONES.map((zone) => {
          const stats = zoneStats ? zoneStats[zone.id] : undefined;
          return (
            <button
              key={zone.id}
              onClick={() => handleZoneClick(zone.id)}
              disabled={readOnly}
              type="button"
              className={`group absolute flex items-center justify-center outline-none touch-manipulation
                  transition-all duration-200 ease-out border
                  ${getZoneStyle(zone.id, flipped)}
                  ${activeClass}
                `}
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
              }}
            >
              <span className={`
                  pointer-events-none
                  font-black uppercase tracking-wider 
                  transition-all duration-300 ease-out
                  drop-shadow-md
                  ${flipped ? 'rotate-180' : ''}
                  ${stats ? 'opacity-100 scale-100' : 'opacity-60 scale-90 group-hover:opacity-100 group-hover:scale-100 text-[10px] sm:text-xs'}
                `}>
                {stats ? renderZoneStats(stats) : zone.label}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => handleZoneClick(ShotZone.FASTBREAK)}
          disabled={readOnly}
          type="button"
          className={`absolute left-[50%] -translate-x-1/2 top-[65%] px-4 py-1.5 flex flex-col items-center justify-center text-xs font-bold rounded-xl transition-all duration-200 ease-out border-2 shadow-lg ${!readOnly ? 'active:scale-95 active:duration-75' : ''}
              ${flipped
              ? 'rotate-180 bg-red-900/60 hover:bg-red-600 text-red-100 border-red-400/30 hover:border-red-300'
              : 'bg-handball-orange/60 hover:bg-handball-orange text-orange-100 border-orange-400/30 hover:border-orange-300'
            }
            `}
        >
          {fbStats ? (
            <div className={`flex items-center gap-2 ${flipped ? 'rotate-180' : ''}`}>
              <span className="uppercase text-[10px] opacity-80 mr-1">Contra</span>
              <div className="flex gap-0.5 font-black bg-black/20 px-1.5 rounded">
                <span className="text-green-300">{fbStats.goals}</span>
                <span className="text-white opacity-50">/</span>
                <span className="text-white">{fbStats.total}</span>
              </div>
            </div>
          ) : (
            <span className={`drop-shadow-md uppercase tracking-widest ${flipped ? 'rotate-180' : ''}`}>Contraataque</span>
          )}
        </button>
      </div>

      {flipped && (
        <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[10px] px-3 py-1.5 rounded-md pointer-events-none uppercase font-black tracking-widest shadow-lg backdrop-blur-md border border-red-400/50 z-20">
          Ataque Rival
        </div>
      )}
    </div>
  );
};