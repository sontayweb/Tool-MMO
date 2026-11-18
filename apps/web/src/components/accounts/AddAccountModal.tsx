'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import {
  UserPlus,
  Key,
  Mail,
  Smartphone,
  Tag,
  Coins,
  Shield,
  ShoppingBag,
  Music2,
  RefreshCw,
  KeyRound,
  Lock
} from 'lucide-react';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (username: string) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showToast
}) => {
  const [platform, setPlatform] = useState<'SHOPEE' | 'TIKTOK'>('SHOPEE');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [cookie, setCookie] = useState('');
  const [phone, setPhone] = useState('');
  const [machineId, setMachineId] = useState('');
  const [coins, setCoins] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      if (showToast) showToast('Vui lòng nhập tên đăng nhập!', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/accounts', {
        platform,
        username: username.trim(),
        password: password.trim() || undefined,
        email: email.trim() || undefined,
        email_password: emailPassword.trim() || undefined,
        cookie: cookie.trim() || undefined,
        phone: phone.trim() || undefined,
        machine_id: machineId.trim() || undefined,
        coins: coins ? Number(coins) : undefined,
        custom_metadata: note ? { note } : undefined
      });

      if (showToast) showToast(`Đã thêm tài khoản ${username} vào kho thành công!`, 'success');
      onSuccess(username);
      // Reset form
      setUsername('');
      setPassword('');
      setEmail('');
      setEmailPassword('');
      setCookie('');
      setPhone('');
      setMachineId('');
      setCoins('');
      setNote('');
      onClose();
    } catch (err: any) {
      console.error('Create Account Failed:', err);
      if (showToast) showToast(err.message || 'Lỗi khi thêm tài khoản', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="xl" showCloseButton={true}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-[var(--border-subtle)]">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-title">Thêm Tài Khoản Mới Vào Kho</h3>
            <p className="text-xs text-desc">Nhập lẻ thông tin tài khoản Shopee hoặc TikTok vào hệ thống lưu trữ.</p>
          </div>
        </div>

        {/* Platform selection */}
        <div className="space-y-1.5 text-xs">
          <label className="block font-semibold text-desc">Chọn Nền Tảng</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlatform('SHOPEE')}
              className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                platform === 'SHOPEE'
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-400 shadow-md'
                  : 'border-[var(--border-subtle)] text-desc hover:text-title bg-white/[0.02]'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-orange-400" />
              <span>SHOPEE</span>
            </button>

            <button
              type="button"
              onClick={() => setPlatform('TIKTOK')}
              className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                platform === 'TIKTOK'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-md'
                  : 'border-[var(--border-subtle)] text-desc hover:text-title bg-white/[0.02]'
              }`}
            >
              <Music2 className="w-4 h-4 text-cyan-400" />
              <span>TIKTOK</span>
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {/* Username */}
          <div className="space-y-1">
            <label className="block font-semibold text-desc">
              Tên Đăng Nhập (Username) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="VD: shopee_user_99"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title font-mono outline-none"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block font-semibold text-desc">Mật Khẩu (Password)</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title font-mono outline-none"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="block font-semibold text-desc">Email Liên Kết</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@hotmail.com"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title font-mono outline-none"
            />
          </div>

          {/* Email Password */}
          <div className="space-y-1">
            <label className="block font-semibold text-desc">Mật Khẩu Email</label>
            <input
              type="text"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Mật khẩu mail..."
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title font-mono outline-none"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="block font-semibold text-desc">Số Điện Thoại (SĐT)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0987654321"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title font-mono outline-none"
            />
          </div>

          {/* Shopee Coins or Machine ID */}
          <div className="space-y-1">
            <label className="block font-semibold text-desc">
              {platform === 'SHOPEE' ? 'Số Xu Shopee' : 'Mã Máy Boxphone'}
            </label>
            {platform === 'SHOPEE' ? (
              <input
                type="number"
                value={coins}
                onChange={(e) => setCoins(e.target.value)}
                placeholder="VD: 5000"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title font-mono outline-none"
              />
            ) : (
              <input
                type="text"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                placeholder="VD: M.C542..."
                className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title font-mono outline-none"
              />
            )}
          </div>
        </div>

        {/* Cookie or Token */}
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-desc">
            {platform === 'SHOPEE' ? 'Cookie Shopee (SPC_F / Session)' : 'Token Phiên TikTok (Session / Cookie)'}
          </label>
          <textarea
            rows={2}
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="Dán Cookie hoặc Session Token vào đây..."
            className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title font-mono outline-none resize-none"
          />
        </div>

        {/* Note */}
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-desc">Ghi Chú / Sản Phẩm Seeding</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú thêm về tài khoản..."
            className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 rounded-xl p-2.5 text-title outline-none"
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all"
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/40 transition-all flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            <span>Lưu Tài Khoản Vào Kho</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
