'use client';

import React, { useState } from 'react';
import { TrendingUp, Calendar, Sparkles } from 'lucide-react';

interface SalesChartProps {
  data?: Array<{
    date: string;
    available: number;
    sold: number;
    imported: number;
  }>;
}

export const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const fallbackData = [
    { date: '01/08', available: 52000, sold: 1200, imported: 3500 },
    { date: '05/08', available: 53500, sold: 1800, imported: 4200 },
    { date: '10/08', available: 54800, sold: 2400, imported: 5100 },
    { date: '15/08', available: 56200, sold: 3100, imported: 4800 },
    { date: '20/08', available: 57500, sold: 3700, imported: 6200 },
    { date: '25/08', available: 58100, sold: 4100, imported: 7500 },
  ];

  const chartData = (data && Array.isArray(data) && data.length > 0) ? data : fallbackData;

  // Compute SVG viewBox dimensions
  const width = 600;
  const height = 200;
  const paddingX = 40;
  const paddingY = 25;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const maxVal = Math.max(...chartData.map((d) => Math.max(d.available || 0, d.sold || 0, 100)), 1000);

  // Generate SVG Area and Line paths
  const pointsAvailable = chartData.map((d, i) => {
    const x = paddingX + (i / Math.max(chartData.length - 1, 1)) * chartW;
    const y = height - paddingY - ((d.available || 0) / maxVal) * chartH;
    return { x, y, ...d };
  });

  const pointsSold = chartData.map((d, i) => {
    const x = paddingX + (i / Math.max(chartData.length - 1, 1)) * chartW;
    const y = height - paddingY - ((d.sold || 0) / maxVal) * chartH;
    return { x, y, ...d };
  });

  const makeAreaPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    const lineParts = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return `${lineParts} L ${last.x.toFixed(1)} ${(height - paddingY).toFixed(1)} L ${first.x.toFixed(1)} ${(height - paddingY).toFixed(1)} Z`;
  };

  const makeLinePath = (pts: Array<{ x: number; y: number }>) => {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  };

  const areaAvailablePath = makeAreaPath(pointsAvailable);
  const lineAvailablePath = makeLinePath(pointsAvailable);
  const areaSoldPath = makeAreaPath(pointsSold);
  const lineSoldPath = makeLinePath(pointsSold);

  return (
    <div className="app-card rounded-2xl p-5 space-y-4 border border-[var(--border-subtle)] shadow-xl relative">
      {/* Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-sm text-title flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span>Biến Động Tồn Kho & Xu Hướng Xuất Bán</span>
          </h3>
          <p className="text-xs text-desc mt-0.5">
            Theo dõi khối lượng nhập kho và lượng nick tiêu thụ theo thời gian thực.
          </p>
        </div>

        {/* Period Pills */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-[var(--border-subtle)] self-start sm:self-auto">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                period === p
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-desc hover:text-title'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative w-full h-56 flex items-center justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="gradientAvailable" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradientSold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = height - paddingY - ratio * chartH;
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="currentColor"
                  className="text-black/5 dark:text-white/5"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-400 text-[9px] font-mono select-none"
                >
                  {Math.round((maxVal * ratio) / 1000)}k
                </text>
              </g>
            );
          })}

          {/* Area Fills */}
          <path d={areaAvailablePath} fill="url(#gradientAvailable)" />
          <path d={areaSoldPath} fill="url(#gradientSold)" />

          {/* Line Strokes */}
          <path d={lineAvailablePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
          <path d={lineSoldPath} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />

          {/* Interactive Data Points */}
          {pointsAvailable.map((pt, idx) => (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredIdx === idx ? 6 : 4}
                className="fill-emerald-500 transition-all duration-150"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <circle
                cx={pointsSold[idx].x}
                cy={pointsSold[idx].y}
                r={hoveredIdx === idx ? 6 : 4}
                className="fill-cyan-500 transition-all duration-150"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              {/* X Axis Date Label */}
              <text
                x={pt.x}
                y={height - 5}
                textAnchor="middle"
                className="fill-zinc-400 text-[10px] font-mono select-none"
              >
                {pt.date}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredIdx !== null && pointsAvailable[hoveredIdx] && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-950/95 text-white border border-purple-500/40 rounded-2xl p-3 shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-100"
            style={{
              left: `${(pointsAvailable[hoveredIdx].x / width) * 100}%`,
              top: '10%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="text-zinc-400 font-bold mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-purple-400" />
              <span>Ngày {pointsAvailable[hoveredIdx].date}</span>
            </div>
            <div className="space-y-1">
              <div className="text-emerald-400 font-semibold flex justify-between gap-4">
                <span>Sẵn sàng:</span>
                <span>{Number(pointsAvailable[hoveredIdx].available || 0).toLocaleString('vi-VN')} TK</span>
              </div>
              <div className="text-cyan-400 font-semibold flex justify-between gap-4">
                <span>Đã bán:</span>
                <span>{Number(pointsAvailable[hoveredIdx].sold || 0).toLocaleString('vi-VN')} TK</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[var(--border-subtle)] text-xs text-desc">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Tồn kho sẵn sàng</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span>Lượng nick đã xuất bán</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-purple-500 dark:text-purple-400 font-semibold font-mono">
          <Sparkles className="w-3 h-3" />
          <span>Tốc độ quay vòng kho: +14.2%/tháng</span>
        </div>
      </div>
    </div>
  );
};
