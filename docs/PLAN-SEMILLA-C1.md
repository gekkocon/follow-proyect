# Plan semilla — C-1: mover tarea entre fases

**27 ago 2026.** Nace al cerrar 1C-b. HEAD `41fe6ea`.

Documento de arranque del próximo chat. `docs/PLAN-SEMILLA-1C.md` queda
**congelado** como registro de 1C-b y de las decisiones D-14 a D-22: se
consulta, no se amplía. `docs/ARQUITECTURA-WORKPLAN.md` sigue siendo la
fuente del modelo.

---

## 0. Cómo usar este documento

Adjuntarlo al chat nuevo junto con `CLAUDE.md`, los dos desde la carpeta del
repo. Pegar el bloque de la §5 verbatim.

Lo que está cerrado en el 1C no se rediscute: D-1 a D-22, las doce
correcciones de hecho, y el criterio de aceptación de su §2.

---

## 1. Estado al arrancar

| | |
|---|---|
| HEAD | `41fe6ea` en `origin/main`, árbol limpio |
| Último paso cerrado | 1C-b — alta y edición de fases desde la UI |
| SQL pendiente | ninguno |
| Migraciones a medias | ninguna |

**Conteos vivos.** Cualquier cambio que los mueva sin explicación es un bug.

| Proyecto | Fases | Tareas | `phase_code_seq` | `orphan_task_code_seq` |
|---|---|---|---|---|
| 5 | 0 | 2 | 1 — **F0 quemado** | 3 |
| 7 | 5 (F0–F4) | 35 | 5 | 6 |
| 9 sandbox | 2 (F0, F1) | 3 | 2 | 7 |

El proyecto 5 es el único que ejercita la rama sin fases. **No crear fases
ahí:** D-19 está abierta y no se decide de rebote.

---

## 2. Qué es C-1

Mover una tarea de una fase a otra, o entre una fase y "Sin fase".

**El código se realoca del watermark de la fase destino.** Una tarea que sale
de F1 como `T03` y entra a F4 recibe el próximo código de F4, no conserva el
suyo. El código de origen queda quemado: los watermarks nunca decrecen.

**Por qué bloquea a 1C-c.** D-20 dice que una fase se vacía moviendo tareas a
otra fase, no soltándolas — soltarlas las manda al namespace de códigos
huérfanos del proyecto, donde el índice único parcial las hace colisionar, que
es exactamente el problema que D-20 existe para evitar. Sin C-1, el bloqueo
por defecto de D-20 no tiene salida y una fase con tareas queda imborrable.

---

## 3. Lo que ya se sabe del repo, medido en 1C-b

No hace falta volver a leerlo.

- **No existe ningún reordenamiento en el repo.** Ni drag & drop, ni
  subir/bajar, ni librería de dnd en `package.json`.
- **`sort_order` no se escribe desde la aplicación**, salvo en `createPhase`,
  que lo deriva del sufijo del código. Se lee en dos lugares: el `.order()` de
  `getProjectWorkPlan` y el comparador de `buildWorkPlan`.
- **`phase-actions.ts`** es el octavo archivo de acciones y el único que
  escribe en `phases`. `createPhase` y `updatePhase`.
- **`refresh()`** rehace el árbol entero y baja por props como `onRefresh`
  hasta `SubtaskRow`. Cualquier escritura de cualquier nivel lo dispara.
- **Contratos de contador:** fase PRE (guarda el próximo libre), tarea en fase
  POST (guarda el último usado). Distintos a propósito.
- **`alloc_task_code_in_phase(p_phase_id)`** existe desde la 013 y la llama
  `createProjectTask`. Es la que C-1 necesita para el código destino.

---

## 4. Lo que hay que decidir antes de escribir código

1. **Dónde vive el control.** ¿Un select en el modo edición de `TaskRow`, o
   una acción aparte en la fila? El modo edición ya guarda con un botón
   explícito y no toca `phase_id` hoy.
2. **Qué pasa con las subtareas.** Sus códigos son locales a la tarea
   (`tasks.subtask_code_seq`), así que en principio no se tocan. Verificar que
   `composeCode` las recomponga bien con el código nuevo del padre.
3. **Si "Sin fase" es destino válido.** D-17 dice que toda tarea nace en una
   fase; sacar una tarea de su fase la volvería huérfana. Probablemente el
   movimiento sea solo fase → fase, pero hay 7 huérfanas vivas que sí
   necesitan entrar.
4. **Si el movimiento queda registrado.** La §6.2 del 1C decía "y el cambio
   queda registrado". Hoy ningún camino de escritura registra nada (deuda 16).

---

## 5. Primer paso del chat nuevo

```txt
Proyecto follow-proyect — C-1: mover tarea entre fases.

Adjunto PLAN-SEMILLA-C1.md y CLAUDE.md. El estado real es el de su §1:
HEAD 41fe6ea, árbol limpio, sin SQL pendiente. 1C-b cerrado y verificado
en pantalla.

PLAN-SEMILLA-1C.md está CONGELADO: se consulta como registro de D-1 a
D-22 y del criterio de aceptación, no se amplía.

Objetivo de la sesión: C-1, mover tarea entre fases con el código
realocado del watermark destino. Primero el bloque de solo lectura,
después las decisiones de la §4, después el bloque de escritura.

Pendiente después: 1C-c (borrar fase, D-20), D-22 (gate de usuarios),
reordenar fases y D-19.

Contexto operativo:
  - Claude Code puede bloquear Bash, Write y Edit por un clasificador.
    Mantener los prompts como trabajo de desarrollo normal: nada de
    descargas con hash, nada de SQL de permisos, nada de git.
  - Verificación en pantalla: hard reload y el renglón `✓ Compiled /ruta`
    antes de creerle a lo que se ve.
  - El SQL va a mi editor de Supabase. El git, a mi terminal.
  - Cuando dos hipótesis producen el mismo píxel, el gate es la base.

Convención: todo bloque de código va precedido por su línea de destino.
  ▶ DESTINO: CLAUDE CODE 🤖 (terminal del repo)
  ▶ DESTINO: SUPABASE 👾 (SQL a mano, base única y viva)
  ▶ DESTINO: HUMANO 👽 (Hikashi)
```
