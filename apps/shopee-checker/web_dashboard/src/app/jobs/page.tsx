'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { History, Download, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function JobsHistoryPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await api.listJobs(50);
      setJobs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={22} color="var(--accent-cyan)" /> Lịch Sử Các Đợt Kiểm Tra (Batches)
        </h2>
        <button onClick={loadJobs} className="btn btn-secondary">
          <RefreshCw size={15} /> Làm Mới
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Tên Batch</th>
              <th>Trạng Thái</th>
              <th>Tổng</th>
              <th>Đã Check</th>
              <th>🟢 Live</th>
              <th>🟡 IVS</th>
              <th>🔴 Die</th>
              <th>Thời Gian Tạo</th>
              <th>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  {loading ? 'Đang tải dữ liệu...' : 'Chưa có batch nào được tạo.'}
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.job_id}>
                  <td style={{ fontWeight: '600', color: 'var(--accent-cyan)' }}>{j.name}</td>
                  <td>
                    <span className={`badge ${j.status === 'RUNNING' ? 'badge-live animate-pulse-slow' : 'badge-pending'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td>{j.total}</td>
                  <td>{j.processed}</td>
                  <td style={{ color: 'var(--status-live)', fontWeight: '700' }}>{j.live}</td>
                  <td style={{ color: 'var(--status-ivs)', fontWeight: '700' }}>{j.ivs_verify}</td>
                  <td style={{ color: 'var(--status-die)', fontWeight: '700' }}>{j.wrong_pass}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(j.created_at).toLocaleString()}
                  </td>
                  <td>
                    <button
                      onClick={() => window.open(api.getExportUrl(j.job_id), '_blank')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                    >
                      <Download size={13} /> Excel
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
