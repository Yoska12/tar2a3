import React, { useState } from 'react';

export interface RadarDataPoint {
  category: string;
  value: number; // 0 - 100
  fullMark: number;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  size = 320,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const center = size / 2;
  const radius = (size / 2) - 45;
  const numAxes = data.length;

  // زوايا الرؤوس الخمسة
  const getAngle = (index: number) => {
    return (index * (2 * Math.PI / numAxes)) - (Math.PI / 2);
  };

  // إحداثيات نقطة بقيمة محددة
  const getCoordinates = (value: number, index: number) => {
    const angle = getAngle(index);
    const normalized = Math.max(0, Math.min(100, value)) / 100;
    const r = radius * normalized;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // توليد مسار مضلع (Polygon path) لشبكة الخلفية
  const generatePolygonPath = (levelRatio: number) => {
    return data
      .map((_, i) => {
        const angle = getAngle(i);
        const r = radius * levelRatio;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(' ');
  };

  // نقاط مضلع أداء الطالب
  const studentPolygonPoints = data
    .map((d, i) => {
      const coords = getCoordinates(d.value, i);
      return `${coords.x},${coords.y}`;
    })
    .join(' ');

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <svg
        width={size}
        height={size}
        className="overflow-visible transition-all duration-300"
      >
        <defs>
          {/* تدرج لوني ذهبي مميز لهوية طرقع */}
          <linearGradient id="tarqaRadarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#d97706" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0.2" />
          </linearGradient>

          {/* توهج ذهبي ناعم */}
          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* 1. حلقات الشبكة الخلفية (Concentric Polygons) */}
        {[0.25, 0.5, 0.75, 1.0].map((level, idx) => (
          <polygon
            key={idx}
            points={generatePolygonPath(level)}
            fill={level === 1.0 ? 'rgba(245, 158, 11, 0.03)' : 'none'}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth={level === 1.0 ? '1.5' : '1'}
            strokeDasharray={level < 1.0 ? '3 3' : undefined}
          />
        ))}

        {/* 2. محاور الأقسام (Axes Lines) */}
        {data.map((_, i) => {
          const outer = getCoordinates(100, i);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800/80"
              strokeWidth="1"
            />
          );
        })}

        {/* 3. مضلع أداء الطالب (Student Performance Area) */}
        <polygon
          points={studentPolygonPoints}
          fill="url(#tarqaRadarGradient)"
          stroke="#f59e0b"
          strokeWidth="2.5"
          filter="url(#goldGlow)"
          className="transition-all duration-500 ease-out"
        />

        {/* 4. نقاط الرؤوس التفاعلية (Interactive Vertices) */}
        {data.map((d, i) => {
          const coords = getCoordinates(d.value, i);
          const isHovered = hoveredIndex === i;

          return (
            <g key={i}>
              <circle
                cx={coords.x}
                cy={coords.y}
                r={isHovered ? 6.5 : 4.5}
                fill={isHovered ? '#ffffff' : '#f59e0b'}
                stroke="#d97706"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          );
        })}

        {/* 5. تسميات الأقسام (Labels) */}
        {data.map((d, i) => {
          const angle = getAngle(i);
          const labelR = radius + 26;
          const x = center + labelR * Math.cos(angle);
          const y = center + labelR * Math.sin(angle);

          // ضبط المحاذاة حسب الموقع
          let textAnchor: 'middle' | 'start' | 'end' = 'middle';
          if (Math.cos(angle) > 0.3) textAnchor = 'start';
          else if (Math.cos(angle) < -0.3) textAnchor = 'end';

          const isHovered = hoveredIndex === i;

          return (
            <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
              <text
                x={x}
                y={y}
                textAnchor={textAnchor}
                className={`text-[11px] font-bold transition-colors ${
                  isHovered 
                    ? 'fill-amber-500 dark:fill-amber-400 font-black' 
                    : 'fill-slate-600 dark:fill-slate-300'
                }`}
              >
                {d.category}
              </text>
              <text
                x={x}
                y={y + 13}
                textAnchor={textAnchor}
                className="text-[10px] font-mono font-bold fill-amber-500"
              >
                {d.value}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* شريحة التوضيح عند التمرير */}
      {hoveredIndex !== null && (
        <div className="absolute top-2 px-3 py-1 rounded-full bg-slate-900/90 dark:bg-slate-800/90 text-white text-xs font-bold shadow-lg border border-amber-500/30 flex items-center gap-2 animate-in fade-in duration-150">
          <span>{data[hoveredIndex].category}:</span>
          <span className="text-amber-400 font-mono">{data[hoveredIndex].value}% إتقان</span>
        </div>
      )}
    </div>
  );
};
