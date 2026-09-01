# Arquitectura funcional — Work Plan

**Estado: PARCIALMENTE IMPLEMENTADO.** Las Etapas 0 (limpieza Drizzle), 1 (el corte a `phases`/`tasks`/`subtasks`/`assignments`) y 2 (`work_items` emergentes) de la sección 9 ya están implementadas y en producción desde antes de la sesión 1N. Queda pendiente únicamente la **Etapa 3** — drag & drop, `activity_log`, `import_work_plan` — sesión 1Q en adelante.
El diseño de las tres etapas ya implementadas sigue siendo la referencia válida de lo que se construyó; lo que describe como pendiente en el resto del documento (sección 8, sección 11) es real solo para la Etapa 3.
Cierra la decisión abierta #2 de `CLAUDE.md`.
Última actualización: 31 ago 2026 (sesión 1Q).

---

## 0. Qué resuelve

Hoy las `tasks` de primer nivel se usan como fases y las `subtasks` como tareas. Este documento define el modelo objetivo y la migración.

Fuera de alcance, deliberadamente: **Handoff**, **Decisions/ADR** y **Git**. Viven a nivel proyecto o fuera del sistema. No son entidades del Work Plan.

---

## 1. Decisiones cerradas

Cinco puntos donde las respuestas del cuestionario se contradecían entre sí o con la realidad del repo. Los cinco están resueltos.

Cada uno queda documentado con la alternativa descartada y el motivo. Sin eso, dentro de tres meses no se pueden reabrir sin reconstruir el razonamiento desde cero.

### C-1. Código único por fase vs. código congelado al mover

Se pidió que el código de tarea sea único **por fase** (`T01` reinicia en cada fase) y a la vez que **se congele** al mover una tarea.

Son incompatibles: si `F3-T08` se mueve a F5, o el código sigue diciendo F3 (miente sobre su ubicación) o colisiona con el `T08` que ya existe en F5.

| Opción | Consecuencia |
|---|---|
| **A. Código local + display compuesto.** Se guarda `T08`; se muestra `phase.code + '-' + task.code`. Al mover, se realoca del watermark de la fase destino. | El código cambia al mover. Nunca miente, nunca colisiona. |
| **B. Código global por proyecto.** `T08` es correlativo del proyecto, no de la fase. Se congela de verdad. | El código no dice a qué fase pertenece. |
| **C. No se permite mover tareas entre fases.** | Congelado real, cero código extra. |

**Decisión: A.** Mover tareas entre fases va a pasar, y un código que miente rompe la trazabilidad, que es la prioridad #2.

Esto **revoca la regla de congelar el código al mover**, que venía del cuestionario. Lo que se congela no es el código: es el histórico. `activity_log` registra que `F3-T08` pasó a ser `F5-T04`, y ahí vive la trazabilidad — no en un identificador que dice una fase en la que la tarea ya no está.

### C-2. `blocked` como estado y `is_blocked` como booleano

Se pidió la misma lista de estados para los tres niveles, incluyendo `blocked`, **y** además `is_blocked` + `blocked_reason` en los tres niveles. Es la misma información en dos lugares: se pueden desincronizar igual que pasó con `status`/`completed`.

**Decisión:** estados **`pending / in_progress / done / cancelled`**. El bloqueo es el booleano con su motivo, y se muestra como badge sobre cualquier estado. Una tarea puede estar `in_progress` y bloqueada — que es justamente el caso real.

### C-3. Tareas sin fase

Se aceptó que existan tareas no ligadas a ninguna fase. La jerarquía las necesita colgadas de algo.

| Opción | Consecuencia |
|---|---|
| **A. `phase_id` nullable.** | Una vista más ("sin fase"), código de tarea sin prefijo. |
| **B. Fase implícita "Sin clasificar"** creada con el proyecto. | Modelo uniforme, cero nulls, una fase que ensucia el avance. |

**Decisión: A**, con `phase_id` nullable y una sección colapsable "Sin fase" al final. No entran en el cálculo de avance de ninguna fase pero sí en el del proyecto.

Se descarta la fase implícita: una fase falsa dentro del organigrama para guardar lo que no clasifica ensucia el avance y obliga a explicarla cada vez.

### C-4. Bugs y deuda en las métricas

