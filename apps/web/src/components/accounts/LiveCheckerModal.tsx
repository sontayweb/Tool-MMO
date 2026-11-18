'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import {
  Zap,
  Play,
  Square,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Clock,
  Coins,
  Download,
  Filter,
  FileSpreadsheet,
  Activity
} from 'lucide-react';

interface CheckResultItem {
  username: string;
  email?: string;
  status: 'LIVE' | 'WRONG_PASS' | 'BANNED' | 'CAPTCHA' | 'FAILED' | 'IVS_VERIFY';
  error_code: number;
  error_msg?: string;
  coins?: number;
  elapsed_ms?: number;
  raw_response?: any;
  checked_at?: string;
}

interface CheckerSessionData {
  id: string;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED';
  is_running: boolean;
  total: number;
  checked: number;
  progress_pct: number;
  live_count: number;
  error_count: number;
  banned_count: number;
  wrong_pass_count: number;
  ivs_count: number;
  total_coins: number;
  speed_per_sec: string;
  elapsed_sec: number;
  worker_status?: {
    is_alive: boolean;
    worker_name?: string | null;
    active_threads?: number;
    last_heartbeat_at?: number | null;
  };
  recent_results: CheckResultItem[];
}

interface LiveCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsernames?: string[];
  onFinished?: () => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const LiveCheckerModal: React.FC<LiveCheckerModalProps> = ({
  isOpen,
  onClose,
  selectedUsernames = [],
  onFinished,
  showToast
}) => {
  const [mode, setMode] = useState<'SELECTED' | 'UNVERIFIED' | 'ERRORS_ONLY' | 'ALL_SHOPEE'>(
    selectedUsernames.length > 0 ? 'SELECTED' : 'UNVERIFIED'
  );

  const [session, setSession] = useState<CheckerSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'ALL' | 'LIVE' | 'ERROR' | 'IVS'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cập nhật chế độ mặc định khi danh sách chọn thay đổi
  useEffect(() => {
    if (selectedUsernames.length > 0) {
      setMode('SELECTED');
    }
  }, [selectedUsernames]);

  // Hàm truy vấn trạng thái phiên
  const fetchSessionStatus = async () => {
    try {
      const data: CheckerSessionData = await api.get('/accounts/checker/session');
      setSession(data);
      if (!data.is_running && pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    } catch (e) {
      // Bỏ qua lỗi polling khi đóng
    }
  };

  // Khởi động vòng lặp polling khi modal mở
  useEffect(() => {
    if (isOpen) {
      fetchSessionStatus();
      pollTimerRef.current = setInterval(fetchSessionStatus, 800);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen]);

  // Bắt đầu phiên kiểm tra
  const handleStart = async () => {
    setLoading(true);
    try {
      const payload: any = { mode };
      if (mode === 'SELECTED') {
        payload.usernames = selectedUsernames;
      }

      const res = await api.post('/accounts/checker/start', payload);
      setSession(res);
      showToast?.(`Đã khởi động tiến trình kiểm tra ${res.total} tài khoản Shopee!`, 'success');

      // Đảm bảo polling được kích hoạt
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(fetchSessionStatus, 800);
      }
    } catch (err: any) {
      showToast?.(err.message || 'Không thể khởi động kiểm tra', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Dừng phiên kiểm tra
  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await api.post('/accounts/checker/stop');
      setSession(res);
      showToast?.('Đã dừng tiến trình kiểm tra!', 'info');
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      onFinished?.();
    } catch (err: any) {
      showToast?.(err.message || 'Không thể dừng tiến trình', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sao chép nguyên văn phản hồi Shopee (Bằng chứng khiếu nại)
  const handleCopyProof = (item: CheckResultItem) => {
    const proofText = JSON.stringify(
      {
        account: item.username,
        email: item.email,
        status: item.status,
        error_code: item.error_code,
        error_msg: item.error_msg,
        response_raw: item.raw_response,
        checked_at: item.checked_at || new Date().toISOString()
      },
      null,
      2
    );

    navigator.clipboard.writeText(proofText);
    setCopiedId(item.username);
    showToast?.(`Đã chép bằng chứng Shopee của nick ${item.username}!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Sao chép danh sách nick LIVE
  const handleCopyLiveList = () => {
    if (!session || !session.recent_results) return;
    const liveItems = session.recent_results.filter(
      r => r.status === 'LIVE' || r.error_code === 0
    );
    if (liveItems.length === 0) {
      showToast?.('Chưa có tài khoản LIVE nào!', 'info');
      return;
    }

    const text = liveItems
      .map(i => `${i.username}\t${i.email || ''}\tXu: ${i.coins || 0}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    showToast?.(`Đã chép ${liveItems.length} tài khoản LIVE vào bộ nhớ tạm!`, 'success');
  };

  // Xuất file khiếu nại tài khoản lỗi gửi shop
  const [exportingClaim, setExportingClaim] = useState<boolean>(false);
  const handleExportClaim = async (format: 'EXCEL' | 'TXT' = 'EXCEL') => {
    setExportingClaim(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const response = await fetch('/api/accounts/checker/export-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          session_id: session?.id,
          format
        })
      });

      if (!response.ok) {
        throw new Error('Không thể xuất file khiếu nại');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'EXCEL'
        ? `khieu_nai_shopee_${session?.id || Date.now()}.xlsx`
        : `khieu_nai_shopee_${session?.id || Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast?.(`Đã tải file khiếu nại ${session?.error_count || 0} tài khoản lỗi!`, 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Lỗi khi xuất file khiếu nại', 'error');
    } finally {
      setExportingClaim(false);
    }
  };

  // Lọc kết quả streaming
  const filteredResults = (session?.recent_results || []).filter(item => {
    if (filterType === 'LIVE') return item.status === 'LIVE' || item.error_code === 0;
    if (filterType === 'ERROR')
      return item.status === 'WRONG_PASS' || item.status === 'BANNED' || item.error_code === 2 || item.error_code === 9;
    if (filterType === 'IVS') return item.status === 'IVS_VERIFY' || item.error_code === 98;
    return true;
  });

  const isRunning = session?.is_running ?? false;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500">
            <Zap className="w-4 h-4 fill-orange-400 text-orange-400" />
          </div>
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
              Kiểm Tra Shopee Trực Tiếp (Live Checker)
              {isRunning && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Đang chạy ngầm
                </span>
              )}
              {session?.worker_status?.is_alive ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" title="Python Worker đang kết nối và xử lý">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Worker Trực Chiến ({session.worker_status.active_threads || 1} luồng)
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30" title="Chưa phát hiện Python Worker kết nối. Hãy bật script shopee_arms_sync.py">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Worker Chưa Kết Nối
                </span>
              )}
            </div>
            <div className="text-xs text-desc">
              Cơ chế Dynamic Token Rotation • Vượt Captcha 100% • Lưu bằng chứng khiếu nại
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* KHU VỰC CẤU HÌNH KHI CHƯA CHẠY */}
        {!isRunning && (!session || session.status === 'IDLE' || session.status === 'COMPLETED' || session.status === 'STOPPED') && (
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300">Chọn nguồn tài khoản muốn kiểm tra:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {selectedUsernames.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode('SELECTED')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    mode === 'SELECTED'
                      ? 'bg-orange-500/10 border-orange-500 text-orange-400 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs">Đã chọn ({selectedUsernames.length})</div>
                  <div className="text-[10px] opacity-70">Chỉ nick đang tích</div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setMode('UNVERIFIED')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  mode === 'UNVERIFIED'
                    ? 'bg-orange-500/10 border-orange-500 text-orange-400 font-bold'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs">Chưa Kiểm Tra</div>
                <div className="text-[10px] opacity-70">Kho nick UNKNOWN</div>
              </button>

              <button
                type="button"
                onClick={() => setMode('ERRORS_ONLY')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  mode === 'ERRORS_ONLY'
                    ? 'bg-orange-500/10 border-orange-500 text-orange-400 font-bold'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs">Check Lại Nick Lỗi</div>
                <div className="text-[10px] opacity-70">Tất cả nick ERROR</div>
              </button>

              <button
                type="button"
                onClick={() => setMode('ALL_SHOPEE')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  mode === 'ALL_SHOPEE'
                    ? 'bg-orange-500/10 border-orange-500 text-orange-400 font-bold'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs">Toàn Bộ Kho Shopee</div>
                <div className="text-[10px] opacity-70">Chạy toàn bộ tài khoản</div>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-desc flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Giãn cách an toàn 0.6s/nick • Tự động giải mã mật khẩu an toàn trong RAM</span>
              </div>
              <button
                onClick={handleStart}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-orange-950/50 flex items-center gap-2 transition-all"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                <span>Bắt Đầu Kiểm Tra</span>
              </button>
            </div>
          </div>
        )}

        {/* TIẾN TRÌNH VÀ THẺ TỔNG HỢP KPI */}
        {session && session.total > 0 && (
          <div className="space-y-3">
            {/* Thanh tiến trình */}
            <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">
                    Đã kiểm tra: {session.checked} / {session.total}
                  </span>
                  <span className="text-desc text-[11px]">({session.progress_pct}%)</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-desc">
                  <span>Tốc độ: <strong className="text-white">{session.speed_per_sec}</strong> nick/s</span>
                  {isRunning && (
                    <button
                      onClick={handleStop}
                      disabled={loading}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-semibold text-[11px] flex items-center gap-1 transition-all"
                    >
                      <Square className="w-3 h-3 fill-rose-300" />
                      <span>Dừng Lại</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, session.progress_pct))}%` }}
                />
              </div>
            </div>

            {/* 4 Thẻ KPI thời gian thực */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <div className="flex items-center justify-between text-[11px] opacity-80">
                  <span>🟢 LIVE</span>
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="text-lg font-black text-emerald-300 mt-0.5">{session.live_count}</div>
                <div className="text-[10px] text-emerald-400/80 flex items-center gap-1 mt-0.5">
                  <Coins className="w-3 h-3 text-amber-400" />
                  <span>{session.total_coins.toLocaleString('vi-VN')} Xu</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <div className="flex items-center justify-between text-[11px] opacity-80">
                  <span>🔴 LỖI / DIE</span>
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div className="text-lg font-black text-rose-300 mt-0.5">{session.error_count}</div>
                <div className="text-[10px] text-rose-400/80 mt-0.5">
                  F02: {session.banned_count} • Pass: {session.wrong_pass_count}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <div className="flex items-center justify-between text-[11px] opacity-80">
                  <span>🟡 CẦN OTP (IVS)</span>
                  <Ban className="w-3.5 h-3.5" />
                </div>
                <div className="text-lg font-black text-amber-300 mt-0.5">{session.ivs_count}</div>
                <div className="text-[10px] text-amber-400/80 mt-0.5">Đúng pass, cần mail OTP</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-slate-300">
                <div className="flex items-center justify-between text-[11px] opacity-80">
                  <span>⏱️ THỜI GIAN</span>
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="text-lg font-black text-white mt-0.5">{session.elapsed_sec}s</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {session.status === 'COMPLETED' ? 'Đã hoàn tất 100%' : 'Đang xử lý ngầm...'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* THANH BỘ LỌC KẾT QUẢ VÀ NÚT XUẤT */}
        {session && session.recent_results && session.recent_results.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            {/* Filter pills */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Tất Cả ({session.recent_results.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('LIVE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-emerald-400'
                }`}
              >
                Chỉ LIVE ({session.live_count})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('ERROR')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === 'ERROR'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-rose-400'
                }`}
              >
                Chỉ LỖI ({session.error_count})
              </button>
              {session.ivs_count > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterType('IVS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filterType === 'IVS'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-amber-400'
                  }`}
                >
                  Cần OTP ({session.ivs_count})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Nút Xuất Khiếu Nại Shop */}
              {session.error_count > 0 && (
                <button
                  type="button"
                  onClick={() => handleExportClaim('EXCEL')}
                  disabled={exportingClaim}
                  className="px-3 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Tải bảng tính Excel chứa danh sách tài khoản bị khóa F02 và sai mật khẩu kèm bằng chứng để gửi shop khiếu nại"
                >
                  {exportingClaim ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>Xuất Khiếu Nại Shop ({session.error_count})</span>
                </button>
              )}

              {/* Quick Export Live button */}
              <button
                type="button"
                onClick={handleCopyLiveList}
                className="px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Sao chép danh sách các nick LIVE thành công"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Copy Nick LIVE</span>
              </button>
            </div>
          </div>
        )}

        {/* BẢNG KẾT QUẢ STREAMING TRỰC TIẾP */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs">
            {filteredResults.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-sans">
                {isRunning
                  ? 'Đang gửi request kiểm tra tài khoản đầu tiên...'
                  : 'Chưa có dữ liệu kiểm tra. Bấm "Bắt Đầu Kiểm Tra" để chạy!'}
              </div>
            ) : (
              filteredResults.map((item, idx) => {
                const isLive = item.status === 'LIVE' || item.error_code === 0;
                const isWrongPass = item.status === 'WRONG_PASS' || item.error_code === 2;
                const isBanned = item.status === 'BANNED' || item.error_code === 9;
                const isIvs = item.status === 'IVS_VERIFY' || item.error_code === 98;

                return (
                  <div
                    key={`${item.username}-${idx}`}
                    className="p-2.5 px-3 flex items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
                  >
                    {/* Username & Email */}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white truncate flex items-center gap-1.5 font-sans">
                        <span>{item.username}</span>
                        {item.elapsed_ms && (
                          <span className="text-[10px] text-slate-500 font-mono font-normal">
                            ({item.elapsed_ms}ms)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate font-mono">
                        {item.email || '—'}
                      </div>
                    </div>

                    {/* Badge Trạng thái */}
                    <div className="flex items-center gap-2">
                      {isLive && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>LIVE</span>
                          {item.coins !== undefined && item.coins > 0 && (
                            <span className="text-amber-300 font-semibold ml-1">
                              • {item.coins.toLocaleString('vi-VN')} Xu
                            </span>
                          )}
                        </span>
                      )}

                      {isWrongPass && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold text-[11px]">
                          🔴 Sai Mật Khẩu (2)
                        </span>
                      )}

                      {isBanned && (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold text-[11px]">
                          🚫 Khóa F02 (9)
                        </span>
                      )}

                      {isIvs && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold text-[11px]">
                          🟡 Cần OTP Mail (98)
                        </span>
                      )}

                      {!isLive && !isWrongPass && !isBanned && !isIvs && (
                        <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-[11px]">
                          ⚠️ Mã {item.error_code}
                        </span>
                      )}

                      {/* Nút Sao Chép Bằng Chứng Khiếu Nại */}
                      <button
                        type="button"
                        onClick={() => handleCopyProof(item)}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-[11px]"
                        title="Sao chép toàn bộ phản hồi JSON từ Shopee để làm bằng chứng khiếu nại"
                      >
                        {copiedId === item.username ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Bằng chứng</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-desc pt-1">
          <span>* Các tài khoản Lỗi được lưu trạng thái <strong>ERROR</strong> (không đẩy vào Blacklist).</span>
          <button
            onClick={() => {
              onClose();
              onFinished?.();
            }}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
