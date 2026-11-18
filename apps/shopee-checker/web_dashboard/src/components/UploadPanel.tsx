import React, { useState } from 'react';
import { UploadCloud, Play, Settings, FileText, CheckCircle } from 'lucide-react';
import { api, AccountItem, JobConfig } from '../lib/api';

interface UploadPanelProps {
  onJobStarted: (job: any) => void;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({ onJobStarted }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [parsedAccounts, setParsedAccounts] = useState<AccountItem[]>([]);
  const [jobName, setJobName] = useState('');
  const [workerCount, setWorkerCount] = useState(10);
  const [delayMs, setDelayMs] = useState(500);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Handle Text Paste Parsing (Client-side simple regex)
  const handleParseText = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n');
    const items: AccountItem[] = [];
    const seen = new Set<string>();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      let parts: string[] = [];
      for (const d of ['\t', '|', ':', ',', ' ']) {
        if (line.includes(d)) {
          parts = line.split(d).map((p) => p.trim()).filter(Boolean);
          break;
        }
      }
      if (!parts.length) parts = [line];

      // Find email
      let email = '';
      let password = '';
      let username = '';

      for (let i = 0; i < parts.length; i++) {
        if (parts[i].includes('@')) {
          email = parts[i];
          if (i === 0 && parts.length > 1) password = parts[1];
          else if (i === 1 && parts.length === 2) password = parts[0];
          else if (i === 3 && parts.length >= 4) {
            username = parts[0];
            password = parts[1];
          } else {
            password = parts[0] !== email ? parts[0] : (parts[1] || '');
          }
          break;
        }
      }

      if (!email && parts.length >= 2) {
        username = parts[0];
        password = parts[1];
        email = username;
      }

      if (email) {
        const key = email.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ email, password, username: username || email.split('@')[0] });
        }
      }
    }

    setParsedAccounts(items);
    setStatusMsg(`✅ Đã bóc tách và lọc trùng ${items.length} tài khoản.`);
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const res = await api.previewFile(file);
      setParsedAccounts(res.accounts);
      setStatusMsg(`✅ File "${res.filename}": Đã nạp ${res.total_parsed} tài khoản.`);
    } catch (err: any) {
      setStatusMsg(`❌ Lỗi đọc file: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const [rotateProvider, setRotateProvider] = useState<string>('');
  const [rotateApiKey, setRotateApiKey] = useState<string>('');
  const [rotateAfterN, setRotateAfterN] = useState<number>(50);
  const [isRefreshingHeaders, setIsRefreshingHeaders] = useState(false);

  // Auto refresh headers
  const handleRefreshSecurityHeaders = async () => {
    setIsRefreshingHeaders(true);
    setStatusMsg('⏳ Đang mở Playwright headless để thu thập headers bảo mật mới từ Shopee...');
    try {
      const res = await api.refreshHeaders();
      setStatusMsg(`✅ Thu thập thành công: ${res.data?.label || 'Header mới'} (x-sap-sec: ${res.data?.has_sap_sec ? 'Có' : 'Không'})`);
    } catch (err: any) {
      setStatusMsg(`❌ Lỗi thu thập header: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsRefreshingHeaders(false);
    }
  };

  // Start Job
  const handleStartJob = async () => {
    if (!parsedAccounts.length) {
      alert('Vui lòng nạp danh sách tài khoản trước khi bắt đầu!');
      return;
    }

    setIsLoading(true);
    try {
      const config: JobConfig = {
        worker_count: workerCount,
        delay_ms: delayMs,
        proxy_enabled: proxyEnabled || !!rotateProvider,
        rotate_provider: rotateProvider || undefined,
        rotate_api_key: rotateApiKey.trim() || undefined,
        rotate_after_n: rotateAfterN,
      };
      const res = await api.createJob({
        name: jobName.trim() || undefined,
        accounts: parsedAccounts,
        config,
      });
      onJobStarted(res);
    } catch (err: any) {
      alert(`Lỗi khởi chạy Job: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UploadCloud size={20} color="var(--accent-cyan)" />
          Nạp Danh Sách Tài Khoản Shopee
        </h3>

        {/* Tab Toggle & Header Refresh */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={handleRefreshSecurityHeaders}
            disabled={isRefreshingHeaders}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderColor: 'var(--accent-cyan)' }}
            title="Tự động mở Playwright để bắt header x-sap-sec mới từ Shopee"
          >
            {isRefreshingHeaders ? '⏳ Đang quét...' : '🔄 Làm Mới Header Pool'}
          </button>

          <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('paste')}
              className="btn"
              style={{
                padding: '0.35rem 0.8rem',
                fontSize: '0.8rem',
                background: activeTab === 'paste' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'paste' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: 'none',
              }}
            >
              Dán Trực Tiếp (Paste)
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className="btn"
              style={{
                padding: '0.35rem 0.8rem',
                fontSize: '0.8rem',
                background: activeTab === 'file' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'file' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: 'none',
              }}
            >
              Upload File Excel / TXT
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Paste Text */}
      {activeTab === 'paste' && (
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onBlur={handleParseText}
            placeholder={`Dán danh sách tài khoản theo các định dạng:\nKhaphanyq51\tyenvya315956@hotmail.com\nxic3p9jukv\tKhaphanyq51\t84996540628\tyenvya315956@hotmail.com\nuser|password`}
            className="code-font"
            style={{
              width: '100%',
              height: '110px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              padding: '0.75rem',
              fontSize: '0.825rem',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button onClick={handleParseText} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              <FileText size={14} /> Phân Tách Dữ Liệu
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: File Upload */}
      {activeTab === 'file' && (
        <div
          style={{
            border: '2px dashed var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            marginBottom: '1rem',
          }}
        >
          <input type="file" id="fileUpload" accept=".txt,.xlsx,.xls,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
          <label htmlFor="fileUpload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <UploadCloud size={36} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600' }}>
              Bấm vào đây để chọn file (.txt, .xlsx, .csv)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hỗ trợ file Excel nhiều cột tự bóc tách</span>
          </label>
        </div>
      )}

      {statusMsg && (
        <div style={{ fontSize: '0.85rem', color: 'var(--status-live)', marginBottom: '1rem', fontWeight: '500' }}>
          {statusMsg}
        </div>
      )}

      {/* Advanced Proxy & Rotation Settings */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.8rem',
          padding: '0.8rem 0',
          marginBottom: '0.8rem',
          borderTop: '1px solid var(--border-light)',
          background: 'rgba(15, 23, 42, 0.25)',
          borderRadius: '6px'
        }}
      >
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            CHẾ ĐỘ PROXY
          </label>
          <select
            value={rotateProvider}
            onChange={(e) => {
              setRotateProvider(e.target.value);
              if (e.target.value === 'file') setProxyEnabled(true);
              else if (e.target.value === '') setProxyEnabled(false);
              else setProxyEnabled(true);
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="">🌐 Không dùng Proxy (Direct)</option>
            <option value="file">📄 Danh sách file proxies.txt</option>
            <option value="tmproxy">⚡ TMProxy API (Xoay IP tự động)</option>
            <option value="shoplike">⚡ ShopLike Proxy API</option>
            <option value="wwproxy">⚡ WWProxy API</option>
          </select>
        </div>

        {rotateProvider && rotateProvider !== 'file' && (
          <>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                API KEY PROXY
              </label>
              <input
                type="password"
                placeholder="Nhập API Key xoay IP..."
                value={rotateApiKey}
                onChange={(e) => setRotateApiKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                XOAY SAU N REQUESTS: <b style={{ color: 'var(--accent-cyan)' }}>{rotateAfterN}</b>
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={rotateAfterN}
                onChange={(e) => setRotateAfterN(parseInt(e.target.value) || 50)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Configurations & Action */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          paddingTop: '0.5rem',
          alignItems: 'center',
        }}
      >
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            TÊN BATCH (TÙY CHỌN)
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Batch_Shop_001"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            SỐ LUỒNG (WORKERS): <b style={{ color: 'var(--accent-cyan)' }}>{workerCount}</b>
          </label>
          <input
            type="range"
            min={1}
            max={30}
            value={workerCount}
            onChange={(e) => setWorkerCount(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            DELAY GIỮA CÁC CALL: <b style={{ color: 'var(--accent-cyan)' }}>{delayMs}ms</b>
          </label>
          <input
            type="range"
            min={100}
            max={2000}
            step={50}
            value={delayMs}
            onChange={(e) => setDelayMs(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleStartJob}
            disabled={isLoading || !parsedAccounts.length}
            className="btn btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.75rem 1.25rem',
              opacity: !parsedAccounts.length ? 0.6 : 1,
            }}
          >
            <Play size={18} fill="currentColor" /> BẮT ĐẦU CHECK ({parsedAccounts.length})
          </button>
        </div>
      </div>
    </div>
  );
};


