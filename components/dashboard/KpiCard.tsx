import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'blue' | 'red' | 'amber' | 'orange' | 'green';

const variantStyles: Record<Variant, { icon: string; value: string; badge: string }> = {
  default: {
    icon:  'bg-slate-100 text-slate-600',
    value: 'text-foreground',
    badge: 'bg-slate-100 text-slate-600',
  },
  blue: {
    icon:  'bg-blue-100 text-blue-600',
    value: 'text-blue-700',
    badge: 'bg-blue-50 text-blue-600',
  },
  red: {
    icon:  'bg-red-100 text-red-600',
    value: 'text-red-700',
    badge: 'bg-red-50 text-red-600',
  },
  amber: {
    icon:  'bg-amber-100 text-amber-600',
    value: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-600',
  },
  orange: {
    icon:  'bg-orange-100 text-orange-600',
    value: 'text-orange-700',
    badge: 'bg-orange-50 text-orange-600',
  },
  green: {
    icon:  'bg-green-100 text-green-600',
    value: 'text-green-700',
    badge: 'bg-green-50 text-green-600',
  },
};

type Props = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  variant?: Variant;
  /** 0-100 — renders a thin bottom progress bar */
  progress?: number;
};

export function KpiCard({ icon: Icon, label, value, sub, variant = 'default', progress }: Props) {
  const s = variantStyles[variant];

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-white p-5 shadow-sm">
      {/* Icon */}
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', s.icon)}>
        <Icon size={18} strokeWidth={1.8} />
      </div>

      {/* Value */}
      <div>
        <p className={cn('text-3xl font-bold tabular-nums leading-none', s.value)}>
          {value}
        </p>
        <p className="mt-1.5 text-xs font-medium text-muted-foreground leading-snug">
          {label}
        </p>
        {sub && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">{sub}</p>
        )}
      </div>

      {/* Optional progress bar (e.g. completion rate) */}
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', variant === 'green' ? 'bg-green-500' : 'bg-primary')}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
