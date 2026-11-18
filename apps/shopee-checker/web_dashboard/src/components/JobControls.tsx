import React from 'react';
import { Square, Download, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface JobControlsProps {
  currentJob: any;
  onJobStopped: () => void;
  onRefresh: () => void;
}

export const JobControls: React.FC<JobControlsProps> = ({
  currentJob,
  onJobStopped,
  onRefresh,
}) => {
  if (!currentJob) return null;

  const handleStop = async () => {
    if (confirm(`Bạn có chắc muốn dừng Job "${currentJob.name}" không?`)) {
      try {
        await api.stopJob(currentJob.job_id);
        onJobStopped();
      } catch (err: any) {
        alert(`Lỗi dừng Job: ${err.message}`);
      }
    }
  };

  const handleExport = (status = 'ALL') => {
    const url = api.getExportUrl(currentJob.job_id, status);
    window.open(url, '_blank');
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ĐANG THAO TÁC TRÊN BATCH</div>
        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
          {currentJob.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({currentJob.job_id?.slice(0, 8)})</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={onRefresh} className="btn btn-secondary" title="Làm mới dữ liệu">
          <RefreshCw size={15} /> Làm Mới
        </button>

        {currentJob.status === 'RUNNING' && (
          <button onClick={handleStop} className="btn btn-danger">
            <Square size={15} fill="currentColor" /> Dừng Job
          </button>
        )}

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button onClick={() => handleExport('ALL')} className="btn btn-success">
            <Download size={15} /> Xuất Toàn Bộ Excel
          </button>
          <button onClick={() => handleExport('LIVE')} className="btn btn-primary" title="Chỉ xuất tài khoản LIVE">
            <Download size={15} /> Xuất Nick Live
          </button>
        </div>
      </div>
    </div>
  );
};
