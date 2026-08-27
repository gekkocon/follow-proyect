# Plan semilla — 1C-c: borrar fase

**27 ago 2026.** Nace al cerrar C-1.

Documento de arranque del próximo chat. `docs/PLAN-SEMILLA-1C.md` y
`docs/PLAN-SEMILLA-C1.md` quedan **congelados** como registro: se consultan,
no se amplían. `docs/ARQUITECTURA-WORKPLAN.md` sigue siendo la fuente del
modelo.

---

## 0. Cómo usar este documento

Adjuntarlo al chat nuevo junto con `CLAUDE.md`, los dos desde la carpeta del
repo. Pegar el bloque de la §6 verbatim.

Lo cerrado no se rediscute: D-1 a D-32.

---

## 1. Estado al arrancar

**Sobre el HEAD.** Este documento se escribe antes de ser commiteado, así que
no puede conocer el hash del commit que lo agrega. El HEAD al escribirlo es
`53b52b4` (C-1), más un commit cosmético y el de este documento. **El terminal
es la autoridad.** El `PLAN-SEMILLA-C1.md` declaró un hash anterior al suyo
propio por esta misma razón y hubo que corregirlo a mano al abrir la sesión.

| | |
|---|---|
| Último paso cerrado | C-1 — mover tarea entre fases, verificado en pantalla y en base |
| SQL pendiente | ninguno |
| Migraciones a medias | ninguna |
| Migración más alta | 013c. No existe archivo 014. |

**Conteos vivos.** Cualquier cambio que los mueva sin explicación es un bug.

| Proyecto | Fases | Tareas | Huérfanas | `phase_code_seq` | `orphan_task_code_seq` |
|---|---|---|---|---|---|
| 5 | 0 | 2 | 2 | 1 — F0 quemado | 3 |
| 7 | 5 (F0–F4) | 35 | 5 | 5 | 6 |
| 9 sandbox | 2 (F0, F1) | 3 | 1 | 2 | 7 |

**Watermarks por fase.** `deriva` = contador − MAX(sufijo). Cero o positiva es
correcto; **negativa es un bug** y la próxima alta colisiona.

| Proyecto | Fase | Contador | Tareas | Deriva |
|---|---|---|---|---|
| 7 | F0 | 8 | 8 | 0 |
| 7 | F1 | 5 | 4 | **+1** |
| 7 | F2 | 5 | 5 | 0 |
| 7 | F3 | 4 | 4 | 0 |
| 7 | F4 | 9 | 9 | 0 |
| 9 | F0 | 2 | **0** | **+2** |
| 9 | F1 | 2 | 2 | 0 |

El proyecto 5 es el único sin fases. **No crear fases ahí:** D-19 sigue
abierta.

**El sandbox quedó preparado para 1C-c a propósito.** Proyecto 9: F0 vacía con
dos códigos quemados —ejercita el borrado permitido— y F1 con dos tareas
—ejercita el bloqueo de D-20—. No deshacer ese estado.

---

## 2. Qué es 1C-c

Borrar una fase.

**D-20:** una fase con tareas **no se borra**. Se vacía moviendo sus tareas a
otra fase, no soltándolas: soltarlas las manda al namespace de códigos
huérfanos del proyecto, donde el índice único parcial `idx_tasks_orphan_code`
las hace colisionar.

C-1 ya existe, así que el bloqueo por defecto de D-20 tiene salida y una fase
con tareas dejó de ser imborrable.

**El código de la fase queda quemado.** `projects.phase_code_seq` es PRE y
monotónico: borrar F0 no lo devuelve. La próxima fase sigue la numeración.

---

## 3. Lo que ya se sabe del repo, medido en C-1

No hace falta volver a leerlo.

- **`phase-actions.ts`** tiene 107 líneas, `createPhase` y `updatePhase`. Usa
  sólo `createServerClient` (anon, sin sesión) y **no verifica rol ni sesión**.
  No hay `deletePhase`.
- **`updatePhase`** arma el update campo por campo, sin spread. Acepta cinco:
  name, objective, status, priority, due_date. Filtra por `id` **y**
  `project_id`.
- **`deleteProjectTask`** es el precedente del borrado bloqueado: cuenta hijos
  con `select('id', { count: 'exact', head: true })` y devuelve un string de
  error si hay alguno. Es la forma que 1C-c debería imitar.
- **Separadores de sección:** `// ` + 44 caracteres U+2500. Los usan
  `project-task-actions.ts` (10 bloques) y `TaskRow.tsx` (3). **Copiarlos del
  propio archivo, nunca reconstruirlos.**
- **`refresh()`** rehace el árbol entero y baja como `onRefresh`. Cualquier
  escritura lo dispara.
- **Contadores:** fase PRE, tarea en fase POST. Distintos a propósito.
- **`tsconfig`** no tiene `noUnusedLocals` ni `noUnusedParameters`, y `strict`
  no los incluye. Una prop declarada y sin consumir compila.
- **lucide-react 1.24.0.** Verificado que existen FolderInput, ArrowRightLeft,
  CornerUpRight, MoveRight y ArrowRight.

---

## 4. Correcciones de hecho, cerradas en C-1

Seis mediciones que contradicen documentos previos. Ganan las mediciones.

