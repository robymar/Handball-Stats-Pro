import React from 'react';

// Bar Chart Component - Horizontal bars for comparing values
interface BarChartProps {
    data: { label: string; value: number; max?: number; color?: string }[];
    height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({ data, height = 200 }) => {
    const maxValue = Math.max(...data.map(d => d.max || d.value), 1);
    const barHeight = Math.max(20, (height - data.length * 8) / data.length);

    return (
        <div className="w-full" style={{ height: `${height}px` }}>
            {data.map((item, idx) => {
                const percentage = (item.value / maxValue) * 100;
                return (
                    <div key={idx} className="mb-2 last:mb-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-400 font-medium truncate">{item.label}</span>
                            <span className="text-white font-bold ml-2">{item.value}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full overflow-hidden" style={{ height: `${Math.min(barHeight, 24)}px` }}>
                            <div
                                className={`h-full transition-all duration-500 ${item.color || 'bg-handball-blue'}`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Donut Chart Component - For percentage distributions
interface DonutChartProps {
    data: { label: string; value: number; color: string }[];
    size?: number;
    centerText?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, size = 160, centerText }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
        return (
            <div className="flex items-center justify-center text-slate-500 italic text-sm" style={{ height: size }}>
                Sin datos
            </div>
        );
    }

    const radius = size / 2 - 10;
    const innerRadius = radius * 0.6;
    const center = size / 2;

    let currentAngle = -90; // Start at top

    const slices = data.map((item, idx) => {
        const percentage = (item.value / total) * 100;
        const angle = (item.value / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;

        currentAngle = endAngle;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        const ix1 = center + innerRadius * Math.cos(startRad);
        const iy1 = center + innerRadius * Math.sin(startRad);
        const ix2 = center + innerRadius * Math.cos(endRad);
        const iy2 = center + innerRadius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        const pathData = [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${ix2} ${iy2}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
            'Z'
        ].join(' ');

        return (
            <g key={idx}>
                <path d={pathData} fill={item.color} className="transition-opacity hover:opacity-80" />
            </g>
        );
    });

    return (
        <div className="flex flex-col items-center gap-3">
            <svg width={size} height={size} className="transform -rotate-0">
                {slices}
                {centerText && (
                    <text
                        x={center}
                        y={center}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white font-bold text-xl"
                    >
                        {centerText}
                    </text>
                )}
            </svg>
            <div className="flex flex-wrap gap-2 justify-center">
                {data.map((item, idx) => {
                    const percentage = ((item.value / total) * 100).toFixed(0);
                    return (
                        <div key={idx} className="flex items-center gap-1.5 text-xs">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-slate-400">{item.label}</span>
                            <span className="text-white font-bold">{percentage}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Radar Chart Component - For multi-dimensional player stats
interface RadarChartProps {
    data: { label: string; value: number; max: number }[];
    size?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({ data, size = 200 }) => {
    if (data.length === 0) return null;

    const center = size / 2;
    const radius = size / 2 - 30;
    const levels = 5;

    // Calculate points for the data polygon
    const points = data.map((item, idx) => {
        const angle = (Math.PI * 2 * idx) / data.length - Math.PI / 2;
        const value = item.max > 0 ? item.value / item.max : 0;
        const x = center + radius * value * Math.cos(angle);
        const y = center + radius * value * Math.sin(angle);
        return { x, y, angle, label: item.label };
    });

    const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

    // Grid circles
    const gridCircles = Array.from({ length: levels }, (_, i) => {
        const r = (radius * (i + 1)) / levels;
        return <circle key={i} cx={center} cy={center} r={r} fill="none" stroke="#334155" strokeWidth="1" />;
    });

    // Axis lines
    const axisLines = data.map((_, idx) => {
        const angle = (Math.PI * 2 * idx) / data.length - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        return <line key={idx} x1={center} y1={center} x2={x} y2={y} stroke="#334155" strokeWidth="1" />;
    });

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size}>
                {gridCircles}
                {axisLines}
                <polygon points={polygonPoints} fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" strokeWidth="2" />
                {points.map((point, idx) => (
                    <circle key={idx} cx={point.x} cy={point.y} r="4" fill="#3b82f6" />
                ))}
            </svg>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                {data.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                        <span className="text-slate-400">{item.label}:</span>
                        <span className="text-white font-bold ml-1">{item.value}/{item.max}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Mini Bar for table cells
interface MiniBarProps {
    value: number;
    max: number;
    color?: string;
}

export const MiniBar: React.FC<MiniBarProps> = ({ value, max, color = 'bg-handball-blue' }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
        </div>
    );
};

// Score Difference Chart (Momentum)
interface ScoreDiffChartProps {
    events: any[]; // MatchEvent[]
    height?: number;
}

export const ScoreDifferenceChart: React.FC<ScoreDiffChartProps> = ({ events, height = 150 }) => {
    // 1. Sort events chronologically
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    // 2. Build data points: [time ratio (0-1), score diff]
    // We assume standard game is approx 3600s (60m). We'll scale x to the last event or max time.
    let currentDiff = 0;
    const points: { time: number; diff: number }[] = [{ time: 0, diff: 0 }];

    let maxTime = 1;

    sortedEvents.forEach(e => {
        // Update diff
        if (e.type === 'SHOT' && e.shotOutcome === 'GOAL') {
            // We scored
            currentDiff += 1;
            points.push({ time: e.timestamp, diff: currentDiff });
        } else if (e.type === 'OPPONENT_GOAL') {
            // Opponent scored
            currentDiff -= 1;
            points.push({ time: e.timestamp, diff: currentDiff });
        }
        maxTime = Math.max(maxTime, e.timestamp);
    });

    if (points.length <= 1) {
        return (
            <div className="flex items-center justify-center text-slate-500 italic text-sm" style={{ height }}>
                Sin datos de goles
            </div>
        );
    }

    // 3. Scale Points to SVG
    // Y-Axis: Find min/max diff to center the graph
    const diffs = points.map(p => p.diff);
    // Add some padding to min/max so lines don't touch edges exactly
    const minDiff = Math.min(0, ...diffs) - 2;
    const maxDiff = Math.max(0, ...diffs) + 2;
    const range = maxDiff - minDiff;

    const width = 1000; // Internal SVG coordinate width
    const svgHeight = height;

    // Helper to map Point -> SVG Coord
    const getCoord = (t: number, d: number) => {
        const x = (t / maxTime) * width;
        // Y grows downwards in SVG, so we invert. 
        // If d = maxDiff, y should be close to 0 (top).
        // If d = minDiff, y should be close to height (bottom).
        // Normalized d (0 to 1) from min to max: (d - minDiff) / range
        // Inverted for SVG y: 1 - normalized
        const normalizedY = 1 - (d - minDiff) / range;
        const y = normalizedY * svgHeight;
        return { x, y };
    };

    // Zero Line (Where diff = 0)
    const zeroY = getCoord(0, 0).y;

    // Build Path
    let dPath = '';
    points.forEach((p, i) => {
        const { x, y } = getCoord(p.time, p.diff);
        // Step Line logic (optional) or direct line. Handball scores are discrete steps.
        // Let's do a "Step-After" look: horizontal then vertical? 
        // Or just straightforward line for "momentum" feel. Direct line is smoother for "momentum".
        // Let's do Step for accuracy.
        if (i === 0) {
            dPath += `M ${x} ${y}`;
        } else {
            // Previous point
            const prev = points[i - 1];
            const prevCoord = getCoord(prev.time, prev.diff);
            // Draw horizontal from prev to current X, then vertical to current Y?
            // Actually, the score changes AT p.time.
            // So we stay at prev Y until p.time, then jump to new Y.
            // L {x} {prevCoord.y} L {x} {y}
            dPath += ` L ${x} ${prevCoord.y} L ${x} ${y}`;
        }
    });

    return (
        <div className="w-full bg-slate-800/50 rounded-lg p-2 backdrop-blur-sm border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-2 font-medium flex justify-between">
                <span>Diferencia de Goles (Minuto a Minuto)</span>
                {currentDiff > 0 ? <span className="text-green-400">+{currentDiff}</span> :
                    currentDiff < 0 ? <span className="text-red-400">{currentDiff}</span> :
                        <span className="text-slate-200">Empate</span>}
            </div>
            <svg viewBox={`0 0 ${width} ${svgHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none" style={{ height: svgHeight }}>
                {/* Zero Line */}
                <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />

                {/* Main Path */}
                <path d={dPath} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" />

                {/* End Point Dot */}
                {points.length > 0 && (
                    <circle
                        cx={getCoord(points[points.length - 1].time, points[points.length - 1].diff).x}
                        cy={getCoord(points[points.length - 1].time, points[points.length - 1].diff).y}
                        r="3"
                        fill="#60a5fa"
                    />
                )}
            </svg>
        </div>
    );
};
