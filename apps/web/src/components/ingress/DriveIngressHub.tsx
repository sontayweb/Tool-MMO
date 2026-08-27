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
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 🌟 Top Page Header */}
      <div className="app-card rounded-3xl p-6 md:p-8 border border-[var(--border-subtle)] relative overflow-hidden bg-gradient-to-r from-blue-950/20 via-purple-950/20 to-pink-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Cloud className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-title flex items-center gap-2.5">
                  <span>Trung Tâm Điều Hành Kéo Dữ Liệu Google Drive</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    INGRESS HUB v4.0
                  </span>
                </h2>
                <p className="text-xs text-desc">
                  Quản lý tập trung toàn bộ tiến trình quét, bóc tách và nạp dữ liệu từ Google Sheets & Excel về Kho DWH
                </p>
              </div>
            </div>
          </div>

          {/* Top Quick Status Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2.5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center gap-2.5">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <div className="text-xs">
                <span className="text-desc block text-[10px]">Kết Nối OAuth Google</span>
                <span className="font-bold text-title">{isConnected ? 'Đã Liên Kết Sẵn Sàng' : 'Chưa Kết Nối'}</span>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-purple-400" />
              <div className="text-xs">
                <span className="text-desc block text-[10px]">Tự Động Quét Ngầm (Cron)</span>
                <span className="font-bold text-purple-400">{autoSyncEnabled ? `Bật (${intervalMinutes}p)` : 'Đang Tắt'}</span>
              </div>
            </div>

            <button
              onClick={() => fetchAllStatus()}
              disabled={tiktokLoading || driveLoading}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-[var(--border-subtle)] text-desc hover:text-title transition-all"
              title="Làm mới trạng thái"
            >
              <RefreshCw className={`w-4 h-4 ${tiktokLoading || driveLoading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 🧭 Subsystem Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-2 select-none">
        <button
          onClick={() => setActiveSubsystemTab('shopee')}
          className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 ${activeSubsystemTab === 'shopee'
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-orange-500/20'
            : 'bg-[var(--surface-card)] text-desc hover:text-orange-400 border border-[var(--border-subtle)]'
            }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span> ĐỒNG BỘ KHO SHOPEE</span>
          {driveProgress.is_running && <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />}
        </button>

        <button
          onClick={() => setActiveSubsystemTab('tiktok')}
          className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 ${activeSubsystemTab === 'tiktok'
            ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-pink-500 text-slate-950 shadow-lg shadow-pink-500/20'
            : 'bg-[var(--surface-card)] text-desc hover:text-cyan-400 border border-[var(--border-subtle)]'
            }`}
        >
          <Music2 className="w-4 h-4" />
          <span> ĐỒNG BỘ KHO TIKTOK</span>
          {ttProgress.is_running && <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />}
        </button>

        <button
          onClick={() => setActiveSubsystemTab('autosync')}
          className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 ${activeSubsystemTab === 'autosync'
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
            : 'bg-[var(--surface-card)] text-desc hover:text-purple-400 border border-[var(--border-subtle)]'
            }`}
        >
          <Settings className="w-4 h-4" />
          <span> HẸN GIỜ & TỰ ĐỘNG HÓA</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/*  TAB 1: PHÂN HỆ TIKTOK DRIVE INGRESS */}
      {/* ========================================================================= */}
      {activeSubsystemTab === 'tiktok' && (
        <div className="space-y-6 animate-fadeIn">
          {/* TikTok KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center justify-between text-xs text-desc">
                <span>Tổng Nick TikTok Tìm Thấy</span>
                <Database className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold text-cyan-400">
                {(ttProgress.accounts_found || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold">
                +{(ttProgress.accounts_inserted || 0).toLocaleString()} nick mới
              </div>
            </div>

            <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center justify-between text-xs text-desc">
                <span>Có Cookie TikTok (ttwid)</span>
                <Key className="w-4 h-4 text-pink-400" />
              </div>
              <div className="text-2xl font-extrabold text-pink-400">
                {(ttProgress.accounts_with_cookie || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-desc">
                {ttProgress.accounts_found > 0
                  ? `${Math.round((ttProgress.accounts_with_cookie / ttProgress.accounts_found) * 100)}% tỷ lệ có cookie`
                  : 'Chưa có dữ liệu'}
              </div>
            </div>

            <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center justify-between text-xs text-desc">
                <span>Có Hotmail / Pass Mail</span>
                <Mail className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-amber-400">
                {(ttProgress.accounts_with_email || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-desc">Mail gốc & Pass Mail</div>
            </div>

            <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center justify-between text-xs text-desc">
                <span>Dàn Máy Nuôi Boxphone</span>
                <Smartphone className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-purple-400">
                {Object.keys(ttProgress.machines_detected || {}).length} máy
              </div>
              <div className="text-[11px] text-desc">
                {(ttProgress.accounts_with_machine || 0).toLocaleString()} nick đã map máy
              </div>
            </div>
          </div>

          {/* Action Trigger Banner */}
          <div className="app-card rounded-3xl p-6 border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-purple-950/20 to-pink-950/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="text-base font-extrabold text-white flex items-center gap-2 justify-center md:justify-start">
                <Zap className="w-5 h-5 text-cyan-400" />
                1-Click Cào Toàn Bộ Kho TikTok Từ Google Drive
              </div>
              <div className="text-xs text-desc max-w-xl">
                Tự động bóc tách từ file mẫu <strong className="text-cyan-300">700 Acc tiktok</strong>, mã hóa AES-256, gắn nhãn platform TIKTOK độc lập và bảo vệ chống đè Shopee.
              </div>
            </div>

            <button
              onClick={handleStartTikTokSync}
              disabled={tiktokSyncing || !isConnected}
              className={`btn bg-gradient-to-r from-cyan-500 via-sky-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-slate-950 text-sm font-extrabold px-8 py-3.5 rounded-2xl shadow-xl shadow-pink-500/20 flex items-center gap-2.5 shrink-0 transition-all ${tiktokSyncing || !isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
            >
              <RefreshCw className={`w-4 h-4 ${tiktokSyncing ? 'animate-spin' : ''}`} />
              <span>{tiktokSyncing ? 'Đang Cào Dữ Liệu TikTok...' : 'Bắt Đầu Cào TikTok Ngay'}</span>
            </button>
          </div>

          {/* Progress bar */}
          {ttProgress.stage && ttProgress.stage !== 'IDLE' && (
            <div className="app-card rounded-2xl p-5 border border-cyan-500/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-400">
                  {ttProgress.stage === 'SCANNING_TIKTOK_FILES' && '🔍 Đang tìm kiếm các file TikTok trên Google Drive...'}
                  {ttProgress.stage === 'PARSING_TIKTOK_DATA' &&
                    `⚡ Đang bóc tách file: ${ttProgress.current_file || '...'} (Tab: ${ttProgress.current_tab || '...'})`}
                  {ttProgress.stage === 'COMPLETED' && '🎉 Đã hoàn tất đồng bộ toàn bộ kho TikTok!'}
                  {ttProgress.stage === 'ERROR' && '❌ Gặp lỗi trong tiến trình'}
                </span>
                <span className="text-desc font-mono">
                  {ttProgress.files_processed} / {ttProgress.files_total} files (
                  {ttProgress.files_total > 0 ? Math.round((ttProgress.files_processed / ttProgress.files_total) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full h-3 bg-[var(--bg-input)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-pink-500 transition-all duration-500 rounded-full"
                  style={{
                    width: `${ttProgress.files_total > 0 ? Math.round((ttProgress.files_processed / ttProgress.files_total) * 100) : 0
                      }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Live Terminal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-desc px-1">
              <span className="flex items-center gap-2 font-bold text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                Nhật Ký Bóc Tách TikTok Thời Gian Thực (Live Ingress Stream)
              </span>
              <span>{ttProgress.logs?.length || 0} dòng</span>
            </div>

            <div
              ref={tiktokLogsRef}
              className="bg-[#050811] text-gray-300 font-mono text-xs p-5 rounded-3xl h-64 overflow-y-auto border border-cyan-950/80 space-y-1.5 shadow-2xl select-text"
            >
              {ttProgress.logs && ttProgress.logs.length > 0 ? (
                ttProgress.logs.map((log: string, idx: number) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${log.includes('HOÀN TẤT') || log.includes('✅')
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
                <div className="text-gray-500 text-center py-24">
                  Chưa có tiến trình cào TikTok nào đang chạy. Bấm "Bắt Đầu Cào TikTok Ngay" ở trên.
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
        <div className="space-y-6 animate-fadeIn">
          {/* Shopee KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center justify-between text-xs text-desc">
                <span>Tổng Tài Khoản Đã Tìm Thấy</span>
                <Database className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-purple-400">
                {(driveProgress.accounts_total_found || 0).toLocaleString()} nick
              </div>
              <div className="text-[11px] text-desc">Từ toàn bộ Google Sheets</div>
            </div>

            <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center justify-between text-xs text-desc">
                <span>Thêm Mới Thành Công</span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400">
                +{(driveProgress.accounts_inserted || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-desc">Lưu mới vào MongoDB</div>
            </div>

            <div className="app-card rounded-2xl p-5 border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center justify-between text-xs text-desc">
                <span>Cập Nhật Cookie Đè</span>
                <RefreshCw className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-extrabold text-blue-400">
                +{(driveProgress.accounts_updated || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-desc">Cập nhật cookie mới nhất</div>
            </div>
          </div>

          {/* Action Trigger Banner */}
          <div className="app-card rounded-3xl p-6 border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-transparent flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="text-base font-extrabold text-white flex items-center gap-2 justify-center md:justify-start">
                <Zap className="w-5 h-5 text-amber-400" />
                1-Click Quét & Bóc Tách Toàn Bộ Google Drive
              </div>
              <div className="text-xs text-desc max-w-xl">
                Tự động nhận diện Cookie Shopee (SPC_EC, SPC_ST), phân loại thông minh và đồng bộ vào kho.
              </div>
            </div>

            <button
              onClick={handleStartDriveSync}
              disabled={driveSyncing || !isConnected}
              className={`btn bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-extrabold px-8 py-3.5 rounded-2xl shadow-xl shadow-blue-500/20 flex items-center gap-2.5 shrink-0 transition-all ${driveSyncing || !isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
            >
              <RefreshCw className={`w-4 h-4 ${driveSyncing ? 'animate-spin' : ''}`} />
              <span>{driveSyncing ? 'Đang Đồng Bộ Drive...' : 'Bắt Đầu Quét Ngay'}</span>
            </button>
          </div>

          {/* Progress bar */}
          {driveProgress.stage && driveProgress.stage !== 'IDLE' && (
            <div className="app-card rounded-2xl p-5 border border-blue-500/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-400">
                  {driveProgress.stage === 'SCANNING_DRIVE' && '🔍 Đang quét danh mục file trên Google Drive...'}
                  {driveProgress.stage === 'PROCESSING_FILES' && `⚡ Đang xử lý: ${driveProgress.current_file || '...'}`}
                  {driveProgress.stage === 'COMPLETED' && '🎉 Đã hoàn tất đồng bộ toàn bộ file!'}
                  {driveProgress.stage === 'ERROR' && '❌ Gặp lỗi trong tiến trình'}
                </span>
                <span className="text-desc font-mono">
                  {driveProgress.files_processed} / {driveProgress.files_total} files (
                  {driveProgress.files_total > 0
                    ? Math.round((driveProgress.files_processed / driveProgress.files_total) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full h-3 bg-[var(--bg-input)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{
                    width: `${driveProgress.files_total > 0
                      ? Math.round((driveProgress.files_processed / driveProgress.files_total) * 100)
                      : 0
                      }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Live Terminal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-desc px-1">
              <span className="flex items-center gap-2 font-bold text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                Nhật Ký Đồng Bộ Google Drive Thời Gian Thực
              </span>
              <span>{driveProgress.logs?.length || 0} dòng</span>
            </div>

            <div
              ref={driveLogsRef}
              className="bg-[#0b0f19] text-gray-300 font-mono text-xs p-5 rounded-3xl h-64 overflow-y-auto border border-gray-800 space-y-1.5 shadow-2xl select-text"
            >
              {driveProgress.logs && driveProgress.logs.length > 0 ? (
                driveProgress.logs.map((log: string, idx: number) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${log.includes('HOÀN THÀNH') || log.includes('✅')
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
                <div className="text-gray-500 text-center py-24">
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
        <div className="space-y-6 animate-fadeIn">
          <div className="app-card rounded-3xl p-6 md:p-8 border border-[var(--border-subtle)] space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-title">Cấu Hình Quét Ngầm Tự Động (Auto Sync Cron)</h3>
                <p className="text-xs text-desc">Tự động kích hoạt cào và bóc tách định kỳ không cần thao tác tay</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-sm font-bold text-title">Bật / Tắt Quét Định Kỳ</div>
                <div className="text-xs text-desc">
                  Trạng thái hiện tại: <strong className="text-purple-400">{autoSyncEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}</strong>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={intervalMinutes}
                  onChange={(e) => handleSaveAutoSync(autoSyncEnabled, parseInt(e.target.value, 10))}
                  className="bg-[var(--bg-input)] text-xs font-bold text-title border border-[var(--border-subtle)] rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                >
                  <option value={15}>Mỗi 15 phút</option>
                  <option value={30}>Mỗi 30 phút</option>
                  <option value={60}>Mỗi 1 tiếng</option>
                  <option value={360}>Mỗi 6 tiếng</option>
                </select>

                <button
                  onClick={() => handleSaveAutoSync(!autoSyncEnabled, intervalMinutes)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${autoSyncEnabled ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* Safety Double-Lock Notice */}
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-emerald-400">Khóa Bảo Vệ Dữ Liệu Tự Động Snapshot Đang Bật</div>
                <div className="text-desc">
                  Trước mỗi đợt nạp hoặc làm sạch dữ liệu lớn, hệ thống luôn tự động tạo bản Snapshot nén <code className="text-emerald-300">.json.gz</code> lưu vào <code className="text-emerald-300">data/backups/</code>. Nếu tạo Snapshot thất bại, tiến trình sẽ tự động bị CHẶN TUYỆT ĐỐI để đảm bảo không bao giờ mất mát dữ liệu.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