1. **Huérfanas: eran 10 al arrancar C-1** (2/5/3), no 7. El 7 del
   `PLAN-SEMILLA-C1.md` era prosa, nunca conteo. Hoy son 8 (2/5/1).
2. **`idx_tasks_orphan_code`** es el nombre real del índice parcial de
   huérfanas. El fundamento de D-20 lo nombra `idx_tasks_project_orphan_code`,
   que no existe: un grep por ese nombre no encuentra nada.
3. **Hay TRES call sites de `TaskList`**, no dos: el map de fases, el bloque
   "Sin fase", y el de la rama de proyecto sin fases.
4. **`PHASES_OPEN_BY_DEFAULT_MAX = 5` con `<=` nunca evaluó en falso** en
   ningún proyecto del repo. Parecía un umbral calibrado y era rama muerta: el
   comportamiento real era "todo abierto, siempre". D-30 lo puso en 0.
5. **No hay proyecto 10.** El `POST /projects` del log era una edición del
   proyecto 5, que se llama "Conectar Claude Code con Workana".
6. **`✓ Compiled in 1870ms (3059 modules)` no es el renglón que pide la §8 de
   `CLAUDE.md`.** Ése es el de recompilación tras editar. El que verifica una
   ruta lleva la ruta: `✓ Compiled /projects/[id]`.

---

## 5. Lo que hay que decidir antes de escribir código

**Primero, una lectura que no se puede saltear.** ¿Qué cláusula `ON DELETE`
tiene la FK de `tasks.phase_id` hacia `phases`, en la 013? De eso depende todo:

- `CASCADE` → borrar una fase borra sus tareas. Peligroso y silencioso.
- `SET NULL` → las tareas quedan huérfanas **conservando su código local de
  fase**, que es exactamente la colisión contra `idx_tasks_orphan_code` que
  D-20 existe para evitar. La base lo haría sola, sin que ningún action lo pida.
- `RESTRICT` / `NO ACTION` → la base ya bloquea y el error llega como mensaje
  de Postgres, no como el string en español que pide el contrato.

Después:

1. **Dónde vive el control.** La cabecera de fase hoy tiene un solo botón, el
   lápiz de editar. ¿Tacho al lado, o dentro del formulario de edición?
2. **Cómo es la confirmación.** La §7 de `CLAUDE.md` exige confirmación
   explícita para toda acción destructiva y dos pasos para las cascadas. Hoy el
   borrado de tarea usa un `confirm()` nativo.
3. **Qué dice el bloqueo.** Un string en español que explique la salida: mover
   las tareas primero, con C-1.
4. **Si el conteo se hace en el servidor.** El cliente ya sabe cuántas tareas
   tiene la fase, pero confiar en eso deja la puerta abierta a un borrado con
   estado viejo. `deleteProjectTask` cuenta en el servidor.
5. **`assignments` no se limpia** (deuda 19). Un borrado en cascada dejaría
   filas colgadas de tareas que ya no existen.
6. **El borrado no verifica rol** (deuda 17) y **no registra nada** (deuda 16).
   Decidir si 1C-c es el momento de cambiarlo o si se hereda.

---

## 6. Primer paso del chat nuevo

    Proyecto follow-proyect — 1C-c: borrar fase.

    Adjunto PLAN-SEMILLA-1C-c.md y CLAUDE.md. El estado real es el de su
    §1; el HEAD lo leo de mi terminal, no del documento.

    PLAN-SEMILLA-1C.md y PLAN-SEMILLA-C1.md están CONGELADOS: se
    consultan como registro de D-1 a D-32, no se amplían.

    Objetivo de la sesión: 1C-c, borrar fase con el bloqueo de D-20.
    En este orden:
      1. Bloque de solo lectura, empezando por la cláusula ON DELETE de
         la FK de tasks.phase_id — de eso depende todo lo demás.
      2. Las decisiones de la §5 del semilla.
      3. Bloque de escritura.

    Banco de pruebas listo en el proyecto 9: F0 vacía (borrado
    permitido), F1 con dos tareas (bloqueo). No deshacer ese estado.

    Pendiente después: D-22 (gate de usuarios), reordenar fases, D-19 y
    la deuda 23 (el botón Importar crea huérfanas en proyectos con fases).

    Contexto operativo:
      - Claude Code puede bloquear Bash, Write y Edit por un clasificador.
        Mantener los prompts como trabajo de desarrollo normal: nada de
        descargas con hash, nada de SQL de permisos, nada de git.
      - Verificación en pantalla: hard reload y el renglón
        `✓ Compiled /ruta` — con la ruta, no el de recompilación.
      - El SQL va a mi editor de Supabase. El git, a mi terminal.
      - Las pruebas de navegador van a WorkGPT como guion paso a paso.
      - Cuando dos hipótesis producen el mismo píxel, el gate es la base.
      - Declarar los números esperados ANTES de correr la query.

    Convención: todo bloque de código va precedido por su línea de destino.
      ▶ DESTINO: CLAUDE CODE 🤖 (terminal del repo)
      ▶ DESTINO: SUPABASE 👾 (SQL a mano, base única y viva)
      ▶ DESTINO: WORKGPT 👁️ (pruebas de navegador)
      ▶ DESTINO: HUMANO 👽 (Hikashi)
