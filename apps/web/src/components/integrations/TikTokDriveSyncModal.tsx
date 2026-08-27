'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Music2,
  RefreshCw,
  CheckCircle,
  Database,
  Smartphone,
  Mail,
  Key,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';

interface TikTokDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const TikTokDriveSyncModal: React.FC<TikTokDriveSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [isOpen]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status?.progress?.logs]);

  const startPolling = () => {
    stopPolling();
    pollTimerRef.current = setInterval(() => {
      loadStatus(true);
    }, 2000);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const loadStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getTikTokDriveStatus();
      setStatus(res);
      setSyncing(!!res.progress?.is_running);

      if (res.progress?.stage === 'COMPLETED' && onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      console.error('Failed to load TikTok Drive status:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleStartSync = async () => {
    try {
      setSyncing(true);
      await api.startTikTokDriveSync();
      setToastMsg('Đã kích hoạt cào kho TikTok từ Google Drive thành công!');
      loadStatus(true);
    } catch (err: any) {
      setToastMsg(`Lỗi: ${err.message}`);
    }
  };

  const progress = status?.progress || {};
  const isConnected = !!status?.connected;
  const isRunning = !!progress.is_running;

  const filePercent =
    progress.files_total > 0
      ? Math.min(100, Math.round((progress.files_processed / progress.files_total) * 100))
      : 0;

  const machineKeys = Object.keys(progress.machines_detected || {});

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Music2 className="w-5 h-5 text-white animate-bounce" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-pink-400">
              Phân Hệ Cào & Đồng Bộ TikTok (Google Drive)
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Chuyên bóc tách Cookie ttwid, Hotmail/Outlook, Device UUID và Dàn máy Boxphone
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Toast */}
        {toastMsg && (
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 text-sm flex items-center justify-between animate-fadeIn">
            <span>{toastMsg}</span>
            <button onClick={() => setToastMsg(null)} className="text-cyan-400 hover:text-white text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Quality Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Tổng Nick TikTok</span>
              <Database className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-lg font-extrabold text-cyan-400">
              {(progress.accounts_found || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">
              +{(progress.accounts_inserted || 0).toLocaleString()} mới
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Có Cookie ttwid</span>
              <Key className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <div className="text-lg font-extrabold text-pink-400">
              {(progress.accounts_with_cookie || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              {progress.accounts_found > 0
                ? `${Math.round((progress.accounts_with_cookie / progress.accounts_found) * 100)}% tỷ lệ`
                : '0%'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Có Hotmail/Pass</span>
              <Mail className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-extrabold text-amber-400">
              {(progress.accounts_with_email || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">Mail & Pass Mail</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Dàn Máy Boxphone</span>
              <Smartphone className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-extrabold text-purple-400">
              {machineKeys.length} máy
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              {(progress.accounts_with_machine || 0).toLocaleString()} nick đã map
            </div>
          </div>
        </div>

        {/* Action Header Banner */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-pink-950/20 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-sm font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
              <Zap className="w-4 h-4 text-cyan-400" />
              1-Click Cào & Chuẩn Hóa Kho TikTok
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Khóa Snapshot an toàn tự động + Định danh độc lập 100% không đè Shopee
            </div>
          </div>

          <button
            onClick={handleStartSync}
            disabled={isRunning || !isConnected}
            className={`btn bg-gradient-to-r from-cyan-500 via-sky-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-slate-950 text-sm font-extrabold px-6 py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 flex items-center gap-2 shrink-0 transition-all ${isRunning || !isConnected ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Đang Cào Dữ Liệu...' : 'Bắt Đầu Cào TikTok Ngay'}
          </button>
        </div>

        {/* Progress bar */}
        {progress.stage && progress.stage !== 'IDLE' && (
          <div className="space-y-2 p-4 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-400">
                {progress.stage === 'SCANNING_TIKTOK_FILES' && '🔍 Đang tìm kiếm các file TikTok trên Google Drive...'}
                {progress.stage === 'PARSING_TIKTOK_DATA' &&
                  ` Đang bóc tách: ${progress.current_file || '...'} (Tab: ${progress.current_tab || '...'})`}
                {progress.stage === 'COMPLETED' && '🎉 Đã hoàn tất đồng bộ toàn bộ kho TikTok!'}
                {progress.stage === 'ERROR' && '❌ Gặp lỗi trong tiến trình'}
              </span>
              <span className="text-[var(--text-muted)]">
                {progress.files_processed} / {progress.files_total} files ({filePercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-[var(--surface-card)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-pink-500 transition-all duration-500 rounded-full"
                style={{ width: `${filePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Terminal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
            <span className="flex items-center gap-1.5 font-semibold text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Nhật Ký Tiến Trình TikTok Ingress Thời Gian Thực
            </span>
            <span>{progress.logs?.length || 0} dòng</span>
          </div>

          <div className="bg-[#070b14] text-gray-300 font-mono text-xs p-4 rounded-2xl h-44 overflow-y-auto border border-cyan-950/80 space-y-1.5 shadow-inner">
            {progress.logs && progress.logs.length > 0 ? (
              progress.logs.map((log: string, idx: number) => (
                <div
                  key={idx}
                  className={`leading-relaxed ${log.includes('HOÀN TẤT') || log.includes('✅')
                      ? 'text-cyan-400 font-semibold'
                      : log.includes('LỖI') || log.includes('❌')
                        ? 'text-rose-400 font-semibold'
                        : log.includes('⚠️')
                          ? 'text-amber-400'
                          : 'text-gray-300'
                    }`}
                >
                  {log}
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-14">
                Chưa có tiến trình cào TikTok nào đang chạy. Bấm "Bắt Đầu Cào TikTok Ngay" ở trên.
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </Modal>
  );
};
