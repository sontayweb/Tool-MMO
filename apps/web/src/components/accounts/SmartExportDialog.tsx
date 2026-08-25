'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Zap, Download, RefreshCw, ShoppingCart, ShieldCheck, ShoppingBag, Music2 } from 'lucide-react';

interface SmartExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExportSuccess: (count: number, soldTo: string) => void;
}

export const SmartExportDialog: React.FC<SmartExportDialogProps> = ({
  isOpen,
  onClose,
  onExportSuccess,
}) => {
  const [platform, setPlatform] = useState<'TIKTOK' | 'SHOPEE'>('TIKTOK');
  const [quantity, setQuantity] = useState<number>(50);
  const [onlyLive, setOnlyLive] = useState<boolean>(true);
  const [format, setFormat] = useState<'TXT' | 'EXCEL'>('TXT');
  const [unitPrice, setUnitPrice] = useState<number>(5000);
  const [customerName, setCustomerName] = useState<string>('');
  const [autoMarkSold, setAutoMarkSold] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  const totalPrice = quantity * unitPrice;

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) return;
    setLoading(true);
    try {
      // Simulate / trigger export endpoint
      await new Promise((resolve) => setTimeout(resolve, 800));
      onExportSuccess(quantity, customerName || 'Khách Mua Nhanh');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" showCloseButton={true}>
      <form onSubmit={handleExportSubmit} className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-[var(--border-subtle)]">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-title">Xuất Nhanh & Tạo Đơn Bán Hàng</h3>
            <p className="text-xs text-desc">Trích xuất tự động nick LIVE có lọc và tính toán tiền đơn hàng.</p>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-3.5 text-xs">
          {/* Customer name */}
          <div className="space-y-1">
            <label className="block font-semibold text-desc">Tên Khách Hàng / Kênh Mua</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="VD: Anh Tuấn (Zalo), Shop Tài Khoản 24h..."
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-amber-500 rounded-xl p-2.5 text-title outline-none"
            />
          </div>

          {/* Platform selection */}
          <div className="grid grid-cols-2 gap-3">
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
              <span>TikTok</span>
            </button>

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
              <span>Shopee</span>
            </button>
          </div>

          {/* Quantity & Unit Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-semibold text-desc">Số Lượng Xuất (Nick)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-amber-500 rounded-xl p-2.5 text-title font-mono font-bold outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-desc">Đơn Giá / Nick (VNĐ)</label>
              <input
                type="number"
                min={0}
                step={500}
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-amber-500 rounded-xl p-2.5 text-title font-mono font-bold outline-none"
              />
            </div>
          </div>

          {/* Filter options */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-desc hover:text-title cursor-pointer">
              <input
                type="checkbox"
                checked={onlyLive}
                onChange={(e) => setOnlyLive(e.target.checked)}
                className="rounded accent-amber-500"
              />
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <strong>Chỉ xuất nick LIVE 100%</strong> (loại bỏ nick checkpoint/hỏng)
              </span>
            </label>

            <label className="flex items-center gap-2 text-desc hover:text-title cursor-pointer">
              <input
                type="checkbox"
                checked={autoMarkSold}
                onChange={(e) => setAutoMarkSold(e.target.checked)}
                className="rounded accent-amber-500"
              />
              <span>Tự động đánh dấu <strong>SOLD</strong> và lưu lịch sử giao dịch</span>
            </label>
          </div>

          {/* Price Calculation Card */}
          <div className="app-card-inner p-3.5 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
            <span className="text-desc">Tổng Tiền Dự Kiến:</span>
            <span className="font-mono font-extrabold text-amber-400 text-sm">
              {totalPrice.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all"
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            disabled={loading || quantity <= 0}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-950/40 transition-all flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Tạo & Xuất Hàng Ngay</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