Se pidió que bugs y deuda técnica **afecten la productividad**, y a la vez que el avance se calcule promediando subtarea → tarea → fase. Un bug no tiene porcentaje: no se puede promediar dentro de una fase sin ensuciar el número.

**Decisión: dos métricas separadas**, nunca fundidas en un solo porcentaje.

- **Avance** — de la jerarquía, como se especificó.
- **Carga emergente** — bugs abiertos ponderados por severidad + deuda abierta ponderada por impacto.

Un proyecto puede estar 90% avanzado con carga emergente alta. Ese es el dato útil; un único número lo escondería.

### C-5. El plazo

Un día no alcanza. El radio medido es de 9 archivos con acceso directo a las tablas, más `TaskRow.tsx` con 767 líneas, más 3 entidades nuevas con su UI, más drag & drop e histórico.

**Decisión: por etapas, sin fecha forzada.** No se sacrifica estructura por un plazo artificial. El detalle está en la sección 9; el primer día termina con una parte funcional y estable, no con todo a medias.

---

## 2. Decisión estructural — tablas separadas + una tabla para lo emergente

La pregunta era: tablas separadas o `work_items` genérico con `type` + `parent_id`. **La respuesta no es la misma para las dos mitades del modelo.**

### Jerarquía: tablas separadas

`phases`, `tasks`, `subtasks`.

Los tres niveles tienen conjuntos de campos genuinamente distintos: la fase planifica (4 fechas, dependencias), la tarea produce un resultado (criterios de aceptación, estimación), la subtarea es un paso (deliberadamente mínima). Un `work_items` genérico obligaría a nulls masivos y a validar en aplicación lo que el esquema puede garantizar. La cadena padre es un FK real, no un `parent_id` que puede apuntar a cualquier cosa.

### Emergentes: una sola tabla

`work_items` con `type` ∈ `bug | debt | question_rfc`.

Bug, deuda y RFC comparten **12 de sus campos**: proyecto, código, título, descripción, estado, prioridad, responsables, creación, autor, resolución, orden y el vínculo con su origen. Difieren en 6 a 8 campos cada uno.

Tres tablas separadas significarían tres allocators de código, tres archivos de acciones y tres componentes de UI casi idénticos. Una sola tabla es **un allocator, un archivo de acciones y un componente con prop `type`** — que es literalmente la preferencia arquitectónica declarada en `CLAUDE.md` sección 7.

Además habilita gratis la conversión RFC → tarea y bug → deuda, que se pidió, y el "aparecen las tres como pestañas colapsables abajo".

Question/RFC es una única entidad, no dos. Puede nacer como pregunta o duda y evolucionar dentro del mismo registro hasta una evaluación de alternativas y una decisión final. No existe conversión Question → RFC ni un segundo work item: es el mismo registro atravesando estados.

### Asignaciones: polimórficas

Hoy hay `task_assignees` y `subtask_assignees`. Con el modelo nuevo harían falta cinco tablas de asignados. Se reemplazan por una sola:

```
assignments (assignable_type, assignable_id, user_id)
```

`assignable_type` ∈ `task | subtask | work_item`. **No hay asignados a nivel fase** — se pidió explícitamente que solo tarea y subtarea los tengan.

---

## 3. Tablas

### `phases`

| Campo | Tipo | Nota |
|---|---|---|
| id | bigserial | |
| project_id | bigint FK | |
| code | text | `F0`, `F1` — **sin padding**, se preserva de las tasks actuales |
| name | text NOT NULL | |
| objective | text | |
| status | enum | `pending / in_progress / done / cancelled` |
| priority | enum | |
| is_blocked | boolean default false | |
| blocked_reason | text | |
| planned_start_date | date | |
| actual_start_date | date | |
| estimated_end_date | date | |
| actual_end_date | date | |
| dependencies | bigint[] | otras fases |
| sort_order | int | drag & drop |
| created_at | timestamptz | |
| task_code_seq | int default 0 | watermark |

**Eliminados de la propuesta original:** `owner` (no hay responsables a nivel fase), `progress_percentage` (se calcula, no se guarda — un porcentaje almacenado se desincroniza), `risk_level` y `health` (subjetivos y superpuestos; la salud se deriva de bloqueo + vencimiento + avance), `blockers` (redundante con `is_blocked`), `next_action` (es concepto de Handoff, fuera de alcance), `notes` (lo cubre `objective`).

### `tasks`

