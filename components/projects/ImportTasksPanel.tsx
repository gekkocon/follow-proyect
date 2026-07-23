'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  previewProjectImport,
  importProjectTasks,
  type ImportPreview,
} from '@/src/lib/supabase/project-import-actions';

type Props = {
  projectId: number;
  existingTitles: string[];
  onClose: () => void;
  onImported: () => void;
};

const EXAMPLE = `{
  "tasks": [
    {
      "title": "Diseño de planos",
      "priority": "Alta",
      "status": "En progreso",
      "responsable": "Ana Pérez",
      "subtasks": [
        { "title": "Plano de cimentación", "priority": "Media" },
        { "title": "Plano eléctrico", "priority": "Media", "due_date": "2026-03-10" }
      ]
    }
  ]
}`;

export function ImportTasksPanel({ projectId, existingTitles, onClose, onImported }: Props) {
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function parseRaw(): { payload: unknown; error: string | null } {
    if (!raw.trim()) return { payload: null, error: 'Pega o carga un archivo JSON primero.' };
    try {
      return { payload: JSON.parse(raw), error: null };
    } catch {
      return { payload: null, error: 'El texto no es JSON válido.' };
    }
  }

  // Allow "responsable"/"responsables" in the JSON as a friendlier alias for
  // assignee_names, since that's the term used in the product requirements.
  function normalizePayloadAliases(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') return payload;
    const obj = payload as { tasks?: unknown[] };
    if (!Array.isArray(obj.tasks)) return payload;

    const normalizeItem = (item: unknown): unknown => {
      if (!item || typeof item !== 'object') return item;
      const rec = { ...(item as Record<string, unknown>) };
      if (rec.responsable && !rec.assignee_names) {
        rec.assignee_names = [rec.responsable];
        delete rec.responsable;
      }
      if (rec.responsables && !rec.assignee_names) {
        rec.assignee_names = rec.responsables;
        delete rec.responsables;
      }
      if (Array.isArray(rec.subtasks)) {
        rec.subtasks = rec.subtasks.map(normalizeItem);
      }
      return rec;
    };

    return { tasks: obj.tasks.map(normalizeItem) };
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setRaw(text);
    setPreview(null);
    setImportError(null);
  }

  async function handlePreview() {
    setImportError(null);
    setPreview(null);
    const { payload, error } = parseRaw();
    if (error || !payload) {
      setPreview({ error, tasksCount: 0, subtasksCount: 0, duplicateTitles: [] });
      return;
    }
    setChecking(true);
    const result = await previewProjectImport(projectId, normalizePayloadAliases(payload));
    setChecking(false);
    setPreview(result);
  }

  async function handleConfirm() {
    const { payload, error } = parseRaw();
    if (error || !payload) {
      setImportError(error ?? 'JSON inválido');
      return;
    }
    setImporting(true);
    setImportError(null);
    const result = await importProjectTasks(projectId, normalizePayloadAliases(payload));
    setImporting(false);
    if (result.error) {
      setImportError(result.error);
      return;
    }
    onImported();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-foreground">Importar tareas</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Pega un JSON con tareas y subtareas, o carga un archivo <code>.json</code>. Las fechas
            (<code>start_date</code>, <code>due_date</code>) son opcionales — puedes omitirlas si
            el proyecto aún no las tiene.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Upload size={12} />
              Cargar archivo .json
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </div>

          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setPreview(null);
              setImportError(null);
            }}
            placeholder={EXAMPLE}
            rows={14}
            className="w-full rounded-md border border-border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary bg-white"
          />

          {existingTitles.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Este proyecto ya tiene {existingTitles.length} tarea
              {existingTitles.length === 1 ? '' : 's'}. La vista previa avisará si detecta títulos
              repetidos.
            </p>
          )}

          {preview && (
            <div
              className={`rounded-md border px-3 py-2 text-xs space-y-1 ${
                preview.error
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-primary/30 bg-primary/5 text-foreground'
              }`}
            >
              {preview.error ? (
                <p className="flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  {preview.error}
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 size={12} className="text-primary" />
                    Se crearán {preview.tasksCount} tarea{preview.tasksCount === 1 ? '' : 's'} y{' '}
                    {preview.subtasksCount} subtarea{preview.subtasksCount === 1 ? '' : 's'}.
                  </p>
                  {preview.duplicateTitles.length > 0 && (
                    <p className="flex items-start gap-1.5 text-amber-700">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      Títulos repetidos: {preview.duplicateTitles.join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {importError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {importError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handlePreview}
            disabled={checking || !raw.trim()}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            {checking ? 'Analizando…' : 'Vista previa'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={importing || !preview || !!preview.error}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {importing ? 'Importando…' : 'Confirmar importación'}
          </button>
        </div>
      </div>
    </>
  );
}
