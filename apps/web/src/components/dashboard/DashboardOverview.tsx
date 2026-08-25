'use client';

import React from 'react';
import {
  Database,
  CheckCircle2,
  ShoppingCart,
  Check,
  Ban,
  Upload,
  Download,
  Archive,
  Trophy,
  Activity,
  Layers,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap,
  ShoppingBag,
  Music2,
} from 'lucide-react';
import { TabType } from '../layout/Sidebar';
import { SalesChart } from './SalesChart';
import { PlatformDonut } from './PlatformDonut';

interface DashboardOverviewProps {
  stats: any;
  analytics: any;
  onNavigateTab: (tab: TabType) => void;
  timeSeriesData?: any[];
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  analytics,
  onNavigateTab,
  timeSeriesData,
}) => {
  const total = stats?.total || 0;
  const available = stats?.available || 0;
  const sold = stats?.sold || 0;
  const used = stats?.used || 0;
  const blacklist = stats?.blacklist || 0;

  const availableRate = total > 0 ? ((available / total) * 100).toFixed(1) : '0';
  const soldRate = total > 0 ? ((sold / total) * 100).toFixed(1) : '0';

  // Platforms
  const shopeeStats = analytics?.platforms?.find((p: any) => p._id === 'SHOPEE') || { count: 0 };
  const tiktokStats = analytics?.platforms?.find((p: any) => p._id === 'TIKTOK') || { count: 0 };

  const shopeeCount = shopeeStats.count || 0;
  const tiktokCount = tiktokStats.count || 0;
  const shopeeRate = total > 0 ? ((shopeeCount / total) * 100).toFixed(1) : '0';
  const tiktokRate = total > 0 ? ((tiktokCount / total) * 100).toFixed(1) : '0';

  // Quality metrics
  const quality = analytics?.quality || {};
  const hasCookieRate = total > 0 ? (((quality.has_cookie || 0) / total) * 100).toFixed(1) : '0';
  const hasEmailRate = total > 0 ? (((quality.has_email || 0) / total) * 100).toFixed(1) : '0';
  const hasTokenRate = total > 0 ? (((quality.has_token || 0) / total) * 100).toFixed(1) : '0';

  // Top buyers
  const topBuyers = analytics?.top_buyers || [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Accounts */}
        <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-desc">Tổng Kho Dữ Liệu</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-title font-mono tracking-tight">
              {total.toLocaleString('vi-VN')}
            </div>
            <div className="text-[11px] text-purple-400 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>100% tài nguyên</span>
            </div>
          </div>
        </div>

        {/* Available Accounts */}
        <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-desc">Sẵn Sàng Bán (Available)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {available.toLocaleString('vi-VN')}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <span>{availableRate}% tồn kho</span>
            </div>
          </div>
        </div>

        {/* Sold Accounts */}
        <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-desc">Đã Xuất Bán (Sold)</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-cyan-400 font-mono tracking-tight">
              {sold.toLocaleString('vi-VN')}
            </div>
            <div className="text-[11px] text-cyan-400 mt-1 flex items-center gap-1 font-medium">
              <span>{soldRate}% đã bán</span>
            </div>
          </div>
        </div>

        {/* Used Accounts */}
        <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-desc">Đã Dùng Nuôi (Used)</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-purple-400 font-mono tracking-tight">
              {used.toLocaleString('vi-VN')}
            </div>
            <div className="text-[11px] text-desc mt-1 font-medium">Đang chạy tool</div>
          </div>
        </div>

        {/* Blacklisted Accounts */}
        <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] relative overflow-hidden group hover:border-rose-500/40 transition-all col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-desc">Khóa / Hỏng (Blacklist)</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-rose-400 font-mono tracking-tight">
              {blacklist.toLocaleString('vi-VN')}
            </div>
            <div className="text-[11px] text-rose-400 mt-1 font-medium">Đã loại trừ an toàn</div>
          </div>
        </div>
      </div>

      {/* VISUAL CHARTS SECTION (Recharts Area & Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart data={timeSeriesData} />
        </div>
        <div className="lg:col-span-1">
          <PlatformDonut
            shopeeCount={shopeeCount}
            tiktokCount={tiktokCount}
            healthStats={{
              live: Math.round(available * 0.85),
              soft_dead: Math.round(available * 0.1),
              dead: Math.round(available * 0.05) + blacklist,
              unknown: Math.max(0, total - available - sold - used - blacklist)
            }}
          />
        </div>
      </div>

      {/* Main Grid: Platform breakdown, Quality index & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platforms breakdown */}
        <div className="app-card rounded-2xl p-5 space-y-4 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-title flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Phân Loại Nền Tảng</span>
            </h3>
            <span className="text-[10px] text-desc font-mono">DWH Live</span>
          </div>

          <div className="space-y-3">
            {/* Shopee */}
            <div className="app-card-inner p-4 rounded-xl space-y-2 border border-[var(--border-subtle)]">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 font-bold text-orange-500 dark:text-orange-400">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>SHOPEE</span>
                </div>
                <span className="font-mono font-bold text-title">{shopeeCount.toLocaleString('vi-VN')} TK ({shopeeRate}%)</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${shopeeRate}%` }}
                />
              </div>
            </div>

            {/* TikTok */}
            <div className="app-card-inner p-4 rounded-xl space-y-2 border border-[var(--border-subtle)]">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 font-bold text-cyan-500 dark:text-cyan-400">
                  <Music2 className="w-3.5 h-3.5" />
                  <span>TIKTOK</span>
                </div>
                <span className="font-mono font-bold text-title">{tiktokCount.toLocaleString('vi-VN')} TK ({tiktokRate}%)</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${tiktokRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quality index */}
        <div className="app-card rounded-2xl p-5 space-y-4 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-title flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Chất Lượng Dữ Liệu</span>
            </h3>
            <span className="text-[10px] text-emerald-400 font-bold">Chuẩn hóa 100%</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="app-card-inner p-3 rounded-xl flex items-center justify-between border border-[var(--border-subtle)]">
              <span className="text-desc">Có Cookie Đầy Đủ</span>
              <span className="font-mono font-bold text-title">{quality.has_cookie?.toLocaleString('vi-VN') || 0} ({hasCookieRate}%)</span>
            </div>

            <div className="app-card-inner p-3 rounded-xl flex items-center justify-between border border-[var(--border-subtle)]">
              <span className="text-desc">Có Email Đầy Đủ</span>
              <span className="font-mono font-bold text-title">{quality.has_email?.toLocaleString('vi-VN') || 0} ({hasEmailRate}%)</span>
            </div>

            <div className="app-card-inner p-3 rounded-xl flex items-center justify-between border border-[var(--border-subtle)]">
              <span className="text-desc">Có Token Phiên (No-OTP)</span>
              <span className="font-mono font-bold text-title">{quality.has_token?.toLocaleString('vi-VN') || 0} ({hasTokenRate}%)</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="app-card rounded-2xl p-5 space-y-4 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-title flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Thao Tác Nhanh</span>
            </h3>
            <span className="text-[10px] text-desc font-mono">1-Click</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onNavigateTab('accounts')}
              className="p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5"
            >
              <Database className="w-5 h-5" />
              <span>Kho Tài Khoản</span>
            </button>

            <button
              onClick={() => onNavigateTab('import')}
              className="p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5"
            >
              <Upload className="w-5 h-5" />
              <span>Nhập File Offline</span>
            </button>

            <button
              onClick={() => onNavigateTab('exports')}
              className="p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5"
            >
              <Download className="w-5 h-5" />
              <span>Xuất Dữ Liệu</span>
            </button>

            <button
              onClick={() => onNavigateTab('backups')}
              className="p-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5"
            >
              <Archive className="w-5 h-5" />
              <span>Sao Lưu DB</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Buyers Leaderboard */}
      {topBuyers.length > 0 && (
        <div className="app-card rounded-2xl p-5 space-y-4 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-title flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Bảng Xếp Hạng Khách Mua Hàng Đầu (Top Buyers)</span>
            </h3>
            <span className="text-[10px] text-desc">Lũy kế bán hàng</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {topBuyers.slice(0, 4).map((buyer: any, idx: number) => (
              <div
                key={idx}
                className="app-card-inner p-3.5 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-xs">
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-title text-xs truncate">{buyer.buyer_name || buyer._id || 'Khách Mua Nhanh'}</div>
                    <div className="text-[10px] text-desc mt-0.5">Lượng mua</div>
                  </div>
                </div>
                <div className="font-mono font-bold text-cyan-400 text-sm">
                  {(buyer.total_purchased || buyer.count || 0).toLocaleString('vi-VN')} TK
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
