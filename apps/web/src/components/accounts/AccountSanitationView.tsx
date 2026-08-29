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

  const handleClean = (category: string, action: 'DELETE' | 'BLACKLIST' | 'AUTO_FIX' | 'HARD_DELETE', label: string) => {
    let actionTitle = action === 'DELETE' ? 'CHUYỂN VÀO THÙNG RÁC' : action === 'HARD_DELETE' ? 'XÓA VĨNH VIỄN' : action === 'BLACKLIST' ? 'KHÓA BLACKLIST' : 'CỨU HỘ DỮ LIỆU';
    
    setConfirmDialog({
      isOpen: true,
      title: `Xác nhận ${actionTitle} - ${label}`,
      message: action === 'AUTO_FIX' 
        ? `Hệ thống sẽ chạy thuật toán bóc tách dữ liệu gốc cho nhóm "${label}". Những tài khoản bóc tách được Username/Password hợp lệ sẽ được chuyển về AVAILABLE. Bạn có chắc chắn muốn tiến hành?`
        : action === 'HARD_DELETE'
        ? `CẢNH BÁO: Bạn đang thực hiện XÓA VĨNH VIỄN toàn bộ danh sách "${label}". Dữ liệu này sẽ không thể khôi phục. Bạn có chắc chắn muốn tiếp tục?`
        : `Bạn đang thực hiện thao tác ${actionTitle} đối với nhóm "${label}". Dữ liệu sẽ được chuyển trạng thái an toàn. Bạn có chắc chắn muốn tiếp tục?`,
      confirmText: 'Đồng ý thực hiện',
      variant: action === 'HARD_DELETE' ? 'danger' : action === 'AUTO_FIX' ? 'warning' : 'info',
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-title">
            <ShieldAlert className="text-amber-500 w-6 h-6" />
            <span>Trung Tâm Cứu Hộ & Dọn Dẹp Dữ Liệu (Sanitation Hub)</span>
          </h2>
          <p className="text-xs text-desc mt-1">
            Không gian chuyên biệt để phát hiện các tài khoản bất thường vi phạm Domain Rules, cứu hộ lệch cột và quản lý thùng rác.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-input)] hover:bg-white/10 text-title border border-[var(--border-subtle)] transition-all flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Tải Lại Số Liệu</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: VI PHẠM QUY CHUẨN NỀN TẢNG (CORRUPTED) */}
        <div className="app-card rounded-2xl p-5 border border-amber-500/30 flex flex-col justify-between hover:shadow-xl transition-all relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                <span>Vi Phạm Domain Rules</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-title">Tài Khoản Bất Thường / Lỗi</h3>
              <p className="text-xs text-desc mt-1 leading-relaxed">
                Token Boxphone (M.C...), số STT dòng, Base64 dài &gt; 35 ký tự, Email sai định dạng.
              </p>
            </div>
            <div className="text-3xl font-extrabold text-amber-500 py-1">
              {stats?.corrupted !== undefined ? stats.corrupted.toLocaleString() : '-'}
              <span className="text-xs text-desc font-normal ml-2">tài khoản</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2 mt-4">
            <div className="flex gap-2">
              {onNavigateToAccounts && (
                <button
                  onClick={() => onNavigateToAccounts('corrupted')}
                  disabled={!stats?.corrupted}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-input)] hover:bg-white/10 text-title border border-[var(--border-subtle)] transition-all text-center"
                >
                  Xem Danh Sách
                </button>
              )}
              <button
                onClick={() => handleClean('corrupted', 'AUTO_FIX', 'Tài Khoản Vi Phạm Domain Rules')}
                disabled={loading || !stats?.corrupted}
                className="flex-[1.4] px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-1.5"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Cứu Hộ Hàng Loạt</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleClean('corrupted', 'BLACKLIST', 'Tài Khoản Vi Phạm Domain Rules')}
                disabled={loading || !stats?.corrupted}
                className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-all"
              >
                Khóa Blacklist
              </button>
              <button
                onClick={() => handleClean('corrupted', 'DELETE', 'Tài Khoản Vi Phạm Domain Rules')}
                disabled={loading || !stats?.corrupted}
                className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vào Thùng Rác</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: THIẾU DỮ LIỆU CỐT LÕI (MISSING CORE) */}
        <div className="app-card rounded-2xl p-5 border border-rose-500/30 flex flex-col justify-between hover:shadow-xl transition-all relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center gap-1.5">
                <AlertOctagon className="w-3 h-3" />
                <span>Trắng Thông Tin</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-title">Thiếu Dữ Liệu Cốt Lõi</h3>
              <p className="text-xs text-desc mt-1 leading-relaxed">
                Tài khoản không có Password LẪN không có Cookie sống (xác không hồn).
              </p>
            </div>
            <div className="text-3xl font-extrabold text-rose-500 py-1">
              {stats?.missing_core !== undefined ? stats.missing_core.toLocaleString() : '-'}
              <span className="text-xs text-desc font-normal ml-2">tài khoản</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2 mt-4">
            <div className="flex gap-2">
              {onNavigateToAccounts && (
                <button
                  onClick={() => onNavigateToAccounts('missing_core')}
                  disabled={!stats?.missing_core}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-input)] hover:bg-white/10 text-title border border-[var(--border-subtle)] transition-all text-center"
                >
                  Xem Danh Sách
                </button>
              )}
              <button
                onClick={() => handleClean('missing_core', 'AUTO_FIX', 'Thiếu Dữ Liệu Cốt Lõi')}
                disabled={loading || !stats?.missing_core}
                className="flex-[1.4] px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-1.5"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Cứu Hộ Hàng Loạt</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleClean('missing_core', 'BLACKLIST', 'Thiếu Dữ Liệu Cốt Lõi')}
                disabled={loading || !stats?.missing_core}
                className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-all"
              >
                Khóa Blacklist
              </button>
              <button
                onClick={() => handleClean('missing_core', 'DELETE', 'Thiếu Dữ Liệu Cốt Lõi')}
                disabled={loading || !stats?.missing_core}
                className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vào Thùng Rác</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 3: KHO THÙNG RÁC (RECYCLE BIN) */}
        <div className="app-card rounded-2xl p-5 border border-purple-500/30 flex flex-col justify-between hover:shadow-xl transition-all relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" />
                <span>Thùng Rác Tạm Lưu</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-title">Kho Thùng Rác (Recycle Bin)</h3>
              <p className="text-xs text-desc mt-1 leading-relaxed">
                Tài khoản đã bị xóa mềm, được cô lập an toàn và có thể khôi phục lại tức thì.
              </p>
            </div>
            <div className="text-3xl font-extrabold text-purple-400 py-1">
              {stats?.trash !== undefined ? stats.trash.toLocaleString() : '-'}
              <span className="text-xs text-desc font-normal ml-2">tài khoản</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2 mt-4">
            <div className="flex gap-2">
              {onNavigateToAccounts && (
                <button
                  onClick={() => onNavigateToAccounts('trash')}
                  disabled={!stats?.trash}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition-all text-center"
                >
                  Xem Thùng Rác
                </button>
              )}
              <button
                onClick={() => handleClean('trash', 'AUTO_FIX', 'Khôi Phục Toàn Bộ Thùng Rác')}
                disabled={loading || !stats?.trash}
                className="flex-[1.4] px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi Phục Tất Cả</span>
              </button>
            </div>
            {userRole === 'OWNER' && (
              <button
                onClick={() => handleClean('trash', 'HARD_DELETE', 'Dọn Sạch Vĩnh Viễn Thùng Rác')}
                disabled={loading || !stats?.trash}
                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dọn Sạch Thùng Rác (Xóa Vĩnh Viễn)</span>
              </button>
            )}
          </div>
        </div>

        {/* CARD 4: BLACKLISTED */}
        <div className="app-card rounded-2xl p-5 border border-slate-700/50 flex flex-col justify-between hover:shadow-xl transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-500/15 text-slate-400 border border-slate-500/30 flex items-center gap-1.5">
                <XCircle className="w-3 h-3" />
                <span>Đã Bị Khóa</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-title">Tài Khoản Blacklisted</h3>
              <p className="text-xs text-desc mt-1 leading-relaxed">
                Tài khoản đã bị đánh dấu khóa do hỏng, checkpoint hoặc rác không thể cứu.
              </p>
            </div>
            <div className="text-3xl font-extrabold text-slate-400 py-1">
              {stats?.blacklisted !== undefined ? stats.blacklisted.toLocaleString() : '-'}
              <span className="text-xs text-desc font-normal ml-2">tài khoản</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex gap-2 mt-4">
            {onNavigateToAccounts && (
              <button
                onClick={() => onNavigateToAccounts('blacklisted')}
                disabled={!stats?.blacklisted}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-input)] hover:bg-white/10 text-title border border-[var(--border-subtle)] transition-all text-center"
              >
                Xem Danh Sách
              </button>
            )}
            <button
              onClick={() => handleClean('blacklisted', 'DELETE', 'Tài Khoản Blacklisted')}
              disabled={loading || !stats?.blacklisted}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Vào Thùng Rác</span>
            </button>
          </div>
        </div>

        {/* CARD 5: TRÙNG LẶP */}
        <div className="app-card rounded-2xl p-5 border border-indigo-500/30 flex flex-col justify-between hover:shadow-xl transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                <span>Trùng Khóa Chính</span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-title">Nhóm Trùng Lặp</h3>
              <p className="text-xs text-desc mt-1 leading-relaxed">
                Phát hiện các nhóm tài khoản bị trùng username trên cùng một nền tảng.
              </p>
            </div>
            <div className="text-3xl font-extrabold text-indigo-400 py-1">
              {stats?.duplicates !== undefined ? stats.duplicates.toLocaleString() : '-'}
              <span className="text-xs text-desc font-normal ml-2">nhóm trùng</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] mt-4">
            <p className="text-[11px] text-indigo-300 leading-relaxed font-medium">
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
