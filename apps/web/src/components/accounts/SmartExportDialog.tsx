'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import {
  Zap,
  Download,
  RefreshCw,
  ShoppingCart,
  ShieldCheck,
  ShoppingBag,
  Music2,
  FileText,
  FileSpreadsheet,
  Settings2,
  Check
} from 'lucide-react';

interface SmartExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExportSuccess: (count: number, soldTo: string) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const SmartExportDialog: React.FC<SmartExportDialogProps> = ({
  isOpen,
  onClose,
  onExportSuccess,
  showToast
}) => {
  const [platform, setPlatform] = useState<'TIKTOK' | 'SHOPEE'>('TIKTOK');
  const [quantity, setQuantity] = useState<number>(50);
  const [onlyLive, setOnlyLive] = useState<boolean>(true);
  const [exportType, setExportType] = useState<'TXT' | 'EXCEL'>('TXT');
  const [presetPattern, setPresetPattern] = useState<string>('{username}|{password}|{cookie}');
  const [customPattern, setCustomPattern] = useState<string>('{username}|{password}|{cookie}');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [unitPrice, setUnitPrice] = useState<number>(5000);
  const [customerName, setCustomerName] = useState<string>('');
  const [autoMarkSold, setAutoMarkSold] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  const totalPrice = quantity * unitPrice;

  const presets = [
    { label: 'User|Pass', pattern: '{username}|{password}' },
    { label: 'User|Pass|Cookie', pattern: '{username}|{password}|{cookie}' },
    { label: 'User|Pass|Mail|PassMail', pattern: '{username}|{password}|{email}|{email_password}' },
    { label: 'Full Pipe Format', pattern: '{username}|{password}|{cookie}|{email}|{email_password}|{phone}' },
    { label: 'User:Pass:Token', pattern: '{username}:{password}:{cookie}' }
  ];

  const sampleAccount = {
    username: platform === 'SHOPEE' ? 'shopee_store_99' : 'tiktok_shop_88',
    password: 'Password@2026',
    cookie: platform === 'SHOPEE' ? 'SPC_EC=x98a...; SPC_ST=sec...' : 'ttwid=1%7Cx9...; odin_tt=...',
    email: 'creator_mmo@domain.com',
    email_password: 'PassMail#999',
    phone: '0987654321',
    machine_id: 'BOX_PHONE_01'
  };

  const activePattern = isCustom ? customPattern : presetPattern;
  const livePreviewLine = activePattern
    .replace(/\{username\}/gi, sampleAccount.username)
    .replace(/\{password\}/gi, sampleAccount.password)
    .replace(/\{cookie\}/gi, sampleAccount.cookie)
    .replace(/\{email\}/gi, sampleAccount.email)
    .replace(/\{email_password\}/gi, sampleAccount.email_password)
    .replace(/\{phone\}/gi, sampleAccount.phone)
    .replace(/\{machine_id\}/gi, sampleAccount.machine_id);

  const handleSelectPreset = (p: string) => {
    setIsCustom(false);
    setPresetPattern(p);
    setCustomPattern(p);
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) return;
    setLoading(true);

    try {
      // 1. Lấy danh sách tài khoản AVAILABLE từ API
      const res: any = await api.get('/accounts', {
        platform,
        status: 'AVAILABLE',
        limit: quantity
      });

      const accounts = res.accounts || [];
      if (accounts.length === 0) {
        if (showToast) {
          showToast(`Kho hiện không còn tài khoản ${platform} nào ở trạng thái AVAILABLE!`, 'error');
        }
        setLoading(false);
        return;
      }

      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      const cleanCustomer = customerName.trim() || 'Khach_Le';

      if (exportType === 'EXCEL') {
        // Tải file Excel trực tiếp qua window open hoặc link
        const downloadUrl = `${api.baseUrl}/accounts/export/excel?platform=${platform}&status=AVAILABLE&limit=${quantity}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.target = '_blank';
        a.click();
      } else {
        // Xuất TXT theo Pattern đã chọn
        const activePattern = isCustom ? customPattern : presetPattern;
        const textLines = accounts.map((acc: any) => {
          return activePattern
            .replace(/\{username\}/gi, acc.username || '')
            .replace(/\{password\}/gi, acc.password || '')
            .replace(/\{cookie\}/gi, acc.cookie || acc.session_token || acc.token || '')
            .replace(/\{email\}/gi, acc.email || '')
            .replace(/\{email_password\}/gi, acc.email_password || '')
            .replace(/\{phone\}/gi, acc.phone || '')
            .replace(/\{machine_id\}/gi, acc.machine_id || '');
        });

        const textContent = textLines.join('\n');
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `[ARMS]_${platform}_${cleanCustomer}_${orderId}_${accounts.length}acc.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }

      // 2. Nếu tích tự động đánh dấu SOLD -> Gọi API bulkMarkSold
      if (autoMarkSold) {
        const usernames = accounts.map((a: any) => a.username);
        await api.post('/accounts/bulk-sold', {
          usernames,
          sold_to: cleanCustomer,
          order_id: orderId,
          unit_price: unitPrice
        });
      }

      if (showToast) {
        showToast(
          `Đã tải về thành công ${accounts.length} tài khoản ${platform} cho ${cleanCustomer}!`,
          'success'
        );
      }

      onExportSuccess(accounts.length, cleanCustomer);
      onClose();
    } catch (err: any) {
      console.error('Export Failed:', err);
      if (showToast) showToast(err.message || 'Lỗi khi xuất tài khoản', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg" showCloseButton={true}>
      <form onSubmit={handleExportSubmit} className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Phiếu Trích Xuất & Xuất Kho Hàng Hóa</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Trích xuất tài khoản khả dụng từ kho lưu trữ và lập chứng từ xuất kho bán hàng.</p>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4 text-xs">
          {/* Customer name */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">Khách Hàng / Đối Tác Tiếp Nhận</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="VD: Anh Tuấn (Zalo), Shop Nick 24h, Khách sỉ HN..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none"
            />
          </div>

          {/* Platform selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlatform('TIKTOK')}
              className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                platform === 'TIKTOK'
                  ? 'bg-cyan-50 border-cyan-400 text-cyan-900 dark:bg-cyan-950/40 dark:border-cyan-500/60 dark:text-cyan-200 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              <Music2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>TIKTOK</span>
            </button>

            <button
              type="button"
              onClick={() => setPlatform('SHOPEE')}
              className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                platform === 'SHOPEE'
                  ? 'bg-orange-50 border-orange-400 text-orange-900 dark:bg-orange-950/40 dark:border-orange-500/60 dark:text-orange-200 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>SHOPEE</span>
            </button>
          </div>

          {/* Quantity & Unit Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Số Lượng Xuất Kho (Tài khoản)</label>
              <input
                type="number"
                min={1}
                max={5000}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-mono font-bold outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Đơn Giá / Tài Khoản (VNĐ)</label>
              <input
                type="number"
                min={0}
                step={500}
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-mono font-bold outline-none"
              />
            </div>
          </div>

          {/* Export Type (TXT vs Excel) */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">Hình Thức Định Dạng Xuất</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportType('TXT')}
                className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  exportType === 'TXT'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 dark:bg-indigo-950/50 dark:border-indigo-500/60 dark:text-indigo-200 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Tệp TXT (Theo định dạng)</span>
              </button>

              <button
                type="button"
                onClick={() => setExportType('EXCEL')}
                className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  exportType === 'EXCEL'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-500/60 dark:text-emerald-200 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Bảng Tính Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* MMO Format Builder (Only for TXT) */}
          {exportType === 'TXT' && (
            <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Mẫu Cấu Hình Chuỗi Trích Xuất (Output Pattern)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustom(!isCustom)}
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  {isCustom ? 'Dùng mẫu có sẵn' : 'Tự gõ mẫu tùy biến'}
                </button>
              </div>

              {!isCustom ? (
                <div className="flex flex-wrap gap-2">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(p.pattern)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all flex items-center gap-1 ${
                        presetPattern === p.pattern && !isCustom
                          ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950/50 dark:border-amber-500/60 dark:text-amber-200 font-bold'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {presetPattern === p.pattern && <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={customPattern}
                    onChange={(e) => setCustomPattern(e.target.value)}
                    placeholder="VD: {username}|{password}|{cookie}|{email}"
                    className="w-full bg-white dark:bg-slate-900 border border-amber-500/60 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100 text-xs outline-none"
                  />
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-1 mt-1 items-center">
                    <span>Biến hợp lệ:</span>
                    {['{username}', '{password}', '{cookie}', '{email}', '{email_password}', '{phone}', '{machine_id}'].map((v) => (
                      <code key={v} className="text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-1 py-0.5 rounded border border-cyan-200 dark:border-cyan-800">
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Preview Box */}
              <div className="mt-2.5 p-2.5 rounded-lg bg-[#0d1117] border border-slate-700/80 text-[11px] space-y-1">
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                  <span>XEM TRƯỚC DÒNG XUẤT THỰC TẾ (LIVE PREVIEW):</span>
                  <span className="text-emerald-400 font-mono">1 dòng mẫu ({platform})</span>
                </div>
                <div className="break-all select-all font-mono leading-relaxed text-emerald-300 bg-black/40 p-1.5 rounded">
                  {livePreviewLine}
                </div>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMarkSold}
                onChange={(e) => setAutoMarkSold(e.target.checked)}
                className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-medium">Tự động ghi nhận chuyển đổi trạng thái <strong className="text-amber-600 dark:text-amber-400">SOLD</strong> và lưu đơn hàng vào CRM</span>
            </label>
          </div>

          {/* Price Summary */}
          <div className="p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-semibold">Tổng Giá Trị Phiếu Xuất:</span>
            <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
              {totalPrice.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all"
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            disabled={loading || quantity <= 0}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Xác Nhận Xuất Kho & Tải File</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
