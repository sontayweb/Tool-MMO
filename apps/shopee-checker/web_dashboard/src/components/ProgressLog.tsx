import React, { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';

interface LogItem {
  id: string;
  time: string;
  email: string;
  status: string;
  msg: string;
  error_code?: number;
}

interface ProgressLogProps {
  logs: LogItem[];
}

export const ProgressLog: React.FC<ProgressLogProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getStatusColor = (st: string) => {
    switch (st) {
      case 'LIVE':
        return 'var(--status-live)';
      case 'IVS_VERIFY':
        return 'var(--status-ivs)';
      case 'WRONG_PASS':
        return 'var(--status-die)';
      case 'CAPTCHA':
        return 'var(--status-captcha)';
      default:
        return 'var(--text-secondary)';
    }
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Terminal size={18} color="var(--accent-cyan)" />
        <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Nhật Ký Thực Thi Thời Gian Thực (Live Terminal Stream)</h4>
      </div>

      <div
        ref={containerRef}
        className="code-font"
        style={{
          height: '180px',
          overflowY: 'auto',
          backgroundColor: '#090d16',
          borderRadius: '8px',
          padding: '0.75rem',
          fontSize: '0.78rem',
          lineHeight: '1.5',
          border: '1px solid var(--border)',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Chưa có log sự kiện nào... Sẵn sàng lắng nghe WebSocket stream.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>[{log.time}]</span>
              <span style={{ color: 'var(--text-primary)' }}>{log.email}</span>
              <span style={{ color: getStatusColor(log.status), fontWeight: '600' }}>[{log.status}]</span>
              <span style={{ color: 'var(--text-secondary)' }}>{log.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
