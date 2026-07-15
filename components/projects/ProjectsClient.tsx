'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '@/src/store/projectStore';
import { deleteProject } from '@/src/lib/supabase/project-actions';
import { ProjectCard } from './ProjectCard';
import { ProjectSlideOver } from './ProjectSlideOver';
import type { ProjectWithRelations, DbUser } from '@/src/lib/supabase/types';

type Props = {
  initialProjects: ProjectWithRelations[];
  users: DbUser[];
  error?: string | null;
};

export function ProjectsClient({ initialProjects, users, error }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    isSlideOverOpen,
    slideOverMode,
    selectedProject,
    confirmDeleteId,
    deleteError,
    openCreate,
    openEdit,
    closeSlideOver,
    setConfirmDeleteId,
    setDeleteError,
  } = useProjectStore();

  const projects = initialProjects;

  async function handleDelete(id: number) {
    const result = await deleteProject(id);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    setConfirmDeleteId(null);
    startTransition(() => router.refresh());
  }

  function handleSuccess() {
    closeSlideOver();
    startTransition(() => router.refresh());
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Proyectos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''} en total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus size={15} />
          Nuevo proyecto
        </button>
      </div>

      {/* Connection / query error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-2">
          <p className="font-semibold">Error al conectar con Supabase</p>
          <p className="font-mono text-xs bg-red-100 rounded px-2 py-1">{error}</p>
          {error.toLowerCase().includes('invalid api key') || error.toLowerCase().includes('apikey') ? (
            <div className="text-xs text-red-700 space-y-1 pt-1 border-t border-red-200">
              <p className="font-semibold">Fix requerido — API Key inválida:</p>
              <ol className="list-decimal list-inside space-y-0.5 pl-1">
                <li>Ir a <strong>Supabase Dashboard → Settings → API</strong></li>
                <li>Copiar la clave <strong>anon / public</strong> (formato <code className="bg-red-100 px-1 rounded">eyJ…</code>)</li>
                <li>Agregar en <code className="bg-red-100 px-1 rounded">.env.local</code>:<br />
                  <code className="bg-red-100 px-1 rounded text-[11px]">NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…</code>
                </li>
                <li>Reiniciar el servidor con <code className="bg-red-100 px-1 rounded">npm run dev</code></li>
              </ol>
            </div>
          ) : (
            <p className="text-xs text-red-600">
              Verifica que las tablas existan en Supabase (ejecutar schema.sql) y que RLS permita lecturas.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border bg-white p-16 text-center">
          <p className="text-sm text-muted-foreground">No hay proyectos todavía.</p>
          <button
            onClick={openCreate}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            Crear el primero →
          </button>
        </div>
      )}

      {/* Cards grid */}
      {projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="group relative">
              <ProjectCard project={project} />

              {/* Action buttons — visible on hover */}
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(project); }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 shadow-sm transition-colors"
                  title="Editar proyecto"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(project.id); }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white border border-border text-muted-foreground hover:text-red-600 hover:border-red-200 shadow-sm transition-colors"
                  title="Eliminar proyecto"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Inline delete confirmation */}
              {confirmDeleteId === project.id && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/97 backdrop-blur-sm border border-red-200 z-20 p-5">
                  <AlertTriangle size={22} className="text-red-500 shrink-0" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">¿Eliminar proyecto?</p>
                    <p className="text-xs text-muted-foreground mt-1">Esta acción no se puede deshacer.</p>
                  </div>

                  {deleteError && (
                    <p className="text-xs text-red-700 text-center px-2">{deleteError}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setConfirmDeleteId(null); }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    {!deleteError && (
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                      >
                        Sí, eliminar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Slide-over panel */}
      {isSlideOverOpen && (
        <ProjectSlideOver
          mode={slideOverMode}
          project={selectedProject}
          users={users}
          onClose={closeSlideOver}
          onSuccess={handleSuccess}
        />
      )}

      {/* Loading overlay while revalidating */}
      {isPending && (
        <div className="fixed bottom-4 right-4 z-50 rounded-full bg-foreground/80 px-3 py-1.5 text-xs text-white shadow-lg">
          Actualizando…
        </div>
      )}
    </>
  );
}
