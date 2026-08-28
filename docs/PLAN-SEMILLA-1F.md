# Plan semilla — 1F: retirar el namespace huérfano

**28 ago 2026.** Nace al cerrar 1D completo (commit `90015fa`).

`PLAN-SEMILLA-1E.md` queda **congelado** como registro: se consulta, no se
amplía. `docs/ARQUITECTURA-WORKPLAN.md` sigue siendo la fuente del modelo.

---

## 0. Cómo usar este documento

Adjuntarlo al chat nuevo junto con `CLAUDE.md`, los dos desde la carpeta del
repo. Pegar el bloque de la §5 verbatim.

Lo cerrado no se rediscute: D-1 a D-46 (registro en 1B, 1C y 1E).

---

## 1. Estado al arrancar

**El HEAD lo lee el terminal, no este documento.**

| | |
|---|---|
| Última fase cerrada | 1D completo (1D-a + 1D-b) |
| SQL pendiente | ninguno |
| Migración más alta | 013f. No existe 014. |

**Medido el 28 ago 2026, después de 013f. Volver a medirlo.**

- `tasks.phase_id` es `NOT NULL` (confirmado vía `information_schema`).
- `select count(*) from tasks where phase_id is null` = 0.
- `orphan_task_code_seq` por proyecto, sin uso desde el cierre de 1D-a:
  proyecto 5 → 3, proyecto 7 → 6, proyecto 9 → 8. Ninguno cambió en las
  dos sesiones siguientes.

**014 sigue reservada e intacta** para su alcance original (`CLAUDE.md`
§6, líneas 109 y 122): bajar `task_assignees`/`subtask_assignees`
(supersedidas por `assignments`) y las columnas legacy `start_date`,
`estimated_cost`, `dependencies`, `subtasks.completed`. 1F no la toca.

---

## 2. Qué es 1F

Con `phase_id NOT NULL` impuesto por la base, el camino huérfano quedó
**inalcanzable pero no retirado.** Tres capas todavía existen sin uso:

1. **Base:** columna `projects.orphan_task_code_seq`, índice parcial
   `idx_tasks_orphan_code` (`WHERE phase_id IS NULL` — ahora un índice
   sobre un conjunto permanentemente vacío), función `alloc_task_code`
   (el allocator sin fase).
2. **RPC:** `import_project_tasks` de 2 argumentos (la sobrecarga vieja,
   sin `p_phase_id`) sigue existiendo con `anon` habilitado — deuda 24
   de `CLAUDE.md`, y además ya inútil: no hay ningún proyecto que
   pueda recibirla sin fase destino desde que el frontend exige
   seleccionarla.
3. **Repo:** `project-task-actions.ts` y `types.ts` probablemente
   todavía tienen tipos o ramas de código que asumen `phase_id`
   nullable, o que llaman al allocator huérfano. No confirmado — es
   justamente lo que audita el primer bloque.

**1F se parte en dos, deliberadamente:**

- **1F-a — auditoría, de solo lectura.** Ubicar cada referencia a las
  tres capas de arriba, en base y en repo, sin modificar nada. Producir
  una lista concreta de qué se puede borrar y qué no.
- **1F-b — retiro.** Migración que baja lo que 1F-a confirmó que está
  muerto, más los cambios de repo correspondientes. Recién después de
  revisar el resultado de 1F-a con Hikashi.

El motivo de partirlo: la última vez que se asumió "esto ya no se usa"
sin medir (deuda 14, `allocCode` devolviendo `null` en silencio) fue un
hallazgo, no una hipótesis confirmada de entrada. No repetir el patrón
en un retiro que toca una función con `anon` todavía en el ACL.

---

## 3. Lo que ya se sabe, heredado de 1D y 1E

No hace falta re-auditar esto — ya está medido:

- **D-33 / D-46 (1D, 1E):** el camino huérfano nació muerto en la UI con
  D-17 (1C) y quedó muerto en la base con 013f (1D-b). No hay ninguna
  vía de escritura activa hacia `phase_id IS NULL`.
- **Deuda 24 (`CLAUDE.md`):** `import_project_tasks` de 2 argumentos y
  los tres allocators se otorgan `TO anon, authenticated`. La sobrecarga
  de 3 argumentos (013e) ya está corregida — `anon` no puede ejecutarla
  (verificado en el paso 1 de 1E). La de 2 argumentos sigue abierta.