| Campo | Tipo | Nota |
|---|---|---|
| id | bigserial | |
| project_id | bigint FK | denormalizado, evita join para la vista global |
| phase_id | bigint FK **nullable** | ver C-3 |
| code | text | `T01` con padding 2 — ver C-1 |
| title | text NOT NULL | |
| description | text | |
| type | enum | `feature / improvement / research / operational` |
| status | enum | |
| priority | enum | |
| is_blocked / blocked_reason | | |
| start_date / due_date | date | |
| completed_at | timestamptz | **automático** al pasar a `done` |
| estimated_hours | numeric | |
| acceptance_criteria | text | |
| tags | text[] | |
| dependencies | bigint[] | otras tareas |
| sort_order | int | |
| created_at | timestamptz | |
| subtask_code_seq | int default 0 | watermark |

**Eliminados:** `actual_hours` (nadie registra horas sin cronómetro), `complexity` (se superpone con `estimated_hours`), `blockers`, `next_action`, `notes`, `planned_start_date`/`actual_start_date` (cuatro fechas por nivel es exactamente el campo que nadie llena; `start_date` + `due_date` + `completed_at` automático alcanza), `assignee_id` legacy (se elimina antes, ver etapa 0), `estimated_cost` (decisión de sesión 1N: se descarta, uso mínimo — la propuesta original de esta sección de mantenerlo y totalizarlo queda revocada).

### `subtasks`

| Campo | Tipo | Nota |
|---|---|---|
| id | bigserial | |
| task_id | bigint FK | |
| code | text | `S01` con padding 2 |
| title | text NOT NULL | |
| description | text | |
| status | enum | |
| is_blocked / blocked_reason | | |
| due_date | date | |
| completed_at | timestamptz | automático |
| checklist | jsonb default `[]` | ver abajo |
| sort_order | int | |
| created_at | timestamptz | |

**Eliminados:** `completed` (los datos lo confirman: 899 subtareas, ninguna con `completed=true` y estado distinto de `done`, y 173 con `done` sin tildar. Es un subconjunto estricto de `status`, nunca aporta información propia. El tilde de la UI pasa a leer y escribir `status`), `priority` (la hereda de su tarea), `estimated_cost`, `dependencies`, `notes`, fechas planned/actual.

**Checklist como JSONB, no como tabla.** Se pidió que no tengan responsable ni fechas: solo texto y tildado. Forma: `[{ id, text, done, order }]`. Una tabla significaría un cuarto nivel persistente, que el modelo prohíbe explícitamente, más su allocator y sus acciones. Reordenar es reordenar un array y una sola escritura. Si en el futuro hiciera falta consultarlos transversalmente, migrar JSONB → filas es un script SQL de una vez.

### `work_items`

Cuatro enums nuevos:

```
work_item_type      ∈ bug | debt | question_rfc
work_item_status     ∈ open | in_progress | awaiting_decision | resolved | discarded
work_item_severity   ∈ minor | major | blocker      (específico de bug)
work_item_impact     ∈ low | medium | high           (específico de debt)
```

Campos comunes a los tres tipos:

| Campo | Tipo | Nota |
|---|---|---|
| id | bigserial | |
| project_id | bigint FK | |
| type | enum | `bug / debt / question_rfc` |
| code | text | `BUG-014`, `TD-007`, `QRFC-004` — padding 3, contador propio por tipo |
| title | text NOT NULL | |
| description | text | |
| status | enum | `open / in_progress / awaiting_decision / resolved / discarded` |
| priority | enum | urgencia para resolver |
| created_by | bigint FK users | |
| created_at | timestamptz | |
| resolved_at | timestamptz | |
| sort_order | int | |
| generated_task_id | bigint FK tasks | la tarea que resuelve este item. Aplica a los tres tipos — ver D-18. |
| checklist | jsonb default '[]' | pasos menores, mismo formato que subtasks |

**`work_item_origins` y `generated_task_id` apuntan en direcciones
opuestas y no se unifican.** El origen dice dónde apareció el item; la
tarea generada, dónde se resuelve. Un bug detectado en `F0-T07` puede
arreglarse con una tarea en F3.

Específicos de **bug**: `severity` (gravedad técnica, distinta de `priority`), `environment`, `version`, `reproduction_steps`, `expected_behavior`, `actual_behavior`, `resolution`.

Específicos de **debt**: `impact` (enum), `proposed_solution`, `estimated_effort`, `target_phase_id`.

