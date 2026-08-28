# Plan semilla — 1D: toda tarea vive en una fase

**27 ago 2026.** Nace al cerrar 1C-c (commit `bbdb48c`).

Documento de arranque del próximo chat. `PLAN-SEMILLA-1C.md`,
`PLAN-SEMILLA-C1.md` y `PLAN-SEMILLA-1C-c.md` quedan **congelados** como
registro: se consultan, no se amplían. `docs/ARQUITECTURA-WORKPLAN.md` sigue
siendo la fuente del modelo.

---

## 0. Cómo usar este documento

Adjuntarlo al chat nuevo junto con `CLAUDE.md`, los dos desde la carpeta del
repo. Pegar el bloque de la §6 verbatim.

Lo cerrado no se rediscute: D-1 a D-32.

---

## 1. Estado al arrancar

**Sobre el HEAD.** Este documento se escribe antes de ser commiteado, así que
no puede conocer su propio hash. El HEAD al escribirlo es `bbdb48c`, más el
commit que agrega este archivo. **El terminal es la autoridad.**

| | |
|---|---|
| Último paso cerrado | 1C-c — borrar fase, con D-20 impuesta por la base |
| SQL pendiente | ninguno |
| Migración más alta | 013d. No existe 014. |

**Conteos declarados, medidos el 27 ago 2026. Volver a medirlos igual.**

| Proyecto | Fases | Tareas | Huérfanas | `phase_code_seq` | `orphan_task_code_seq` |
|---|---|---|---|---|---|
| 5 | 0 | 2 | 2 | 1 — F0 quemado | 3 |
| 7 | 5 (F0–F4) | 35 | 5 | 5 | 6 |
| 9 | 1 (F1) | 3 | 1 | 4 — F0, F2 y F3 quemados | 7 |

**Total de huérfanas: 8.** Ese número es el objeto de 1D-a.

**Las tres capas de D-20 están probadas:** el `disabled` del botón (que
resistió que le quitaran el atributo desde DevTools), el conteo en
`deletePhase` (probado con dos pestañas: la vista decía 0 tareas y el
servidor contestó "Tiene 1"), y el `RESTRICT` de la 013d.

**Watermarks.** `deriva` = contador − MAX(sufijo). Negativa es un bug.
Proyecto 7: F0 8/8, F1 5/4 (+1), F2 5/5, F3 4/4, F4 9/9.
Proyecto 9: F1 2/2. Verificado con V5 el 27 ago: cero anomalías.

---

## 2. Qué es 1D

**Invariante declarado por Hikashi el 27 ago 2026: toda tarea vive en una
fase.** No es una puerta de UI. Es un cambio de modelo que absorbe D-19 y la
deuda 23 y las convierte en dos caras de lo mismo.

Propuesta de partición, a confirmar o corregir en la §5:

- **1D-a** — nadie nace huérfano y las 8 existentes se mudan. Gates de UI,
  `import_project_tasks` exigiendo fase destino, migración de datos.
  Criterio de cierre: `count(*) from tasks where phase_id is null` = 0.
- **1D-b** — el invariante se vuelve estructura: `phase_id NOT NULL`, baja del
  namespace huérfano. Solo después de que 1D-a haya vivido sin recaídas.

El motivo de partirlo: una sola base, sin backups. Y el `RESTRICT` de la 013d
ya es la cláusula correcta para un `phase_id NOT NULL` — 1C-c dejó puesto el
primer ladrillo sin saberlo.

---

## 3. Lo que ya se sabe del repo, medido en 1C-c

No hace falta volver a leerlo.

**Base, medido contra `pg_constraint` y `pg_indexes`:**

- `tasks.phase_id` → `phases` es **ON DELETE RESTRICT** (013d, aplicada y
  verificada). Antes era SET NULL, incompatible con D-20.
- `phases.project_id` → `projects` es CASCADE. `tasks.project_id` y
  `subtasks.task_id` son **NO ACTION**: los borrados bloqueados del repo están
  respaldados por la base.
- Cuatro índices: `idx_phases_project_code`, `idx_tasks_phase_code`,
  `idx_tasks_orphan_code` (parcial, `WHERE phase_id IS NULL`), `idx_tasks_phase`.
- **Cero triggers** en phases, tasks y subtasks.
- `assignments.assignable_id` no tiene FK — es polimórfica.

**Repo:**

- `phase-actions.ts`: 166 líneas. `createPhase`, `updatePhase`, `deletePhase`.
  Ninguna verifica rol ni sesión: usan `createServerClient` (anon).
- `ProjectTasksClient.tsx`: 742 líneas. `WorkSection` es un componente privado
  del mismo archivo; `WorkSectionProps` en 246-274. La cabecera de fase tiene
  lápiz y tacho. Imports: línea 4 lucide, 10 project-task-actions,
  11 phase-actions.
- **Tres call sites de `TaskList`**: el map de fases, "Sin fase", y la rama de
  proyecto sin fases. Los tres los toca 1D.
