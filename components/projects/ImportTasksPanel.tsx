'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Upload, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  previewProjectImport,
  importProjectTasks,
  previewProjectUpdate,
  updateProjectTasks,
  type ImportPreview,
} from '@/src/lib/supabase/project-import-actions';
import { FIELD_LABELS, type UpdatePreview } from '@/src/lib/supabase/update-normalize';

export type ImportTasksPanelMode = 'import' | 'update';

type Props = {
  projectId: number;
  existingTitles: string[];
  /** Etapa 1, paso 1D-a — fases del proyecto, para elegir destino. Ignorada en modo 'update'. */
  phases: { id: number; code: string; name: string }[];
  onClose: () => void;
  onImported: () => void;
  /** 'import' crea filas nuevas; 'update' parchea las existentes por código. */
  mode?: ImportTasksPanelMode;
};

const IMPORT_EXAMPLE = `{
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

const UPDATE_EXAMPLE = `[
  { "code": "F3", "status": "En progreso", "priority": "Alta" },
  { "code": "F3-T08", "title": "Plano eléctrico revisado", "completed": true },
  { "code": "F4", "assignees": ["Ana Pérez", "Luis Gómez"] }
]`;

const COPY: Record<ImportTasksPanelMode, { title: string; confirm: string; confirming: string }> = {
  import: {
    title: 'Importar tareas',
    confirm: 'Confirmar importación',
    confirming: 'Importando…',
  },
  update: {
    title: 'Actualizar tareas',
    confirm: 'Confirmar actualización',
    confirming: 'Actualizando…',
  },
};

// ─────────────────────────────────────────────
// Preview boxes
//
// Los dos modos comparten el shell del panel (overlay, cabecera, carga de
// archivo, textarea, botonera) pero no el resumen: el de importación son dos
// contadores y el de actualización son cuatro grupos con avisos. Mezclarlos en
// el mismo JSX lo llenaba de ternarios anidados, así que va uno por modo.
// ─────────────────────────────────────────────

function ImportPreviewBox({ preview }: { preview: ImportPreview }) {
  if (preview.error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        <p className="flex items-center gap-1.5">
          <AlertTriangle size={12} />
          {preview.error}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs space-y-1 text-foreground">
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
    </div>
  );
}

function UpdatePreviewBox({ preview }: { preview: UpdatePreview }) {
  if (preview.error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        <p className="flex items-center gap-1.5">
          <AlertTriangle size={12} />
          {preview.error}
        </p>
      </div>
    );
  }

  const nullCodes = preview.nullCodeTasks + preview.nullCodeSubtasks;

  return (
    <div className="space-y-2 text-xs">
      {preview.blocking.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 space-y-1">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle size={12} />
            {preview.blocking.length} error{preview.blocking.length === 1 ? '' : 'es'} que impide
            {preview.blocking.length === 1 ? '' : 'n'} confirmar
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            {preview.blocking.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-foreground space-y-2">
        <p className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 size={12} className="text-primary" />
          A actualizar: {preview.toUpdate.length} · Sin cambios: {preview.unchanged.length} · No
          encontradas: {preview.notFound.length}
        </p>

        {preview.toUpdate.length > 0 && (
          <ul className="space-y-1">
            {preview.toUpdate.map((item) => (
              <li key={item.code}>
                <span className="font-mono font-medium">{item.code}</span>{' '}
                <span className="text-muted-foreground">{item.title}</span>
                <ul className="list-disc pl-5 text-[11px] text-muted-foreground">
                  {item.changes.map((change) => (
                    <li key={change.field}>
                      {FIELD_LABELS[change.field] ?? change.field}: {change.from} → {change.to}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {preview.unchanged.length > 0 && (
          <p className="text-muted-foreground">
            Sin cambios: <span className="font-mono">{preview.unchanged.join(', ')}</span>
          </p>
        )}

        {preview.notFound.length > 0 && (
          <p className={preview.createMissing ? 'text-foreground' : 'text-amber-700'}>
            {preview.createMissing ? 'Se crearán' : 'No encontradas (se omiten)'}:{' '}
            <span className="font-mono">{preview.notFound.join(', ')}</span>
          </p>
        )}
      </div>

      {preview.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          <ul className="list-disc pl-4 space-y-0.5">
            {preview.warnings.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {nullCodes > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          <p className="flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 shrink-0" />
            Este proyecto tiene {preview.nullCodeTasks} tarea
            {preview.nullCodeTasks === 1 ? '' : 's'} y {preview.nullCodeSubtasks} subtarea
            {preview.nullCodeSubtasks === 1 ? '' : 's'} sin código: no son direccionables por este
            flujo.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────

export function ImportTasksPanel({
  projectId,
  existingTitles,
  phases,
  onClose,
  onImported,
  mode = 'import',
}: Props) {
  const [raw, setRaw] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [updatePreview, setUpdatePreview] = useState<UpdatePreview | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // Etapa 1, paso 1D-a — fase destino. Obligatoria en modo 'import'.
  const [phaseId, setPhaseId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copy = COPY[mode];
  const isUpdate = mode === 'update';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function resetPreview() {
    setImportPreview(null);
    setUpdatePreview(null);
    setImportError(null);
  }

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
  // Import only: the update payload is flat and uses "assignees".
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
    resetPreview();
  }

  async function handlePreview() {
    resetPreview();
    const { payload, error } = parseRaw();

    if (error || !payload) {
      if (isUpdate) {
        setImportError(error ?? 'JSON inválido');
      } else {
        setImportPreview({ error, tasksCount: 0, subtasksCount: 0, duplicateTitles: [] });
      }
      return;
    }

    setChecking(true);
    if (isUpdate) {
      setUpdatePreview(await previewProjectUpdate(projectId, payload, createMissing));
    } else {
      setImportPreview(await previewProjectImport(projectId, normalizePayloadAliases(payload)));
    }
    setChecking(false);
  }

  async function handleConfirm() {
    const { payload, error } = parseRaw();
    if (error || !payload) {
      setImportError(error ?? 'JSON inválido');
      return;
    }
    // La guarda de la fase va ANTES de marcar el envío en curso: si falta el
    // destino no hay nada en vuelo que deshacer.
    //
    // El if/else reemplaza al ternario porque TypeScript no estrecha `phaseId`
    // a través de él: el chequeo tiene que vivir dentro de la rama que lo usa.
    // Así se evita `!` y `as number`, que callarían al compilador en vez de
    // resolver el caso.
    let result;
    if (isUpdate) {
      setImporting(true);
      setImportError(null);
      result = await updateProjectTasks(projectId, payload, createMissing);
    } else {
      if (phaseId === null) {
        setImportError('Elegí una fase destino antes de importar.');
        return;
      }
      setImporting(true);
      setImportError(null);
      result = await importProjectTasks(projectId, normalizePayloadAliases(payload), phaseId);
    }

    setImporting(false);
    if (result.error) {
      setImportError(result.error);
      return;
    }
    onImported();
  }

  const canConfirm = isUpdate
    ? !!updatePreview && !updatePreview.error && updatePreview.blocking.length === 0
    : !!importPreview && !importPreview.error && phaseId !== null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {isUpdate ? (
            <p className="text-xs text-muted-foreground">
              Pega un array <strong>plano</strong> de objetos, o carga un archivo{' '}
              <code>.json</code>. Cada objeto se direcciona por su <code>code</code>, que es
              obligatorio: <code>F3</code> es una tarea y <code>F3-T08</code> una subtarea. Los
              códigos se pasan a <strong>MAYÚSCULAS</strong> automáticamente. Sólo se actualizan
              los campos presentes en cada objeto; los que no vengan quedan intactos. Si viene{' '}
              <code>assignees</code>, reemplaza el set completo de responsables.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pega un JSON con tareas y subtareas, o carga un archivo <code>.json</code>. La
              fecha (<code>due_date</code>) es opcional — puedes omitirla si el proyecto aún no
              la tiene.
            </p>
          )}

          {/* Etapa 1, paso 1D-a — destino obligatorio. Toda tarea importada
              nace dentro de una fase; la sobrecarga de 3 argumentos del RPC es
              la que lo hace. Sólo en modo 'import'. */}
          {!isUpdate &&
            (phases.length === 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                Este proyecto todavía no tiene fases. Creá una fase antes de importar.
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Fase destino
                </label>
                <select
                  value={phaseId ?? ''}
                  onChange={(e) => {
                    setPhaseId(e.target.value ? Number(e.target.value) : null);
                    // Mismo tratamiento que el textarea: cambiar el destino
                    // invalida la vista previa, o se previsualiza contra una
                    // fase y se confirma contra otra.
                    resetPreview();
                  }}
                  className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
                >
                  <option value="">Elegí una fase…</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {`${p.code} · ${p.name}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}

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
              resetPreview();
            }}
            placeholder={isUpdate ? UPDATE_EXAMPLE : IMPORT_EXAMPLE}
            rows={14}
            className="w-full rounded-md border border-border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary bg-white"
          />

          {isUpdate && (
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={createMissing}
                onChange={(e) => {
                  setCreateMissing(e.target.checked);
                  // El grupo de "no encontradas" cambia de significado con el
                  // toggle, así que la vista previa anterior deja de valer.
                  resetPreview();
                }}
                className="mt-0.5"
              />
              <span>
                Crear las no encontradas
                <span className="block text-[11px] text-muted-foreground">
                  Apagado, los códigos inexistentes se reportan y se omiten. Encendido, se crean —
                  un código mal tipeado se convierte en una fila nueva.
                </span>
              </span>
            </label>
          )}

          {!isUpdate && existingTitles.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Este proyecto ya tiene {existingTitles.length} tarea
              {existingTitles.length === 1 ? '' : 's'}. La vista previa avisará si detecta títulos
              repetidos.
            </p>
          )}

          {!isUpdate && importPreview && <ImportPreviewBox preview={importPreview} />}
          {isUpdate && updatePreview && <UpdatePreviewBox preview={updatePreview} />}

          {isUpdate && updatePreview && !updatePreview.error && (
            <p className="text-[11px] text-muted-foreground">
              Al confirmar, el total de &quot;actualizadas&quot; que informa la base incluye
              también las que no cambiaron.
            </p>
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
            disabled={importing || !canConfirm}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {importing ? copy.confirming : copy.confirm}
          </button>
        </div>
      </div>
    </>
  );
}
