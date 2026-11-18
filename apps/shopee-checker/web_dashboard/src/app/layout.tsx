import '../styles/globals.css';
import React from 'react';
import Link from 'next/link';
import { ShoppingBag, History, LayoutDashboard } from 'lucide-react';

export const metadata = {
  title: 'Shopee Account Live/Die Checker — Thức Sơn MMO',
  description: 'Hệ thống kiểm tra trạng thái tài khoản Shopee và đồng bộ Session tự động',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {/* Navigation Bar */}
        <header
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div
            className="container-fluid"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.85rem 1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                  padding: '0.5rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShoppingBag size={22} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                  SHOPEE ACCOUNT CHECKER <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>v2.0 PRO</span>
                </h1>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Thức Sơn Tool MMO Ecosystem</p>
              </div>
            </div>

            <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link
                href="/"
                className="btn btn-secondary"
                style={{ fontSize: '0.825rem', padding: '0.45rem 0.9rem' }}
              >
                <LayoutDashboard size={16} /> Bảng Điều Khiển
              </Link>
              <Link
                href="/jobs"
                className="btn btn-secondary"
                style={{ fontSize: '0.825rem', padding: '0.45rem 0.9rem' }}
              >
                <History size={16} /> Lịch Sử Batches
              </Link>
            </nav>
          </div>
        </header>

        <main className="container-fluid">{children}</main>
      </body>
    </html>
  );
}
