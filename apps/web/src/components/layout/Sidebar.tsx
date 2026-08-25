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
      iconColor: 'text-purple-500 dark:text-purple-400',
    },
    {
      id: 'accounts' as TabType,
      label: 'Kho Tài Khoản',
      icon: Database,
      badge: stats?.available ? `${(stats.available / 1000).toFixed(1)}k` : undefined,
      iconColor: 'text-cyan-500 dark:text-cyan-400',
    },
    {
      id: 'import' as TabType,
      label: 'Nhập Kho Offline',
      icon: Upload,
      iconColor: 'text-indigo-500 dark:text-indigo-400',
    },
    {
      id: 'lookup' as TabType,
      label: 'Tra Cứu Nhanh',
      icon: Search,
      iconColor: 'text-emerald-500 dark:text-emerald-400',
    },
    {
      id: 'exports' as TabType,
      label: 'Trung Tâm Xuất File',
      icon: Download,
      iconColor: 'text-blue-500 dark:text-blue-400',
    },
  ];

  const mmoNavItems = [
    {
      id: 'farm' as TabType,
      label: 'Dàn Máy Boxphone',
      icon: Server,
      iconColor: 'text-amber-500 dark:text-amber-400',
      tag: 'HOT',
    },
    {
      id: 'crm' as TabType,
      label: 'Doanh Thu & Khách Hàng',
      icon: TrendingUp,
      iconColor: 'text-emerald-500 dark:text-emerald-400',
    },
  ];

  const infraNavItems = [
    {
      id: 'backups' as TabType,
      label: 'Sao Lưu Snapshot',
      icon: Archive,
      iconColor: 'text-teal-500 dark:text-teal-400',
      roles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'apikeys' as TabType,
      label: 'Cổng Kết Nối Tool API',
      icon: Key,
      iconColor: 'text-amber-500 dark:text-amber-400',
      roles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'teams' as TabType,
      label: 'Đội Nhóm & Quyền',
      icon: Users,
      iconColor: 'text-purple-500 dark:text-purple-400',
      roles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'systemlogs' as TabType,
      label: 'Nhật Ký Tập Trung',
      icon: Terminal,
      iconColor: 'text-rose-500 dark:text-rose-400',
      badge: 'LIVE',
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
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
    iconColor?: string;
    badge?: string;
    badgeColor?: string;
    tag?: string;
    roles?: string[];
  }) => {
    if (item.roles && !item.roles.includes(userRole)) return null;

    const Icon = item.icon;
    const isActive = activeTab === item.id;

    if (isCollapsed) {
      return (
        <button
          key={item.id}
          onClick={() => handleTabClick(item.id)}
          title={item.label}
          className={`w-11 h-11 mx-auto flex items-center justify-center rounded-xl transition-all relative group ${
            isActive
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/30 font-bold'
              : 'text-[var(--sidebar-text-desc)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
          }`}
        >
          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.iconColor || 'text-[var(--sidebar-text-desc)]'}`} />
          {item.tag && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[var(--sidebar-bg)]" />
          )}
        </button>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${
          isActive
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/30 font-bold'
            : 'text-[var(--sidebar-text-desc)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.iconColor || 'text-[var(--sidebar-text-desc)]'}`} />

        <span className="flex-1 text-left truncate">{item.label}</span>

        {item.tag && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 shrink-0">
            {item.tag}
          </span>
        )}

        {item.badge && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
              item.badgeColor || 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30'
            }`}
          >
            {item.badge}
          </span>
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
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text)',
        }}
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col h-screen shrink-0 overflow-hidden border-r transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } shadow-xl md:shadow-none select-none`}
      >
        {/* Brand Header */}
        <div
          style={{ borderColor: 'var(--sidebar-border)' }}
          className={`border-b flex items-center ${
            isCollapsed ? 'p-2 flex-col justify-center gap-2' : 'p-4 justify-between'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Mở rộng menu' : undefined}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-0.5 shadow-md shadow-purple-950/20 shrink-0 hover:scale-105 transition-transform"
            >
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
            </button>

            {!isCollapsed && (
              <div className="min-w-0">
                <div className="font-extrabold text-sm tracking-tight text-[var(--sidebar-text)] flex items-center gap-1.5 truncate">
                  <span>ARMS DWH</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-mono font-bold">
                    v4.0
                  </span>
                </div>
                <div className="text-[11px] text-[var(--sidebar-text-desc)] truncate">MMO Data Warehouse</div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 rounded-xl hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-desc)] hover:text-[var(--sidebar-text)] transition-all"
            title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* User Mini Profile (Only when Expanded) */}
        {!isCollapsed && (
          <div
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--sidebar-border)',
            }}
            className="p-3 mx-3 my-2 rounded-2xl border flex items-center gap-3 shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center font-bold text-purple-600 dark:text-purple-300 text-xs shrink-0">
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[var(--sidebar-text)] truncate">{userDisplayName}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--sidebar-text-desc)] mt-0.5">
                <Shield className="w-3 h-3 text-purple-500" />
                <span className="font-semibold text-purple-600 dark:text-purple-400">{userRole}</span>
                <span>·</span>
                <span className="truncate">{userTeam}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-1 py-3 space-y-3' : 'px-3 py-2 space-y-4'}`}>
          {/* Main Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold text-[var(--sidebar-text-muted)] uppercase tracking-wider">
                Quản Lý Kho
              </div>
            )}
            {mainNavItems.map(renderNavButton)}
          </div>

          {/* MMO Special Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold text-[var(--sidebar-text-muted)] uppercase tracking-wider">
                MMO Chuyên Nghiệp
              </div>
            )}
            {mmoNavItems.map(renderNavButton)}
          </div>

          {/* Infra & Security Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold text-[var(--sidebar-text-muted)] uppercase tracking-wider">
                Hạ Tầng & Bảo Mật
              </div>
            )}
            {infraNavItems.map(renderNavButton)}
          </div>
        </div>

        {/* Bottom Actions */}
        <div
          style={{ borderColor: 'var(--sidebar-border)' }}
          className={`border-t ${isCollapsed ? 'p-1.5 space-y-2' : 'p-3 space-y-1'}`}
        >
          {/* Theme Toggle */}
          {isCollapsed ? (
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Chuyển sang Chế độ sáng' : 'Chuyển sang Chế độ tối'}
              className="w-11 h-11 mx-auto flex items-center justify-center rounded-xl text-[var(--sidebar-text-desc)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-all"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-purple-500 shrink-0" />
              )}
            </button>
          ) : (
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--sidebar-text-desc)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-all"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-purple-500 shrink-0" />
              )}
              <span>{theme === 'dark' ? 'Chế Độ Sáng' : 'Chế Độ Tối'}</span>
            </button>
          )}

          {/* Logout Button */}
          {isCollapsed ? (
            <button
              onClick={onLogout}
              title="Đăng xuất khỏi hệ thống"
              className="w-11 h-11 mx-auto flex items-center justify-center rounded-xl text-[var(--sidebar-text-desc)] hover:text-rose-500 hover:bg-rose-500/10 transition-all"
            >
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          ) : (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--sidebar-text-desc)] hover:text-rose-500 hover:bg-rose-500/10 transition-all"
            >
              <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="text-rose-500 font-semibold">Đăng Xuất</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
