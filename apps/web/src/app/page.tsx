'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Shield,
  Layers,
  Database,
  Upload,
  Search,
  Download,
  Archive,
  Key,
  Users,
  Terminal,
  Activity,
  UserPlus,
  RefreshCw,
  Clock,
  UserCheck,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle,
  Copy,
  Trash2,
  Lock,
  Code2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { api, getToken, removeToken, getRole, getTeam, getDisplayName } from '../lib/api';

// Modular UI Components
import { Sidebar, TabType } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { ConfirmDialog, ConfirmDialogProps } from '../components/ui/ConfirmDialog';
import { InputDialog, InputDialogProps } from '../components/ui/InputDialog';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import { AccountFilters, AccountFiltersState } from '../components/accounts/AccountFilters';
import { AccountsTable } from '../components/accounts/AccountsTable';
import { BulkActionBar } from '../components/accounts/BulkActionBar';
import { AccountDetailModal } from '../components/accounts/AccountDetailModal';

export default function App() {
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userTeam, setUserTeam] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Navigation & Layout State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Global Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Custom Modal Dialog States (replacing confirm / prompt)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'success' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    description?: string;
    required?: boolean;
    variant?: 'purple' | 'emerald' | 'amber' | 'blue';
    onSubmit: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    onSubmit: () => {},
  });

  // Tab 1: Overview & Stats State
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isRefreshingGlobal, setIsRefreshingGlobal] = useState(false);

  // Tab 2: Accounts State
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsTotal, setAccountsTotal] = useState(0);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsTotalPages, setAccountsTotalPages] = useState(1);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<any | null>(null);

  const [accountFilters, setAccountFilters] = useState<AccountFiltersState>({
    search: '',
    platform: 'ALL',
    status: 'ALL',
    machine_id: '',
    source_file: '',
    managed_by: '',
    has_cookie: '',
    has_email: '',
    has_token: '',
    team: 'ALL',
    limit: 50,
  });

  // Tab 3: Offline Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [dupScanLoading, setDupScanLoading] = useState(false);
  const [dupScanResult, setDupScanResult] = useState<any>(null);

  // Tab 4: Quick Lookup State
  const [lookupText, setLookupText] = useState('');
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Tab 5: Exports State
  const [exportsList, setExportsList] = useState<any[]>([]);
  const [exportPlatform, setExportPlatform] = useState('ALL');
  const [exportStatus, setExportStatus] = useState('AVAILABLE');
  const [exportFormat, setExportFormat] = useState('TXT');
  const [exportMarkUsed, setExportMarkUsed] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Tab 6: Backups State
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);

  // Tab 7: API Keys State
  const [apiKeysList, setApiKeysList] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['READ_ACCOUNTS']);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<any>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  // Tab 8: Teams & Users State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberDisplayName, setNewMemberDisplayName] = useState('');
  const [newMemberTeam, setNewMemberTeam] = useState('TEAM_HA_NOI');
  const [newMemberRole, setNewMemberRole] = useState<'MEMBER' | 'MANAGER' | 'VIEWER'>('MEMBER');
  const [memberLoading, setMemberLoading] = useState(false);

  // Tab 9: System Logs State
  const [systemLogsData, setSystemLogsData] = useState<any>(null);
  const [systemLogsLoading, setSystemLogsLoading] = useState(false);
  const [systemLogsAutoScroll, setSystemLogsAutoScroll] = useState(true);
  const [systemLogsFilterLevel, setSystemLogsFilterLevel] = useState('ALL');
  const [systemLogsSearch, setSystemLogsSearch] = useState('');
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Show Toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label = 'Dữ liệu') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label} vào bộ nhớ tạm!`, 'success');
  };

  // Toggle Theme helper
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('arms_theme', nextTheme);
  };

  // Check login on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('arms_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    const token = getToken();
    if (token) {
      setIsLoggedIn(true);
      setUserRole(getRole() || 'MEMBER');
      setUserTeam(getTeam() || 'ALL');
      setUserDisplayName(getDisplayName() || 'Thành Viên');
    }
  }, []);

  // Fetch data when tab changes or user logs in
  useEffect(() => {
    if (isLoggedIn) {
      fetchDashboardStats();
      if (activeTab === 'accounts') fetchAccounts(1);
      if (activeTab === 'exports') fetchExports();
      if (activeTab === 'backups') fetchBackups();
      if (activeTab === 'apikeys') fetchApiKeys();
      if (activeTab === 'teams') fetchTeamsAndUsers();
      if (activeTab === 'systemlogs') fetchSystemLogs();
    }
  }, [isLoggedIn, activeTab]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await api.login(username, password);
      setIsLoggedIn(true);
      setUserRole(res.user?.role || res.role);
      setUserTeam(res.user?.team || 'ALL');
      setUserDisplayName(res.user?.display_name || username);
      showToast(`Chào mừng ${res.user?.display_name || username} đăng nhập thành công!`, 'success');
    } catch (err: any) {
      setLoginError(err.message || 'Đăng nhập thất bại. Kiểm tra tài khoản/mật khẩu.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Đăng xuất khỏi hệ thống',
      message: 'Bạn có chắc chắn muốn đăng xuất phiên làm việc hiện tại?',
      confirmText: 'Đăng xuất ngay',
      variant: 'danger',
      onConfirm: () => {
        removeToken();
        setIsLoggedIn(false);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast('Đã đăng xuất an toàn.', 'info');
      },
    });
  };

  // Fetch Dashboard Stats & Analytics
  const fetchDashboardStats = async () => {
    try {
      setIsRefreshingGlobal(true);
      const [statsData, analyticsData] = await Promise.all([
        api.getStats(),
        api.getAnalytics().catch(() => null),
      ]);
      setStats(statsData);
      setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('Failed to fetch dashboard stats', err);
    } finally {
      setIsRefreshingGlobal(false);
    }
  };

  // Fetch Accounts
  const fetchAccounts = async (pageToFetch = accountsPage) => {
    setAccountsLoading(true);
    try {
      const res = await api.getAccounts({
        page: pageToFetch,
        limit: accountFilters.limit,
        platform: accountFilters.platform === 'ALL' ? undefined : accountFilters.platform,
        status: accountFilters.status === 'ALL' ? undefined : accountFilters.status,
        machine_id: accountFilters.machine_id ? accountFilters.machine_id.trim() : undefined,
        search: accountFilters.search ? accountFilters.search.trim() : undefined,
        has_cookie: accountFilters.has_cookie || undefined,
        has_email: accountFilters.has_email || undefined,
        has_token: accountFilters.has_token || undefined,
      });

      setAccounts(res.accounts || []);
      setAccountsTotal(res.total || 0);
      setAccountsPage(res.page || pageToFetch);
      setAccountsTotalPages(res.total_pages || Math.ceil((res.total || 0) / accountFilters.limit) || 1);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nạp danh sách tài khoản', 'error');
    } finally {
      setAccountsLoading(false);
    }
  };

  // Accounts Selection handlers
  const handleToggleSelectAll = () => {
    const currentAll = accounts.every((acc) => selectedUsernames.includes(acc.username));
    if (currentAll) {
      setSelectedUsernames([]);
    } else {
      setSelectedUsernames(accounts.map((acc) => acc.username));
    }
  };

  const handleToggleSelectOne = (u: string) => {
    if (selectedUsernames.includes(u)) {
      setSelectedUsernames((prev) => prev.filter((item) => item !== u));
    } else {
      setSelectedUsernames((prev) => [...prev, u]);
    }
  };

  // Bulk Actions
  const handleQuickCopy = (mode: 'basic' | 'full' = 'basic') => {
    if (selectedUsernames.length === 0) return;
    const selectedAccs = accounts.filter((a) => selectedUsernames.includes(a.username));
    let text = '';
    if (mode === 'basic') {
      text = selectedAccs.map((a) => `${a.username}|${a.password || ''}`).join('\n');
    } else {
      text = selectedAccs
        .map(
          (a) =>
            `${a.username}|${a.password || ''}|${a.email || ''}|${a.email_password || a.pass_email || ''}|${
              a.session_token || a.cookie || ''
            }`
        )
        .join('\n');
    }
    copyToClipboard(text, `${selectedAccs.length} tài khoản`);
  };

  const handleBulkMarkSold = () => {
    if (selectedUsernames.length === 0) return;

    setInputDialog({
      isOpen: true,
      title: `⚡ Bán Nhanh & Sao Chép (${selectedUsernames.length} tài khoản)`,
      label: 'Tên Khách Hàng Mua / Kênh Thu Mua',
      placeholder: 'VD: Anh Tuấn, Shop ABC, Zalo @mmo...',
      required: true,
      variant: 'emerald',
      description: 'Hệ thống sẽ tự động chuyển trạng thái thành SOLD và sao chép toàn bộ định dạng gửi khách.',
      onSubmit: async (soldTo) => {
        try {
          await api.markSold(selectedUsernames, soldTo);
          handleQuickCopy('full');
          showToast(`Đã bán thành công cho ${soldTo}!`, 'success');
          setSelectedUsernames([]);
          setInputDialog((prev) => ({ ...prev, isOpen: false }));
          fetchAccounts(accountsPage);
          fetchDashboardStats();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi cập nhật trạng thái', 'error');
        }
      },
    });
  };

  const handleBulkMarkUsed = () => {
    if (selectedUsernames.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Xác nhận đánh dấu ĐÃ DÙNG (${selectedUsernames.length} tài khoản)`,
      message: 'Chuyển trạng thái các tài khoản này sang USED để phân loại cho tool nuôi / seeding?',
      confirmText: 'Đánh dấu Đã Dùng',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await api.markUsed(selectedUsernames);
          showToast(`Đã chuyển ${selectedUsernames.length} tài khoản sang USED`, 'success');
          setSelectedUsernames([]);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchAccounts(accountsPage);
          fetchDashboardStats();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi cập nhật', 'error');
        }
      },
    });
  };

  const handleBulkBlacklist = () => {
    if (selectedUsernames.length === 0) return;

    setInputDialog({
      isOpen: true,
      title: `Khóa ${selectedUsernames.length} tài khoản (Blacklist)`,
      label: 'Lý do khóa / lỗi',
      placeholder: 'VD: Nick die checkpoint, sai pass...',
      required: true,
      variant: 'amber',
      onSubmit: async (reason) => {
        try {
          await api.blacklist(selectedUsernames, reason);
          showToast(`Đã đưa ${selectedUsernames.length} tài khoản vào Blacklist!`, 'info');
          setSelectedUsernames([]);
          setInputDialog((prev) => ({ ...prev, isOpen: false }));
          fetchAccounts(accountsPage);
          fetchDashboardStats();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi blacklist', 'error');
        }
      },
    });
  };

  // Tab 3: Offline Import Handlers
  const handleUploadPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImportLoading(true);
    try {
      const res = await api.uploadOffline(importFile, 'preview');
      setImportPreviewData(res);
      showToast(`Đã phân tích xong tệp tin: tìm thấy ${res.total_parsed} tài khoản`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Lỗi phân tích tệp tin', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importFile) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Xác nhận Nhập Kho Chính Thức',
      message: `Hệ thống sẽ nạp toàn bộ ${importPreviewData?.total_parsed || 0} tài khoản vào kho tổng MongoDB, tự động chuẩn hóa và mã hóa AES-256.`,
      confirmText: 'Nhập Kho Ngay',
      variant: 'success',
      onConfirm: async () => {
        setImportLoading(true);
        try {
          const res = await api.uploadOffline(importFile, 'commit');
          showToast(`Nhập kho thành công! Thêm mới: ${res.inserted || 0}, Cập nhật: ${res.updated || 0}`, 'success');
          setImportPreviewData(null);
          setImportFile(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchDashboardStats();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi nhập kho', 'error');
        } finally {
          setImportLoading(false);
        }
      },
    });
  };

  // Duplicate scan handlers
  const handleScanDuplicates = async () => {
    setDupScanLoading(true);
    try {
      const res = await api.scanDuplicates();
      setDupScanResult(res);
      showToast(`Quét xong! Tìm thấy ${res.duplicate_groups_count || 0} nhóm nick bị trùng lặp`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Lỗi quét trùng', 'error');
    } finally {
      setDupScanLoading(false);
    }
  };

  const handleCleanDuplicates = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Tự động gộp & Làm sạch nick trùng lặp',
      message: 'Hệ thống sẽ giữ lại bản ghi có đầy đủ Cookie/Token mới nhất và dọn dẹp các bản ghi rác thừa.',
      confirmText: 'Làm sạch ngay',
      variant: 'warning',
      onConfirm: async () => {
        try {
          const res = await api.cleanDuplicates();
          showToast(`Đã làm sạch thành công: xóa ${res.cleaned_count || 0} bản ghi rác`, 'success');
          setDupScanResult(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchDashboardStats();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi làm sạch trùng', 'error');
        }
      },
    });
  };

  // Tab 4: Quick Lookup Handler
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const usernames = lookupText
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    if (usernames.length === 0) return;
    setLookupLoading(true);
    try {
      const res = await api.lookupBulk(usernames);
      setLookupResults(res.results || []);
      showToast(`Đã tra cứu xong ${res.results?.length || 0} tài khoản`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Lỗi tra cứu', 'error');
    } finally {
      setLookupLoading(false);
    }
  };

  // Tab 5: Exports Handlers
  const fetchExports = async () => {
    try {
      const res = await api.getExports();
      setExportsList(res.exports || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportLoading(true);
    try {
      const filter: any = {};
      if (exportPlatform !== 'ALL') filter.platform = exportPlatform;
      if (exportStatus !== 'ALL') filter.status = exportStatus;

      await api.createExport(filter, exportFormat, undefined, exportMarkUsed);
      showToast('Đã tạo tác vụ xuất file thành công!', 'success');
      fetchExports();
    } catch (err: any) {
      showToast(err.message || 'Lỗi tạo tác vụ xuất', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  // Tab 6: Backups Handlers
  const fetchBackups = async () => {
    try {
      const res = await api.getBackups();
      setBackupsList(res.backups || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBackup = async () => {
    setInputDialog({
      isOpen: true,
      title: 'Tạo Bản Sao Lưu Snapshot Mới',
      label: 'Ghi chú sao lưu (tùy chọn)',
      placeholder: 'VD: Snapshot trước khi nhập đợt 50k nick...',
      variant: 'purple',
      onSubmit: async (note) => {
        setBackupLoading(true);
        try {
          await api.createBackup(note);
          showToast('Đã tạo bản sao lưu snapshot thành công!', 'success');
          setInputDialog((prev) => ({ ...prev, isOpen: false }));
          fetchBackups();
        } catch (err: any) {
          showToast(err.message || 'Lỗi tạo sao lưu', 'error');
        } finally {
          setBackupLoading(false);
        }
      },
    });
  };

  const handleRestoreBackup = (fileName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: `Khôi phục dữ liệu từ bản ${fileName}?`,
      message: 'CẢNH BÁO: Quá trình khôi phục sẽ ghi đè dữ liệu hiện tại bằng dữ liệu của bản Snapshot này.',
      confirmText: 'Phục hồi dữ liệu',
      variant: 'danger',
      onConfirm: async () => {
        setBackupLoading(true);
        try {
          await api.restoreBackup(fileName);
          showToast(`Đã phục hồi thành công từ bản ${fileName}!`, 'success');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchDashboardStats();
        } catch (err: any) {
          showToast(err.message || 'Lỗi phục hồi', 'error');
        } finally {
          setBackupLoading(false);
        }
      },
    });
  };

  const handleDeleteBackup = (fileName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: `Xóa bản sao lưu ${fileName}?`,
      message: 'Bản sao lưu này sẽ bị xóa vĩnh viễn khỏi máy chủ lưu trữ.',
      confirmText: 'Xóa vĩnh viễn',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteBackup(fileName);
          showToast('Đã xóa bản sao lưu.', 'info');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchBackups();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi xóa', 'error');
        }
      },
    });
  };

  // Tab 7: API Keys Handlers
  const fetchApiKeys = async () => {
    try {
      const res = await api.getApiKeys();
      setApiKeysList(res.keys || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setApiKeyLoading(true);
    try {
      const res = await api.createApiKey(newKeyName, newKeyScopes, 365);
      setNewlyCreatedKey(res);
      setNewKeyName('');
      showToast('Đã tạo API Key thành công!', 'success');
      fetchApiKeys();
    } catch (err: any) {
      showToast(err.message || 'Lỗi tạo API Key', 'error');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRevokeApiKey = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Thu hồi khóa API Key này?',
      message: 'Các tool ngoại vi đang sử dụng khóa này sẽ ngay lập tức bị ngắt kết nối khỏi Data Warehouse.',
      confirmText: 'Thu hồi ngay',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.revokeApiKey(id);
          showToast('Đã thu hồi API Key.', 'info');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchApiKeys();
        } catch (err: any) {
          showToast(err.message || 'Lỗi thu hồi', 'error');
        }
      },
    });
  };

  // Tab 8: Teams & Users Handlers
  const fetchTeamsAndUsers = async () => {
    try {
      const res = await api.getUsers();
      setUsersList(res.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberLoading(true);
    try {
      await api.createUser({
        username: newMemberUsername,
        password: newMemberPassword,
        role: newMemberRole,
        team: newMemberTeam,
        display_name: newMemberDisplayName || newMemberUsername,
      });
      showToast(`Đã tạo nhân viên ${newMemberUsername} thành công!`, 'success');
      setNewMemberUsername('');
      setNewMemberPassword('');
      setNewMemberDisplayName('');
      fetchTeamsAndUsers();
    } catch (err: any) {
      showToast(err.message || 'Lỗi tạo tài khoản nhân viên', 'error');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleDeleteMember = (id: string, memberUsername: string) => {
    setConfirmDialog({
      isOpen: true,
      title: `Xóa tài khoản nhân viên @${memberUsername}?`,
      message: 'Tài khoản này sẽ không thể đăng nhập vào ARMS nữa.',
      confirmText: 'Xóa nhân viên',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteUser(id);
          showToast(`Đã xóa nhân viên @${memberUsername}`, 'info');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchTeamsAndUsers();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi xóa nhân viên', 'error');
        }
      },
    });
  };

  // Tab 9: System Logs Handlers
  const fetchSystemLogs = async () => {
    setSystemLogsLoading(true);
    try {
      const res = await api.getSystemLogs(200);
      setSystemLogsData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSystemLogsLoading(false);
    }
  };

  // Auto-scroll logs terminal
  useEffect(() => {
    if (activeTab === 'systemlogs' && systemLogsAutoScroll && logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [systemLogsData, activeTab, systemLogsAutoScroll]);

  // ----------------------------------------------------
  // RENDER: LOGIN SCREEN (When not logged in)
  // ----------------------------------------------------
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--bg-main)]">
        {/* Background glow decorations */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md app-card rounded-3xl p-8 border border-[var(--border-subtle)] shadow-2xl space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-0.5 shadow-xl shadow-purple-950/50 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-purple-400" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-title">ARMS DWH v4.0</h1>
            <p className="text-xs text-desc">Hệ Thống Quản Lý Kho Tài Khoản MMO Enterprise</p>
          </div>

          {/* Error Banner */}
          {loginError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-desc">Tên Đăng Nhập</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: admin_sontay"
                required
                className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl p-3.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-desc">Mật Khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl p-3.5 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/40 transition-all flex items-center justify-center gap-2"
            >
              {loginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Đăng Nhập Vào Kho Dữ Liệu</span>
            </button>
          </form>

          <div className="text-center text-[11px] text-desc">
            Bảo mật AES-256 · Phân quyền đa cấp · RBAC Team Isolation
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: AUTHENTICATED DASHBOARD
  // ----------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[var(--bg-main)] text-title">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-slideDown border ${
            toastType === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40'
              : toastType === 'error'
              ? 'bg-rose-950/90 text-rose-300 border-rose-500/40 shadow-rose-950/40'
              : 'bg-purple-950/90 text-purple-300 border-purple-500/40 shadow-purple-950/40'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Custom Confirm Dialog (Replaces window.confirm) */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
      />

      {/* Custom Input Dialog (Replaces window.prompt) */}
      <InputDialog
        isOpen={inputDialog.isOpen}
        onClose={() => setInputDialog((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={inputDialog.onSubmit}
        title={inputDialog.title}
        label={inputDialog.label}
        placeholder={inputDialog.placeholder}
        defaultValue={inputDialog.defaultValue}
        description={inputDialog.description}
        required={inputDialog.required}
        variant={inputDialog.variant}
      />

      {/* Account Detail Modal */}
      <AccountDetailModal
        account={selectedAccountDetail}
        isOpen={!!selectedAccountDetail}
        onClose={() => setSelectedAccountDetail(null)}
        onCopyText={copyToClipboard}
      />

      {/* Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        userTeam={userTeam}
        userDisplayName={userDisplayName}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileDrawerOpen}
        setIsMobileOpen={setIsMobileDrawerOpen}
        stats={stats}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* TopBar Header */}
        <TopBar
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
          onRefresh={fetchDashboardStats}
          isRefreshing={isRefreshingGlobal}
          theme={theme}
          toggleTheme={toggleTheme}
          userDisplayName={userDisplayName}
          userRole={userRole}
          totalAccounts={stats?.total}
        />

        {/* Content Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <DashboardOverview
              stats={stats}
              analytics={analytics}
              onNavigateTab={(t) => setActiveTab(t)}
            />
          )}

          {/* TAB 2: ACCOUNTS DATA */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <AccountFilters
                filters={accountFilters}
                setFilters={setAccountFilters}
                onApplyFilters={() => fetchAccounts(1)}
                onResetFilters={() => {
                  setAccountFilters({
                    search: '',
                    platform: 'ALL',
                    status: 'ALL',
                    machine_id: '',
                    source_file: '',
                    managed_by: '',
                    has_cookie: '',
                    has_email: '',
                    has_token: '',
                    team: 'ALL',
                    limit: 50,
                  });
                  fetchAccounts(1);
                }}
                isLoading={accountsLoading}
              />

              <AccountsTable
                accounts={accounts}
                total={accountsTotal}
                page={accountsPage}
                limit={accountFilters.limit}
                totalPages={accountsTotalPages}
                onPageChange={(p) => fetchAccounts(p)}
                selectedUsernames={selectedUsernames}
                onToggleSelectAll={handleToggleSelectAll}
                onToggleSelectOne={handleToggleSelectOne}
                onViewDetail={(acc) => setSelectedAccountDetail(acc)}
                onCopyText={copyToClipboard}
                isLoading={accountsLoading}
              />

              {/* Floating Bulk Action Bar */}
              <BulkActionBar
                selectedCount={selectedUsernames.length}
                onClearSelection={() => setSelectedUsernames([])}
                onQuickCopy={() => handleQuickCopy('basic')}
                onCopyFull={() => handleQuickCopy('full')}
                onMarkSold={handleBulkMarkSold}
                onMarkUsed={handleBulkMarkUsed}
                onBlacklist={handleBulkBlacklist}
              />
            </div>
          )}

          {/* TAB 3: OFFLINE IMPORT & DUPLICATE CLEANER */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Duplicate Cleaner Banner */}
              <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-title flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Công Cụ Quét Trùng Lặp & Làm Sạch Kho</span>
                    </h3>
                    <p className="text-xs text-desc mt-1">
                      Tự động quét toàn bộ kho MongoDB để phát hiện nick trùng username_normalized và làm sạch an toàn.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleScanDuplicates}
                      disabled={dupScanLoading}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-all flex items-center gap-1.5"
                    >
                      {dupScanLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Quét Trùng Lặp</span>
                    </button>
                    {dupScanResult?.duplicate_groups_count > 0 && (
                      <button
                        onClick={handleCleanDuplicates}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Làm Sạch {dupScanResult.duplicate_groups_count} Nhóm Trùng</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload Card */}
              <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <h3 className="font-bold text-sm text-title flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Tải Lên Tệp Tin Tài Khoản (TXT / XLSX / CSV)</span>
                </h3>

                <form onSubmit={handleUploadPreview} className="space-y-4">
                  <div className="border-2 border-dashed border-[var(--border-subtle)] hover:border-purple-500/50 rounded-2xl p-8 text-center transition-all bg-[var(--bg-input)]">
                    <input
                      type="file"
                      accept=".txt,.xlsx,.xls,.csv"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="offline-file-input"
                    />
                    <label htmlFor="offline-file-input" className="cursor-pointer space-y-2 block">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-title">
                        {importFile ? importFile.name : 'Bấm để chọn tệp tin hoặc kéo thả vào đây'}
                      </div>
                      <div className="text-[11px] text-desc">
                        Hỗ trợ định dạng TXT (User|Pass|Mail|Cookie), Excel (Shopee, TikTok, Boxphone)
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="submit"
                      disabled={!importFile || importLoading}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg transition-all flex items-center gap-2"
                    >
                      {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>Xem Trước Dữ Liệu (Preview)</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Preview Table & Commit */}
              {importPreviewData && (
                <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)] animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-title">Kết Quả Phân Tích: {importPreviewData.total_parsed} Tài Khoản</h3>
                      <p className="text-xs text-desc">Kiểm tra thông tin trước khi nạp chính thức vào kho dữ liệu.</p>
                    </div>
                    <button
                      onClick={handleCommitImport}
                      disabled={importLoading}
                      className="px-6 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
                    >
                      {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      <span>Xác Nhận Nạp Kho Ngay</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: QUICK LOOKUP */}
          {activeTab === 'lookup' && (
            <div className="space-y-6">
              <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <h3 className="font-bold text-sm text-title flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400" />
                  <span>Tra Cứu Nhanh Danh Sách Tài Khoản</span>
                </h3>
                <p className="text-xs text-desc">
                  Dán danh sách username (mỗi dòng một tài khoản) để kiểm tra tồn kho, trạng thái bán và mật khẩu.
                </p>

                <form onSubmit={handleLookup} className="space-y-4">
                  <textarea
                    rows={6}
                    value={lookupText}
                    onChange={(e) => setLookupText(e.target.value)}
                    placeholder={`shopee_acc_01\nshopee_acc_02\ntiktok_acc_03`}
                    className="w-full bg-[var(--bg-input)] text-title text-xs rounded-xl p-4 border border-[var(--border-subtle)] focus:outline-none focus:border-purple-500 font-mono"
                  />

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-desc">
                      Đã nhập: {lookupText.split('\n').filter((u) => u.trim()).length} dòng
                    </span>
                    <button
                      type="submit"
                      disabled={lookupLoading || !lookupText.trim()}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg transition-all flex items-center gap-2"
                    >
                      {lookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>Tra Cứu Ngay</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Lookup Results */}
              {lookupResults.length > 0 && (
                <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                  <h3 className="font-bold text-sm text-title">Kết Quả Tra Cứu ({lookupResults.length})</h3>
                  <div className="divide-y divide-[var(--border-subtle)] max-h-96 overflow-y-auto">
                    {lookupResults.map((r, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between gap-4">
                        <div className="font-mono text-xs">
                          <span className="font-bold text-title">{r.username}</span>
                          {r.found ? (
                            <span className="ml-2 text-desc">({r.platform || 'UNKNOWN'})</span>
                          ) : (
                            <span className="ml-2 text-rose-400 font-bold">Chưa có trong kho</span>
                          )}
                        </div>
                        {r.found && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-purple-500/20 text-purple-300">
                              {r.status}
                            </span>
                            <button
                              onClick={() => setSelectedAccountDetail(r)}
                              className="text-xs text-purple-400 hover:underline"
                            >
                              Chi tiết
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EXPORTS */}
          {activeTab === 'exports' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <h3 className="font-bold text-sm text-title flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>Tạo Lệnh Xuất Dữ Liệu</span>
                </h3>

                <form onSubmit={handleCreateExport} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-desc mb-1">Nền Tảng</label>
                    <select
                      value={exportPlatform}
                      onChange={(e) => setExportPlatform(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                    >
                      <option value="ALL">Tất cả nền tảng</option>
                      <option value="SHOPEE">Shopee</option>
                      <option value="TIKTOK">TikTok</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-desc mb-1">Trạng Thái</label>
                    <select
                      value={exportStatus}
                      onChange={(e) => setExportStatus(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                    >
                      <option value="AVAILABLE">AVAILABLE (Sẵn sàng bán)</option>
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="SOLD">SOLD (Đã bán)</option>
                      <option value="USED">USED (Đã dùng)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-desc mb-1">Định Dạng</label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                    >
                      <option value="TXT">TXT (User|Pass|Mail|Cookie)</option>
                      <option value="EXCEL">Excel (.xlsx)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-desc cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportMarkUsed}
                      onChange={(e) => setExportMarkUsed(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>Tự động đánh dấu USED sau khi xuất</span>
                  </label>

                  <button
                    type="submit"
                    disabled={exportLoading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {exportLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>Tạo Lệnh Xuất File</span>
                  </button>
                </form>
              </div>

              {/* Exports List */}
              <div className="md:col-span-2 app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-title">Lịch Sử Xuất Dữ Liệu</h3>
                  <button onClick={fetchExports} className="text-xs text-desc hover:text-title flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    <span>Làm mới</span>
                  </button>
                </div>

                {exportsList.length === 0 ? (
                  <div className="p-8 text-center text-desc text-xs">Chưa có lệnh xuất nào.</div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {exportsList.map((job: any) => (
                      <div key={job.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-title">
                            {job.format} · {job.total_count || 0} tài khoản
                          </div>
                          <div className="text-[10px] text-desc mt-0.5">
                            {new Date(job.created_at).toLocaleString('vi-VN')} · Trạng thái: {job.status}
                          </div>
                        </div>
                        {job.status === 'COMPLETED' && (
                          <a
                            href={api.getDownloadUrl(job.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-blue-500/15 text-blue-400 font-bold text-xs flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải về</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: BACKUPS & DISASTER RECOVERY */}
          {activeTab === 'backups' && (
            <div className="space-y-6">
              <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-title flex items-center gap-2">
                      <Archive className="w-4 h-4 text-teal-400" />
                      <span>Sao Lưu & Bảo Hiểm Dữ Liệu MongoDB</span>
                    </h3>
                    <p className="text-xs text-desc mt-1">
                      Tạo các bản Snapshot độc lập để bảo đảm an toàn 100% cho kho dữ liệu trước các đợt thao tác lớn.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateBackup}
                    disabled={backupLoading}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg transition-all flex items-center gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Tạo Bản Snapshot Ngay</span>
                  </button>
                </div>
              </div>

              {/* Backups List */}
              <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <h3 className="font-bold text-sm text-title">Danh Sách Bản Sao Lưu ({backupsList.length})</h3>
                {backupsList.length === 0 ? (
                  <div className="p-8 text-center text-desc text-xs">Chưa có bản sao lưu nào.</div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {backupsList.map((b: any, idx: number) => (
                      <div key={idx} className="py-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-teal-400">
                            <Archive className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-title text-xs font-mono">{b.fileName}</div>
                            <div className="text-[11px] text-desc mt-0.5">
                              Dung lượng: <strong className="text-teal-400">{b.size_mb} MB</strong> · Ngày tạo:{' '}
                              {new Date(b.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={api.getBackupDownloadUrl(b.fileName)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-title border border-[var(--border-subtle)] flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5 text-teal-400" />
                            <span>Tải về</span>
                          </a>
                          <button
                            onClick={() => handleRestoreBackup(b.fileName)}
                            disabled={backupLoading}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-400 border border-amber-500/30 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Phục hồi</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(b.fileName)}
                            className="p-2 text-desc hover:text-rose-400 transition-all"
                            title="Xóa bản sao lưu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: API KEYS GATEWAY */}
          {activeTab === 'apikeys' && (
            <div className="space-y-6">
              {newlyCreatedKey && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <Key className="w-8 h-8 text-amber-400" />
                    <div>
                      <h3 className="font-bold text-title text-base">Khóa API Mới Đã Tạo Thành Công!</h3>
                      <p className="text-xs text-amber-300 mt-0.5">
                        ⚠️ Sao chép và lưu trữ khóa ngay bây giờ. Khóa sẽ không bao giờ hiển thị lại.
                      </p>
                    </div>
                  </div>

                  <div className="app-card-inner p-4 rounded-xl border border-amber-500/30 flex items-center justify-between font-mono text-xs text-amber-400">
                    <span className="break-all">{newlyCreatedKey.full_key}</span>
                    <button
                      onClick={() => copyToClipboard(newlyCreatedKey.full_key, 'Service API Key')}
                      className="ml-4 bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setNewlyCreatedKey(null)}
                    className="text-xs text-desc hover:text-title underline"
                  >
                    Tôi đã sao chép an toàn, đóng thông báo này
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Create Form */}
                <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                  <h3 className="font-bold text-sm text-title flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>Tạo Service Key Mới</span>
                  </h3>

                  <form onSubmit={handleCreateApiKey} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-desc mb-1">Tên Tool / Ứng Dụng</label>
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="VD: Shopee Checker Machine 1"
                        required
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                      />
                    </div>

                    <div className="space-y-2 text-xs text-title">
                      <label className="block text-xs font-semibold text-desc mb-1">Phân Quyền Scopes</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes('READ_ACCOUNTS')}
                          onChange={(e) => {
                            if (e.target.checked) setNewKeyScopes((p) => [...p, 'READ_ACCOUNTS']);
                            else setNewKeyScopes((p) => p.filter((s) => s !== 'READ_ACCOUNTS'));
                          }}
                        />
                        <span>READ_ACCOUNTS (Lấy danh sách nick)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes('WRITE_ACCOUNTS')}
                          onChange={(e) => {
                            if (e.target.checked) setNewKeyScopes((p) => [...p, 'WRITE_ACCOUNTS']);
                            else setNewKeyScopes((p) => p.filter((s) => s !== 'WRITE_ACCOUNTS'));
                          }}
                        />
                        <span>WRITE_ACCOUNTS (Cập nhật Cookie/Mật khẩu)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes('CONSUME_ACCOUNTS')}
                          onChange={(e) => {
                            if (e.target.checked) setNewKeyScopes((p) => [...p, 'CONSUME_ACCOUNTS']);
                            else setNewKeyScopes((p) => p.filter((s) => s !== 'CONSUME_ACCOUNTS'));
                          }}
                        />
                        <span>CONSUME_ACCOUNTS (Bán/Tiêu thụ tự động)</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={apiKeyLoading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      {apiKeyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      <span>Tạo Khóa API Key</span>
                    </button>
                  </form>
                </div>

                {/* Keys List */}
                <div className="md:col-span-2 space-y-6">
                  <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                    <h3 className="font-bold text-sm text-title">Danh Sách Khóa API Đang Hoạt Động</h3>
                    {apiKeysList.length === 0 ? (
                      <div className="p-8 text-center text-desc text-xs">Chưa có API Key nào.</div>
                    ) : (
                      <div className="divide-y divide-[var(--border-subtle)]">
                        {apiKeysList.map((k: any) => (
                          <div key={k.id} className="py-3 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-title text-xs">{k.name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-400">
                                  {k.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-desc font-mono mt-1">
                                {k.key_prefix} · Scopes: {k.scopes?.join(', ')}
                              </div>
                            </div>
                            {k.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleRevokeApiKey(k.id)}
                                className="text-xs text-rose-400 px-3 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 font-semibold"
                              >
                                Thu hồi
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Integration Snippet */}
                  <div className="app-card rounded-2xl p-6 space-y-3 font-mono text-xs border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 text-purple-400 font-bold font-sans">
                      <Code2 className="w-4 h-4" />
                      <span>Mẫu Gọi API Cho Python / Node.js</span>
                    </div>
                    <div className="app-card-inner p-4 rounded-xl text-title overflow-x-auto">
                      <pre>{`# Python Example: Lấy 10 tài khoản AVAILABLE từ ARMS DWH
import requests

url = "http://localhost:4000/api/accounts?status=AVAILABLE&limit=10"
headers = { "x-arms-service-key": "arms_live_xxxxxxxxxxxxxxxx" }
response = requests.get(url, headers=headers)
print(response.json())`}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: TEAMS MANAGEMENT */}
          {activeTab === 'teams' && (userRole === 'OWNER' || userRole === 'MANAGER') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Create User Form */}
              <div className="app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <h3 className="font-bold text-sm text-title flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-400" />
                  <span>Thêm Nhân Viên Mới</span>
                </h3>

                <form onSubmit={handleCreateMember} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-desc mb-1">Tên Đăng Nhập</label>
                    <input
                      type="text"
                      value={newMemberUsername}
                      onChange={(e) => setNewMemberUsername(e.target.value)}
                      placeholder="VD: nv_hanoi_02"
                      required
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-desc mb-1">Mật Khẩu</label>
                    <input
                      type="password"
                      value={newMemberPassword}
                      onChange={(e) => setNewMemberPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-desc mb-1">Tên Hiển Thị</label>
                    <input
                      type="text"
                      value={newMemberDisplayName}
                      onChange={(e) => setNewMemberDisplayName(e.target.value)}
                      placeholder="VD: Nguyễn Văn A"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-desc mb-1">Đội Nhóm</label>
                    <select
                      value={newMemberTeam}
                      onChange={(e) => setNewMemberTeam(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                    >
                      <option value="TEAM_HA_NOI">Team Hà Nội</option>
                      <option value="TEAM_TIKTOK_US">Team TikTok US</option>
                      <option value="TEAM_SAI_GON">Team Sài Gòn</option>
                      <option value="TEAM_SHOPEE_AFFILIATE">Team Shopee Affiliate</option>
                      <option value="KHO_TONG">Kho Tổng</option>
                      <option value="ALL">Toàn Quyền (Tất cả)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-desc mb-1">Vai Trò</label>
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value as any)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-title outline-none"
                    >
                      <option value="MEMBER">MEMBER (Quản lý nhóm mình)</option>
                      <option value="MANAGER">MANAGER (Giám sát nhóm)</option>
                      <option value="VIEWER">VIEWER (Chỉ xem, ẩn pass)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={memberLoading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {memberLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    <span>Tạo Tài Khoản</span>
                  </button>
                </form>
              </div>

              {/* Members List */}
              <div className="md:col-span-2 app-card rounded-2xl p-6 space-y-4 border border-[var(--border-subtle)]">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-title">Danh Sách Nhân Viên ({usersList.length})</h3>
                  <button onClick={fetchTeamsAndUsers} className="text-xs text-desc hover:text-title flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    <span>Làm mới</span>
                  </button>
                </div>

                {usersList.length === 0 ? (
                  <div className="p-8 text-center text-desc text-xs">Chưa có nhân viên động trong DB.</div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)] max-h-96 overflow-y-auto">
                    {usersList.map((u: any) => (
                      <div key={u.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-title text-xs">{u.display_name || u.username}</span>
                            <span className="text-[10px] text-desc font-mono">(@{u.username})</span>
                            <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded">
                              {u.role}
                            </span>
                          </div>
                          <div className="text-[11px] text-desc mt-1">
                            Thuộc nhóm: <strong className="text-purple-400">{u.team || 'ALL'}</strong>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteMember(u.id, u.username)}
                          className="text-xs text-rose-400 font-semibold px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: SYSTEM LOGS LIVE STREAM */}
          {activeTab === 'systemlogs' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-title">Trung Tâm Nhật Ký Tập Trung</h2>
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE AUDIT
                    </span>
                  </div>
                  <p className="text-xs text-desc mt-1">Ghi vết tập trung toàn bộ tiến trình Ingress, Worker và thao tác quản trị.</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={fetchSystemLogs}
                    disabled={systemLogsLoading}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-title border border-[var(--border-subtle)] flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${systemLogsLoading ? 'animate-spin' : ''}`} />
                    <span>Làm Mới</span>
                  </button>

                  <button
                    onClick={() => setSystemLogsAutoScroll(!systemLogsAutoScroll)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 ${
                      systemLogsAutoScroll
                        ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                        : 'bg-white/5 text-desc border-[var(--border-subtle)]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{systemLogsAutoScroll ? 'Cuộn: BẬT' : 'Cuộn: TẮT'}</span>
                  </button>
                </div>
              </div>

              {/* Terminal Logs View */}
              <div className="app-card rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-2xl flex flex-col">
                <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                      <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="font-mono text-[11px] text-zinc-400 font-bold ml-2">arms-live-audit.log</span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    Sự kiện: {systemLogsData?.total_events || 0}
                  </div>
                </div>

                <div
                  ref={logTerminalRef}
                  className="p-4 bg-zinc-950/95 text-zinc-300 font-mono text-xs max-h-[500px] overflow-y-auto space-y-2 select-text divide-y divide-zinc-900"
                >
                  {(systemLogsData?.events || []).length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 font-sans text-xs">
                      {systemLogsLoading ? 'Đang tải nhật ký...' : 'Chưa có bản ghi nhật ký nào.'}
                    </div>
                  ) : (
                    systemLogsData.events.map((ev: any) => (
                      <div key={ev.id} className="pt-2 flex flex-col md:flex-row md:items-start justify-between gap-2 hover:bg-white/[0.02] p-1.5 rounded transition-all">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <span className="text-zinc-500 shrink-0 text-[11px]">
                            {new Date(ev.timestamp).toLocaleTimeString('vi-VN')}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            [{ev.category}]
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              ev.level === 'SUCCESS'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : ev.level === 'ERROR'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {ev.level}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-zinc-200 font-bold truncate">{ev.title}</div>
                            <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                              Thực hiện: <span className="text-purple-300 font-semibold">{ev.actor}</span> · Đối tượng:{' '}
                              <span className="text-zinc-300">{ev.target}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
