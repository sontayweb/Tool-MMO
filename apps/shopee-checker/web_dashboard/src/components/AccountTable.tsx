import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff, Search, Filter, ShieldCheck, AlertCircle } from 'lucide-react';

interface AccountTableProps {
  accounts: any[];
  filterStatus: string;
  onFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const AccountTable: React.FC<AccountTableProps> = ({
  accounts,
  filterStatus,
  onFilterChange,
  searchQuery,
  onSearchChange,
}) => {
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const toggleRevealPass = (email: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [email]: !prev[email] }));
  };

  const handleCopy = (text: string, email: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
        return <span className="badge badge-live">🟢 LIVE</span>;
      case 'IVS_VERIFY':
        return <span className="badge badge-ivs">🟡 IVS VERIFY</span>;
      case 'WRONG_PASS':
        return <span className="badge badge-die">🔴 WRONG PASS</span>;
      case 'BANNED':
        return <span className="badge badge-die" style={{ backgroundColor: 'rgba(220, 38, 38, 0.25)', borderColor: '#dc2626' }}>🚫 BANNED (F02)</span>;
      case 'CAPTCHA':
        return <span className="badge badge-captcha">🧩 CAPTCHA</span>;
      case 'FAILED':
        return <span className="badge badge-failed">⚠️ FAILED</span>;
      case 'RATE_LIMIT':
        return <span className="badge badge-failed">⌛ RATE LIMIT</span>;
      default:
        return <span className="badge badge-pending">⌛ PENDING</span>;
    }
  };

  return (
    <div className="card">
      {/* Table Controls / Filters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', maxWidth: '350px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Tìm kiếm Email hoặc Username..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.5rem 0.5rem 2rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {/* Filter Badges */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['ALL', 'LIVE', 'IVS_VERIFY', 'WRONG_PASS', 'CAPTCHA', 'FAILED', 'PENDING'].map((st) => (
            <button
              key={st}
              onClick={() => onFilterChange(st)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: filterStatus === st ? 'var(--accent-cyan)' : 'var(--border)',
                backgroundColor: filterStatus === st ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-primary)',
                color: filterStatus === st ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto', maxHeight: '550px' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>STT</th>
              <th>Username</th>
              <th>Email</th>
              <th>Mật Khẩu</th>
              <th>Trạng Thái</th>
              <th>Shopee Xu</th>
              <th>Thông Tin Nick</th>
              <th>Mã Lỗi</th>
              <th>Session</th>
              <th>Proxy</th>
              <th>Thời Gian</th>
              <th>Ghi Chú</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  Chưa có tài khoản nào được nạp hoặc không khớp bộ lọc.
                </td>
              </tr>
            ) : (
              accounts.map((acc, idx) => (
                <tr key={acc.email + idx}>
                  <td style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{idx + 1}</td>
                  <td className="code-font" style={{ fontWeight: '500' }}>{acc.username || '—'}</td>
                  <td className="code-font" style={{ color: 'var(--accent-cyan)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{acc.email}</span>
                      <button
                        onClick={() => handleCopy(acc.email, acc.email)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        title="Copy Email"
                      >
                        {copiedEmail === acc.email ? <Check size={13} color="var(--status-live)" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </td>
                  <td className="code-font">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>
                        {revealedPasswords[acc.email]
                          ? acc.password_plain
                          : acc.password_plain
                          ? '••••••••'
                          : '—'}
                      </span>
                      {acc.password_plain && (
                        <button
                          onClick={() => toggleRevealPass(acc.email)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                          {revealedPasswords[acc.email] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {getStatusBadge(acc.status)}
                      {acc.ivs_resolved && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--status-live)', fontWeight: '600' }}>
                          ⚡ IVS Verified
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {acc.xu_balance !== undefined && acc.xu_balance > 0 ? (
                      <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.85rem' }}>
                        🪙 {acc.xu_balance.toLocaleString()} Xu
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>0 Xu</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>
                    {acc.display_name || acc.phone_masked ? (
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{acc.display_name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {acc.phone_masked} {acc.account_level ? `• Lv${acc.account_level}` : ''}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="code-font" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {acc.error_code !== undefined && acc.error_code !== -1 ? acc.error_code : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {acc.has_cookies ? (
                      <span style={{ color: 'var(--status-live)', fontSize: '0.8rem', fontWeight: '600' }}>✅ Có</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>❌ Không</span>
                    )}
                  </td>
                  <td className="code-font" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {acc.last_used_proxy || 'Direct'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {acc.last_checked_at ? new Date(acc.last_checked_at).toLocaleTimeString() : '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.error_msg || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
};
