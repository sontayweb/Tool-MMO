'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import {
  Shield,
  Copy,
  Check,
  Key,
  Mail,
  Smartphone,
  Tag,
  Clock,
  User,
  FileText,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AccountDetailModalProps {
  account: any | null;
  isOpen: boolean;
  onClose: () => void;
  onCopyText: (text: string, label: string) => void;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  isOpen,
  onClose,
  onCopyText,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!account) return null;

  const handleCopy = (text: string, key: string, label: string) => {
    onCopyText(text, label);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'SOLD':
        return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30';
      case 'USED':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'BLACKLIST':
      default:
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl" showCloseButton={true}>
      <div className="space-y-6">
        {/* Header summary */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--border-subtle)]">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-title font-mono truncate">{account.username}</h3>
              <button
                onClick={() => handleCopy(account.username, 'username', 'Username')}
                className="text-desc hover:text-title p-1"
                title="Sao chép Username"
              >
                {copiedKey === 'username' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {/* Platform badge */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  account.platform === 'TIKTOK'
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                }`}
              >
                {account.platform === 'TIKTOK' ? '🎵 TIKTOK' : '🛒 SHOPEE'}
              </span>

              {/* Status badge */}
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                  account.status
                )}`}
              >
                {account.status}
              </span>

              {/* Machine ID */}
              {account.machine_id && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                  <Smartphone className="w-3 h-3" />
                  <span>Máy: {account.machine_id}</span>
                </span>
              )}

              {/* Team */}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {account.metadata?.team || 'KHO_TONG'}
              </span>
            </div>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="app-card-inner p-4 rounded-2xl space-y-3 font-mono text-xs border border-[var(--border-subtle)]">
          <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider font-sans flex items-center justify-between">
            <span>Thông Tin Bảo Mật & Đăng Nhập</span>
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="text-[10px] text-desc hover:text-title flex items-center gap-1 font-normal font-sans"
            >
              {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Password */}
            <div className="bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-subtle)]">
              <div className="text-[10px] text-desc uppercase font-sans flex items-center gap-1">
                <Key className="w-3 h-3" />
                <span>Mật khẩu</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-title font-bold">
                  {showPassword ? account.password || '---' : '••••••••••••'}
                </span>
                {account.password && (
                  <button
                    onClick={() => handleCopy(account.password, 'password', 'Mật khẩu')}
                    className="text-desc hover:text-title p-1"
                  >
                    {copiedKey === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-subtle)]">
              <div className="text-[10px] text-desc uppercase font-sans flex items-center gap-1">
                <Mail className="w-3 h-3" />
                <span>Email liên kết</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-title truncate mr-2">{account.email || '---'}</span>
                {account.email && (
                  <button
                    onClick={() => handleCopy(account.email, 'email', 'Email')}
                    className="text-desc hover:text-title p-1 shrink-0"
                  >
                    {copiedKey === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Email Password */}
            <div className="bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-subtle)]">
              <div className="text-[10px] text-desc uppercase font-sans flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Mật khẩu Email</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-title">
                  {showPassword
                    ? account.email_password || account.pass_email || '---'
                    : '••••••••••••'}
                </span>
                {(account.email_password || account.pass_email) && (
                  <button
                    onClick={() =>
                      handleCopy(
                        account.email_password || account.pass_email,
                        'email_password',
                        'Mật khẩu email'
                      )
                    }
                    className="text-desc hover:text-title p-1"
                  >
                    {copiedKey === 'email_password' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Product / Note */}
            <div className="bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-subtle)]">
              <div className="text-[10px] text-desc uppercase font-sans flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>Sản Phẩm / Seeding Note</span>
              </div>
              <div className="text-title mt-1 font-sans truncate">
                {account.custom_metadata?.product ||
                  account.custom_metadata?.note ||
                  account.tags?.join(', ') ||
                  '---'}
              </div>
            </div>
          </div>

          {/* Session Token or Cookies */}
          {(account.session_token || account.token || account.cookie) && (
            <div className="bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-subtle)]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-desc uppercase font-sans">
                  {account.platform === 'TIKTOK'
                    ? '⚡ Token Phiên TikTok (Đăng nhập không cần OTP)'
                    : '🍪 Cookie Shopee (SPC_F / Session)'}
                </span>
                <button
                  onClick={() =>
                    handleCopy(
                      account.session_token || account.token || account.cookie,
                      'cookie',
                      'Cookie / Token'
                    )
                  }
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-sans font-bold"
                >
                  {copiedKey === 'cookie' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Sao Chép Toàn Bộ</span>
                </button>
              </div>
              <div className="text-title break-all text-[11px] mt-1.5 line-clamp-3 font-mono bg-[var(--bg-input)] p-2 rounded-lg">
                {account.session_token || account.token || account.cookie}
              </div>
            </div>
          )}
        </div>

        {/* Source and Audit Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="app-card-inner rounded-2xl p-4 space-y-2 border border-[var(--border-subtle)]">
            <div className="text-[11px] font-bold text-desc uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Nguồn Gốc Dữ Liệu</span>
            </div>
            <div className="space-y-1.5 text-title">
              <div>
                Tệp nguồn: <strong className="text-purple-400">{account.metadata?.source_file || 'Thủ công / API'}</strong>
              </div>
              {account.metadata?.source_sheet && (
                <div>
                  Tab sheet: <span className="font-mono">{account.metadata.source_sheet}</span>
                </div>
              )}
              <div>
                Quản lý bởi: <span>{account.metadata?.managed_by || 'Admin'}</span>
              </div>
            </div>
          </div>

          <div className="app-card-inner rounded-2xl p-4 space-y-2 border border-[var(--border-subtle)]">
            <div className="text-[11px] font-bold text-desc uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Lịch Sử & Giao Dịch</span>
            </div>
            <div className="space-y-1.5 text-title">
              {account.sales_metadata?.sold_to && (
                <div>
                  Khách mua: <strong className="text-cyan-400">{account.sales_metadata.sold_to}</strong>
                </div>
              )}
              {account.sales_metadata?.sold_at && (
                <div>
                  Ngày bán: <span>{new Date(account.sales_metadata.sold_at).toLocaleString('vi-VN')}</span>
                </div>
              )}
              <div>
                Ngày nhập: <span>{new Date(account.created_at || account.createdAt || Date.now()).toLocaleString('vi-VN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer quick button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all"
          >
            Đóng Hộp Thoại
          </button>
        </div>
      </div>
    </Modal>
  );
};
