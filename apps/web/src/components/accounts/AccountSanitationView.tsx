import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, ShieldAlert, RefreshCw, XCircle, Layers, LifeBuoy, RotateCcw, AlertOctagon } from 'lucide-react';
import { api } from '../../lib/api';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface AccountSanitationViewProps {
  onRefreshGlobalStats: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onNavigateToAccounts?: (category: 'corrupted' | 'missing_core' | 'blacklisted' | 'duplicates' | 'trash') => void;
  userRole?: string;
}

export function AccountSanitationView({ onRefreshGlobalStats, showToast, onNavigateToAccounts, userRole }: AccountSanitationViewProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant?: 'danger' | 'warning' | 'success' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.getSanitationStats();
      setStats(data);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tải dữ liệu dọn dẹp', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleClean = (category: string, action: 'DELETE' | 'BLACKLIST' | 'AUTO_FIX' | 'HARD_DELETE' | 'RESTORE', label: string) => {
    let actionTitle = action === 'DELETE' ? 'CHUYỂN VÀO THÙNG RÁC' : action === 'HARD_DELETE' ? 'XÓA VĨNH VIỄN' : action === 'BLACKLIST' ? 'KHÓA BLACKLIST' : action === 'RESTORE' ? 'KHÔI PHỤC VỀ AVAILABLE' : 'CỨU HỘ DỮ LIỆU';
    
    setConfirmDialog({
      isOpen: true,
      title: `Xác nhận ${actionTitle} - ${label}`,
      message: action === 'AUTO_FIX' 
        ? `Hệ thống sẽ chạy thuật toán bóc tách dữ liệu gốc cho nhóm "${label}". Những tài khoản bóc tách được Username/Password hợp lệ sẽ được chuyển về AVAILABLE. Bạn có chắc chắn muốn tiến hành?`
        : action === 'RESTORE'
        ? `Hệ thống sẽ khôi phục tất cả tài khoản trong "${label}" về trạng thái Sẵn Sàng (AVAILABLE). Bạn có chắc chắn muốn tiếp tục?`
        : action === 'HARD_DELETE'
        ? `CẢNH BÁO: Bạn đang thực hiện XÓA VĨNH VIỄN toàn bộ danh sách "${label}". Dữ liệu này sẽ không thể khôi phục. Bạn có chắc chắn muốn tiếp tục?`
        : `Bạn đang thực hiện thao tác ${actionTitle} đối với nhóm "${label}". Dữ liệu sẽ được chuyển trạng thái an toàn. Bạn có chắc chắn muốn tiếp tục?`,
      confirmText: 'Đồng ý thực hiện',
      variant: action === 'HARD_DELETE' ? 'danger' : action === 'AUTO_FIX' ? 'warning' : action === 'RESTORE' ? 'success' : 'info',
      onConfirm: async () => {
        setLoading(true);
        try {
          const data = await api.cleanSanitationAccounts(category, action as any);
          showToast(`Thao tác thành công: Đã xử lý ${data.count} tài khoản!`, 'success');
          fetchStats();
          onRefreshGlobalStats();
        } catch (err: any) {
          showToast(err.message || 'Lỗi trong quá trình dọn dẹp', 'error');
        } finally {
          setLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Quét & Phân Loại Vi Phạm Domain Rules
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            Domain Scanner
          </span>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Tải Lại Số Liệu</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: VI PHẠM QUY CHUẨN NỀN TẢNG (CORRUPTED) */}
        <div className="app-card rounded-2xl p-5 border border-amber-300/80 dark:border-amber-500/40 flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden bg-white dark:bg-slate-900/60">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                <span>Vi Phạm Domain Rules</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Tài Khoản Bất Thường / Lỗi</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Token Boxphone (M.C...), số STT dòng, Base64 dài &gt; 35 ký tự, Email sai định dạng.
              </p>
            </div>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 py-1">
              {stats?.corrupted !== undefined ? stats.corrupted.toLocaleString() : '-'}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-2">tài khoản</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 mt-4">
            <div className="flex gap-2">
              {onNavigateToAccounts && (
                <button
                  onClick={() => onNavigateToAccounts('corrupted')}
                  disabled={!stats?.corrupted}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-600 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Xem Danh Sách
                </button>
              )}
              <button
                onClick={() => handleClean('corrupted', 'AUTO_FIX', 'Tài Khoản Vi Phạm Domain Rules')}
                disabled={loading || !stats?.corrupted}
                className="flex-[1.4] px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white border border-amber-700 dark:border-amber-500 shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Cứu Hộ Hàng Loạt</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleClean('corrupted', 'BLACKLIST', 'Tài Khoản Vi Phạm Domain Rules')}
                disabled={loading || !stats?.corrupted}
                className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 dark:bg-purple-950/70 dark:hover:bg-purple-900/60 dark:text-purple-200 dark:border-purple-600 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Khóa Blacklist
              </button>
              <button
                onClick={() => handleClean('corrupted', 'DELETE', 'Tài Khoản Vi Phạm Domain Rules')}
                disabled={loading || !stats?.corrupted}
                className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-950 border-2 border-rose-400 dark:bg-rose-950/70 dark:hover:bg-rose-900/60 dark:text-rose-200 dark:border-rose-600 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vào Thùng Rác</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: THIẾU DỮ LIỆU CỐT LÕI (MISSING CORE) */}
        <div className="app-card rounded-2xl p-5 border border-rose-300/80 dark:border-rose-500/40 flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden bg-white dark:bg-slate-900/60">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700 flex items-center gap-1.5">
                <AlertOctagon className="w-3 h-3" />
                <span>Trắng Thông Tin</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Thiếu Dữ Liệu Cốt Lõi</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Tài khoản không có Password lẫn không có Cookie sống (không đủ điều kiện khả dụng).
              </p>
            </div>
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 py-1">
              {stats?.missing_core !== undefined ? stats.missing_core.toLocaleString() : '-'}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-2">tài khoản</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 mt-4">
            <div className="flex gap-2">
              {onNavigateToAccounts && (
                <button
                  onClick={() => onNavigateToAccounts('missing_core')}
                  disabled={!stats?.missing_core}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-600 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Xem Danh Sách
                </button>
              )}
              <button
                onClick={() => handleClean('missing_core', 'AUTO_FIX', 'Thiếu Dữ Liệu Cốt Lõi')}
                disabled={loading || !stats?.missing_core}
                className="flex-[1.4] px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white border border-amber-700 dark:border-amber-500 shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Cứu Hộ Hàng Loạt</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleClean('missing_core', 'BLACKLIST', 'Thiếu Dữ Liệu Cốt Lõi')}
                disabled={loading || !stats?.missing_core}
                className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 dark:bg-purple-950/70 dark:hover:bg-purple-900/60 dark:text-purple-200 dark:border-purple-600 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Khóa Blacklist
              </button>
              <button
                onClick={() => handleClean('missing_core', 'DELETE', 'Thiếu Dữ Liệu Cốt Lõi')}
                disabled={loading || !stats?.missing_core}
                className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-950 border-2 border-rose-400 dark:bg-rose-950/70 dark:hover:bg-rose-900/60 dark:text-rose-200 dark:border-rose-600 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vào Thùng Rác</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 3: KHO THÙNG RÁC (RECYCLE BIN) */}
        <div className="app-card rounded-2xl p-5 border border-purple-300/80 dark:border-purple-500/40 flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden bg-white dark:bg-slate-900/60">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700 flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" />
                <span>Thùng Rác Tạm Lưu</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Kho Thùng Rác (Recycle Bin)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Tài khoản đã bị xóa mềm, được cô lập an toàn và có thể khôi phục lại tức thì.
              </p>
            </div>
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 py-1">
              {stats?.trash !== undefined ? stats.trash.toLocaleString() : '-'}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-2">tài khoản</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 mt-4">
            <div className="flex gap-2">
              {onNavigateToAccounts && (
                <button
                  onClick={() => onNavigateToAccounts('trash')}
                  disabled={!stats?.trash}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-600 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Xem Thùng Rác
                </button>
              )}
              <button
                onClick={() => handleClean('trash', 'RESTORE', 'Khôi Phục Toàn Bộ Thùng Rác')}
                disabled={loading || !stats?.trash}
                className="flex-[1.4] px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-700 dark:border-emerald-500 shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi Phục Tất Cả</span>
              </button>
            </div>
            {userRole === 'OWNER' && (
              <button
                onClick={() => handleClean('trash', 'HARD_DELETE', 'Dọn Sạch Vĩnh Viễn Thùng Rác')}
                disabled={loading || !stats?.trash}
                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 dark:border-rose-500 shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dọn Sạch Thùng Rác (Xóa Vĩnh Viễn)</span>
              </button>
            )}
          </div>
        </div>

        {/* CARD 4: BLACKLISTED */}
        <div className="app-card rounded-2xl p-5 border border-slate-300 dark:border-slate-700 flex flex-col justify-between hover:shadow-lg transition-all bg-white dark:bg-slate-900/60">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-700/50 dark:text-slate-200 dark:border-slate-600 flex items-center gap-1.5">
                <XCircle className="w-3 h-3" />
                <span>Đã Bị Khóa</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Tài Khoản Blacklisted</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Tài khoản đã bị đánh dấu khóa do hỏng, checkpoint hoặc không hợp lệ.
              </p>
            </div>
            <div className="text-3xl font-extrabold text-slate-700 dark:text-slate-300 py-1">
              {stats?.blacklisted !== undefined ? stats.blacklisted.toLocaleString() : '-'}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-2">tài khoản</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 mt-4">
            <div className="flex gap-2">
              {onNavigateToAccounts && (
                <button
                  onClick={() => onNavigateToAccounts('blacklisted')}
                  disabled={!stats?.blacklisted}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-600 transition-all text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Xem Danh Sách
                </button>
              )}
              <button
                onClick={() => handleClean('blacklisted', 'AUTO_FIX', 'Tài Khoản Blacklisted')}
                disabled={loading || !stats?.blacklisted}
                className="flex-[1.4] px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white border border-amber-700 dark:border-amber-500 shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Cứu Hộ Lại</span>
              </button>
            </div>
            <button
              onClick={() => handleClean('blacklisted', 'DELETE', 'Tài Khoản Blacklisted')}
              disabled={loading || !stats?.blacklisted}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-950 border-2 border-rose-400 dark:bg-rose-950/70 dark:hover:bg-rose-900/60 dark:text-rose-200 dark:border-rose-600 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3 h-3" />
              <span>Chuyển Vào Thùng Rác</span>
            </button>
          </div>
        </div>

        {/* CARD 5: TRÙNG LẶP */}
        <div className="app-card rounded-2xl p-5 border border-indigo-300/80 dark:border-indigo-500/40 flex flex-col justify-between hover:shadow-lg transition-all bg-white dark:bg-slate-900/60">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                <span>Trùng Khóa Chính</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Nhóm Trùng Lặp</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Phát hiện các nhóm tài khoản bị trùng username trên cùng một nền tảng.
              </p>
            </div>
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 py-1">
              {stats?.duplicates !== undefined ? stats.duplicates.toLocaleString() : '-'}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-2">nhóm trùng</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
            <p className="text-[11px] text-indigo-800 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 leading-relaxed font-medium">
              💡 Sử dụng công cụ "Quét Trùng Lặp" ở Tab Nhập Offline để gộp thông minh và giữ lại dữ liệu mới nhất.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant || 'danger'}
        loading={loading}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
