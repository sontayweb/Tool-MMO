'use client';

import React from 'react';
import { Copy, CheckSquare, ShoppingCart, CheckCircle, Ban, X, LifeBuoy, RotateCcw, Trash2 } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onQuickCopy: () => void;
  onCopyFull: () => void;
  onMarkSold: () => void;
  onMarkUsed: () => void;
  onBlacklist: () => void;
  onAutoFix?: () => void;
  onRestore?: () => void;
  onDeleteToTrash?: () => void;
  isTrashMode?: boolean;
  loading?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClearSelection,
  onQuickCopy,
  onCopyFull,
  onMarkSold,
  onMarkUsed,
  onBlacklist,
  onAutoFix,
  onRestore,
  onDeleteToTrash,
  isTrashMode = false,
  loading = false,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-6 z-30 mx-auto max-w-4xl bg-slate-950/90 dark:bg-slate-900/90 text-white rounded-3xl p-3 md:p-4 shadow-2xl border border-purple-500/40 backdrop-blur-xl animate-slideUp flex flex-wrap items-center justify-between gap-3">
      {/* Selected counter and clear */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold text-xs">
          {selectedCount}
        </div>
        <div className="text-xs">
          <span className="font-bold text-white">Đã chọn {selectedCount} tài khoản</span>
        </div>
        <button
          onClick={onClearSelection}
          className="text-xs text-desc hover:text-white p-1 ml-1"
          title="Bỏ chọn tất cả"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {isTrashMode ? (
          <>
            {/* Restore from Trash */}
            {onRestore && (
              <button
                onClick={onRestore}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
                title="Khôi phục các tài khoản đã chọn về kho khả dụng"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Khôi Phục Về Kho</span>
              </button>
            )}
          </>
        ) : (
          <>
            {/* Copy User|Pass */}
            <button
              onClick={onQuickCopy}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-all flex items-center gap-1.5"
              title="Copy định dạng User|Pass"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Copy User|Pass</span>
            </button>

            {/* Copy Full (User|Pass|Cookie|Mail) */}
            <button
              onClick={onCopyFull}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-all flex items-center gap-1.5"
              title="Copy đầy đủ User|Pass|Mail|Cookie"
            >
              <Copy className="w-3.5 h-3.5 text-purple-400" />
              <span>Copy Đầy Đủ</span>
            </button>

            {/* Auto Fix */}
            {onAutoFix && (
              <button
                onClick={onAutoFix}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-amber-950/40 transition-all flex items-center gap-1.5"
                title="Tự động bóc tách lại dữ liệu gốc để khôi phục"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Cứu Hộ</span>
              </button>
            )}

            {/* Mark SOLD */}
            <button
              onClick={onMarkSold}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Bán Nhanh</span>
            </button>

            {/* Mark USED */}
            <button
              onClick={onMarkUsed}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 font-semibold transition-all flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Đã Dùng</span>
            </button>

            {/* Move to Trash (Soft Delete) */}
            {onDeleteToTrash && (
              <button
                onClick={onDeleteToTrash}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-semibold transition-all flex items-center gap-1.5"
                title="Chuyển vào Thùng Rác"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa / Vào Thùng Rác</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
