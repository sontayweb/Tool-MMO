'use client';

import React from 'react';
import {
  Layers,
  Database,
  Upload,
  Search,
  Download,
  Archive,
  Key,
  Users,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Shield,
  Moon,
  Sun,
  LogOut,
  Sparkles,
  Server,
  TrendingUp,
} from 'lucide-react';

export type TabType =
  | 'overview'
  | 'accounts'
  | 'import'
  | 'lookup'
  | 'exports'
  | 'backups'
  | 'apikeys'
  | 'teams'
  | 'systemlogs'
  | 'farm'
  | 'crm';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  userRole: string;
  userTeam: string;
  userDisplayName: string;
  onLogout: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  stats?: {
    total?: number;
    available?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  userTeam,
  userDisplayName,
  onLogout,
  theme,
  toggleTheme,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  stats,
}) => {
  const mainNavItems = [
    {
      id: 'overview' as TabType,
      label: 'Tổng Quan Kho',
      icon: Layers,
      color: 'text-purple-400',
    },
    {
      id: 'accounts' as TabType,
      label: 'Kho Tài Khoản',
      icon: Database,
      badge: stats?.available ? `${(stats.available / 1000).toFixed(1)}k` : undefined,
      color: 'text-cyan-400',
    },
    {
      id: 'import' as TabType,
      label: 'Nhập Kho Offline',
      icon: Upload,
      color: 'text-indigo-400',
    },
    {
      id: 'lookup' as TabType,
      label: 'Tra Cứu Nhanh',
      icon: Search,
      color: 'text-emerald-400',
    },
    {
      id: 'exports' as TabType,
      label: 'Trung Tâm Xuất File',
      icon: Download,
      color: 'text-blue-400',
    },
  ];

  const mmoNavItems = [
    {
      id: 'farm' as TabType,
      label: 'Dàn Máy Boxphone',
      icon: Server,
      color: 'text-amber-400',
      tag: 'NEW',
    },
    {
      id: 'crm' as TabType,
      label: 'Kế Toán & CRM',
      icon: TrendingUp,
      color: 'text-emerald-400',
      tag: 'NEW',
    },
  ];

  const infraNavItems = [
    {
      id: 'backups' as TabType,
      label: 'Sao Lưu & Khôi Phục',
      icon: Archive,
      color: 'text-teal-400',
      roles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'apikeys' as TabType,
      label: 'Cổng API Tool',
      icon: Key,
      color: 'text-amber-400',
      roles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'teams' as TabType,
      label: 'Đội Nhóm & RBAC',
      icon: Users,
      color: 'text-purple-400',
      roles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'systemlogs' as TabType,
      label: 'Nhật Ký Tập Trung',
      icon: Terminal,
      color: 'text-rose-400',
      badge: 'LIVE',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    },
  ];

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileOpen(false);
  };

  const renderNavButton = (item: {
    id: TabType;
    label: string;
    icon: any;
    color?: string;
    badge?: string;
    badgeColor?: string;
    tag?: string;
    roles?: string[];
  }) => {
    if (item.roles && !item.roles.includes(userRole)) return null;

    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        title={isCollapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all relative group ${
          isActive
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/40 font-bold'
            : 'text-desc hover:text-title hover:bg-white/5'
        }`}
      >
        {/* Active indicator bar */}
        {isActive && (
          <div className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full" />
        )}

        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.color || 'text-desc'}`} />

        {!isCollapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>

            {item.tag && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                {item.tag}
              </span>
            )}

            {item.badge && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                  item.badgeColor || 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}
              >
                {item.badge}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } shadow-2xl md:shadow-none`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-purple-950/40 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="font-extrabold text-sm tracking-tight text-title flex items-center gap-1.5 truncate">
                  <span>ARMS DWH</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-mono">
                    v4.0
                  </span>
                </div>
                <div className="text-[11px] text-desc truncate">MMO Data Warehouse</div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 rounded-xl hover:bg-white/5 text-desc hover:text-title transition-all"
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User Mini Profile Card */}
        {!isCollapsed && (
          <div className="mx-3 my-3 p-3 rounded-2xl bg-white/[0.03] border border-[var(--border-subtle)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-title truncate">{userDisplayName}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-purple-500/20 text-purple-300">
                  {userRole}
                </span>
                <span className="text-[10px] text-desc truncate font-mono">
                  {userTeam}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {/* Main Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                Quản Lý Kho
              </div>
            )}
            {mainNavItems.map(renderNavButton)}
          </div>

          {/* MMO Special Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                MMO Chuyên Nghiệp
              </div>
            )}
            {mmoNavItems.map(renderNavButton)}
          </div>

          {/* Infra & Security Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                Hạ Tầng & Bảo Mật
              </div>
            )}
            {infraNavItems.map(renderNavButton)}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-1">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Chuyển sang Chế độ sáng' : 'Chuyển sang Chế độ tối'}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-desc hover:text-title hover:bg-white/5 transition-all"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-purple-400 shrink-0" />
            )}
            {!isCollapsed && <span>{theme === 'dark' ? 'Giao Diện Sáng' : 'Giao Diện Tối'}</span>}
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Đăng xuất khỏi hệ thống"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-desc hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Đăng Xuất</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
