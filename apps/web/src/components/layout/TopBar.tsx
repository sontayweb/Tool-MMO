'use client';

import React from 'react';
import { Menu, Activity, Sparkles, RefreshCw, Sun, Moon, Shield, Zap } from 'lucide-react';
import { TabType } from './Sidebar';

interface TopBarProps {
  activeTab: TabType;
  onOpenMobileMenu: () => void;
  onRefresh?: () => void;
  onOpenSmartExport?: () => void;
  isRefreshing?: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  userDisplayName: string;
  userRole: string;
  totalAccounts?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onOpenMobileMenu,
  onRefresh,
  onOpenSmartExport,
  isRefreshing = false,
  theme,
  toggleTheme,
  userDisplayName,
  userRole,
  totalAccounts,
}) => {
  const getTabTitle = (tab: TabType) => {
    switch (tab) {
      case 'overview':
        return { title: 'Bảng Điều Khiển Tổng Quan', desc: 'Báo cáo chỉ số KPI, tỷ lệ tài nguyên và chất lượng dữ liệu' };
      case 'accounts':
        return { title: 'Kho Dữ Liệu Tài Khoản', desc: 'Quản lý, phân loại, tìm kiếm và thao tác hàng loạt' };
      case 'ingress':
        return { title: 'Trung Tâm Điều Hành Kéo Dữ Liệu Google Drive', desc: 'Quản lý tập trung kéo data Sheets & Excel từ Google Drive về Kho DWH' };
      case 'import':
        return { title: 'Nhập Kho Offline & File', desc: 'Tải lên tệp TXT/Excel trực tiếp từ máy tính' };
      case 'lookup':
        return { title: 'Tra Cứu Nhanh Danh Sách', desc: 'Dán danh sách username để kiểm tra trạng thái tức thì' };
      case 'exports':
        return { title: 'Trung Tâm Xuất Dữ Liệu', desc: 'Tạo lệnh trích xuất tài khoản theo định dạng TXT / Excel' };
      case 'farm':
        return { title: 'Trung Tâm Dàn Máy Boxphone', desc: 'Quản lý tài khoản theo từng máy nuôi và đẩy sang Antidetect Browser' };
      case 'crm':
        return { title: 'Kế Toán Doanh Thu & Khách Hàng', desc: 'Quản lý giao dịch, công nợ và tự động hóa bảo hành' };
      case 'backups':
        return { title: 'Sao Lưu & Khắc Phục Sự Cố', desc: 'Tạo bản snapshot MongoDB và phục hồi dữ liệu 1-click' };
      case 'apikeys':
        return { title: 'Cổng Kết Nối Tool API', desc: 'Tạo khóa Service Key cho tool Python, C#, Node.js' };
      case 'teams':
        return { title: 'Quản Lý Đội Nhóm & Phân Quyền', desc: 'Phân quyền nhân viên và cô lập dữ liệu theo từng nhóm' };
      case 'systemlogs':
        return { title: 'Trung Tâm Nhật Ký Tập Trung', desc: 'Luồng log trực tiếp giám sát Ingress và tác vụ quản trị' };
      default:
        return { title: 'ARMS Data Warehouse', desc: 'Hệ thống Quản lý Tài nguyên Tài khoản' };
    }
  };

  const currentTabInfo = getTabTitle(activeTab);

  return (
    <header className="sticky top-0 z-30 px-6 py-3.5 bg-[var(--bg-main)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] flex items-center justify-between gap-4">
      {/* Left: Mobile hamburger & Tab Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-desc hover:text-title hover:bg-white/5 transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm md:text-base font-bold text-title">{currentTabInfo.title}</h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">
              <Sparkles className="w-2.5 h-2.5" />
              <span>ARMS v4.0</span>
            </span>
          </div>
          <p className="text-[11px] text-desc hidden sm:block truncate max-w-xl">
            {currentTabInfo.desc}
          </p>
        </div>
      </div>

      {/* Right: Quick actions, status & Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Total Accounts Counter */}
        {totalAccounts !== undefined && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-[var(--border-subtle)] text-xs">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-desc text-[11px]">Tổng kho:</span>
            <span className="font-bold text-title font-mono">{totalAccounts.toLocaleString('vi-VN')}</span>
          </div>
        )}

        {/* Smart 1-Click Export Action */}
        {onOpenSmartExport && (
          <button
            onClick={onOpenSmartExport}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/30 transition-all flex items-center gap-1.5 shrink-0"
            title="Xuất Nhanh 1-Click & Bán Hàng"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xuất Nhanh</span>
          </button>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span className="hidden md:inline">Làm Mới</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-desc hover:text-title hover:bg-white/5 border border-[var(--border-subtle)] transition-all"
          title={theme === 'dark' ? 'Chuyển sang Chế độ sáng' : 'Chuyển sang Chế độ tối'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-purple-400" />
          )}
        </button>

        {/* User Mini Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-subtle)]">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs">
            {userDisplayName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-title leading-tight">{userDisplayName}</div>
            <div className="text-[10px] text-purple-400 font-semibold">{userRole}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
