'use client';

import React, { useState, useEffect } from 'react';
import {
  Terminal,
  RefreshCw,
  Search,
  Filter,
  Clock,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  User,
  Info,
  ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';

interface LogEvent {
  id: string;
  timestamp: string;
  category: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  actor: string;
  title: string;
  details?: any;
  target?: string;
}

export const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<LogEvent | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemLogs(200);
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch system logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchSearch =
      (log.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.actor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.target || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = categoryFilter === 'ALL' || log.category === categoryFilter;
    const matchLevel = levelFilter === 'ALL' || log.level === levelFilter;
    return matchSearch && matchCategory && matchLevel;
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">SUCCESS</span>;
      case 'WARN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">WARN</span>;
      case 'ERROR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">ERROR</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">INFO</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Card */}
      <div className="app-card rounded-3xl p-6 md:p-8 border border-[var(--border-subtle)] relative overflow-hidden bg-gradient-to-r from-slate-900 via-purple-950/20 to-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-title flex items-center gap-2.5">
                <span>Nhật Ký & Truy Vết Hệ Thống (Audit Logs)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  REALTIME
                </span>
              </h2>
              <p className="text-xs text-desc">
                Theo dõi toàn bộ lịch sử đồng bộ Google Drive, xuất kho, nạp nick, và các tác vụ vận hành
              </p>
            </div>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-[var(--border-subtle)] text-xs font-bold text-title flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            <span>Làm mới nhật ký</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="app-card rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-desc" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo hành động, người thực hiện, nguồn file..."
            className="w-full bg-transparent text-xs text-title placeholder-desc focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-xs text-title focus:outline-none"
          >
            <option value="ALL">Tất cả danh mục</option>
            <option value="AUDIT">Audit Hành Động</option>
            <option value="INGRESS">Đồng Bộ Drive</option>
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-xs text-title focus:outline-none"
          >
            <option value="ALL">Tất cả cấp độ</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="app-card rounded-3xl border border-[var(--border-subtle)] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-white/5 text-desc font-bold select-none">
                <th className="py-3.5 px-4 w-40">Thời Gian</th>
                <th className="py-3.5 px-4 w-28">Cấp Độ</th>
                <th className="py-3.5 px-4 w-44">Người Thực Hiện</th>
                <th className="py-3.5 px-4">Hành Động / Chi Tiết</th>
                <th className="py-3.5 px-4 w-20 text-center">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-desc">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Đang tải danh sách nhật ký...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-desc">
                    Không tìm thấy nhật ký phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-desc whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : 'N/A'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getLevelBadge(log.level)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-title whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        <span>{log.actor}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-title">{log.title}</div>
                      {log.details && (
                        <div className="text-[11px] text-desc font-mono truncate max-w-md mt-0.5">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="p-1 rounded-lg hover:bg-white/10 text-desc hover:text-title transition-all">
                        <ChevronRight className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="app-card rounded-3xl p-6 md:p-8 max-w-xl w-full border border-[var(--border-subtle)] space-y-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2.5">
                <Info className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-title text-base">Chi Tiết Bản Ghi Nhật Ký</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-desc hover:text-title transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-desc">Thời gian:</span>
                  <div className="font-mono text-title">{selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString('vi-VN') : 'N/A'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-desc">Người thực hiện:</span>
                  <div className="font-bold text-purple-400">{selectedLog.actor}</div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-desc">Hành động:</span>
                <div className="font-bold text-title">{selectedLog.title}</div>
              </div>

              <div className="space-y-1">
                <span className="text-desc">Dữ liệu chi tiết (Payload Details):</span>
                <pre className="p-4 rounded-2xl bg-black/60 border border-[var(--border-subtle)] text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all"
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
