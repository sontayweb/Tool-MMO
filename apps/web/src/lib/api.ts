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
    has_token?: string;
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
    return request('/accounts/blacklist', {
      method: 'POST',
      body: JSON.stringify({ usernames, reason }),
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

  // Upload Offline File (Preview / Commit)
  async uploadOffline(file: File, mode: 'preview' | 'commit' = 'preview') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

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
  async getSystemLogs(limit = 150) {
    return request(`/audit-logs/system-logs?limit=${limit}`);
  },

  // Shopee Drive Automated Ingress
  async getShopeeDriveStatus() {
    return request('/integrations/shopee-drive/status');
  },

  async startShopeeDriveSync() {
    return request('/integrations/shopee-drive/sync-now', {
      method: 'POST',
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

  async startGoogleDriveSync() {
    return this.startShopeeDriveSync();
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
