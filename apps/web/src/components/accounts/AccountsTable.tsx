'use client';

import React from 'react';
import {
  Copy,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Shield,
  Key,
  Mail,
  FileSpreadsheet,
  ShoppingBag,
  Music2,
  Globe,
  Layers,
  Cookie,
} from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';

interface AccountsTableProps {
  accounts: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  selectedUsernames: string[];
  onToggleSelectAll: () => void;
  onToggleSelectOne: (username: string) => void;
  onViewDetail: (account: any) => void;
  onCopyText: (text: string, label: string) => void;
  isLoading?: boolean;
}

export const AccountsTable: React.FC<AccountsTableProps> = ({
  accounts,
  total,
  page,
  limit,
  totalPages,
  onPageChange,
  selectedUsernames,
  onToggleSelectAll,
  onToggleSelectOne,
  onViewDetail,
  onCopyText,
  isLoading = false,
}) => {
  const isAllSelected =
    accounts.length > 0 && accounts.every((acc) => selectedUsernames.includes(acc.username));

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
      case 'SOLD':
        return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30';
      case 'USED':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30';
      case 'TRASH':
        return 'bg-amber-500/20 text-amber-500 border border-amber-500/40 font-bold';
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-500 border border-rose-500/50 shadow-sm shadow-rose-500/20 animate-pulse';
      case 'BLACKLISTED':
      case 'BLACKLIST':
      default:
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
    }
  };

  return (
    <div className="app-card rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-xl">
      {/* Table Container */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[980px] text-left text-xs">
          {/* Table Header */}
          <thead className="bg-[var(--bg-input)] text-desc border-b border-[var(--border-subtle)] uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="p-3.5 w-12 text-center shrink-0">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  disabled={isLoading || accounts.length === 0}
                  className="rounded accent-purple-500 cursor-pointer"
                />
              </th>
              <th className="py-3.5 px-3 min-w-[200px]">Tài Khoản / Username</th>
              <th className="py-3.5 px-3 min-w-[110px]">Mật Khẩu</th>
              <th className="py-3.5 px-3 min-w-[100px]">Nền Tảng</th>
              <th className="py-3.5 px-3 min-w-[150px]">Dàn Máy / Ghi Chú</th>
              <th className="py-3.5 px-3 min-w-[120px]">Trạng Thái</th>
              <th className="py-3.5 px-3 min-w-[140px]">Nguồn / Đội Nhóm</th>
              <th className="py-3.5 px-4 min-w-[80px] text-right">Chi Tiết</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[var(--border-subtle)] text-title">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-0">
                  <TableSkeleton rows={8} cols={8} />
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-desc text-xs">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Shield className="w-8 h-8 text-desc/40" />
                    <span>Không tìm thấy tài khoản nào phù hợp với bộ lọc.</span>
                  </div>
                </td>
              </tr>
            ) : (
              accounts.map((acc: any) => {
                const isSelected = selectedUsernames.includes(acc.username);

                return (
                  <tr
                    key={acc.id || acc._id || acc.username}
                    className={`transition-all hover:bg-white/[0.02] ${
                      isSelected ? 'bg-purple-500/[0.08]' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3.5 w-12 text-center shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectOne(acc.username)}
                        className="rounded accent-purple-500 cursor-pointer"
                      />
                    </td>

                    {/* Username & Phẩm chất */}
                    <td className="py-3 px-3 min-w-[210px] max-w-[260px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {acc.username.startsWith('dup_') ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="font-bold font-mono text-amber-400 text-xs truncate max-w-[130px] inline-block align-middle"
                              title={`Nick trùng kho: ${acc.username}`}
                            >
                              {acc.username.replace(/^dup_/, '').replace(/_[a-f0-9]{4}$/, '')}
                            </span>
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 whitespace-nowrap"
                              title={acc.username}
                            >
                              Trùng kho
                            </span>
                          </div>
                        ) : acc.username.startsWith('junk_') ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="font-bold font-mono text-desc/60 text-xs truncate max-w-[120px] inline-block align-middle"
                              title={`Dòng rác bảng tính: ${acc.username}`}
                            >
                              {acc.username}
                            </span>
                            <span
                              className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-500/15 border border-zinc-500/30 text-desc whitespace-nowrap"
                            >
                              Rác Excel
                            </span>
                          </div>
                        ) : (
                          <span
                            className="font-bold font-mono text-title text-xs truncate max-w-[160px] inline-block align-middle"
                            title={acc.username}
                          >
                            {acc.username}
                          </span>
                        )}

                        <button
                          onClick={() => onCopyText(acc.username, 'Username')}
                          className="text-desc hover:text-title p-0.5 opacity-60 hover:opacity-100 transition-opacity shrink-0"
                          title="Copy Username"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Micro-Badges Phẩm chất: SĐT, Cookie, Token, Email */}
                      <div className="flex items-center gap-1.5 text-[10px] text-desc font-mono mt-1 flex-wrap">
                        {acc.phone && (
                          <span className="text-amber-400 font-semibold">{acc.phone}</span>
                        )}

                        {/* Cookie Badge */}
                        {(acc.quality?.has_cookie || acc.has_cookie || acc.cookie_enc) && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            title="Tài khoản có Cookie"
                          >
                            <Cookie className="w-2.5 h-2.5" />
                            <span>Cookie</span>
                          </span>
                        )}

                        {/* Token Badge */}
                        {(acc.quality?.has_token || acc.has_token || acc.token_enc || acc.session_token) && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30"
                            title="Tài khoản có Token Boxphone"
                          >
                            <Key className="w-2.5 h-2.5" />
                            <span>Token</span>
                          </span>
                        )}

                        {/* Email Substring */}
                        {acc.email && (
                          <span
                            className="truncate max-w-[130px] text-desc/80"
                            title={acc.email}
                          >
                            {acc.email}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Password */}
                    <td className="py-3 px-3 min-w-[110px] font-mono text-desc whitespace-nowrap">
                      {acc.password ? (
                        <div className="flex items-center gap-1.5">
                          <span>••••••••</span>
                          <button
                            onClick={() => onCopyText(acc.password, 'Mật khẩu')}
                            className="text-desc hover:text-title p-0.5"
                            title="Copy Password"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] opacity-40">---</span>
                      )}
                    </td>

                    {/* Platform */}
                    <td className="py-3 px-3 min-w-[100px] whitespace-nowrap">
                      {acc.platform === 'TIKTOK' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-gradient-to-r from-cyan-950/60 to-pink-950/60 text-cyan-400 border-cyan-500/40 shadow-sm shadow-cyan-500/10">
                          <Music2 className="w-3 h-3 text-pink-400" />
                          <span>TIKTOK</span>
                        </span>
                      )}
                      {acc.platform === 'SHOPEE' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-orange-500/15 text-orange-400 border-orange-500/30">
                          <ShoppingBag className="w-3 h-3" />
                          <span>SHOPEE</span>
                        </span>
                      )}
                      {acc.platform === 'FACEBOOK' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-blue-500/15 text-blue-400 border-blue-500/30">
                          <Globe className="w-3 h-3" />
                          <span>FACEBOOK</span>
                        </span>
                      )}
                      {acc.platform === 'MAIL' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
                          <Mail className="w-3 h-3" />
                          <span>MAIL</span>
                        </span>
                      )}
                      {!['TIKTOK', 'SHOPEE', 'FACEBOOK', 'MAIL'].includes(acc.platform) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-zinc-500/15 text-zinc-400 border-zinc-500/30">
                          <Layers className="w-3 h-3" />
                          <span>{acc.platform || 'OTHER'}</span>
                        </span>
                      )}
                    </td>

                    {/* Machine ID / Coins / Product */}
                    <td className="py-3 px-3 min-w-[150px]">
                      {acc.machine_id && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-[var(--border-subtle)] text-desc">
                          <Smartphone className="w-3 h-3 text-emerald-400" />
                          <span>{acc.machine_id}</span>
                        </div>
                      )}
                      {acc.coins && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold ml-1">
                          <span>💰 {Number(acc.coins).toLocaleString()} xu</span>
                        </div>
                      )}
                      {(acc.custom_metadata?.product || acc.custom_metadata?.note) && (
                        <div className="text-[10px] text-desc truncate max-w-xs mt-0.5">
                          {acc.custom_metadata?.product || acc.custom_metadata?.note}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 min-w-[120px] whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getStatusBadgeClass(
                          acc.status
                        )}`}
                      >
                        {acc.status}
                      </span>
                    </td>

                    {/* Source / Team */}
                    <td className="py-3 px-3 min-w-[140px] max-w-[180px]">
                      <div className="text-[11px] font-medium text-title truncate max-w-[160px]" title={acc.metadata?.team || 'KHO_TONG'}>
                        {acc.metadata?.team || 'KHO_TONG'}
                      </div>
                      {acc.metadata?.source_file && (
                        <div
                          className="text-[10px] text-desc truncate max-w-[160px] flex items-center gap-1 mt-0.5"
                          title={`Tệp: ${acc.metadata.source_file}${acc.metadata.source_sheet ? ` | Sheet: ${acc.metadata.source_sheet}` : ''}`}
                        >
                          <FileSpreadsheet className="w-3 h-3 text-purple-400 shrink-0" />
                          <span className="truncate">{acc.metadata.source_file}</span>
                        </div>
                      )}
                      {acc.metadata?.source_sheet && (
                        <div
                          className="text-[9px] text-purple-400/90 truncate max-w-[150px] font-mono mt-0.5"
                          title={`Sheet: ${acc.metadata.source_sheet}`}
                        >
                          📑 {acc.metadata.source_sheet}
                        </div>
                      )}
                    </td>

                    {/* View Detail Action */}
                    <td className="py-3 px-4 min-w-[80px] text-right whitespace-nowrap">
                      <button
                        onClick={() => onViewDetail(acc)}
                        className="px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-semibold text-xs transition-all flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 bg-[var(--bg-input)] border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="text-desc">
          Hiển thị <strong className="text-title">{accounts.length}</strong> /{' '}
          <strong className="text-title">{total.toLocaleString('vi-VN')}</strong> tài khoản (Trang{' '}
          <span className="font-bold text-title">{page}</span>/{totalPages || 1})
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="p-2 rounded-xl border border-[var(--border-subtle)] text-desc hover:text-title hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 text-xs font-mono font-bold text-title">
            {page} / {totalPages || 1}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="p-2 rounded-xl border border-[var(--border-subtle)] text-desc hover:text-title hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Trang tiếp"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
