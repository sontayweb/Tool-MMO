'use client';

import React, { useState } from 'react';
import {
  Server,
  Smartphone,
  Activity,
  Layers,
  Send,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface FarmMachine {
  id: string;
  code: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  platform: 'SHOPEE' | 'TIKTOK' | 'HYBRID';
  accounts_count: number;
  live_rate: number;
  product_seeding: string;
  last_active: string;
  ip_proxy: string;
}

interface FarmMatrixViewProps {
  onPushToBrowser?: (machineCode: string) => void;
}

export const FarmMatrixView: React.FC<FarmMatrixViewProps> = ({ onPushToBrowser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'ALL' | 'SHOPEE' | 'TIKTOK'>('ALL');

  const sampleMachines: FarmMachine[] = [
    {
      id: '1',
      code: 'p2k1',
      name: 'Boxphone Dàn 1 - Hà Nội',
      status: 'ONLINE',
      platform: 'SHOPEE',
      accounts_count: 24,
      live_rate: 96,
      product_seeding: '10 Gói Milo Canxi 180ml (Flash Sale)',
      last_active: 'Vừa xong',
      ip_proxy: '103.149.28.12:8080 (IPv4)',
    },
    {
      id: '2',
      code: 'p2k2',
      name: 'Boxphone Dàn 2 - Hà Nội',
      status: 'ONLINE',
      platform: 'TIKTOK',
      accounts_count: 32,
      live_rate: 91,
      product_seeding: 'Mỹ phẩm son kem lì Velvet Tint',
      last_active: '3 phút trước',
      ip_proxy: '14.225.204.88:8080 (Proxy xoay)',
    },
    {
      id: '3',
      code: 'p2k3',
      name: 'Boxphone Dàn 3 - Sài Gòn',
      status: 'BUSY',
      platform: 'TIKTOK',
      accounts_count: 40,
      live_rate: 88,
      product_seeding: 'Áo thun oversize unisex',
      last_active: '1 phút trước',
      ip_proxy: '115.79.209.15:9090 (IPv4)',
    },
    {
      id: '4',
      code: 'MÁY 1',
      name: 'Antidetect PC Nuôi 01',
      status: 'ONLINE',
      platform: 'SHOPEE',
      accounts_count: 18,
      live_rate: 100,
      product_seeding: 'Cốc giữ nhiệt Lock&Lock 500ml',
      last_active: 'Vừa xong',
      ip_proxy: '171.244.52.99:8000',
    },
    {
      id: '5',
      code: 'MÁY 2',
      name: 'Antidetect PC Nuôi 02',
      status: 'OFFLINE',
      platform: 'SHOPEE',
      accounts_count: 12,
      live_rate: 75,
      product_seeding: 'Đèn led rèm trang trí phòng ngủ',
      last_active: '2 giờ trước',
      ip_proxy: 'Mất kết nối',
    },
    {
      id: '6',
      code: 'p2k4',
      name: 'Boxphone Dàn 4 - TikTok US',
      status: 'ONLINE',
      platform: 'TIKTOK',
      accounts_count: 50,
      live_rate: 94,
      product_seeding: 'Affiliate TikTok Shop US trending',
      last_active: '5 phút trước',
      ip_proxy: 'US Residential Proxy Pool',
    },
  ];

  const filteredMachines = sampleMachines.filter((m) => {
    const matchSearch =
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.product_seeding.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPlatform = platformFilter === 'ALL' || m.platform === platformFilter;
    return matchSearch && matchPlatform;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Overview */}
      <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)] shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-title flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" />
                <span>Trung Tâm Quản Lý Dàn Máy Boxphone & Antidetect Farm</span>
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                FARM MATRIX
              </span>
            </div>
            <p className="text-xs text-desc mt-1">
              Theo dõi tình trạng dàn máy vật lý, tài khoản đang nuôi và 1-click đẩy nick sang trình duyệt Antidetect (AdsPower, GoLogin, MoreLogin).
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>5 Dàn Đang Online</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-desc" />
            <input
              type="text"
              placeholder="Tìm mã máy (p2k1, MÁY 1) hoặc sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-input)] text-xs text-title rounded-xl pl-9 pr-4 py-2 border border-[var(--border-subtle)] focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            {(['ALL', 'SHOPEE', 'TIKTOK'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  platformFilter === p
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-white/5 text-desc hover:text-title border border-[var(--border-subtle)]'
                }`}
              >
                {p === 'ALL' ? 'Tất cả' : p === 'SHOPEE' ? '🛒 Shopee' : '🎵 TikTok'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Machines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMachines.map((machine) => (
          <div
            key={machine.id}
            className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] hover:border-amber-500/40 transition-all space-y-4 shadow-lg flex flex-col justify-between"
          >
            {/* Top header */}
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono font-bold text-xs">
                    {machine.code}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-title">{machine.name}</h3>
                    <div className="text-[10px] text-desc font-mono mt-0.5">{machine.ip_proxy}</div>
                  </div>
                </div>

                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    machine.status === 'ONLINE'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : machine.status === 'BUSY'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {machine.status}
                </span>
              </div>

              {/* Product Seeding Note */}
              <div className="app-card-inner p-3 rounded-xl border border-[var(--border-subtle)] text-xs space-y-1">
                <div className="text-[10px] font-bold text-desc uppercase">Sản Phẩm Seeding Đang Nuôi:</div>
                <div className="text-title font-semibold truncate text-[11px] text-purple-300">
                  {machine.product_seeding}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                  <div className="text-[10px] text-desc">Số TK Trong Máy</div>
                  <div className="font-mono font-extrabold text-title text-sm mt-0.5">
                    {machine.accounts_count} TK
                  </div>
                </div>

                <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                  <div className="text-[10px] text-desc">Tỷ Lệ Nick Sống</div>
                  <div className="font-mono font-extrabold text-emerald-400 text-sm mt-0.5">
                    {machine.live_rate}% LIVE
                  </div>
                </div>
              </div>

              {/* 1-Click Push Button */}
              <button
                onClick={() => onPushToBrowser?.(machine.code)}
                className="w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>1-Click Đẩy Sang Antidetect Browser</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