- **Deuda 14:** `allocCode` puede devolver `null` sin que el insert lo
  note. Verificado en 1E (paso previo a 013f): cero filas hoy con
  `phase_id` seteado y `code` null. Pero esa verificación fue puntual,
  no es una garantía estructural — no hay constraint que lo impida
  hacia adelante en el resto del modelo (fases, subtareas).
- **Receta de funciones SQL con identidad del llamador** (`CLAUDE.md`
  §8): si el retiro de `alloc_task_code` implica tocar grants, aplica
  la misma receta de seis pasos ya medida para las otras RPC —
  `REVOKE` por nombre, no alcanza `FROM PUBLIC`.

---

## 4. Decisiones a cerrar en el chat, con el resultado de 1F-a en mano

1. **`orphan_task_code_seq`: ¿se borra la columna, o se deja como
   anotación histórica?** Es un int simple, no un riesgo de integridad
   como `legacy_code`. Pero borrar una columna es 014-style (destructivo:
   código primero, SQL después), no aditivo.
2. **`import_project_tasks(bigint, jsonb)` — la sobrecarga vieja.**
   ¿Se dropea directamente, o primero se le aplica el mismo `REVOKE`
   nominal que a la de 3 argumentos, como paso intermedio de menor
   riesgo?
3. **`alloc_task_code` y `idx_tasks_orphan_code`.** Mismo dilema que el
   punto 1: ¿drop directo o deprecar primero?
4. **¿1F-b entra en su propia migración (`013g`), o se agrupa con
   014 ya que ambas son limpieza de cosas muertas?** Mi lectura previa
   —la misma razón que separó 013f de la baja de namespace en 1D-b—
   es que conviene número propio: 014 ya tiene su propio alcance
   grande (dos tablas + cuatro columnas) y mezclar aumenta el radio de
   qué puede salir mal. A confirmar.

---

## 5. Primer paso del chat nuevo

    Proyecto follow-proyect — 1F: retirar el namespace huérfano.

    Adjunto PLAN-SEMILLA-1F.md y CLAUDE.md. El estado real es el de su
    §1; el HEAD lo leo de mi terminal, no del documento.

    El semilla 1E está CONGELADO: registro de D-1 a D-46.

    Objetivo de esta sesión: SOLO 1F-a, la auditoría. No se escribe ni
    se corre SQL. No se modifica ningún archivo del repo. Es lectura
    pura, en tres frentes:

      1. Base: confirmar el estado real de projects.orphan_task_code_seq,
         idx_tasks_orphan_code y alloc_task_code — uso, grants (proacl,
         has_function_privilege para anon y authenticated), y si algo
         los referencia todavía desde otras funciones o triggers.
      2. RPC: confirmar si import_project_tasks(bigint, jsonb) — la
         sobrecarga de 2 argumentos — tiene algún caller real hoy, o
         si es codigo muerto desde que el frontend exige fase destino.
      3. Repo: grep de orphan_task_code_seq, alloc_task_code, y
         cualquier lógica de project-task-actions.ts o types.ts que
         asuma phase_id nullable o llame al allocator sin fase.

    Entregable de esta sesión: un informe, no una migración. Lista
    concreta de qué está confirmado muerto y qué no, para cerrar las
    cuatro decisiones de la §4 con Hikashi antes de escribir 1F-b.

    Contexto operativo:
      - El SQL de auditoría (SELECT, pg_proc, information_schema) va
        a mi editor de Supabase, a mano — no se ejecuta desde acá.
      - El grep del repo sí lo corre Claude Code directamente.
      - Nada de ALTER, DROP, REVOKE ni GRANT en esta sesión.
      - Declarar los números esperados ANTES de correr cada query,
        igual que en 1D y 1E.

    Convención: todo bloque de código va precedido por su línea de destino.
      ▶ DESTINO: CLAUDE CODE 🤖 (terminal del repo, solo lectura/grep)
      ▶ DESTINO: SUPABASE 👾 (SQL de auditoría, a mano)
      ▶ DESTINO: HUMANO 👽 (Hikashi)
