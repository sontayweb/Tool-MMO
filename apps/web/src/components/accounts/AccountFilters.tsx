'use client';

import React from 'react';
import { Search, Filter, X, RefreshCw, Music2, ShoppingBag, Globe, Mail, Layers, Sparkles, FileSpreadsheet } from 'lucide-react';

export interface AccountFiltersState {
  search: string;
  platform: string;
  status: string;
  data_quality: string;
  machine_id: string;
  source_file: string;
  managed_by: string;
  team: string;
  limit: number;
}

interface AccountFiltersProps {
  filters: AccountFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<AccountFiltersState>>;
  onApplyFilters: (customFilters?: AccountFiltersState) => void;
  onResetFilters: () => void;
  onExportExcel?: () => void;
  isLoading?: boolean;
  isExporting?: boolean;
}

export const AccountFilters: React.FC<AccountFiltersProps> = ({
  filters,
  setFilters,
  onApplyFilters,
  onResetFilters,
  onExportExcel,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onApplyFilters(filters);
    }
  };

  return (
    <div className="app-card rounded-2xl p-4 md:p-5 space-y-3.5 border border-[var(--border-subtle)]">
      {/* 🌟 Quick Subsystem Platform Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
        <button
          type="button"
          onClick={() => handleSelectSubsystem('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            filters.platform === 'ALL' || !filters.platform
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-[var(--bg-input)] text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>✨ TẤT CẢ KHO</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubsystem('TIKTOK')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            filters.platform === 'TIKTOK'
              ? 'bg-gradient-to-r from-cyan-500 to-pink-500 text-slate-950 shadow-lg shadow-pink-500/25'
              : 'bg-[var(--bg-input)] text-desc hover:text-cyan-400 hover:bg-cyan-500/5 border border-[var(--border-subtle)]'
          }`}
        >
          <Music2 className="w-3.5 h-3.5 text-pink-400" />
          <span> PHÂN HỆ TIKTOK MMO</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubsystem('SHOPEE')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            filters.platform === 'SHOPEE'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-orange-500/25'
              : 'bg-[var(--bg-input)] text-desc hover:text-orange-400 hover:bg-orange-500/5 border border-[var(--border-subtle)]'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-orange-400" />
          <span> PHÂN HỆ SHOPEE</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubsystem('FACEBOOK')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            filters.platform === 'FACEBOOK'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[var(--bg-input)] text-desc hover:text-blue-400 hover:bg-blue-500/5 border border-[var(--border-subtle)]'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span> FACEBOOK</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubsystem('MAIL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            filters.platform === 'MAIL'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-[var(--bg-input)] text-desc hover:text-indigo-400 hover:bg-indigo-500/5 border border-[var(--border-subtle)]'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-indigo-400" />
          <span> HÒM MAIL</span>
        </button>
      </div>

      {/* Main Streamlined Filter Bar (1 Single Row) */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 pt-1">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-desc" />
          <input
            type="text"
            placeholder="Tìm username, file nguồn, note..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl pl-9 pr-8 py-2.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-medium"
          />
          {filters.search && (
            <button
              onClick={() => handleChange('search', '')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-desc hover:text-title p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status select */}
        <div className="w-full sm:w-auto min-w-[145px]">
          <select
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-3 py-2.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-medium"
          >
            <option value="ALL">Tất Cả Trạng Thái</option>
            <option value="AVAILABLE">AVAILABLE (Sẵn sàng)</option>
            <option value="SOLD">SOLD (Đã bán)</option>
            <option value="USED">USED (Đã dùng)</option>
            <option value="BLACKLISTED">BLACKLISTED (Hỏng/Khóa)</option>
            <option value="ERROR">ERROR (Lỗi/Rác)</option>
            <option value="TRASH">THÙNG RÁC (Đã xóa)</option>
          </select>
        </div>

        {/* Data Quality & Integrity Filter */}
        <div className="w-full sm:w-auto min-w-[185px]">
          <select
            value={filters.data_quality || ''}
            onChange={(e) => handleChange('data_quality', e.target.value)}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-3 py-2.5 border border-purple-500/40 focus:outline-none focus:border-purple-500 transition-all font-bold text-amber-500 dark:text-amber-400"
          >
            <option value="">Chất Lượng: Tất Cả</option>
            <option value="corrupted">Nick Lỗi / Rác (Token, STT, Sai Định Dạng)</option>
            <option value="missing_core">Nick Thiếu (Trắng Pass & Cookie)</option>
            <option value="full_info">Nick Đầy Đủ (Có Pass + Cookie)</option>
          </select>
        </div>

        {/* Machine ID */}
        <div className="w-full sm:w-auto min-w-[120px]">
          <input
            type="text"
            placeholder="Mã máy (p2k1...)"
            value={filters.machine_id}
            onChange={(e) => handleChange('machine_id', e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-3 py-2.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-medium"
          />
        </div>

        {/* Rows per page selector */}
        <div className="w-full sm:w-auto min-w-[90px]">
          <select
            value={filters.limit}
            onChange={(e) => handleChange('limit', Number(e.target.value))}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-2.5 py-2.5 border border-[var(--border-subtle)] focus:outline-none font-medium"
          >
            <option value={20}>20 dòng</option>
            <option value={50}>50 dòng</option>
            <option value={100}>100 dòng</option>
            <option value={200}>200 dòng</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              disabled={isExporting}
              type="button"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/20 whitespace-nowrap"
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
            className="px-3 py-2 rounded-xl text-xs font-semibold text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all flex items-center gap-1"
            title="Đặt lại bộ lọc"
          >
            <X className="w-3.5 h-3.5" />
            <span>Đặt Lại</span>
          </button>

          <button
            onClick={() => onApplyFilters(filters)}
            disabled={isLoading}
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/40 transition-all flex items-center gap-1.5 whitespace-nowrap"
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
    </div>
  );
};
