'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StatsBar } from '../components/StatsBar';
import { UploadPanel } from '../components/UploadPanel';
import { AccountTable } from '../components/AccountTable';
import { JobControls } from '../components/JobControls';
import { ProgressLog } from '../components/ProgressLog';
import { api } from '../lib/api';
import { useJobWebSocket, WSMessage } from '../lib/useWebSocket';

export default function DashboardPage() {
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<any[]>([]);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    live: 0,
    ivsVerify: 0,
    wrongPass: 0,
    failed: 0,
    captcha: 0,
    pending: 0,
  });

  // Fetch accounts for current job
  const fetchAccounts = useCallback(async () => {
    if (!currentJob) return;
    try {
      const res = await api.listAccounts({
        job_id: currentJob.job_id,
        status: filterStatus,
        q: searchQuery || undefined,
        page: 1,
        page_size: 150,
      });
      setAccounts(res.accounts || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, [currentJob, filterStatus, searchQuery]);

  // Fetch job status
  const fetchJobStatus = useCallback(async () => {
    if (!currentJob?.job_id) return;
    try {
      const j = await api.getJob(currentJob.job_id);
      setCurrentJob(j);
      setStats({
        total: j.total,
        processed: j.processed,
        live: j.live,
        ivsVerify: j.ivs_verify,
        wrongPass: j.wrong_pass,
        failed: j.failed,
        captcha: j.captcha,
        pending: j.pending,
      });
    } catch (err) {
      console.error('Error fetching job:', err);
    }
  }, [currentJob?.job_id]);

  // WebSocket Message Handler
  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'account_result') {
      const data = msg.data;
      // Add log
      setLogs((prev) => [
        ...prev.slice(-100),
        {
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          email: data.email,
          status: data.status,
          msg: `${data.error_msg || ''} (${data.elapsed_ms || 0}ms)`,
          error_code: data.error_code,
        },
      ]);

      // Update counters
      setStats((prev) => {
        const next = { ...prev, processed: prev.processed + 1, pending: Math.max(0, prev.pending - 1) };
        if (data.status === 'LIVE') next.live += 1;
        else if (data.status === 'IVS_VERIFY') next.ivsVerify += 1;
        else if (data.status === 'WRONG_PASS') next.wrongPass += 1;
        else if (data.status === 'CAPTCHA') next.captcha += 1;
        else next.failed += 1;
        return next;
      });

      // Update account in table
      setAccounts((prev) => {
        const existingIdx = prev.findIndex((a) => a.email.toLowerCase() === data.email.toLowerCase());
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], ...data, last_checked_at: new Date().toISOString() };
          return updated;
        } else {
          return [{ ...data, last_checked_at: new Date().toISOString() }, ...prev];
        }
      });
    }
  }, []);

  // Connect WebSocket
  const { isConnected } = useJobWebSocket(currentJob?.job_id || null, handleWSMessage);

  // When a new job is created
  const handleJobStarted = (job: any) => {
    setCurrentJob(job);
    setStats({
      total: job.total,
      processed: 0,
      live: 0,
      ivsVerify: 0,
      wrongPass: 0,
      failed: 0,
      captcha: 0,
      pending: job.total,
    });
    setLogs([
      {
        id: 'start',
        time: new Date().toLocaleTimeString(),
        email: 'SYSTEM',
        status: 'INFO',
        msg: `Khởi chạy Job: ${job.name} với ${job.total} tài khoản.`,
      },
    ]);
  };

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return (
    <div>
      {/* Upload & Config Panel */}
      <UploadPanel onJobStarted={handleJobStarted} />

      {/* Stats Bar */}
      <StatsBar
        total={stats.total}
        processed={stats.processed}
        live={stats.live}
        ivsVerify={stats.ivsVerify}
        wrongPass={stats.wrongPass}
        failed={stats.failed}
        captcha={stats.captcha}
        pending={stats.pending}
      />

      {/* Controls */}
      <JobControls
        currentJob={currentJob}
        onJobStopped={fetchJobStatus}
        onRefresh={() => {
          fetchJobStatus();
          fetchAccounts();
        }}
      />

      {/* Account Table */}
      <AccountTable
        accounts={accounts}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Live Terminal Log */}
      <ProgressLog logs={logs} />
    </div>
  );
}
