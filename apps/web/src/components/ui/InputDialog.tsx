'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Edit3 } from 'lucide-react';

export interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  loading?: boolean;
  variant?: 'purple' | 'emerald' | 'amber' | 'blue';
}

export const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  label,
  placeholder,
  defaultValue = '',
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  required = false,
  loading = false,
  variant = 'purple',
}) => {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (required && !value.trim()) return;
    onSubmit(value);
  };

  const getSubmitBtnClass = () => {
    switch (variant) {
      case 'emerald':
        return 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white';
      case 'amber':
        return 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white';
      case 'blue':
        return 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white';
      case 'purple':
      default:
        return 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" showCloseButton={false}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Edit3 className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 className="text-base font-bold text-title">{title}</h3>
            {description && <p className="text-xs text-desc leading-relaxed">{description}</p>}
          </div>
        </div>

        <div className="space-y-2">
          {label && <label className="block text-xs font-semibold text-desc">{label}</label>}
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            required={required}
            autoFocus
            className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 rounded-xl p-3 text-xs text-title outline-none transition-all"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            disabled={loading || (required && !value.trim())}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 ${getSubmitBtnClass()} ${
              loading || (required && !value.trim()) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
