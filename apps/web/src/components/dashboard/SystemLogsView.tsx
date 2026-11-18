'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  Clock,
  User,
  ExternalLink,
  Copy,
  Check,
  Filter,
  Download,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';

interface LogEvent {
  id: string;
  timestamp: string;
  category: string;
  action?: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  actor: string;
  title: string;
  ip_address?: string;
  platform?: string;
  details?: any;
  target?: string;
}

export const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilter, setQuickFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<LogEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const quickFilters = [
    { id: 'ALL', label: 'Tất Cả' },
    { id: 'AUTH', label: '🔑 Đăng Nhập', action: 'AUTH_LOGIN' },
    { id: 'INGRESS', label: '☁️ Kéo Drive', category: 'INGRESS' },
    { id: 'SOLD', label: '🛒 Xuất Bán Hàng', action: 'MARK_SOLD' },
    { id: 'EXPORT_EXCEL', label: '📊 Xuất Excel', action: 'EXPORT_EXCEL' },
    { id: 'RESCUE', label: '🛟 Cứu Hộ / Fix', action: 'SANITATION_AUTO_FIX' },
    { id: 'IMPORT', label: '📁 Nạp Tệp', action: 'IMPORT_FILE_COMMIT' },
    { id: 'TRASH', label: '🗑️ Khóa / Xóa', action: 'TRASH' }
  ];

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const activeQ = quickFilters.find(q => q.id === quickFilter);
      const queryParams: any = { limit: 250 };
      if (activeQ?.action && activeQ.action !== 'TRASH') {
        queryParams.action = activeQ.action;
      }
      if (activeQ?.category) {
        queryParams.category = activeQ.category;
      }
      if (levelFilter !== 'ALL') {
        queryParams.level = levelFilter;
      }

      const res = await api.getSystemLogs(queryParams);
      const list = Array.isArray(res) ? res : (res?.events || []);
      setLogs(list);
    } catch (err) {
      console.error('Failed to fetch system logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [quickFilter, levelFilter]);

  // Optional auto-refresh every 8s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, quickFilter, levelFilter]);

  const filteredLogs = logs.filter(log => {
    const s = searchTerm.toLowerCase().trim();
    if (quickFilter === 'TRASH') {
      const isTrash = (log.action || '').includes('TRASH') || (log.action || '').includes('BLACKLIST');
      if (!isTrash) return false;
    }
    if (!s) return true;
    const matchSearch =
      (log.title || '').toLowerCase().includes(s) ||
      (log.actor || '').toLowerCase().includes(s) ||
      (log.action || '').toLowerCase().includes(s) ||
      (log.target || '').toLowerCase().includes(s) ||
      (log.ip_address || '').toLowerCase().includes(s) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(s);
    return matchSearch;
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            SUCCESS
          </span>
        );
      case 'WARN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            WARN
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            ERROR
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            INFO
          </span>
        );
    }
  };

  const handleCopyDetails = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-12">
      {/* 🧭 Sleek Enterprise Top Toolbar (0 duplicate titles) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            Nhật Ký & Truy Vết Hoạt Động (Audit Trail)
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            ({filteredLogs.length} bản ghi)
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded accent-purple-600"
            />
            <span className="text-[11px]">Tự động tải (8s)</span>
          </label>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-500' : ''}`} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* 1-Click Quick Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
        {quickFilters.map((q) => (
          <button
            key={q.id}
            onClick={() => setQuickFilter(q.id)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 border ${
              quickFilter === q.id
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Search & Level Filter Row */}
      <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Lọc theo người dùng, hành động, khách hàng, tệp tin hoặc IP..."
            className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">Cấp độ:</span>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none"
          >
            <option value="ALL">Tất cả</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 font-semibold select-none">
                <th className="py-2.5 px-3.5 w-36">Thời Gian</th>
                <th className="py-2.5 px-3 w-20">Cấp Độ</th>
                <th className="py-2.5 px-3.5 w-32">Người Dùng</th>
                <th className="py-2.5 px-3.5">Hành Động & Chi Tiết</th>
                <th className="py-2.5 px-3.5 w-24 text-right">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-slate-400" />
                    Đang nạp nhật ký hệ thống...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    Không tìm thấy bản ghi nhật ký phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2 px-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {getLevelBadge(log.level)}
                    </td>
                    <td className="py-2 px-3.5 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="font-mono text-xs font-semibold">{log.actor}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-xs">
                        {log.title}
                      </div>
                      {log.target && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-xl">
                          Đối tượng: <span className="font-semibold">{log.target}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="px-2 py-0.5 rounded text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getLevelBadge(selectedLog.level)}
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  {selectedLog.title}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-500 block">Thời gian:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {new Date(selectedLog.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Người thực hiện:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLog.actor}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Hành động (Action):</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedLog.action || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Địa chỉ IP:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedLog.ip_address || '127.0.0.1'}
                  </span>
                </div>
              </div>

              {selectedLog.details && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Dữ Liệu JSON Chi Tiết
                    </span>
                    <button
                      onClick={() => handleCopyDetails(JSON.stringify(selectedLog.details, null, 2))}
                      className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Đã sao chép' : 'Sao chép JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-64 border border-slate-800">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
