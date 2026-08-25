'use client';

import React from 'react';
import { PieChart as PieIcon, Activity, ShoppingBag, Music2 } from 'lucide-react';

interface PlatformDonutProps {
  shopeeCount?: number;
  tiktokCount?: number;
  healthStats?: {
    live?: number;
    soft_dead?: number;
    dead?: number;
    unknown?: number;
  };
  stats?: {
    total?: number;
    available?: number;
    sold?: number;
    used?: number;
    blacklist?: number;
    shopee?: number;
    tiktok?: number;
    health?: {
      live?: number;
      soft_dead?: number;
      dead?: number;
    };
  };
}

export const PlatformDonut: React.FC<PlatformDonutProps> = ({
  shopeeCount: propShopee,
  tiktokCount: propTiktok,
  healthStats: propHealth,
  stats,
}) => {
  const tiktokCount = propTiktok ?? stats?.tiktok ?? 0;
  const shopeeCount = propShopee ?? stats?.shopee ?? 0;
  const totalPlatform = Math.max(tiktokCount + shopeeCount, 1);

  const tiktokRate = Math.round((tiktokCount / totalPlatform) * 100);
  const shopeeRate = 100 - tiktokRate;

  const healthStats = {
    live: propHealth?.live ?? stats?.health?.live ?? 0,
    soft_dead: propHealth?.soft_dead ?? stats?.health?.soft_dead ?? 0,
    dead: propHealth?.dead ?? stats?.health?.dead ?? 0,
  };
  const totalHealth = Math.max(healthStats.live + healthStats.soft_dead + healthStats.dead, 1);
  const liveRate = Math.round((healthStats.live / totalHealth) * 100);

  // SVG Circle Geometry
  const size = 130;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Platform Dash offsets
  const tiktokDash = (tiktokRate / 100) * circumference;
  const shopeeDash = circumference - tiktokDash;

  // Health Dash offsets
  const liveDash = ((healthStats.live || 0) / totalHealth) * circumference;
  const softDash = ((healthStats.soft_dead || 0) / totalHealth) * circumference;
  const deadDash = circumference - liveDash - softDash;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Nền Tảng: TikTok vs Shopee */}
      <div className="app-card rounded-2xl p-4 border border-[var(--border-subtle)] space-y-3 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <PieIcon className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            </div>
            <span className="font-bold text-xs text-title">Tỷ Trọng Nền Tảng</span>
          </div>
          <span className="text-[10px] font-mono text-desc">{(stats?.total || 0).toLocaleString('vi-VN')} TK</span>
        </div>

        {/* Donut Graphic */}
        <div className="relative flex items-center justify-center py-2">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              className="text-black/5 dark:text-white/5"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Shopee Segment (Orange) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#f97316"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
            {/* TikTok Segment (Cyan) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#06b6d4"
              strokeWidth={strokeWidth}
              strokeDasharray={`${tiktokDash} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-extrabold text-title font-mono">
              {tiktokRate}%
            </span>
            <span className="text-[9px] text-cyan-500 dark:text-cyan-400 font-bold uppercase">TIKTOK</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-around text-xs pt-1 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-desc">TikTok ({tiktokRate}%)</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-desc">Shopee ({shopeeRate}%)</span>
          </div>
        </div>
      </div>

      {/* 2. Sức Khỏe Tài Khoản (Health Status) */}
      <div className="app-card rounded-2xl p-4 border border-[var(--border-subtle)] space-y-3 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <span className="font-bold text-xs text-title">Sức Khỏe Cookie / Token</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-bold">Auto-Check</span>
        </div>

        {/* Health Donut Graphic */}
        <div className="relative flex items-center justify-center py-2">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              className="text-black/5 dark:text-white/5"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Dead Segment (Rose) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#f43f5e"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
            {/* Soft Dead Segment (Amber) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#f59e0b"
              strokeWidth={strokeWidth}
              strokeDasharray={`${liveDash + softDash} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
            {/* Live Segment (Emerald) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#10b981"
              strokeWidth={strokeWidth}
              strokeDasharray={`${liveDash} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-extrabold text-emerald-500 dark:text-emerald-400 font-mono">
              {liveRate}%
            </span>
            <span className="text-[9px] text-desc font-bold uppercase">LIVE</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-around text-xs pt-1 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-desc">Live: {(healthStats.live || 0).toLocaleString('vi-VN')}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-desc">Soft: {(healthStats.soft_dead || 0).toLocaleString('vi-VN')}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-desc">Dead: {(healthStats.dead || 0).toLocaleString('vi-VN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
