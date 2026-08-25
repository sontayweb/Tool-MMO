'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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

  // Fallback demo/simulation data if backend returns empty or loading
  const fallbackData = [
    { date: '01/08', available: 52000, sold: 1200, imported: 3500 },
    { date: '05/08', available: 53500, sold: 1800, imported: 4200 },
    { date: '10/08', available: 54800, sold: 2400, imported: 5100 },
    { date: '15/08', available: 56200, sold: 3100, imported: 4800 },
    { date: '20/08', available: 57500, sold: 3700, imported: 6200 },
    { date: '25/08', available: 58100, sold: 4100, imported: 7500 },
  ];

  const chartData = data && data.length > 0 ? data : fallbackData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950/95 border border-purple-500/30 rounded-2xl p-3 shadow-2xl text-xs font-mono backdrop-blur-md">
          <div className="text-zinc-400 font-bold mb-1.5 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-purple-400" />
            <span>Ngày {label}</span>
          </div>
          <div className="space-y-1">
            <div className="text-emerald-400 font-semibold flex justify-between gap-4">
              <span>Sẵn sàng:</span>
              <span>{payload[0]?.value?.toLocaleString('vi-VN')} TK</span>
            </div>
            <div className="text-cyan-400 font-semibold flex justify-between gap-4">
              <span>Đã bán:</span>
              <span>{payload[1]?.value?.toLocaleString('vi-VN')} TK</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-card rounded-2xl p-5 space-y-4 border border-[var(--border-subtle)] shadow-xl">
      {/* Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-sm text-title flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
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

      {/* Chart Area */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorSold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
            <YAxis
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="available"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAvailable)"
              name="Tồn Kho (Available)"
            />
            <Area
              type="monotone"
              dataKey="sold"
              stroke="#06b6d4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSold)"
              name="Đã Bán (Sold)"
            />
          </AreaChart>
        </ResponsiveContainer>
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
        <div className="flex items-center gap-1 text-purple-400 font-semibold font-mono">
          <Sparkles className="w-3 h-3" />
          <span>Tốc độ quay vòng kho: +14.2%/tháng</span>
        </div>
      </div>
    </div>
  );
};
