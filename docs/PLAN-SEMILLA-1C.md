# Plan semilla — Etapa 1, paso 1C

**26 ago 2026.** Cierre de la sesión que ejecutó la migración 013c y el paso 1B.
Todo lo de acá pasó de verdad: se corrió, se verificó con queries que devuelven
filas y con la pantalla, y quedó commiteado.

Reemplaza a `PLAN-SEMILLA-1B.md` como documento de arranque. Ese sigue siendo
válido como registro de las decisiones D-1 a D-13, pero su §5 ("lo que queda
abierto") ya no describe el estado.

---

## 0. Cómo usar este documento

Adjuntarlo al chat nuevo. `docs/ARQUITECTURA-WORKPLAN.md` sigue siendo la fuente
del modelo, con las correcciones de la §3 del semilla 1B **más** las de la §4 de
acá.

**Aviso sobre `CLAUDE.md`:** sigue describiendo el modelo previo a la Etapa 1.
El parche de la §6 del semilla 1B nunca se aplicó — el documento no llegó al
repo. La §8 de acá trae el parche **consolidado**, que va del texto de la 8B
directo al estado post-1B. Aplicar ese, no el encadenado.

---

## 1. Estado del repo

Tres commits nuevos sobre `4bb5504`:

| Commit | Qué trajo |
|---|---|
| `migration: 013c reparar RLS en phases y assignments` | el SQL, ya ejecutado |
| `feat: modulo puro del work plan` | `src/lib/work-plan.ts` |
| `feat: fases en el detalle de proyecto (etapa 1, paso 1B)` | los 4 archivos de UI |

Sin SQL pendiente de correr. Ninguna migración a medias.

---

## 2. Estado de la base

Migraciones **013**, **013b** y **013c** aplicadas y verificadas.

```
proyectos    2
phases       5   (todas del proyecto 7)
tasks       37   (35 del proyecto 7 + 2 del proyecto 5)
subtasks   106
```

### Criterio de aceptación permanente

Verificado en pantalla el 26 ago. **Cualquier cambio futuro que altere estos
números sin explicación es un bug.**

| Fase | code | tareas | avance |
|---|---|---|---|
| Fase 0 | F0 | 8 | 21.3 % |
| Fase 1 | F1 | 5 | 0.0 % |
| Fase 2 | F2 | 4 | 0.0 % |
| Fase 3 | F3 | 4 | 0.0 % |
| SEO Técnico | F4 | 9 | 77.8 % |
| Sin fase | — | 5 | 100.0 % |
| **Proyecto 7** | | **35** | **19.8 %** |
| **Proyecto 5** | sin fases | **2** | **100 %** |

**El paso 1B+ dejó un código quemado, no una tarea.** La prueba de aceptación
creó `F2-T05` "Desarrollo motriz" —primera tarea nacida dentro de una fase
desde la UI, con el código correcto a la primera— y después se borró. Los
conteos volvieron a 35, pero `phases.task_code_seq` de F2 quedó en 5: es un
watermark monotónico y nunca decrece (D-11).

**Consecuencia para quien verifique el 1C:** la próxima tarea de F2 nace
`T06`, no `T05`. Es el diseño, no una falla del allocator.

### Postura de RLS — es MIXTA, y es el estándar real

| RLS | Políticas | Tablas |
|---|---|---|
| **off** | 0 | `users`, `projects`, `tasks`, `subtasks`, `phases`, `assignments` |
| **on** | 1 (`allow_all`) | `brand_settings`, `project_members`, `task_assignees`, `subtask_assignees` |

Toda la seguridad real es de aplicación. `CLAUDE.md §9` punto 1 describía solo
la mitad de derecha y por eso confundía.

---

## 3. Qué entregó el paso 1B

**`src/lib/work-plan.ts`** — módulo puro, sin acceso a base. Vive fuera de los
archivos de acciones porque esos llevan `'use server'` y solo pueden exportar
funciones async; mismo criterio que `update-normalize.ts`.

Exporta `composeCode`, `codeSortValue`, `taskProgress`, `phaseProgress`,
`projectProgress`, `buildWorkPlan`, y los tipos `PhaseWithTasks` y
`ProjectWorkPlan`.

**`getProjectWorkPlan(projectId)`** en `project-task-actions.ts` — devuelve el
árbol. `getProjectTasksFull` quedó **intacta y plana** a propósito:
`previewProjectUpdate` la recorre para armar sus mapas por código, y ese flujo
está congelado hasta la Etapa 3. Cambiarle la forma rompería un consumidor que
se va a reescribir igual.

**UI** — fases colapsables, sección "Sin fase" al final, modo plano para
proyectos sin fases, código compuesto en los 2 puntos de render de
`TaskRow.tsx`, que **no se partió**.

**Optimización de paso:** los tres `.filter()` anidados de `getProjectTasksFull`
eran O(n·m). Ahora son `Map` indexados una vez. Los seis
`eslint-disable-next-line` que los acompañaban se fueron con ellos; queda uno
solo, en `groupAssignees`.

---

## 4. Correcciones de hecho — no reabrir, son medidas

Se suman a las siete de `PLAN-SEMILLA-1B §3`.

8. **`task_status` no coincide con `ARQUITECTURA` C-2.** El enum real es
   `todo · in_progress · in_review · done · blocked`. No existe `cancelled` ni
   `pending`. La fórmula de §5 decía "done o cancelled → 100": contra esta base,
   solo `done` cuenta. `in_review` y `blocked` cuentan 0, y ninguno de los dos
   aparece en una sola fila hoy. Migrar el enum queda fuera de alcance.
9. **El formato del importador es `{ "tasks": [...] }` en inglés**, con `title`
   y `subtasks`. `ARQUITECTURA §8` hablaba de `tareas` / `subtareas`: era
   descripción informal, no el formato.
10. **La 013 creó `phases` y `assignments` con RLS habilitada y CERO políticas.**
    Copió el `ENABLE ROW LEVEL SECURITY` de `task_assignees` sin copiar su
    `CREATE POLICY`. Reparado por la 013c.
11. **`ProgressBar` es `{ done, total, className?, showLabel? }`**, y
    `showLabel` viene en `true` por defecto.
12. **La respuesta A2 del cuestionario tiene dos mitades, y C-3 leyó una.**
    Literal: *"No todas tienen que estar ligadas a alguna fase, para eso
    también tenemos los otros tres elementos: Bugs, Technical Debt,
    Questions / RFC"*. La sección C-3 cita la primera cláusula y no menciona
    los tres elementos ni una vez. Ver D-17.

---

## 5. Decisiones nuevas

| | Decisión | Estado |
|---|---|---|
| **D-5** | `subtasks.completed` se elimina. Verificado: cero filas sucias, y la tabla cruzada da una **biyección exacta** con `status='done'` (62 todo/false, 1 in_progress/false, 43 done/true). Cero información propia. | ✅ verde |
| **D-14** | La 014 es destructiva **y correctiva a la vez**: en la misma transacción dropea las columnas y republica `import_project_tasks` sin referencias a ellas. El barrido real es de **25+ puntos en 7 archivos**, no los 3 que listaba `PLAN-SEMILLA-1B §5.6`. Ver §6.3. | ⬜ |
| **D-15** | **Avance, regla C.** Las tareas sin fase **no entran** en el número del proyecto cuando el proyecto tiene fases; el bloque "Sin fase" muestra el suyo aparte. Un proyecto sin fases promedia sus tareas planas. Fase sin tareas → "—", nunca 0 %. Amienda `ARQUITECTURA §5`. La regla entera vive en `projectProgress()`. | ✅ |
| **D-16** | "Actualizar tareas" queda **como está** en el 1B y se resuelve en el 1C. Su direccionamiento por guion (`F3-T08`) murió con los códigos locales; hoy el botón solo puede terminar en error. Ver §6.2. | ⬜ |
| **D-17** | **Toda tarea nueva nace dentro de una fase.** El esquema mantiene `phase_id` nullable —hay 7 huérfanas vivas y el importador crea más— pero la UI deja de fabricarlas. "Sin fase" pasa a ser sala de espera, no destino. Amienda C-3. | ⬜ pendiente — decidido, sin implementar |
| **D-18** | **Los emergentes son planos.** Un `work_item` no tiene hijos. Bug, deuda y RFC **generan** una tarea dentro de una fase y quedan vinculados por `generated_task_id`; el trabajo vive en la jerarquía. Un solo árbol. Los tres suman `checklist jsonb`. | ⬜ Etapa 2 |
| **D-19** | **ABM de fases, y con él se cierra D-17.** "Nueva tarea sin fase" desaparece en todos lados; un proyecto con cero fases muestra "Crear primera fase". El modo plano pasa a ser estado heredado del proyecto 5, no una alternativa viva. | ⬜ paso 1C |

### El fundamento de D-15, para no reabrirlo

Medido sobre el proyecto 7, `ARQUITECTURA §5` literal —cada huérfana pesa como
una fase entera— daba **59.9 %**, poniendo el 83 % del numerador en 5 filas que
el relevamiento ya había clasificado como registros retroactivos de Handoff,
mientras tres fases con 13 tareas sin empezar aportaban cero. Mismo principio
que C-4: dos lecturas separadas, nunca fundidas en un porcentaje.

Amplitud medida entre las cuatro reglas candidatas: **40 puntos** sobre los
mismos datos. No era afinar decimales.

### El fundamento de D-17 y D-19, para no reabrirlos

El "para eso" de la respuesta A2 señala un destino: el trabajo suelto existe, y
su casa son los tres bloques emergentes, no una tarea huérfana.

Lo que **no** cambia: `phase_id` sigue nullable; D-15 queda reforzada;
`PLAN-SEMILLA-ETAPA1 §5` (F30–F34 como Handoff parqueado) queda reforzada;
D-7 pasa a ser explícitamente un puente, y `import_work_plan` importará a fase
en la Etapa 3.

**D-19 no revive la opción B de C-3.** Aquella era una fase-basurero "Sin
clasificar" conviviendo con fases reales. Esto es que la primera fase real la
crea el usuario, con nombre. Se parecen y no son lo mismo.

### El fundamento de D-18

`Bugs - task` se lee igual de bien como "el bug genera una tarea" que como "el
bug contiene tareas". La segunda lectura es una jerarquía paralela: allocator
nuevo, UI nueva, y rompe el máximo de tres niveles persistentes porque habría
dos árboles. La primera cuesta un campo y una acción.

---

## 6. Lo que queda abierto

### 6.0 Gate del botón de huérfanas — hacer esto primero

**D-17 está decidida y no implementada.** Verificado en el código: el botón
"Nueva tarea sin fase" del pie de la lista **no está gateado por la cantidad de
fases**. `hasPhases = workPlan.phases.length > 0` (`ProjectTasksClient.tsx:421`)
solo elige la *etiqueta* —`newTaskLabel`, línea 427— y el botón se renderiza
siempre. O sea que el proyecto 7, con sus 5 fases, sigue ofreciendo fabricar
huérfanas.

Alcance: el botón se renderiza **solo cuando el proyecto tiene cero fases**.
Con fases, el único camino de alta es el pie de cada `WorkSection`.

Cuidado con el proyecto 5: **depende de ese camino**. No tiene fases y sus dos
tareas se crean por ahí, así que el gate tiene que dejarlo pasar. El caso
"cero fases" se resuelve del todo recién en D-19, cuando pase a mostrar "Crear
primera fase".

### ~~6.1 Paso 1B+ — crear tareas dentro de una fase~~ · CERRADO

**Cerrado el 26 ago.** `createProjectTask` acepta `phaseId` y llama a
`alloc_task_code_in_phase`; `WorkSection` tiene su pie "Nueva tarea en esta
fase"; una fase vacía ahora abre y muestra solo el pie. Verificado en
pantalla: F2-T05 "Desarrollo motriz", código correcto a la primera.

Hoy toda tarea creada desde la UI nace **sin fase**, porque
`createProjectTask` llama a `alloc_task_code` —el allocator de huérfanas— y no
recibe `phaseId`. En el 1B el botón dice "Nueva tarea sin fase" para no mentir,
pero con 5 fases en pantalla la limitación duele.

`alloc_task_code_in_phase(p_phase_id)` **existe en la base desde la 013 y no la
llama nadie.** Se creó exactamente para esto. Sin SQL, sin migración.

Alcance, ~40 líneas en 2 archivos:

1. `createProjectTask` recibe `phaseId?: number`. Si viene, llama
   `alloc_task_code_in_phase({ p_phase_id: phaseId })` en vez de
   `alloc_task_code`, e inserta con `phase_id`.
2. `NewTaskRow` recibe `phaseId?: number` y lo pasa al server action.
3. Cada `WorkSection` suma un "Nueva tarea en esta fase" al pie, con su propio
   estado local.
4. El botón del pie de la lista sigue existiendo para las huérfanas.

**Cuidado con el contrato del contador:** `phases.task_code_seq` es POST-incremento
y `projects.phase_code_seq` es PRE. Están documentados con `COMMENT ON COLUMN`.
No unificarlos (D-11).

Criterio de aceptación: crear una tarea en F1 le da código `T06` (F1 tiene 5
tareas), aparece dentro de F1, y el avance de F1 baja de 0.0 % a 0.0 % —no
cambia, porque la tarea nueva no está `done`— mientras el conteo pasa a 6.

### 6.2 Paso 1C — ABM de fases

Crear, editar, borrar y reordenar fases (`sort_order`, que existe y nadie
consume). Mover tarea entre fases: **el código se realoca** del watermark de la
fase destino (C-1) y el cambio queda registrado.

Entra también:

- **`phase.status` y `phase.priority` en la UI.** El 1B los oculta a propósito:
  son columnas reales pero nadie las puede editar, y un badge "Pendiente" sobre
  una fase al 77.8 % confunde. Con ABM, se muestran.
- **"Actualizar tareas" (D-16).** Mínimo: deshabilitar el botón con la leyenda
  "Disponible de nuevo en la Etapa 3". El placeholder del panel todavía enseña
  `F3` y `F3-T08`, un formato que ya no existe.

### 6.3 Migración 014 — destructiva y correctiva

`DROP` de `start_date`, `estimated_cost` y `dependencies` en `tasks` y
`subtasks` (D-2); `DROP` de `subtasks.completed` (D-5, ya verde); `DROP` de
`task_assignees` y `subtask_assignees`.

**El barrido, completo.** Puntos que escriben o leen `completed`:

| Archivo | Punto |
|---|---|
| `project-task-actions.ts` | `createProjectSubtask` → `completed: data.status === 'done'` |
| `project-task-actions.ts` | `updateProjectSubtask` → el spread condicional |
| `import-schema.ts` | `updatableFields.completed` |
| `update-normalize.ts` | `SUBTASK_ONLY_FIELDS` queda vacío, y con él muere el `else` de `validateItemShape` |
| `update-normalize.ts` | `FIELD_LABELS.completed` |
| `update-normalize.ts` | `diffItem` → `'completed' in item` |
| `update-normalize.ts` | los dos `warnings` de status/completed |
| `types.ts` | `DbSubtask.completed` |
| `TaskRow.tsx` | checkbox, line-through y `toggleComplete` en `SubtaskRow` |
| `013b` | el INSERT de subtareas |

Sumando las otras tres columnas, son **25+ puntos en 7 archivos**.

Dos detalles que se pasan fácil:

- Al sacar `estimated_cost` de `diffItem`, el helper `sameNumber()` queda sin
  consumidor y el linter lo marca.
- El copy del importador dice "Las fechas (`start_date`, `due_date`) son
  opcionales". Después de la 014 es falso.

**Y el modo de falla peligroso:** si `completed` sale de la base pero queda en
`diffItem`, `row.completed` pasa a ser `undefined` y **la vista previa reporta
un cambio que no existe**. Compila, corre y miente.

**Orden obligatorio, invertido respecto de las aditivas:** push del código que
ya no usa nada de eso → verificar producción andando → recién ahí correr el SQL.

### 6.4 Divergencia del dashboard

El dashboard mide `tareas done / totales` y muestra el proyecto 7 en **12/35 ≈
34 %**. El detalle muestra **19.8 %**. Dos números del mismo proyecto en dos
pantallas.

No es un bug —son métricas distintas— pero se lee como uno.

*Recomendación:* reetiquetar la barra del dashboard a "tareas finalizadas" en
vez de migrarla a `getProjectWorkPlan`. Es más barato y más honesto: el
dashboard cuenta tareas, no mide avance del plan.

### 6.5 Deuda chica, viva

`allocCode` en `project-task-actions.ts` devuelve `null` si el RPC falla y el
insert omite la clave: una fila puede nacer **sin código** en silencio. Con
cuatro contadores la probabilidad sube. `composeCode` ya lo tolera —devuelve
`null` y la UI oculta el badge— pero la fila queda sin identidad.

### 6.6 El botón Importar sigue sin probarse end-to-end

Viene de `PLAN-SEMILLA-1B §5.2` y no se cerró: desapareció al cambiar de
documento. La 013b pasó su smoke test dentro de Postgres, pero nadie apretó
el botón en la app. Es barato y cierra la 013b de verdad.

---

## 7. Lecciones de proceso de esta sesión

1. **El editor SQL de Supabase bypassea RLS.** Una migración que crea tablas no
   se cierra verificando desde ahí. La 013, la 013b y su smoke test pasaron las
   tres mientras la app veía cero filas. La verificación tiene que leer con la
   misma llave que usa la app, o comprobar explícitamente `relrowsecurity` y el
   conteo de políticas.
2. **Al reemplazar una tabla, la política viaja con el flag.** La 013 copió
   `ENABLE ROW LEVEL SECURITY` de `task_assignees` y no copió su `CREATE POLICY`.
   La tabla nueva nació muda.
3. **RLS sin políticas falla en silencio.** No da error: da conjunto vacío. Y
   `syncTaskAssignees` hace `INSERT` sin chequear el error que devuelve, así que
   asignar responsables venía fallando sin decir nada desde `4bb5504`.
4. **El md5 es el gate correcto para SQL y el equivocado para TypeScript.** El
   editor de Supabase no compila nada, así que ahí el hash protege el
   transporte. En el repo, `tsc` atrapa el drift que rompe tipos y los números
   de aceptación atrapan el que rompe la fórmula. El hash no verifica ninguna
   de las dos.
5. **Un número de aceptación mal derivado cuesta una sesión.** Se fijó "37
   tareas" para el proyecto 7 cuando 37 era el total de los dos proyectos. El
   valor correcto era 35. La verificación en pantalla frenó por un fantasma.
6. **Una pestaña abierta sobrevive a la muerte de su servidor.** El bundle ya
   cargado responde y se ve idéntico a uno vivo, así que se diagnostica código
   que nunca corrió. El gate es el renglón `✓ Compiled /ruta`, no la pantalla.
7. **"No hay nada que corregir" es un resultado válido.** Ante un síntoma en
   pantalla y un fuente sano, la salida correcta es reportar la discrepancia,
   no fabricar un arreglo.

---

## 8. Parche consolidado a `CLAUDE.md`

> **⚠️ APLICADO — no volver a ejecutar.** Los ocho reemplazos se aplicaron
> el 26 ago 2026. `CLAUDE.md` ya está en estado post-1B. Esta sección queda
> como registro de qué cambió, no como instrucción pendiente.

`CLAUDE.md` está en el estado de la Fase 8B. Estos reemplazos lo llevan directo
al estado post-1B. **No aplicar antes el parche del semilla 1B: este lo incluye.**

### 8.1 Encabezado

Reemplazar `Última fase cerrada: **8B**.` por:

```
Última fase cerrada: **Etapa 1, paso 1B** (migraciones 013, 013b y 013c aplicadas).
```

### 8.2 Sección 6 — primera línea

Reemplazar la línea que empieza con `**8 tablas**` por:

```
**10 tablas:** `users`, `brand_settings`, `projects`, `phases`, `tasks`, `subtasks`, `assignments`, `task_assignees`, `subtask_assignees`, `project_members`.

`task_assignees` y `subtask_assignees` están **supersedidas** por `assignments` y se borran en la 014.

Los ids **no son todos bigserial**: `projects.id`, `tasks.id` y `subtasks.id` son `integer`; `phases`, `assignments` y las tablas de asignados son `bigint`. El mix es preexistente.
```

### 8.3 Sección 6 — campos reales

Reemplazar el bloque de tres viñetas por:

```
- `projects`: name, description, status, priority, owner_id, start_date, due_date, phase_code_seq, orphan_task_code_seq
- `phases`: project_id, code, name, objective, status, priority, start_date, due_date, completed_at, sort_order, task_code_seq
- `tasks`: title, description, status, priority, project_id, **phase_id (nullable)**, is_blocked, blocked_reason, start_date, due_date, estimated_cost, dependencies, code, **legacy_code**, **completed_at**, subtask_code_seq
- `subtasks`: igual + task_id + completed + legacy_code + completed_at; sin is_blocked ni blocked_reason
- `assignments`: assignable_type (`task | subtask | work_item`), assignable_id, user_id — UNIQUE sobre los tres
- `project_members`: project_id, user_id, rol_en_proyecto *(TEXT libre, no enum)*

`start_date`, `estimated_cost`, `dependencies` y `subtasks.completed` se eliminan en la 014.

**`task_status` real:** `todo · in_progress · in_review · done · blocked`. No existe `cancelled` ni `pending`.
```

### 8.4 Sección 6 — reemplazar "Códigos humanos legibles (Fase 8A)" entera

```
### Códigos humanos legibles (Etapa 1)

El código guardado es **local**. El compuesto (`F0-T03-S02`) se arma al mostrar, con `composeCode()` de `src/lib/work-plan.ts`.

| Nivel | Formato | Único dentro de | Contador | Contrato |
|---|---|---|---|---|
| Fase | `F0`, `F1` sin padding | proyecto | `projects.phase_code_seq` | PRE |
| Tarea en fase | `T01` padding 2 | fase | `phases.task_code_seq` | POST |
| Tarea sin fase | `T01` padding 2 | proyecto | `projects.orphan_task_code_seq` | POST |
| Subtarea | `S01` padding 2 | tarea | `tasks.subtask_code_seq` | POST |

**Los contratos PRE y POST son distintos a propósito. No unificarlos.**

Allocators: `alloc_phase_code`, `alloc_task_code` (sin fase), `alloc_task_code_in_phase`, `alloc_subtask_code`. Padding con ancho dinámico `GREATEST(2, length(...))`: un `lpad` fijo trunca y colisiona.

Watermarks monotónicos: nunca decrecen, los códigos borrados quedan quemados.

`legacy_code` guarda el código 8A previo (`F19`, `F19-T01`). Es anotación histórica: **nunca se muestra como código vivo.**
```

### 8.5 Sección 6 — tabla de funciones SQL de carga masiva

```
| Función | Migración | Estado |
|---|---|---|
| `import_project_tasks` | 010 → reparada en 013b | Ancla. Crea tareas **sin fase**. Valida códigos del payload. |
| `update_project_tasks` | 011 → congelada en 013b | Lanza excepción. Direccionaba por `F3-T08`, que ya no existe. Vuelve como `update_work_plan` en la Etapa 3. |
```

### 8.6 Sección 9 — deuda técnica

Reemplazar el punto 1 por:

```
1. La postura de RLS es **mixta**: `users`, `projects`, `tasks`, `subtasks`, `phases` y `assignments` la tienen **deshabilitada**; `brand_settings`, `project_members` y las dos tablas de asignados la tienen habilitada con una política `allow_all`. Toda la seguridad real es de aplicación.
```

Reemplazar el punto 13 por:

```
13. ~~`TaskWithSubtasks`~~ — **eliminado** en el paso 1A.
```

Agregar:

```
14. `allocCode` en `project-task-actions.ts` devuelve `null` si el RPC falla y el insert omite la clave: una fila puede nacer sin código en silencio.
15. El dashboard mide `tareas done / totales` y el detalle de proyecto mide avance del plan. Para el proyecto 7 son 34 % y 19.8 %. Métricas distintas, etiquetas parecidas.
```

### 8.7 Sección 10 — decisiones abiertas

Reemplazar el punto 1 por:

```
1. ~~Arquitectura del Work Plan~~ — **cerrada.** Modelo en `docs/ARQUITECTURA-WORKPLAN.md`; decisiones D-1 a D-16 en `docs/PLAN-SEMILLA-1B.md` y `docs/PLAN-SEMILLA-1C.md`. Tablas separadas para la jerarquía, `assignments` polimórfica, `work_items` única para lo emergente en la Etapa 2.
```

### 8.8 Sección 8 — agregar al final

```
### Las verificaciones tienen que devolver filas, y con la llave correcta

El editor SQL de Supabase **no muestra `RAISE NOTICE` ni `RAISE WARNING`**: una migración que verifica con NOTICE devuelve "Success. No rows returned" tanto si pasó como si no verificó nada. Toda verificación que tenga que leer un humano va en un `SELECT` aparte.

Y el editor **corre como superusuario y bypassea RLS**. Una migración que crea tablas no se cierra verificando desde ahí: la 013, la 013b y su smoke test pasaron las tres mientras la app, con la anon key, veía cero filas. Al crear una tabla que reemplaza a otra, la política se copia junto con el flag de RLS o la nueva nace muda.
```

---

## 9. Primer paso del chat nuevo

```txt
Proyecto follow-proyect — Etapa 1, paso 1C del Work Plan.

Adjunto PLAN-SEMILLA-1C.md, que es el estado real: migraciones 013, 013b y
013c aplicadas; pasos 1B y 1B+ verificados en pantalla y pusheados;
CLAUDE.md ya patcheado al estado post-1B — la §8 de este documento está
GASTADA, no volver a aplicarla.

Leelo antes de nada. Lo que está cerrado ahí no se rediscute: D-1 a D-19,
las doce correcciones de hecho, y el criterio de aceptación de la §2.

Objetivo de la sesión, en este orden:
  1. Lo que quede abierto de la §6.0 y la §6.6, si las hay.
  2. Paso 1C (§6.2): ABM de fases — crear, editar, borrar, reordenar.
  3. Mover tarea entre fases, con el código realocado del watermark
     destino (C-1).
  4. Cerrar D-19: "Nueva tarea sin fase" desaparece de todos lados; un
     proyecto con cero fases muestra "Crear primera fase".
  5. phase.status y phase.priority en pantalla.
  6. "Actualizar tareas" deshabilitado con leyenda (D-16).

Contexto operativo:
  - Claude Code puede bloquear Bash, Write y Edit por un clasificador que
    reacciona al contenido de la conversación. Mantener los prompts como
    trabajo de desarrollo normal: nada de descargas con hash, nada de SQL
    de permisos, nada de git.
  - Verificación en pantalla: hard reload y el renglón `✓ Compiled /ruta`
    en la terminal antes de creerle a lo que se ve. Una pestaña abierta
    sobrevive a la muerte de su servidor.
  - El SQL va a mi editor de Supabase. El git, a mi terminal.

Convención: todo bloque de código va precedido por su línea de destino.
  ▶ DESTINO: CLAUDE CODE 🤖 (terminal del repo)
  ▶ DESTINO: SUPABASE 👾 (SQL a mano, base única y viva)
  ▶ DESTINO: HUMANO 👽 (Hikashi)
```
