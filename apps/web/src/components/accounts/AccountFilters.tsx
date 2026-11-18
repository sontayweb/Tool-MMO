'use client';

import React from 'react';
import { Search, Filter, X, RefreshCw, Music2, ShoppingBag, Globe, Mail, Layers, Sparkles, FileSpreadsheet, Calendar, UserPlus, Zap } from 'lucide-react';

export interface AccountFiltersState {
  search: string;
  platform: string;
  status: string;
  data_quality: string;
  machine_id: string;
  source_file: string;
  managed_by: string;
  team: string;
  date_from?: string;
  date_to?: string;
  limit: number;
}

interface AccountFiltersProps {
  filters: AccountFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<AccountFiltersState>>;
  onApplyFilters: (customFilters?: AccountFiltersState) => void;
  onResetFilters: () => void;
  onExportExcel?: () => void;
  onOpenAddAccount?: () => void;
  onOpenChecker?: () => void;
  isLoading?: boolean;
  isExporting?: boolean;
}

export const AccountFilters: React.FC<AccountFiltersProps> = ({
  filters,
  setFilters,
  onApplyFilters,
  onResetFilters,
  onExportExcel,
  onOpenAddAccount,
  onOpenChecker,
  isLoading = false,
  isExporting = false,
}) => {
  const handleChange = (key: keyof AccountFiltersState, value: any) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    if (key === 'data_quality' || key === 'status' || key === 'limit') {
      onApplyFilters(nextFilters);
    }
  };

  const handleSelectSubsystem = (platformValue: string) => {
    const nextFilters = { ...filters, platform: platformValue };
    setFilters(nextFilters);
    onApplyFilters(nextFilters);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const searchValue = e.currentTarget.value;
      const nextFilters = { ...filters, search: searchValue };
      setFilters(nextFilters);
      onApplyFilters(nextFilters);
    }
  };

  return (
    <div className="app-card rounded-2xl p-4 md:p-5 space-y-4 border border-[var(--border-subtle)] shadow-sm">
      {/* 🌟 Header Row: Platform Tabs + Action Buttons */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        {/* Subsystem Platform Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 lg:pb-0 scrollbar-none select-none">
          <button
            type="button"
            onClick={() => handleSelectSubsystem('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${filters.platform === 'ALL' || !filters.platform
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-[var(--bg-input)] text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)]'
              }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>✨ TẤT CẢ KHO</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubsystem('TIKTOK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${filters.platform === 'TIKTOK'
                ? 'bg-gradient-to-r from-cyan-500 to-pink-500 text-slate-950 shadow-md shadow-pink-500/25 font-extrabold'
                : 'bg-[var(--bg-input)] text-desc hover:text-cyan-400 hover:bg-cyan-500/5 border border-[var(--border-subtle)]'
              }`}
          >
            <Music2 className="w-3.5 h-3.5 text-pink-400" />
            <span>TIKTOK MMO</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubsystem('SHOPEE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${filters.platform === 'SHOPEE'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 font-extrabold'
                : 'bg-[var(--bg-input)] text-desc hover:text-orange-400 hover:bg-orange-500/5 border border-[var(--border-subtle)]'
              }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-orange-400" />
            <span>SHOPEE</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubsystem('FACEBOOK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${filters.platform === 'FACEBOOK'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-extrabold'
                : 'bg-[var(--bg-input)] text-desc hover:text-blue-400 hover:bg-blue-500/5 border border-[var(--border-subtle)]'
              }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>FACEBOOK</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubsystem('MAIL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${filters.platform === 'MAIL'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
                : 'bg-[var(--bg-input)] text-desc hover:text-indigo-400 hover:bg-indigo-500/5 border border-[var(--border-subtle)]'
              }`}
          >
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            <span>HÒM MAIL</span>
          </button>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
          {onOpenChecker && (
            <button
              onClick={onOpenChecker}
              type="button"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-950/25 transition-all flex items-center gap-1.5 whitespace-nowrap"
              title="Mở bảng kiểm tra trực tiếp tài khoản Shopee"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
              <span>⚡ Kiểm Tra Shopee</span>
            </button>
          )}

          {onOpenAddAccount && (
            <button
              onClick={onOpenAddAccount}
              type="button"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-950/25 transition-all flex items-center gap-1.5 whitespace-nowrap"
              title="Thêm thủ công 1 tài khoản lẻ vào kho"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Thêm Tài Khoản</span>
            </button>
          )}

          {onExportExcel && (
            <button
              onClick={onExportExcel}
              disabled={isExporting}
              type="button"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1.5 whitespace-nowrap"
              title="Xuất toàn bộ danh sách tài khoản theo bộ lọc hiện tại ra file Excel (.xlsx)"
            >
              {isExporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{isExporting ? 'Đang Xuất...' : 'Xuất Excel'}</span>
            </button>
          )}

          <button
            onClick={onResetFilters}
            type="button"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all flex items-center gap-1 whitespace-nowrap"
            title="Đặt lại toàn bộ bộ lọc về mặc định"
          >
            <X className="w-3.5 h-3.5" />
            <span>Đặt Lại</span>
          </button>

          <button
            onClick={() => onApplyFilters(filters)}
            disabled={isLoading}
            type="button"
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-950/30 transition-all flex items-center gap-1.5 whitespace-nowrap"
            title="Áp dụng bộ lọc"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Filter className="w-3.5 h-3.5" />
            )}
            <span>Lọc Kết Quả</span>
          </button>
        </div>
      </div>

      {/* 🔍 Controls Grid: Search & Refinement Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2.5 items-center">
        {/* Search input: Spans 4 columns on large displays */}
        <div className="relative sm:col-span-2 md:col-span-3 lg:col-span-4">
          <button
            type="button"
            onClick={() => onApplyFilters(filters)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-desc hover:text-purple-400 transition-colors p-0.5 cursor-pointer z-10"
            title="Nhấn để tìm kiếm"
          >
            <Search className="w-4 h-4" />
          </button>
          <input
            type="text"
            placeholder="Tìm username, SĐT, file nguồn, note... (Nhấn Enter để lọc)"
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl pl-9 pr-8 py-2 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-medium"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => {
                const nextFilters = { ...filters, search: '' };
                setFilters(nextFilters);
                onApplyFilters(nextFilters);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-desc hover:text-title p-0.5"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status select: 2 columns */}
        <div className="lg:col-span-2">
          <select
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-2.5 py-2 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-medium"
          >
            <option value="ALL">Tất Cả Trạng Thái</option>
            <option value="AVAILABLE">🟢 AVAILABLE (Sẵn sàng)</option>
            <option value="SOLD">🔵 SOLD (Đã bán)</option>
            <option value="USED">🟣 USED (Đã dùng)</option>
            <option value="BLACKLISTED">🔴 BLACKLISTED (Hỏng/Khóa)</option>
            <option value="ERROR">⚠️ ERROR (Lỗi/Rác)</option>
            <option value="TRASH">🗑️ THÙNG RÁC (Đã xóa)</option>
          </select>
        </div>

        {/* Data Quality & Integrity Filter: 2 columns */}
        <div className="lg:col-span-2">
          <select
            value={filters.data_quality || ''}
            onChange={(e) => handleChange('data_quality', e.target.value)}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-2.5 py-2 border border-purple-500/40 focus:outline-none focus:border-purple-500 transition-all font-bold text-amber-500 dark:text-amber-400"
          >
            <option value="">Chất Lượng: Tất Cả</option>
            <option value="full_info">✨ Nick Đầy Đủ (Pass+Cookie)</option>
            <option value="has_cookie">🍪 Có Cookie Sống</option>
            <option value="has_token">🔑 Có Token Boxphone</option>
            <option value="has_email">📧 Có Hòm Mail</option>
            <option value="missing_core">⚪ Nick Thiếu (Trắng Pass&Cookie)</option>
            <option value="corrupted">⚠️ Nick Lỗi / Rác Cần Cứu Hộ</option>
          </select>
        </div>

        {/* Machine ID: 2 columns */}
        <div className="lg:col-span-2">
          <input
            type="text"
            placeholder="Mã máy (p2k1...)"
            value={filters.machine_id}
            onChange={(e) => handleChange('machine_id', e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-2.5 py-2 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-medium"
          />
        </div>

        {/* Date range picker: 2 columns */}
        <div className="lg:col-span-2 flex items-center justify-between gap-1 bg-[var(--bg-input)] rounded-xl px-2 py-1.5 border border-[var(--border-subtle)] text-xs text-desc">
          <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(e) => handleChange('date_from', e.target.value)}
            title="Từ ngày quét"
            className="bg-transparent text-title text-[11px] outline-none cursor-pointer w-[92px]"
          />
          <span className="text-desc">-</span>
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => handleChange('date_to', e.target.value)}
            title="Đến ngày quét"
            className="bg-transparent text-title text-[11px] outline-none cursor-pointer w-[92px]"
          />
        </div>
      </div>

      {/* 🏷️ Tier 3: 1-Click Operational Quick Chips (Rule 9: Pragmatic UX) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)] text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-desc font-semibold mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Lọc nhanh:</span>
          </span>

          <button
            type="button"
            onClick={() => {
              const updated = { ...filters, status: 'AVAILABLE', data_quality: '' };
              setFilters(updated);
              onApplyFilters(updated);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${filters.status === 'AVAILABLE' && !filters.data_quality
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                : 'bg-white/[0.02] text-desc hover:text-title border-[var(--border-subtle)]'
              }`}
          >
            🟢 Sẵn Sàng (AVAILABLE)
          </button>

          <button
            type="button"
            onClick={() => {
              const updated = { ...filters, data_quality: 'full_info' };
              setFilters(updated);
              onApplyFilters(updated);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${filters.data_quality === 'full_info'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 font-bold'
                : 'bg-white/[0.02] text-desc hover:text-title border-[var(--border-subtle)]'
              }`}
          >
            ✨ Full Info (Pass + Cookie)
          </button>

          <button
            type="button"
            onClick={() => {
              const updated = { ...filters, data_quality: 'has_cookie' };
              setFilters(updated);
              onApplyFilters(updated);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${filters.data_quality === 'has_cookie'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold'
                : 'bg-white/[0.02] text-desc hover:text-title border-[var(--border-subtle)]'
              }`}
          >
            🍪 Có Cookie
          </button>

          <button
            type="button"
            onClick={() => {
              const updated = { ...filters, data_quality: 'has_token' };
              setFilters(updated);
              onApplyFilters(updated);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${filters.data_quality === 'has_token'
                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 font-bold'
                : 'bg-white/[0.02] text-desc hover:text-title border-[var(--border-subtle)]'
              }`}
          >
            🔑 Có Token
          </button>

          <button
            type="button"
            onClick={() => {
              const updated = { ...filters, data_quality: 'has_email' };
              setFilters(updated);
              onApplyFilters(updated);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${filters.data_quality === 'has_email'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 font-bold'
                : 'bg-white/[0.02] text-desc hover:text-title border-[var(--border-subtle)]'
              }`}
          >
            📧 Có Email
          </button>

          <button
            type="button"
            onClick={() => {
              const updated = { ...filters, data_quality: 'missing_core' };
              setFilters(updated);
              onApplyFilters(updated);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${filters.data_quality === 'missing_core'
                ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40 font-bold'
                : 'bg-white/[0.02] text-desc hover:text-title border-[var(--border-subtle)]'
              }`}
          >
            ⚪ Thiếu Pass&Cookie
          </button>

          <button
            type="button"
            onClick={() => {
              const updated = { ...filters, data_quality: 'corrupted' };
              setFilters(updated);
              onApplyFilters(updated);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${filters.data_quality === 'corrupted'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold'
                : 'bg-white/[0.02] text-desc hover:text-title border-[var(--border-subtle)]'
              }`}
          >
            ⚠️ Nick Lỗi / Rác Cần Cứu
          </button>

          <button
            type="button"
            onClick={() => {
              const updated = { ...filters, status: 'TRASH', data_quality: '' };
              setFilters(updated);
              onApplyFilters(updated);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${filters.status === 'TRASH'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold'
                : 'bg-white/[0.02] text-desc hover:text-title border-[var(--border-subtle)]'
              }`}
          >
            🗑️ Thùng Rác (TRASH)
          </button>
        </div>

        {/* Rows per page selector on the right */}
        <div className="flex items-center gap-1.5 ml-auto text-desc text-[11px]">
          <span>Hiển thị:</span>
          <select
            value={filters.limit}
            onChange={(e) => handleChange('limit', Number(e.target.value))}
            className="bg-[var(--bg-input)] text-title text-[11px] rounded-lg px-2 py-1 border border-[var(--border-subtle)] focus:outline-none font-medium cursor-pointer"
          >
            <option value={20}>20 dòng/trang</option>
            <option value={50}>50 dòng/trang</option>
            <option value={100}>100 dòng/trang</option>
            <option value={200}>200 dòng/trang</option>
          </select>
        </div>
      </div>
    </div>
  );
};
