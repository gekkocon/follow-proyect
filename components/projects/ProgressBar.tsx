import { cn } from '@/lib/utils';

type ProgressBarProps = {
  done: number;
  total: number;
  className?: string;
  showLabel?: boolean;
};

export function ProgressBar({ done, total, className, showLabel = true }: ProgressBarProps) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-primary' : 'bg-slate-400';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
          {done}/{total}
        </span>
      )}
    </div>
  );
}