Específicos de **question_rfc**: `options`, `recommendation`, `final_decision`.

**Eliminados:** `detected_by` y `detected_at` (son `created_by` y `created_at`), `reproducible` (se deduce de si hay pasos), `reason` y `context` (los cubre `description`), `risk_if_not_resolved` (se superpone con `impact`), `generated_decision_id` (el ADR vive fuera, no hay tabla que referenciar — si hace falta, un campo de texto con la ruta).

**`technical_interest` eliminado.** El concepto —cuánto empeora la deuda con el tiempo— es real, pero como campo es una estimación subjetiva que nadie va a mantener actualizada, que es precisamente la prioridad de diseño #5. Se sustituye por algo objetivo y gratis: **antigüedad × impacto**. La antigüedad sale de `created_at` sin que nadie la escriba, y el impacto ya está. La UI muestra "abierta hace 94 días, impacto alto" en vez de pedir que alguien adivine una tasa.

### `work_item_origins`

Se pidió que un item pueda apuntar a más de un origen, lo que descarta las tres columnas `*_origin_id`.

```
work_item_origins (work_item_id, origin_type, origin_id)
origin_type ∈ phase | task | subtask
```

A diferencia de `work_items.type` y `work_items.status`, que son enums Postgres reales, `origin_type` es `TEXT` + `CHECK`, siguiendo el mismo patrón que `assignments.assignable_type` — necesario porque `origin_id` es polimórfico y no puede llevar un FK real.

El vínculo es **opcional**: se aceptó que existan items huérfanos a nivel proyecto.

### `assignments`

```
assignments (assignable_type, assignable_id, user_id)
assignable_type ∈ task | subtask | work_item
```

### `activity_log`

Histórico, que se pidió guardar. Deliberadamente mínimo:

```
activity_log (entity_type, entity_id, user_id, field, old_value, new_value, created_at)
```

Se escribe desde los server actions. No se versiona la fila entera, solo el campo que cambió.

---

## 4. Códigos

| Nivel | Formato | Padding | Único dentro de |
|---|---|---|---|
| Fase | `F0`, `F1` | ninguno | proyecto |
| Tarea | `T01` | 2 | fase |
| Subtarea | `S01` | 2 | tarea |
| Emergentes | `BUG-014`, `TD-007`, `QRFC-004` | 3 | proyecto, contador por tipo |

En base se guarda **solo el sufijo local** (`T08`). El código completo `F3-T08-S02` se compone al mostrar, encadenando los códigos de los padres.

**Al mover una tarea de fase, el código se realoca** — toma el siguiente del watermark de la fase destino. `F3-T08` movida a F5 pasa a ser `F5-T04`. El código viejo queda quemado en F3 y `activity_log` registra el cambio. Misma regla para subtareas movidas entre tareas.

**Watermarks, todos monotónicos** — nunca decrecen, nunca reutilizan, los códigos borrados quedan quemados:

- `projects`: `phase_code_seq`, `bug_seq`, `debt_seq`, `question_rfc_seq`
- `phases`: `task_code_seq`
- `tasks`: `subtask_code_seq`

**Lección obligatoria de la fase 8A:** el padding se calcula con ancho dinámico, `GREATEST(2, length(...))`. Un `lpad(seq, 2, '0')` fijo trunca cuando el contador pasa de dos dígitos y genera colisiones invisibles.

Y la regla de proceso: una migración que toca contadores **no se cierra porque el script corra sin error**. Se cierra cuando la query de verificación (contador vs. MAX real del sufijo) devuelve cero filas.

---

## 5. Cálculo del avance

```
subtarea    done o cancelled → 100, resto → 0
tarea       con subtareas    → promedio de sus subtareas
            sin subtareas    → 100 si done, 0 si no
fase        promedio de sus tareas, todas pesan igual
proyecto    promedio de sus fases + tareas sin fase, todas pesan igual
```

Se calcula al leer, **no se guarda**. Un `progress_percentage` almacenado se desincroniza en el primer borrado.

La carga emergente es la segunda métrica, separada (ver C-4).

---

## 6. UX

