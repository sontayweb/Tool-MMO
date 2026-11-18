import React from 'react';
import { Activity, CheckCircle2, ShieldAlert, XCircle, AlertTriangle, Clock, Zap } from 'lucide-react';

interface StatsBarProps {
  total: number;
  processed: number;
  live: number;
  ivsVerify: number;
  wrongPass: number;
  failed: number;
  captcha: number;
  pending: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  total,
  processed,
  live,
  ivsVerify,
  wrongPass,
  failed,
  captcha,
  pending,
}) => {
  const progressPct = total > 0 ? ((processed / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      {/* Top Counters Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px' }}>
            <Activity size={24} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TỔNG CỘNG</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{total.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
            <CheckCircle2 size={24} color="var(--status-live)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🟢 LIVE</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--status-live)' }}>
              {live.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px' }}>
            <ShieldAlert size={24} color="var(--status-ivs)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🟡 IVS VERIFY</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--status-ivs)' }}>
              {ivsVerify.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
            <XCircle size={24} color="var(--status-die)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🔴 DIE / SAI PASS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--status-die)' }}>
              {wrongPass.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(192, 132, 252, 0.1)', borderRadius: '8px' }}>
            <Zap size={24} color="var(--status-captcha)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🧩 CAPTCHA</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--status-captcha)' }}>
              {captcha.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px' }}>
            <AlertTriangle size={24} color="var(--status-failed)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>⚠️ LỖI / BLOCK</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--status-failed)' }}>
              {failed.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(100, 116, 139, 0.1)', borderRadius: '8px' }}>
            <Clock size={24} color="var(--status-pending)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>⌛ ĐANG CHỜ</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--status-pending)' }}>
              {pending.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>Tiến độ thực thi: {processed}/{total} ({progressPct}%)</span>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>Tốc độ xử lý realtime</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            borderRadius: '5px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0284c7, #38bdf8, #10b981)',
              borderRadius: '5px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
};
