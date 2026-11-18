const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('arms_token');
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('arms_token', token);
  }
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('arms_token');
  }
}

export function getRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('arms_role');
}

export function setRole(role: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('arms_role', role);
  }
}

export function removeRole() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('arms_role');
  }
}

export function getTeam(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('arms_team');
}

export function setTeam(team: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('arms_team', team);
  }
}

export function removeTeam() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('arms_team');
  }
}

export function getDisplayName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('arms_display_name');
}

export function setDisplayName(name: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('arms_display_name', name);
  }
}

export function removeDisplayName() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('arms_display_name');
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      removeRole();
      removeTeam();
      removeDisplayName();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }

    let errorMsg = 'Đã xảy ra lỗi hệ thống';
    try {
      const data = await response.json();
      errorMsg = data.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  baseUrl: BASE_URL,

  // Generic HTTP helpers
  async get(path: string, params?: Record<string, any>) {
    let url = path;
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      const qs = q.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    return request(url);
  },

  async post(path: string, body?: any) {
    return request(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  async patch(path: string, body?: any) {
    return request(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  async delete(path: string) {
    return request(path, {
      method: 'DELETE',
    });
  },

  // Auth
  async login(username: string, password: string) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.access_token) {
      setToken(res.access_token);
      setRole(res.user?.role || res.role);
      setTeam(res.user?.team || 'ALL');
      setDisplayName(res.user?.display_name || username);
    }
    return res;
  },

  async me() {
    return request('/auth/me');
  },

  // Users & Teams Management
  async getUsers() {
    return request('/users');
  },

  async createUser(payload: {
    username: string;
    password: string;
    role: string;
    team: string;
    display_name?: string;
  }) {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateUser(id: string, payload: {
    password?: string;
    role?: string;
    team?: string;
    display_name?: string;
    status?: string;
  }) {
    return request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteUser(id: string) {
    return request(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  async getTeams() {
    return request('/users/teams/list');
  },

  // Accounts
  async getSanitationStats() {
    return request('/accounts/sanitation/stats');
  },

  async cleanSanitationAccounts(category: string, action: 'DELETE' | 'BLACKLIST' | 'AUTO_FIX' | 'HARD_DELETE' | 'RESTORE') {
    return request('/accounts/sanitation/clean', {
      method: 'POST',
      body: JSON.stringify({ category, action }),
    });
  },

  async getAccounts(params: {
    page?: number;
    limit?: number;
    platform?: string;
    machine_id?: string;
    status?: string;
    source_file?: string;
    source_sheet?: string;
    managed_by?: string;
    team?: string;
    batch_id?: string;
    search?: string;
    has_cookie?: string;
    has_email?: string;
    has_password?: string;
    has_token?: string;
    data_quality?: string;
    tags?: string;
  }) {
    const query = new URLSearchParams();
    if (params.page && params.limit) {
      const skip = (params.page - 1) * params.limit;
      query.append('skip', skip.toString());
      query.append('limit', params.limit.toString());
    }
    Object.entries(params).forEach(([key, val]) => {
      if (key !== 'page' && key !== 'limit' && val !== undefined && val !== '') {
        query.append(key, val.toString());
      }
    });
    return request(`/accounts?${query.toString()}`);
  },

  async exportAccountsExcel(params: {
    platform?: string;
    status?: string;
    machine_id?: string;
    search?: string;
    has_cookie?: string;
    has_email?: string;
    has_password?: string;
    has_token?: string;
    data_quality?: string;
    tags?: string;
  }) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== '' && val !== 'ALL') {
        query.append(key, val.toString());
      }
    });

    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}/accounts/export/excel?${query.toString()}`, {
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Xuất file Excel thất bại' }));
      throw new Error(err.message || 'Xuất file Excel thất bại');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kho_Tai_Khoan_${params.platform || 'ALL'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async markSold(usernames: string[], soldTo: string, note?: string) {
    return request('/accounts/mark-sold', {
      method: 'POST',
      body: JSON.stringify({ usernames, sold_to: soldTo, note }),
    });
  },

  async markUsed(usernames: string[], note?: string) {
    return request('/accounts/mark-used', {
      method: 'POST',
      body: JSON.stringify({ usernames, note }),
    });
  },

  async blacklist(usernames: string[], reason: string) {
    return request('/accounts/bulk-blacklist', {
      method: 'POST',
      body: JSON.stringify({ usernames, note: reason }),
    });
  },

  async deleteAccounts(usernames: string[]) {
    return request('/accounts/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ usernames }),
    });
  },

  async restoreAccountsFromTrash(usernames: string[]) {
    return request('/accounts/trash/restore', {
      method: 'POST',
      body: JSON.stringify({ usernames }),
    });
  },

  async emptyTrash() {
    return request('/accounts/trash/empty', {
      method: 'POST',
    });
  },

  async scanDuplicates() {
    return request('/accounts/duplicates/scan');
  },

  async cleanDuplicates() {
    return request('/accounts/duplicates/clean', {
      method: 'POST',
    });
  },

  async getAnalytics() {
    return request('/accounts/analytics');
  },

  // DWH Backup & Disaster Recovery
  async createBackup(note?: string) {
    return request('/backup/create', {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  async getBackups() {
    return request('/backup/list');
  },

  async restoreBackup(fileName: string) {
    return request(`/backup/restore/${fileName}`, {
      method: 'POST',
    });
  },

  async deleteBackup(fileName: string) {
    return request(`/backup/${fileName}`, {
      method: 'DELETE',
    });
  },

  getBackupDownloadUrl(fileName: string) {
    const token = getToken();
    return `${BASE_URL}/backup/download/${fileName}${token ? `?token=${token}` : ''}`;
  },

  // DWH External Tool API Keys
  async getApiKeys() {
    return request('/api-keys');
  },

  async createApiKey(name: string, scopes?: string[], expiresInDays?: number) {
    return request('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, scopes, expires_in_days: expiresInDays }),
    });
  },

  async revokeApiKey(id: string) {
    return request(`/api-keys/${id}`, {
      method: 'DELETE',
    });
  },

  // Scan Engine
  async getBatches() {
    return request('/scan/batches');
  },

  async getBatch(id: string) {
    return request(`/scan/batches/${id}`);
  },

  async uploadScan(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${BASE_URL}/scan/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = 'Lỗi upload tệp tin';
      try {
        const data = await response.json();
        errorMsg = data.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    return response.json();
  },

  // Stats & Dashboard
  async getStats() {
    return request('/accounts/stats');
  },

  // Lookup Bulk (Paste list)
  async lookupBulk(usernames: string[]) {
    return request('/accounts/lookup-bulk', {
      method: 'POST',
      body: JSON.stringify({ usernames }),
    });
  },

  async getAccount(username: string) {
    return request(`/accounts/${username}`);
  },

  async bulkTag(usernames: string[], tags: string[], operation: 'ADD' | 'REMOVE' | 'SET' = 'ADD') {
    return request('/accounts/bulk-tag', {
      method: 'POST',
      body: JSON.stringify({ usernames, tags, operation }),
    });
  },

  async autoFixAccounts(usernames: string[]) {
    return request('/accounts/auto-fix', {
      method: 'POST',
      body: JSON.stringify({ usernames }),
    });
  },

  // Upload Offline File (Preview / Commit)
  async uploadOffline(file: File, mode: 'preview' | 'commit' = 'preview', platform = 'SHOPEE') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    formData.append('platform', platform);

    const token = getToken();
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${BASE_URL}/scan/upload-offline`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = 'Lỗi upload tệp tin offline';
      try {
        const data = await response.json();
        errorMsg = data.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    return response.json();
  },

  // Exports
  async getExports() {
    return request('/exports');
  },

  async getExport(id: string) {
    return request(`/exports/${id}`);
  },

  async createExport(filter: any, format: string, columns?: string[], markAsUsed?: boolean) {
    return request('/exports', {
      method: 'POST',
      body: JSON.stringify({ filter, format, columns, mark_as_used_after_export: markAsUsed }),
    });
  },

  getDownloadUrl(jobId: string) {
    return `${BASE_URL}/exports/${jobId}/download`;
  },

  // Centralized System Logs
  async getSystemLogs(params?: number | { limit?: number; action?: string; actor?: string; platform?: string; date_from?: string; date_to?: string; search?: string; category?: string; level?: string }) {
    if (typeof params === 'number') {
      return request(`/audit-logs/system-logs?limit=${params}`);
    }
    const q = new URLSearchParams();
    const p = params || {};
    if (p.limit) q.set('limit', String(p.limit));
    if (p.action && p.action !== 'ALL') q.set('action', p.action);
    if (p.actor) q.set('actor', p.actor);
    if (p.platform && p.platform !== 'ALL') q.set('platform', p.platform);
    if (p.date_from) q.set('date_from', p.date_from);
    if (p.date_to) q.set('date_to', p.date_to);
    if (p.search) q.set('search', p.search);
    if (p.category && p.category !== 'ALL') q.set('category', p.category);
    if (p.level && p.level !== 'ALL') q.set('level', p.level);
    const qs = q.toString();
    return request(`/audit-logs/system-logs${qs ? `?${qs}` : ''}`);
  },

  // Shopee Drive Automated Ingress
  async getShopeeDriveStatus() {
    return request('/integrations/shopee-drive/status');
  },

  async startShopeeDriveSync(options?: { create_snapshot?: boolean }) {
    return request('/integrations/shopee-drive/sync-now', {
      method: 'POST',
      body: options ? JSON.stringify(options) : undefined,
    });
  },

  async getShopeeDriveAuthUrl() {
    return request('/integrations/shopee-drive/auth-url');
  },

  async saveShopeeDriveSettings(settings: { auto_sync_enabled?: boolean; sync_interval_minutes?: number }) {
    return request('/integrations/shopee-drive/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // Backward compatibility alias
  async getGoogleDriveStatus() {
    return this.getShopeeDriveStatus();
  },

  async startGoogleDriveSync(options?: { create_snapshot?: boolean }) {
    return this.startShopeeDriveSync(options);
  },

  async getGoogleDriveAuthUrl() {
    return this.getShopeeDriveAuthUrl();
  },

  async saveGoogleDriveSettings(settings: { auto_sync_enabled?: boolean; sync_interval_minutes?: number }) {
    return this.saveShopeeDriveSettings(settings);
  },

  // Dedicated TikTok Drive Ingress
  async getTikTokDriveStatus() {
    return request('/integrations/tiktok-drive/status');
  },

  async startTikTokDriveSync() {
    return request('/integrations/tiktok-drive/sync-now', {
      method: 'POST',
    });
  }
};
