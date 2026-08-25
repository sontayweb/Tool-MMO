'use client';

import React from 'react';
import { Search, Filter, X, RefreshCw } from 'lucide-react';

export interface AccountFiltersState {
  search: string;
  platform: string;
  status: string;
  machine_id: string;
  source_file: string;
  managed_by: string;
  has_cookie: string;
  has_email: string;
  has_token: string;
  team: string;
  limit: number;
}

interface AccountFiltersProps {
  filters: AccountFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<AccountFiltersState>>;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

export const AccountFilters: React.FC<AccountFiltersProps> = ({
  filters,
  setFilters,
  onApplyFilters,
  onResetFilters,
  isLoading = false,
}) => {
  const handleChange = (key: keyof AccountFiltersState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onApplyFilters();
    }
  };

  return (
    <div className="app-card rounded-2xl p-4 md:p-5 space-y-4 border border-[var(--border-subtle)]">
      {/* Top row: Search and primary selects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-desc" />
          <input
            type="text"
            placeholder="Tìm theo username, email, note..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl pl-9 pr-8 py-2.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all"
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

        {/* Platform select */}
        <div>
          <select
            value={filters.platform}
            onChange={(e) => handleChange('platform', e.target.value)}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-3 py-2.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-medium"
          >
            <option value="ALL">Tất Cả Nền Tảng</option>
            <option value="SHOPEE">Shopee</option>
            <option value="TIKTOK">TikTok</option>
          </select>
        </div>

        {/* Status select */}
        <div>
          <select
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-3 py-2.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-medium"
          >
            <option value="ALL">Tất Cả Trạng Thái</option>
            <option value="AVAILABLE">AVAILABLE (Sẵn sàng)</option>
            <option value="SOLD">SOLD (Đã bán)</option>
            <option value="USED">USED (Đã dùng)</option>
            <option value="BLACKLIST">BLACKLIST (Hỏng/Khóa)</option>
          </select>
        </div>

        {/* Machine ID */}
        <div>
          <input
            type="text"
            placeholder="Mã máy (VD: p2k1, MÁY 1...)"
            value={filters.machine_id}
            onChange={(e) => handleChange('machine_id', e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl px-3 py-2.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all"
          />
        </div>
      </div>

      {/* Second row: Checkboxes and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
        {/* Checkbox filters */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-desc hover:text-title transition-all">
            <input
              type="checkbox"
              checked={filters.has_cookie === 'true'}
              onChange={(e) => handleChange('has_cookie', e.target.checked ? 'true' : '')}
              className="rounded accent-purple-500 cursor-pointer"
            />
            <span>Có Cookie</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-desc hover:text-title transition-all">
            <input
              type="checkbox"
              checked={filters.has_email === 'true'}
              onChange={(e) => handleChange('has_email', e.target.checked ? 'true' : '')}
              className="rounded accent-purple-500 cursor-pointer"
            />
            <span>Có Mail</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-desc hover:text-title transition-all">
            <input
              type="checkbox"
              checked={filters.has_token === 'true'}
              onChange={(e) => handleChange('has_token', e.target.checked ? 'true' : '')}
              className="rounded accent-purple-500 cursor-pointer"
            />
            <span>Có Token Phiên</span>
          </label>

          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5 ml-2 text-desc">
            <span>Hiển thị:</span>
            <select
              value={filters.limit}
              onChange={(e) => handleChange('limit', Number(e.target.value))}
              className="bg-[var(--bg-input)] text-title text-xs rounded-lg px-2 py-1 border border-[var(--border-subtle)] focus:outline-none"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span>dòng</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onResetFilters}
            type="button"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Đặt Lại</span>
          </button>

          <button
            onClick={onApplyFilters}
            disabled={isLoading}
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/40 transition-all flex items-center gap-1.5"
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
