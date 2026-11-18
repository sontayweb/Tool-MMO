'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  Music2,
  ShoppingBag,
  RefreshCw,
  Clock,
  Database,
  Key,
  Mail,
  Smartphone,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Play,
  Zap,
  Layers,
  History,
  FileSpreadsheet,
  Settings,
  ExternalLink,
  Search,
} from 'lucide-react';
import { api } from '../../lib/api';

interface DriveIngressHubProps {
  onSyncComplete?: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const DriveIngressHub: React.FC<DriveIngressHubProps> = ({
  onSyncComplete,
  showToast,
}) => {
  const [activeSubsystemTab, setActiveSubsystemTab] = useState<'tiktok' | 'shopee' | 'autosync'>('shopee');

  // TikTok State
  const [tiktokStatus, setTiktokStatus] = useState<any>(null);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [tiktokSyncing, setTiktokSyncing] = useState(false);

  // Shopee / General Drive State
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(60);

  // Logs refs
  const tiktokLogsRef = useRef<HTMLDivElement>(null);
  const driveLogsRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchAllStatus();
    startPolling();
    return () => stopPolling();
  }, []);

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(() => {
      fetchAllStatus(true);
    }, 2500);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchAllStatus = async (silent = false) => {
    if (!silent) {
      setTiktokLoading(true);
      setDriveLoading(true);
    }
    try {
      const [ttRes, driveRes] = await Promise.all([
        api.getTikTokDriveStatus().catch(() => null),
        api.getGoogleDriveStatus().catch(() => null),
      ]);

      if (ttRes) {
        setTiktokStatus(ttRes);
        setTiktokSyncing(!!ttRes.progress?.is_running);
      }
      if (driveRes) {
        setDriveStatus(driveRes);
        setDriveSyncing(!!driveRes.progress?.is_running);
        setAutoSyncEnabled(!!driveRes.auto_sync_enabled);
        setIntervalMinutes(driveRes.sync_interval_minutes || 60);
      }
    } catch (err) {
      console.error('Failed to fetch Ingress status:', err);
    } finally {
      if (!silent) {
        setTiktokLoading(false);
        setDriveLoading(false);
      }
    }
  };

  useEffect(() => {
    if (tiktokLogsRef.current) {
      tiktokLogsRef.current.scrollTop = tiktokLogsRef.current.scrollHeight;
    }
  }, [tiktokStatus?.progress?.logs]);

  useEffect(() => {
    if (driveLogsRef.current) {
      driveLogsRef.current.scrollTop = driveLogsRef.current.scrollHeight;
    }
  }, [driveStatus?.progress?.logs]);

  const handleStartTikTokSync = async () => {
    try {
      setTiktokSyncing(true);
      await api.startTikTokDriveSync();
      showToast('Đã kích hoạt cào kho TikTok từ Google Drive!', 'success');
      fetchAllStatus(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi kích hoạt cào TikTok', 'error');
    }
  };

  const handleStartDriveSync = async () => {
    try {
      setDriveSyncing(true);
      await api.startGoogleDriveSync();
      showToast('Đã kích hoạt đồng bộ Google Drive tổng thể!', 'success');
      fetchAllStatus(true);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi kích hoạt đồng bộ Drive', 'error');
    }
  };

  const handleSaveAutoSync = async (enabled: boolean, interval: number) => {
    try {
      await api.saveGoogleDriveSettings({
        auto_sync_enabled: enabled,
        sync_interval_minutes: interval,
      });
      setAutoSyncEnabled(enabled);
      setIntervalMinutes(interval);
      showToast(`Đã lưu cấu hình tự động quét: ${enabled ? `mỗi ${interval} phút` : 'TẮT'}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu cấu hình', 'error');
    }
  };

  const isConnected = !!(tiktokStatus?.connected || driveStatus?.connected);
  const ttProgress = tiktokStatus?.progress || {};
  const driveProgress = driveStatus?.progress || {};

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* 🧭 Sleek Flat Linear-style Toolbar & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800 text-xs">
        {/* Subsystem Navigation Tabs */}
        <div className="flex items-center gap-1.5 select-none flex-wrap">
          <button
            onClick={() => setActiveSubsystemTab('shopee')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubsystemTab === 'shopee'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>ĐỒNG BỘ SHOPEE</span>
            {driveProgress.is_running && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
          </button>

          <button
            onClick={() => setActiveSubsystemTab('tiktok')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubsystemTab === 'tiktok'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>ĐỒNG BỘ TIKTOK</span>
            {ttProgress.is_running && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
          </button>

          <button
            onClick={() => setActiveSubsystemTab('autosync')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubsystemTab === 'autosync'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>HẸN GIỜ & CRON</span>
          </button>
        </div>

        {/* Quick Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-500 dark:text-slate-400">OAuth:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{isConnected ? 'Sẵn Sàng' : 'Chưa Kết Nối'}</span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 text-[11px]">
            <Clock className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
            <span className="text-slate-500 dark:text-slate-400">Cron:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{autoSyncEnabled ? `${intervalMinutes}p` : 'Tắt'}</span>
          </div>

          <button
            onClick={() => fetchAllStatus()}
            disabled={tiktokLoading || driveLoading}
            className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all disabled:opacity-40"
            title="Làm mới trạng thái"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${tiktokLoading || driveLoading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/*  TAB 1: PHÂN HỆ TIKTOK DRIVE INGRESS */}
      {/* ========================================================================= */}
      {activeSubsystemTab === 'tiktok' && (
        <div className="space-y-4 animate-fadeIn">
          {/* TikTok KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>Tổng Nick Tìm Thấy</span>
                <Database className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                {(ttProgress.accounts_found || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                +{(ttProgress.accounts_inserted || 0).toLocaleString()} nick mới
              </div>
            </div>

            <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>Có Cookie (ttwid)</span>
                <Key className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
              </div>
              <div className="text-xl font-bold text-pink-600 dark:text-pink-400 font-mono">
                {(ttProgress.accounts_with_cookie || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {ttProgress.accounts_found > 0
                  ? `${Math.round((ttProgress.accounts_with_cookie / ttProgress.accounts_found) * 100)}% có cookie`
                  : 'Chưa có dữ liệu'}
              </div>
            </div>

            <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>Có Hotmail / Pass Mail</span>
                <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                {(ttProgress.accounts_with_email || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Mail gốc & Pass Mail</div>
            </div>

            <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>Dàn Máy Boxphone</span>
                <Smartphone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono">
                {Object.keys(ttProgress.machines_detected || {}).length} máy
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {(ttProgress.accounts_with_machine || 0).toLocaleString()} nick map máy
              </div>
            </div>
          </div>

          {/* Action Trigger Banner */}
          <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Quét & Nạp Kho TikTok Từ Google Drive</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 max-w-xl">
                Bóc tách file TikTok trên Drive, mã hóa AES-256, gắn nhãn platform TIKTOK độc lập và bảo vệ chống đè dữ liệu.
              </div>
            </div>

            <button
              onClick={handleStartTikTokSync}
              disabled={tiktokSyncing || !isConnected}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tiktokSyncing ? 'animate-spin' : ''}`} />
              <span>{tiktokSyncing ? 'Đang Đồng Bộ TikTok...' : 'Bắt Đầu Quét TikTok'}</span>
            </button>
          </div>

          {/* Progress bar */}
          {ttProgress.stage && ttProgress.stage !== 'IDLE' && (
            <div className="app-card rounded-xl p-3 border border-cyan-300 dark:border-cyan-500/40 bg-white dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-700 dark:text-cyan-300 text-[11px]">
                  {ttProgress.stage === 'SCANNING_TIKTOK_FILES' && '🔍 Đang tìm kiếm các file TikTok trên Google Drive...'}
                  {ttProgress.stage === 'PARSING_TIKTOK_DATA' &&
                    `⚡ Đang bóc tách: ${ttProgress.current_file || '...'} (Tab: ${ttProgress.current_tab || '...'})`}
                  {ttProgress.stage === 'COMPLETED' && '🎉 Đã hoàn tất đồng bộ toàn bộ kho TikTok!'}
                  {ttProgress.stage === 'ERROR' && '❌ Gặp lỗi trong tiến trình'}
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {ttProgress.files_processed} / {ttProgress.files_total} files (
                  {ttProgress.files_total > 0 ? Math.round((ttProgress.files_processed / ttProgress.files_total) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-500 rounded-full"
                  style={{
                    width: `${ttProgress.files_total > 0 ? Math.round((ttProgress.files_processed / ttProgress.files_total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Live Terminal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                <span>Nhật Ký Đồng Bộ TikTok Thời Gian Thực</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">{ttProgress.logs?.length || 0} dòng</span>
            </div>

            <div
              ref={tiktokLogsRef}
              className="bg-[#0b0f19] text-gray-200 font-mono text-[11px] p-3 rounded-xl h-48 overflow-y-auto border border-slate-300 dark:border-slate-800 space-y-1 shadow-inner select-text"
            >
              {ttProgress.logs && ttProgress.logs.length > 0 ? (
                ttProgress.logs.map((log: string, idx: number) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      log.includes('HOÀN TẤT') || log.includes('✅')
                        ? 'text-cyan-400 font-bold'
                        : log.includes('LỖI') || log.includes('❌')
                        ? 'text-rose-400 font-bold'
                        : log.includes('⚠️')
                        ? 'text-amber-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-16 text-xs">
                  Chưa có tiến trình cào TikTok nào đang chạy. Bấm "Bắt Đầu Quét TikTok" ở trên.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/*  TAB 2: PHÂN HỆ SHOPEE & TỔNG QUAN GOOGLE DRIVE */}
      {/* ========================================================================= */}
      {activeSubsystemTab === 'shopee' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Shopee KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>Tổng Nick Đã Tìm Thấy</span>
                <Database className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400 font-mono">
                {(driveProgress.accounts_total_found || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Từ toàn bộ Google Sheets</div>
            </div>

            <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>Thêm Mới Thành Công</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                +{(driveProgress.accounts_inserted || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Lưu mới vào MongoDB</div>
            </div>

            <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>Cập Nhật Cookie Đè</span>
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                +{(driveProgress.accounts_updated || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Cập nhật cookie mới nhất</div>
            </div>
          </div>

          {/* Action Trigger Banner */}
          <div className="app-card rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                <span>Quét & Bóc Tách Google Drive (Shopee)</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 max-w-xl">
                Tự động nhận diện Cookie Shopee (SPC_EC, SPC_ST), phân loại thông minh và đồng bộ vào kho dữ liệu.
              </div>
            </div>

            <button
              onClick={handleStartDriveSync}
              disabled={driveSyncing || !isConnected}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-sm flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${driveSyncing ? 'animate-spin' : ''}`} />
              <span>{driveSyncing ? 'Đang Đồng Bộ Drive...' : 'Bắt Đầu Quét Ngay'}</span>
            </button>
          </div>

          {/* Progress bar */}
          {driveProgress.stage && driveProgress.stage !== 'IDLE' && (
            <div className="app-card rounded-xl p-3 border border-orange-300 dark:border-orange-500/40 bg-white dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-orange-700 dark:text-orange-300 text-[11px]">
                  {driveProgress.stage === 'SCANNING_DRIVE' && '🔍 Đang quét danh mục file trên Google Drive...'}
                  {driveProgress.stage === 'PROCESSING_FILES' && `⚡ Đang xử lý: ${driveProgress.current_file || '...'}`}
                  {driveProgress.stage === 'COMPLETED' && '🎉 Đã hoàn tất đồng bộ toàn bộ file!'}
                  {driveProgress.stage === 'ERROR' && '❌ Gặp lỗi trong tiến trình'}
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {driveProgress.files_processed} / {driveProgress.files_total} files (
                  {driveProgress.files_total > 0
                    ? Math.round((driveProgress.files_processed / driveProgress.files_total) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-500 rounded-full"
                  style={{
                    width: `${
                      driveProgress.files_total > 0
                        ? Math.round((driveProgress.files_processed / driveProgress.files_total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Live Terminal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                <span>Nhật Ký Đồng Bộ Google Drive Thời Gian Thực</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">{driveProgress.logs?.length || 0} dòng</span>
            </div>

            <div
              ref={driveLogsRef}
              className="bg-[#0b0f19] text-gray-200 font-mono text-[11px] p-3 rounded-xl h-48 overflow-y-auto border border-slate-300 dark:border-slate-800 space-y-1 shadow-inner select-text"
            >
              {driveProgress.logs && driveProgress.logs.length > 0 ? (
                driveProgress.logs.map((log: string, idx: number) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      log.includes('HOÀN THÀNH') || log.includes('✅')
                        ? 'text-emerald-400 font-bold'
                        : log.includes('LỖI') || log.includes('❌')
                        ? 'text-rose-400 font-bold'
                        : log.includes('⚠️')
                        ? 'text-amber-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-16 text-xs">
                  Chưa có tiến trình đồng bộ nào đang chạy. Bấm "Bắt Đầu Quét Ngay" ở trên.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/*  TAB 3: HẸN GIỜ TỰ ĐỘNG & KHÓA AN TOÀN SNAPSHOT */}
      {/* ========================================================================= */}
      {activeSubsystemTab === 'autosync' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="app-card rounded-xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Cấu Hình Quét Ngầm Tự Động (Auto Sync Cron)</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Tự động kích hoạt cào và bóc tách định kỳ không cần thao tác tay</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Bật / Tắt Quét Định Kỳ</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Trạng thái: <strong className="text-indigo-600 dark:text-indigo-400">{autoSyncEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <select
                  value={intervalMinutes}
                  onChange={(e) => handleSaveAutoSync(autoSyncEnabled, parseInt(e.target.value, 10))}
                  className="bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value={15}>Mỗi 15 phút</option>
                  <option value={30}>Mỗi 30 phút</option>
                  <option value={60}>Mỗi 1 tiếng</option>
                  <option value={360}>Mỗi 6 tiếng</option>
                </select>

                <button
                  onClick={() => handleSaveAutoSync(!autoSyncEnabled, intervalMinutes)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoSyncEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Safety Double-Lock Notice */}
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[11px]">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">Khóa Bảo Vệ Dữ Liệu Tự Động Snapshot Đang Bật</div>
                <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Trước mỗi đợt nạp hoặc làm sạch dữ liệu lớn, hệ thống luôn tự động tạo bản Snapshot nén <code className="text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded font-mono">.json.gz</code> lưu vào <code className="text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded font-mono">data/backups/</code>. Nếu tạo Snapshot thất bại, tiến trình sẽ tự động hủy để đảm bảo an toàn.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