- `deleteProject` (project-actions.ts:99-162) borra a mano, en 8 requests
  separadas, y **solo chequea el error de la última**. Es el único borrado que
  limpia `assignments`.
- `import_project_tasks` crea tareas **sin fase** por diseño. Reparada en 013b.
- Allocators: `alloc_task_code` (huérfana) y `alloc_task_code_in_phase`.
- Separadores: `// ` + 44 × U+2500. Copiarlos del archivo, nunca reconstruirlos.
- Cuatro `confirm()` en el repo, todos de un paso. El de fase nombra el código.

---

## 4. Correcciones de hecho, cerradas en 1C-c

1. **React ignora el `disabled` del DOM.** `getListener` lee `props.disabled`
   del fiber. Quitar el atributo desde DevTools no revive el handler: el click
   ocurre y no hay a quién entregárselo. La capa 1 no es cosmética.
2. **El `title` no se ve en un `<button disabled>`.** Chrome suprime los
   eventos de mouse. Por eso vive en un `<span>` que envuelve al botón.
3. **La deuda 19 era falsa para `deleteProject`**, que sí limpia `assignments`.
4. **`schema.sql` se contradice con la base** (deuda 31), no solo está viejo.
5. **Un hydration mismatch sobrevivió a un rebuild y era el bundle viejo.** El
   discriminador es `rm -rf .next` + el renglón `✓ Compiled /ruta`.
6. **Regla de ruido de consola:** error en la carga, sin interacción, es ruido;
   error tras un click, detiene. El SW y `cz-shortcut-listen` son ruido.
7. **Un prompt que edita un archivo debe correr DESPUÉS del que lo crea.** En
   1C-c se invirtió el orden y dos ediciones murieron sin ancla. Claude Code
   paró bien; el error fue del orden, no suyo.

---

## 5. Lo que hay que decidir antes de escribir código

1. **El nivel del invariante.** ¿Se confirma la partición 1D-a / 1D-b, o va
   todo junto?
2. **Dónde van las 8 huérfanas.** ¿Una fase "Sin clasificar" autocreada por
   proyecto, o mudanza manual con C-1? El proyecto 5 no tiene ninguna fase.
3. **`import_project_tasks`.** ¿Exige fase destino como parámetro, o el payload
   trae códigos de fase? Es el trabajo más grande de 1D y toca una RPC recién
   reparada.
4. **El bloque "Sin fase".** ¿Desaparece, o queda de solo lectura durante la
   transición?
5. **Los códigos al mudar.** Una huérfana T07 que entra a una fase recibe
   código nuevo del watermark destino. ¿`legacy_code` guarda el viejo?
   Verificar primero qué hace `moveTaskToPhase` de C-1 hoy.
6. **D-19 pasa de "crear primera fase" a "no puede haber tareas sin fase".**
   ¿El proyecto sin fases muestra el alta de tarea deshabilitada, o la oculta?
7. **Rol y registro.** 1D toca escritura masiva sin gate (deudas 17, 24, 25) ni
   log (deuda 16). D-22 viene después: decidir si se hereda otra vez.

---

## 6. Primer paso del chat nuevo

    Proyecto follow-proyect — 1D: toda tarea vive en una fase.

    Adjunto PLAN-SEMILLA-1D.md y CLAUDE.md. El estado real es el de su
    §1; el HEAD lo leo de mi terminal, no del documento.

    Los semillas 1C, C1 y 1C-c están CONGELADOS: registro de D-1 a D-32.

    Objetivo: cerrar el alcance de 1D antes de escribir una línea.
    En este orden:
      1. Medición del estado: las 8 huérfanas, los contadores, y qué
         hace hoy moveTaskToPhase con legacy_code.
      2. Las siete decisiones de la §5, empezando por la partición
         1D-a / 1D-b.
      3. Recién después, plan de implementación.

    Contexto operativo:
      - Claude Code puede bloquear Bash, Write y Edit por un clasificador.
        Prompts como trabajo de desarrollo normal: nada de descargas con
        hash, nada de SQL de permisos, nada de git.
      - Verificación en pantalla: hard reload y el renglón
        `✓ Compiled /ruta` — con la ruta.
      - Ruido de consola: error en la carga = ruido; tras un click = parar.
      - El SQL va a mi editor de Supabase. El git, a mi terminal.
      - Las pruebas de navegador van a WorkGPT como guion paso a paso.
      - Cuando dos hipótesis producen el mismo píxel, el gate es la base.
      - Declarar los números esperados ANTES de correr la query.
      - Todo archivo del repo lo modifica Claude Code, con anclas que
        exijan exactamente una coincidencia. Un prompt que edita corre
        después del que crea.

    Convención: todo bloque de código va precedido por su línea de destino.
      ▶ DESTINO: CLAUDE CODE 🤖 (terminal del repo)
      ▶ DESTINO: SUPABASE 👾 (SQL a mano, base única y viva)
      ▶ DESTINO: WORKGPT 👁️ (pruebas de navegador)
      ▶ DESTINO: HUMANO 👽 (Hikashi)