- Vista de proyecto: **fases colapsables**, tareas adentro, subtareas solo cuando existen.
- Debajo de las fases: sección "Sin fase", y las tres pestañas colapsables — Bugs, Deuda Técnica, Preguntas/RFC.
- **Drag & drop** para reordenar fases y tareas (`sort_order`).
- Un bug se crea **desde la tarea** donde apareció, con el origen prellenado.
- Vista global `/tasks`: tareas asignadas al usuario, con filtros.
- Edición inline. Sin modales pesados. Un componente con prop `type` para los tres emergentes.

---

## 7. Migración de los datos actuales

Todo lo que hay en producción son datos de prueba, así que la migración es simple y no necesita heurísticas:

| Origen | Destino |
|---|---|
| `tasks` actuales | `phases` — **se preservan los códigos `F0`, `F1`** |
| `subtasks` actuales | `tasks` — códigos nuevos `T01…` por fase |
| — | nivel subtarea arranca vacío |
| `subtask_assignees` | `assignments` con `assignable_type='task'` |
| `task_assignees` | se descarta (no hay asignados a nivel fase) |
| `subtasks.completed` | se descarta |

Se aceptó **un solo corte**, con la plataforma restringida mientras se ejecuta. Sin período de convivencia entre estructuras.

Las tasks actuales que eran realmente tareas y no fases quedan como fases y se reorganizan a mano después. Son datos de prueba: la limpieza manual es más barata que una heurística que se equivoque.

---

## 8. `import_project_tasks` y el formato JSON

El JSON anidado actual tiene `tareas` con `subtareas` adentro. **Bajo el modelo nuevo esa misma estructura mapea a fases con tareas** — el formato no cambia, solo cambian las tablas destino.

Eso permite mantener la compatibilidad que se pidió. Pero la función actual está escrita contra el modelo viejo y su semántica queda invertida: el ancla de estabilidad se rompe sola con la migración, sin que nadie la toque.

*Recomendación:* `import_project_tasks` se **congela y se deja de usar**; se crea `import_work_plan` al lado, que acepta el mismo JSON y escribe en la estructura nueva, más un nivel opcional de subtareas. Igual para `update_project_tasks`. `ImportTasksPanel.tsx` mantiene su prop `mode` y solo cambia a qué RPC llama.

---

## 9. Etapas

**Etapa 0 — limpieza previa (~1 hora, independiente).**
Borrar Drizzle: `git rm` de `drizzle.config.ts` y `src/db/*`, `rm` de `drizzle/` (no está trackeado), borrar `src/lib/types.ts` en el mismo commit —es el único que importa `src/db/schema` y nadie lo importa a él—, sacar los 4 scripts `db:*` y las 5 dependencias huérfanas. Eliminar `assignee_id` legacy, que ata `user-actions.ts` y `users/page.tsx`. Cerrar la nomenclatura de roles adoptando los reales.

**Etapa 1 — el corte (1 día largo).**
Migración SQL, `phases`/`tasks`/`subtasks`/`assignments`, allocators, adaptar los 9 archivos con acceso directo, adaptar `TaskRow.tsx`. Al final del día hay jerarquía de tres niveles funcionando.

**Etapa 2 — emergentes.**
`work_items`, `work_item_origins`, UI de las tres pestañas, creación desde la tarea, carga emergente en el dashboard.

**Etapa 3 — el resto.**
Drag & drop, `activity_log`, `import_work_plan`.

`TaskRow.tsx` no se parte antes: partirlo y migrarlo a la vez duplica el riesgo. Se migra tal cual en la etapa 1 y se evalúa después.

---

## 10. `dependencies`

Hoy se guarda, se resuelve en la importación y no hace nada — deuda #8.

*Recomendación:* mantenerlo en **fases y tareas**, eliminarlo de subtareas, e implementar únicamente un **aviso visual**: badge cuando una tarea pasa a `in_progress` con dependencias sin cerrar. Sin bloqueo duro, sin grafo, sin ruta crítica. Son unas veinte líneas, cierra la deuda y no convierte esto en Jira.

---

## 11. Checklist de cierre

Este documento pasa a CERRADO cuando:

- [x] C-1 código al mover → se realoca, el histórico guarda el cambio
- [x] C-2 bloqueo → booleano, no estado
- [x] C-3 tareas sin fase → `phase_id` nullable
- [x] C-4 dos métricas separadas
- [x] C-5 por etapas, sin fecha forzada
- [ ] Recortes de campos revisados uno por uno (sección 3)
- [ ] `import_work_plan` confirmado como función nueva (sección 8)

Recién entonces se escriben las migraciones.