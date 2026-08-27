'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Play,
  FileSpreadsheet,
  Layers,
  Check,
  ExternalLink,
  ShieldCheck,
  Settings,
  Sparkles,
  Database,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [intervalMin, setIntervalMin] = useState(60);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch status on open
  useEffect(() => {
    if (isOpen) {
      loadStatus();
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [isOpen]);

  // Scroll logs to bottom
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
      const res = await api.getGoogleDriveStatus();
      setStatus(res);
      setAutoSync(!!res.auto_sync_enabled);
      setIntervalMin(res.sync_interval_minutes || 60);
      setSyncing(!!res.progress?.is_running);

      if (res.progress?.stage === 'COMPLETED' && onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      console.error('Failed to load Google Drive status:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleStartSync = async () => {
    try {
      setSyncing(true);
      await api.startGoogleDriveSync();
      setToastMsg('Đã kích hoạt tiến trình đồng bộ ngầm thành công!');
      loadStatus(true);
    } catch (err: any) {
      setToastMsg(`Lỗi: ${err.message}`);
    }
  };

  const handleSaveSettings = async (enabled: boolean, interval: number) => {
    try {
      await api.saveGoogleDriveSettings({
        auto_sync_enabled: enabled,
        sync_interval_minutes: interval,
      });
      setAutoSync(enabled);
      setIntervalMin(interval);
      setToastMsg(`Đã cập nhật tự động quét: ${enabled ? `mỗi ${interval} phút` : 'TẮT'}`);
    } catch (err: any) {
      setToastMsg(`Lỗi cập nhật: ${err.message}`);
    }
  };

  const handleGetAuthUrl = async () => {
    try {
      const res = await api.getGoogleDriveAuthUrl();
      if (res.auth_url) {
        window.open(res.auth_url, '_blank');
      }
    } catch (err: any) {
      setToastMsg(`Lỗi lấy link đăng nhập: ${err.message}`);
    }
  };

  const progress = status?.progress || {};
  const isConnected = !!status?.connected;
  const isRunning = !!progress.is_running;

  // Calculate percentage
  const filePercent =
    progress.files_total > 0
      ? Math.min(100, Math.round((progress.files_processed / progress.files_total) * 100))
      : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Cloud className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gradient-primary">
              Đồng Bộ Google Drive Tự Động
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Quét toàn bộ Sheets & Excel trên Drive nạp thẳng vào Kho DWH
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Toast alert */}
        {toastMsg && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm flex items-center justify-between animate-fadeIn">
            <span>{toastMsg}</span>
            <button
              onClick={() => setToastMsg(null)}
              className="text-blue-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Status Card Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                isConnected ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <div>
              <div className="text-xs text-[var(--text-muted)]">Kết Nối OAuth Drive</div>
              <div className="text-sm font-bold text-[var(--text-primary)]">
                {isConnected ? 'Đã Kết Nối Sẵn Sàng' : 'Chưa Kết Nối'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center gap-3">
            <Database className="w-4 h-4 text-purple-400" />
            <div>
              <div className="text-xs text-[var(--text-muted)]">Tài Khoản Đã Tìm Thấy</div>
              <div className="text-sm font-bold text-purple-400">
                {(progress.accounts_total_found || 0).toLocaleString()} nick
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs text-[var(--text-muted)]">Nạp Thành Công</div>
              <div className="text-sm font-bold text-emerald-400">
                +{(progress.accounts_inserted || 0).toLocaleString()} mới (+{(progress.accounts_updated || 0).toLocaleString()} đè)
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar & Controls */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/20 via-purple-900/10 to-transparent border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <div className="text-sm font-bold text-white flex items-center gap-2 justify-center md:justify-start">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              1-Click Quét & Nạp Toàn Bộ Google Drive
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Tự động nhận diện Cookie, Token, Email, phân loại Shopee & TikTok
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {!isConnected ? (
              <button
                onClick={handleGetAuthUrl}
                className="btn btn-secondary text-sm flex items-center gap-2 w-full md:w-auto justify-center"
              >
                <ExternalLink className="w-4 h-4" />
                Liên Kết Tài Khoản Drive
              </button>
            ) : (
              <button
                onClick={handleStartSync}
                disabled={isRunning}
                className={`btn btn-primary text-sm font-bold flex items-center gap-2 px-6 py-2.5 shadow-lg shadow-blue-500/30 w-full md:w-auto justify-center ${
                  isRunning ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Đang Đồng Bộ Ngầm...' : 'Bắt Đầu Đồng Bộ Ngay'}
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar (if running or completed) */}
        {progress.stage && progress.stage !== 'IDLE' && (
          <div className="space-y-2 p-4 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-400">
                {progress.stage === 'SCANNING_DRIVE' && '🔍 Đang quét danh mục file trên Drive...'}
                {progress.stage === 'PROCESSING_FILES' && `⚡ Đang xử lý: ${progress.current_file || '...'}`}
                {progress.stage === 'COMPLETED' && '🎉 Đã hoàn tất đồng bộ toàn bộ file!'}
                {progress.stage === 'ERROR' && '❌ Gặp lỗi trong tiến trình'}
              </span>
              <span className="text-[var(--text-muted)]">
                {progress.files_processed} / {progress.files_total} files ({filePercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-[var(--surface-card)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${filePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Auto Sync Settings Toggle */}
        <div className="p-4 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Tự Động Quét Định Kỳ (Auto Cron)
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Tự động chạy ngầm mỗi {intervalMin} phút để cập nhật file mới
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={intervalMin}
              onChange={(e) => handleSaveSettings(autoSync, parseInt(e.target.value, 10))}
              className="bg-[var(--surface-card)] text-xs text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value={15}>Mỗi 15 phút</option>
              <option value={30}>Mỗi 30 phút</option>
              <option value={60}>Mỗi 1 tiếng</option>
              <option value={360}>Mỗi 6 tiếng</option>
            </select>

            <button
              onClick={() => handleSaveSettings(!autoSync, intervalMin)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSync ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSync ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Live Terminal Logs Window */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Nhật Ký Tiến Trình Thời Gian Thực (Live Ingress Logs)
            </span>
            <span>{progress.logs?.length || 0} dòng</span>
          </div>

          <div className="bg-[#0b0f19] text-gray-300 font-mono text-xs p-4 rounded-2xl h-48 overflow-y-auto border border-gray-800 space-y-1.5 shadow-inner">
            {progress.logs && progress.logs.length > 0 ? (
              progress.logs.map((log: string, idx: number) => (
                <div
                  key={idx}
                  className={`leading-relaxed ${
                    log.includes('HOÀN THÀNH') || log.includes('✅')
                      ? 'text-emerald-400 font-semibold'
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
              <div className="text-gray-500 text-center py-16">
                Chưa có tiến trình đồng bộ nào đang chạy. Hãy bấm "Bắt Đầu Đồng Bộ Ngay" ở trên.
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </Modal>
  );
};
