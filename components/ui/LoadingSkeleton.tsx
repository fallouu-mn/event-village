import React from 'react';

export const LoadingSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 3,
  className = 'h-44',
}) => {
  return (
    <div className="w-full space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`w-full rounded-3xl bg-white/10 backdrop-blur-md animate-pulse border border-white/10 ${className}`}
        />
      ))}
    </div>
  );
};
