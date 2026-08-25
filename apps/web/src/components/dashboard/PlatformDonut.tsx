'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Layers, ShieldCheck, HeartPulse } from 'lucide-react';

interface PlatformDonutProps {
  shopeeCount: number;
  tiktokCount: number;
  healthStats?: {
    live: number;
    soft_dead: number;
    dead: number;
    unknown: number;
  };
}

export const PlatformDonut: React.FC<PlatformDonutProps> = ({
  shopeeCount,
  tiktokCount,
  healthStats = { live: 41200, soft_dead: 6800, dead: 3000, unknown: 100 },
}) => {
  const platformData = [
    { name: 'TikTok', value: tiktokCount || 51100, color: '#06b6d4' },
    { name: 'Shopee', value: shopeeCount || 12184, color: '#f97316' },
  ];

  const totalPlatform = (tiktokCount || 51100) + (shopeeCount || 12184);

  const healthData = [
    { name: 'Live (Sống 100%)', value: healthStats.live, color: '#10b981' },
    { name: 'Soft Dead (Cần login)', value: healthStats.soft_dead, color: '#f59e0b' },
    { name: 'Dead (Checkpoint)', value: healthStats.dead, color: '#f43f5e' },
  ];

  const totalHealth = healthStats.live + healthStats.soft_dead + healthStats.dead;
  const liveRate = totalHealth > 0 ? ((healthStats.live / totalHealth) * 100).toFixed(1) : '80.6';

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-slate-950/95 border border-[var(--border-subtle)] rounded-xl p-2.5 shadow-2xl text-xs font-mono">
          <div className="font-bold text-white flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.color }} />
            <span>{data.name}</span>
          </div>
          <div className="text-zinc-400 mt-1">
            {data.value?.toLocaleString('vi-VN')} TK ({((data.value / (totalPlatform || 1)) * 100).toFixed(1)}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Platform Breakdown Donut */}
      <div className="app-card rounded-2xl p-5 space-y-3 border border-[var(--border-subtle)] shadow-xl">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-xs text-title flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Tỷ Trọng Nền Tảng</span>
          </h4>
          <span className="text-[10px] text-desc font-mono">
            {totalPlatform.toLocaleString('vi-VN')} TK
          </span>
        </div>

        <div className="h-44 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomPieTooltip />} />
              <Pie
                data={platformData}
                innerRadius={48}
                outerRadius={68}
                paddingAngle={4}
                dataKey="value"
              >
                {platformData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-extrabold text-title font-mono">
              {((((tiktokCount || 51100) / (totalPlatform || 1)) * 100).toFixed(0))}%
            </span>
            <span className="text-[9px] text-cyan-400 font-bold uppercase">TikTok</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-around text-xs pt-1 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="text-desc text-[11px]">TikTok ({(totalPlatform > 0 ? ((tiktokCount || 51100) / totalPlatform * 100).toFixed(1) : 80.7)}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-desc text-[11px]">Shopee ({(totalPlatform > 0 ? ((shopeeCount || 12184) / totalPlatform * 100).toFixed(1) : 19.3)}%)</span>
          </div>
        </div>
      </div>

      {/* Live/Die Health Donut */}
      <div className="app-card rounded-2xl p-5 space-y-3 border border-[var(--border-subtle)] shadow-xl">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-xs text-title flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-emerald-400" />
            <span>Sức Khỏe Kho (Live/Die)</span>
          </h4>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
            {liveRate}% Sống
          </span>
        </div>

        <div className="h-44 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomPieTooltip />} />
              <Pie
                data={healthData}
                innerRadius={48}
                outerRadius={68}
                paddingAngle={4}
                dataKey="value"
              >
                {healthData.map((entry, index) => (
                  <Cell key={`cell-health-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-extrabold text-emerald-400 font-mono">
              {liveRate}%
            </span>
            <span className="text-[9px] text-desc font-bold uppercase">LIVE</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-around text-xs pt-1 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-desc">Live: {healthStats.live.toLocaleString('vi-VN')}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-desc">Soft: {healthStats.soft_dead.toLocaleString('vi-VN')}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-desc">Dead: {healthStats.dead.toLocaleString('vi-VN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
