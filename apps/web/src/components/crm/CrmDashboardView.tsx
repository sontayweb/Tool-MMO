'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Clock,
  RefreshCw,
  Award,
  Package,
  Receipt,
  Search,
  ExternalLink,
  DollarSign
} from 'lucide-react';

interface CrmDashboardViewProps {
  onNavigateToAccounts?: (filterSoldTo: string) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const CrmDashboardView: React.FC<CrmDashboardViewProps> = ({
  onNavigateToAccounts,
  showToast
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [customerSearch, setCustomerSearch] = useState<string>('');

  const fetchCrmData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounts/crm/stats');
      setData(res);
    } catch (err: any) {
      console.error('Fetch CRM Stats Failed:', err);
      if (showToast) showToast('Không thể tải dữ liệu CRM & Doanh thu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrmData();
  }, []);

  const stats = data || {
    total_sold: 0,
    total_available: 0,
    total_customers: 0,
    estimated_revenue: 0,
    top_customers: [],
    recent_orders: []
  };

  const filteredCustomers = (stats.top_customers || []).filter((c: any) =>
    (c.customer_name || '').toLowerCase().includes(customerSearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-4 animate-fadeIn pb-10">
      {/* 🧭 Top Action Bar: Clean, sleek, no redundant header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            Báo Cáo Kế Toán & Đối Soát Bán Hàng
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            · Cập nhật theo thời gian thực
          </span>
        </div>

        <button
          onClick={fetchCrmData}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          <span>Làm Mới Số Liệu</span>
        </button>
      </div>

      {/* 4 Compact Enterprise KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Estimated Revenue */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Ước Tính Doanh Thu</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {(stats.estimated_revenue || 0).toLocaleString('vi-VN')} <span className="text-xs font-sans font-medium text-slate-500">đ</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Đơn giá trung bình ~5k/nick
            </div>
          </div>
        </div>

        {/* Total Sold */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng Nick Đã Bán</span>
            <div className="w-6 h-6 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
              {(stats.total_sold || 0).toLocaleString('vi-VN')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Trạng thái SOLD trong kho
            </div>
          </div>
        </div>

        {/* Total Customers */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Khách Hàng Đã Bán</span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
              {stats.total_customers || 0}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Kênh / Đối tác lấy hàng
            </div>
          </div>
        </div>

        {/* Live Inventory */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Kho Nick Sẵn Sàng (Live)</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {(stats.total_available || 0).toLocaleString('vi-VN')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Sẵn sàng xuất đơn ngay
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Top Customers & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Top Customers (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Top Khách Hàng ({stats.top_customers?.length || 0})
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Lọc khách hàng..."
                className="w-32 sm:w-40 px-2 py-1 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Chưa có dữ liệu bán hàng. Hãy xuất đơn hàng đầu tiên!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
              {filteredCustomers.map((c: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                          : idx === 2
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {c.customer_name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        {c.shopee_count > 0 && (
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            {c.shopee_count} Shopee
                          </span>
                        )}
                        {c.tiktok_count > 0 && (
                          <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                            {c.tiktok_count} TikTok
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-xs font-mono text-slate-900 dark:text-slate-100">
                      {c.total_accounts.toLocaleString()} <span className="text-[10px] font-sans text-slate-500">nick</span>
                    </div>
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {(c.estimated_spend || 0).toLocaleString('vi-VN')} đ
                    </div>
                    {onNavigateToAccounts && (
                      <button
                        onClick={() => onNavigateToAccounts(c.customer_name)}
                        className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 justify-end mt-0.5"
                      >
                        <span>Xem nick</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders History (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Nhật Ký Đơn Hàng Xuất Bán Gần Đây
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
              {stats.recent_orders?.length || 0} Đơn
            </span>
          </div>

          {(!stats.recent_orders || stats.recent_orders.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Chưa có đơn hàng nào được ghi nhận.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
              {stats.recent_orders.map((ord: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 dark:text-purple-300 dark:bg-purple-950/60 dark:border-purple-800 px-2 py-0.5 rounded">
                        {ord.order_id}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {ord.sold_to}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                      Mẫu: {ord.usernames?.slice(0, 3).join(', ') || '...'}
                      {ord.usernames?.length > 3 && ` (+${ord.usernames.length - 3} khác)`}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                        {ord.count} tài khoản
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {new Date(ord.sold_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
