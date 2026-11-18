import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface AccountItem {
  email: str;
  password: str;
  username?: str;
  phone?: str;
}

export interface JobConfig {
  worker_count: number;
  delay_ms: number;
  proxy_enabled: boolean;
  rotate_provider?: string;
  rotate_api_key?: string;
  rotate_after_n?: number;
}

export interface CreateJobPayload {
  name?: string;
  accounts: AccountItem[];
  config?: JobConfig;
}

export const api = {
  createJob: async (payload: CreateJobPayload) => {
    const res = await apiClient.post('/api/jobs', payload);
    return res.data;
  },

  listJobs: async (limit = 20) => {
    const res = await apiClient.get(`/api/jobs?limit=${limit}`);
    return res.data;
  },

  getJob: async (jobId: string) => {
    const res = await apiClient.get(`/api/jobs/${jobId}`);
    return res.data;
  },

  stopJob: async (jobId: string) => {
    const res = await apiClient.post(`/api/jobs/${jobId}/stop`);
    return res.data;
  },

  listAccounts: async (params: {
    job_id?: string;
    status?: string;
    q?: string;
    page?: number;
    page_size?: number;
  }) => {
    const res = await apiClient.get('/api/accounts', { params });
    return res.data;
  },

  previewFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/api/accounts/import-preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  refreshHeaders: async () => {
    const res = await apiClient.post('/api/admin/refresh-headers');
    return res.data;
  },

  listHeaders: async () => {
    const res = await apiClient.get('/api/admin/headers');
    return res.data;
  },

  getExportUrl: (jobId: string, status?: string) => {
    const query = status && status !== 'ALL' ? `?status=${status}` : '';
    return `${API_BASE_URL}/api/export/${jobId}${query}`;
  },
};

