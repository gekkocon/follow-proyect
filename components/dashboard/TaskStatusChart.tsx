import { cn } from '@/lib/utils';

type Bar = { label: string; count: number; color: string };

type Props = { bars: Bar[]; total: number };

export function TaskStatusChart({ bars, total }: Props) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">Estado de tareas</h2>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin tareas registradas.</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted mb-5">
            {bars.map((b) =>
              b.count > 0 ? (
                <div
                  key={b.label}
                  className={cn('h-full transition-all', b.color)}
                  style={{ width: `${(b.count / total) * 100}%` }}
                  title={`${b.label}: ${b.count}`}
                />
              ) : null
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', b.color)} />
                <span className="text-xs text-muted-foreground flex-1 truncate">{b.label}</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">{b.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
