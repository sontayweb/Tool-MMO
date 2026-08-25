'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      className={`animate-pulse bg-white/5 dark:bg-white/[0.04] rounded-lg ${className}`}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 6, cols = 5 }) => {
  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex gap-3 pb-2 border-b border-[var(--border-subtle)]">
        {Array.from({ length: cols }).map((_, idx) => (
          <Skeleton key={idx} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex gap-3 py-2 border-b border-white/[0.02]">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton key={cIdx} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="app-card rounded-2xl p-5 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
};
