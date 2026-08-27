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
proyectos    3
phases       5   (todas del proyecto 7)
tasks       40   (35 del proyecto 7 + 2 del proyecto 5 + 3 del sandbox)
subtasks   108
```

### Criterio de aceptación permanente

Verificado en pantalla el 26 ago. **Cualquier cambio futuro que altere estos
números sin explicación es un bug.**

| Fase | code | tareas | avance |
|---|---|---|---|
| Fase 0 | F0 | 8 | 21.3 % |
| Fase 1 | F1 | 4 | 0.0 % |
| Fase 2 | F2 | 5 | 0.0 % |
| Fase 3 | F3 | 4 | 0.0 % |
| SEO Técnico | F4 | 9 | 77.8 % |
| Sin fase | — | 5 | 100.0 % |
| **Proyecto 7** | | **35** | **19.8 %** |
| **Proyecto 5** | sin fases | **2** | **100 %** |
| **Proyecto 9 — sandbox** | sin fases | **3** | **0.0 %** |

Corregida el 27 ago 2026. F1 y F2 estaban invertidas por la pérdida documentada
abajo. Los porcentajes no se mueven: las dos fases afectadas estaban y siguen en
0.0 %, y el promedio del proyecto sobre las cinco fases queda igual.

**Actualizado el 27 ago 2026, cierre de 1C-b.** Los conteos de tareas no se movieron: 35, 2 y 3. Lo que cambió son las fases: el proyecto 9 tiene ahora dos (`F0` "estructura y alcance modificado" y `F1` "desarrollo proyecto"), creadas desde la UI. El proyecto 5 recibió una fase por error y se borró con SQL; su `phase_code_seq` quedó en 1, así que **F0 está quemado ahí** y su próxima fase nacerá `F1` con `sort_order` 1 siendo la primera de la lista.

Consecuencia de alcance: el proyecto 5 dejó de ser plano durante unos minutos y volvió a serlo. Es el único que ejercita la rama sin fases, y por eso se revirtió — D-19 está fuera del alcance de 1C-b y no se decide de rebote.

### Watermarks y códigos quemados — 27 ago 2026

| Contador | Valor | Vivas | Quemados |
|---|---|---|---|
| `task_code_seq` F0 | 8 | 8 | — |
| `task_code_seq` F1 | 5 | 4 | T05 (era F18, borrada por error) |
| `task_code_seq` F2 | 5 | 5 | — |
| `task_code_seq` F3 | 4 | 4 | — |
| `task_code_seq` F4 | 9 | 9 | — |
| `orphan_task_code_seq` p7 | 6 | 5 | T06 |
| `orphan_task_code_seq` p5 | 3 | 2 | T03 |
| `orphan_task_code_seq` p9 | 7 | 3 | T03–T06 |
| `phase_code_seq` p5 | 1 | 0 | F0 (fase borrada) |
| `phase_code_seq` p7 | 5 | 5 | — |
| `phase_code_seq` p9 | 2 | 2 | — |

El sandbox estrena una clase de quemado que antes no estaba descrita: T03 a T06
nunca existieron. Los quemó el Pass 3 de la 013b al elevar el watermark por
encima del código explícito T07 que traía el payload. Quemado por elevación, no
por borrado.

### La tarea perdida — id 54, `legacy_code` F18

**Se borró una tarea real del proyecto 7 el 26 ago 2026, por error.** El commit
`6e372f5` ("docs: revertir conteos de la §2 tras borrar la tarea de prueba")
registra la intención de borrar la tarea de prueba. Lo que se borró fue otra fila.

`Desarrollo motriz` (id 249, F2-T05) **está viva**: creada 2026-08-26 23:57:15,
con `updated_at` idéntico al `created_at`. Nunca se tocó después de nacer.

La fila que falta es el **id 54**, `legacy_code` **F18**, que era **F1-T05**. Es
el único código del mapeo de la 013 sin fila viva.

Cómo se reconstruyó, para que nadie lo rehaga: los ids de las 34 tareas legacy
del proyecto 7 corresponden con su `legacy_code` por un offset fijo de 36, sin
excepciones y a ambos lados del hueco (53→F17, 55→F19). El único hueco de id en
el rango 36–70 es el 54.

**Alcance, medido:** F18 no tenía subtareas. `PLAN-SEMILLA-ETAPA1.md §5` declara
Fase 1 = 5 tareas / 13 subtareas, y las cuatro vivas de F1 suman exactamente 13.
Tampoco tenía responsables: no quedó un solo `assignment` huérfano. Se perdió un
título, un estado, una prioridad y sus fechas.

**No es recuperable.** El plan Free de Supabase no incluye backups.

Rastro para reconstruir el título: F18 no viene del JSON de importación original
—ese trae 16 tareas, cuatro por fase, y las cuatro de Fase 1 están vivas—. Nació
después, en la misma tanda que F19 ("Accesos sitio WEB showroommiami.com") y F20
("Determinar ADN o manual de marca"), ids 55 y 56. Pertenecía a Fase 1.

**Por qué el gate no lo vio:** una tarea real menos y una de prueba más se
compensaron y el total quedó en 35. La §2 se corrigió razonando desde la
intención en vez de volver a medir la tabla por fase, que sí lo habría mostrado.
Revertir un número en un documento no es re-medirlo.

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
| **D-16** | "Actualizar tareas" queda **como está** en el 1B y se resuelve en el 1C. Su direccionamiento por guion (`F3-T08`) murió con los códigos locales; hoy el botón solo puede terminar en error. Ver §6.2. Cerrado en 1C-b: botón `disabled` con `title="Disponible de nuevo en la Etapa 3"`. | ✅ |
| **D-17** | **Toda tarea nueva nace dentro de una fase.** El esquema mantiene `phase_id` nullable —hay 7 huérfanas vivas y el importador crea más— pero la UI deja de fabricarlas. "Sin fase" pasa a ser sala de espera, no destino. Amienda C-3. | 🟡 gate de UI aplicado el 26 ago (§6.0). Se cierra con D-19. |
| **D-18** | **Los emergentes son planos.** Un `work_item` no tiene hijos. Bug, deuda y RFC **generan** una tarea dentro de una fase y quedan vinculados por `generated_task_id`; el trabajo vive en la jerarquía. Un solo árbol. Los tres suman `checklist jsonb`. | ⬜ Etapa 2 |
| **D-19** | **ABM de fases, y con él se cierra D-17.** "Nueva tarea sin fase" desaparece en todos lados; un proyecto con cero fases muestra "Crear primera fase". El modo plano pasa a ser estado heredado del proyecto 5, no una alternativa viva. | ⬜ paso 1C |
| **D-20** | **Eliminar fase: bloqueo por defecto, cascada solo admin, atómica y autorizada en el servidor.** Una fase vacía se borra por el camino normal. Con tareas adentro, el borrado normal queda bloqueado, con el conteo en el mensaje. Existe un camino de cascada reservado a rol `admin`, con confirmación en dos pasos en la UI. La autorización se verifica **en el servidor**, contra la sesión, nunca contra un parámetro del cliente. La cascada corre en **una sola transacción** —`assignments` → subtareas → tareas → fase— y no se apoya en ningún `ON DELETE`. | ⬜ paso 1C |
| **D-21** | **Desacoplada del bloque de la cascada.** El gate de `updateUserRole` y `createUser` NO entra en 1C-c. D-20 se cierra con **garantía condicional** y la condición se escribe en el código, no solo acá. Ver el fundamento abajo. | ✅ resuelta |
| **D-22** | **Gate del módulo de usuarios**, paso propio. Convierte la garantía de D-20 de condicional en absoluta y es precondición de cualquier gate por rol posterior. Toca `updateUserRole`, `createUser`, `deleteUser` y probablemente el `TO anon` de las RPC (deuda 24). | ⬜ |

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

### El fundamento de D-20

`tasks.phase_id` declara `ON DELETE SET NULL`. Borrar una fase con tareas no las
borra ni falla: las suelta al namespace de códigos huérfanos del proyecto, donde
el índice único parcial `idx_tasks_project_orphan_code` sobre `(project_id, code)`
las hace colisionar. Los dos desenlaces posibles son malos: error crudo de clave
duplicada en pantalla, o dos T01 conviviendo si el índice no llegó a crearse.

De ahí las dos cláusulas. El bloqueo por defecto tiene precedente en el propio
repo: `deleteProjectTask` ya se niega a borrar una tarea con subtareas. Y la
fase se vacía moviendo tareas a otra fase —la funcionalidad del punto 3 del 1C—,
no soltándolas, que contradiría D-17 y D-19.

**La atomicidad no es una preferencia de estilo: es forzada.** `supabase-js`
habla PostgREST sobre HTTP y cada `.delete()` es una request, una transacción y
un commit propio. Cuatro deletes secuenciales en un server action son cuatro
transacciones; si el tercero falla, los dos primeros ya están commiteados y la
fase queda a medio borrar. El cliente JS no expone `BEGIN`/`COMMIT`. La única
forma de una transacción es una función plpgsql invocada con un solo `rpc()`.

**La cascada no puede apoyarse en la FK.** `tasks.phase_id` es `ON DELETE SET
NULL`: la base no borra, suelta. La función borra `assignments`, subtareas,
tareas y fase explícitamente, y con eso saltea deliberadamente la guarda de
subtareas de `deleteProjectTask`. Ese salteo es lo que justifica exigir admin y
dos pasos, no un detalle de implementación. Borrar explícitamente además hace
reales los conteos que la operación devuelve.

**El botón no es la frontera: el action lo es.** Un server action de Next tiene
su propio endpoint y es invocable con independencia de si la página que lo
renderiza escondió el botón. Ocultar por rol en la UI es UX, no seguridad —
misma confusión que ya registra la deuda 2. Y si la función SQL recibiera el rol
o el id de usuario como parámetro, cualquiera pasaría `admin`. La identidad se
deriva de la sesión, que el llamador no puede setear.

**Es el primer chequeo de rol sobre una acción destructiva de este repo.** Los
tres actions de borrado usan `createServerClient()` con anon key y no saben
quién pide el borrado. Dónde vive exactamente el chequeo —dentro de la función
SIGUIENDO `auth.uid()`, o en el action antes de invocarla— queda pendiente de
leer la capa de sesión: el vínculo Auth ↔ `users` es por email y no por UUID
(`CLAUDE.md §6`), y eso condiciona la resolución del rol.

**Lo que sale gratis:** la cascada no quema ningún código. Los códigos de las
tareas de una fase viven en `phases.task_code_seq`, que desaparece con la fila.
No hay contador que elevar. Es lo contrario del camino `SET NULL`, cuyo problema
era justamente el namespace del proyecto.

**Dónde vive el chequeo — resuelto por medición, 27 ago 2026.** Queda dentro
de la función. Una sonda invocada desde los dos clientes probó que
`createAuthServerClient()` propaga el email del JWT hasta el cuerpo de la
función, y que el cruce contra `public.users` resuelve el rol. La receta
completa de grants quedó en `CLAUDE.md §8`.

El chequeo del server action se conserva, pero cumple otra función: produce el
mensaje de error y habilita el flujo de dos pasos. La garantía la da el de
adentro, porque es el único que sobrevive a una llamada directa a PostgREST
con la anon key del bundle.

### El fundamento de D-21, para no reabrirlo

La cadena que motivaba bloquear es real: `updateUserRole` no verifica quién
llama (deuda 25), así que cualquiera con la anon key se pone `admin` y después
usa la cascada legítimamente. La función SQL no falla — hace exactamente lo que
debe: cruza el email del JWT contra `public.users` y encuentra `admin`. Lo
falso es la premisa que lee.

Lo que cambia la decisión es el alcance de esa cadena. El agujero no es "la
cascada es insegura", es "`users.role` es escribible por cualquiera". En ese
escenario un atacante ya edita roles y fabrica cuentas con service role;
borrar fases es de lo menos dañino que puede hacer. **La cascada no agrega
superficie: hereda una que ya está abierta y que hoy protege cosas más
valiosas que las fases.**

Y la ventaja de D-20 no es de grado sino de tipo. Los tres actions de borrado
actuales usan `createServerClient()` con anon key y no saben quién pide el
borrado. La cascada sería **el primer camino destructivo del repo con
identidad derivada de la sesión**. Implementarla con premisa débil deja el
repo mejor de lo que está; bloquearla hasta arreglar usuarios deja lo peor
exactamente igual, más tiempo.

**Obligación que deja abierta:** la función SQL de la cascada lleva un
comentario en su cuerpo declarando que su chequeo vale lo que valga la
integridad de `users.role`, con puntero a la deuda 25 y a D-22. La condición
vive en el código, no solo en este documento.

El argumento en contra, que se pesó: mezclar los dos permite escribir el
chequeo de rol una vez y probarlo una vez. Perdió contra el tamaño del bloque
— dos cirugías en la misma mesa.

---

## 6. Lo que queda abierto

### ~~6.0 Gate del botón de huérfanas~~ · CERRADO

**Cerrado el 26 ago.** El botón del pie de la lista se renderiza solo cuando el
proyecto tiene cero fases. Con fases, el único camino de alta es el pie de cada
`WorkSection`. La etiqueta quedó fija en "Nueva tarea" y `newTaskLabel` se borró.

**Fueron dos cambios, no uno.** El gate solo, tal como lo describía esta sección,
dejaba un botón muerto: el empty state del proyecto
(`workPlan.allTasks.length === 0 && !showNewTask`) esconde las fases y ofrece
"Crear la primera", que pone `showNewTask` en true, hace desaparecer el empty
state y cae a un pie que el gate ya no renderiza. Pantalla sin formulario y sin
salida salvo recargar.

La corrección no fue una guarda extra sino la condición: el empty state ahora
exige además `!hasPhases`. Un proyecto con fases y cero tareas ya no dice "No hay
tareas para este proyecto" — muestra sus fases vacías, cada una con su pie. Así
los dos únicos setters de `showNewTask` quedan dentro de bloques que exigen
`!hasPhases`, y la variable no puede volverse true sin un `NewTaskRow` que la
renderice.

Esa condición —cero fases y cero tareas— es el disparador que D-19 necesita para
poner "Crear primera fase". El punto 5 reemplaza el contenido de ese bloque, no
su condición.

**D-17 no queda cerrada acá.** El proyecto 5 sigue creando huérfanas por ese pie,
que es lo correcto hasta que exista el ABM. Se cierra con D-19.

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

### ~~6.2 Paso 1C-b — alta y edición de fases~~ · CERRADO

**Cerrado el 27 ago.** Dos archivos nuevos —`src/lib/supabase/phase-actions.ts` y `components/projects/PhaseForm.tsx`— y catorce ediciones en `ProjectTasksClient.tsx`. Sin SQL: `alloc_phase_code` existía desde la 013 y nadie la llamaba.

**La primera escritura real contra `phases` desde la app.** Las cinco filas previas entraron por un INSERT del editor SQL, que corre como superusuario; ésta usa la anon key. Era el cuadrante que la 013c ya hizo fallar una vez, y pasó.

Verificado en pantalla, cuatro pruebas: alta (F0 y F1 en el proyecto 9), edición de los cinco campos con `code`/`sort_order`/`task_code_seq` intactos, D-16 gris con leyenda, y el empty state sobre un proyecto descartable ya borrado.

**`sort_order` se deriva del sufijo del código**, no queda en el DEFAULT 0. Con una sola fase los dos escenarios son indistinguibles —incluso en pantalla, porque `byCode` desempata—; la segunda fase lo partió: F1 salió con `sort_order` 1.

**Dos guardas, no una.** El botón "Nueva fase" vive en la cabecera, fuera del ternario del empty state, así que el formulario necesitó `!showNewPhase` en la condición del empty state para no ser un botón muerto. Y una vez abierto, el pie "Nueva tarea" seguía visible porque solo lo guardaba `!hasPhases`: la pantalla ofrecía crear una huérfana mientras se creaba la primera fase. Los dos bloques que compiten por ese espacio llevan ahora el mismo término. Es la tercera vez que este archivo pide gatear una condición además de esconder un botón.

**`createPhase` aborta si el RPC falla y no inserta.** Es deliberadamente lo contrario de `allocCode` en `project-task-actions.ts`, que devuelve null y deja nacer una fila sin código (deuda 14). No unificarlos sin decidirlo.

Quedó fuera y sigue abierto: reordenar fases (paso propio, con subir/bajar, sin librería), borrar fases (1C-c, D-20 y D-21), y D-19.

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

**Cuidado con `showNewTask` al crear una fase.** El estado del pie de alta de la
lista sobrevive a un cambio de `hasPhases`. Hoy es inalcanzable porque no hay
forma de crear una fase desde la UI, pero con el ABM: proyecto sin fases, el
usuario abre "Nueva tarea" y escribe, crea una fase, `hasPhases` pasa a true y el
formulario desaparece con lo escrito adentro. Crear una fase tiene que apagar ese
estado.

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

### ~~6.6 El botón Importar sigue sin probarse end-to-end~~ · CERRADO

**Cerrado el 27 ago sobre el proyecto 9 (sandbox).** Delta declarado antes de
importar y cumplido en los siete puntos: tres tareas T01, T02 y T07; dos
subtareas S01 y S02 bajo la primera; las tres con `phase_id` NULL; prioridad
`high` normalizada desde "Alta"; subtareas de la base 106 → 108; proyecto 7
intacto en 35; y `orphan_task_code_seq` en **7**, que era el control positivo —
solo llega a 7 si el Pass 3 eleva el watermark por encima del código explícito.
El modo de falla que temía esta sección no existe.

Segunda prueba, la del error: un payload con `"code": "F3"` pasa la vista previa
**en verde** ("Se crearán 1 tarea y 0 subtareas") y recién revienta al confirmar,
con el mensaje crudo de Postgres íntegro hasta el "Quitá el campo". Cero filas
escritas. Confirmado en pantalla que la vista previa no valida códigos y que el
error del RPC viaja intacto del SQL al usuario. Detalle menor: el recuadro verde
no desaparece cuando aparece el rojo; conviven diciendo cosas opuestas.

Viene de `PLAN-SEMILLA-1B §5.2` y no se cerró: desapareció al cambiar de
documento. La 013b pasó su smoke test dentro de Postgres, pero nadie apretó
el botón en la app. Es barato y cierra la 013b de verdad.

**Verificar antes de apretar:** si `import_project_tasks` avanza
`projects.orphan_task_code_seq` o solo valida los códigos del payload. Si no lo
avanza, importar mete códigos que el contador no conoce y la próxima huérfana
colisiona en silencio — el modo de falla del seeding de contadores. Y declarar el
delta de conteos antes de importar: §2 dice que un número que cambia sin
explicación es un bug.

### 6.7 Orden de lo que viene

**C-1 bloquea 1C-c, y esa dependencia sí es dura.** D-20 dice que una fase se
vacía moviendo tareas a otra fase, no soltándolas — soltarlas las manda al
namespace de códigos huérfanos, que es el problema que D-20 existe para
evitar. Sin C-1, el bloqueo por defecto no tiene salida: una fase con tareas
queda imborrable.

1. **C-1** — mover tarea entre fases, con el código realocado del watermark
   de la fase destino. Le da salida al bloqueo de D-20.
2. **1C-c** — borrar fase: bloqueo por defecto, cascada admin, función
   transaccional, UI de dos pasos. Ya no lo bloquea D-21.
3. **D-22** — gate del módulo de usuarios.
4. **Reordenar fases** (subir/bajar, sin librería) y **D-19**.

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
8. **Una copia que puede desfasarse, se desfasa.** Los archivos del proyecto
   de Claude.ai eran copias subidas a mano: ningún `git push` las toca, y un
   chat nuevo que las lea razona sobre el estado anterior sin saberlo. Ya
   falló en las dos direcciones — el parche de la 1B §6 nunca llegó al repo,
   y el de la 1C nunca llegó al proyecto.
   **Regla: el repo local es la única fuente para las dos capas.** Claude Code
   lo lee del disco; la capa de conversación recibe los documentos como
   adjunto desde la carpeta del repo, en el primer mensaje. Los archivos del
   proyecto quedan vacíos a propósito.
   Cerrar sesión son dos movimientos, no tres: commit y push.
9. **El `git status` del agente es un reporte, no el estado.** En esta sesión
   Claude Code informó cinco veces un árbol que ya no existía: seguía viendo
   `M docs/PLAN-SEMILLA-1C.md` después de que el commit y el push ocurrieran en
   otra terminal. No miente — mira el snapshot de cuando arrancó su turno, y el
   git vive fuera de su sesión. Antes de commitear, el `git status` que vale es
   el de la terminal propia. Sus números sí sirven: las líneas cambiadas
   reconciliaron con git a la primera.

10. **Un número que la pantalla no puede falsar necesita la query.** `sort_order`
   derivado y `sort_order` en su default dan el mismo render, porque el
   desempate por código los vuelve indistinguibles. La verificación en pantalla
   es necesaria y no siempre suficiente: cuando dos hipótesis producen el mismo
   píxel, el gate es la base.

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
Proyecto follow-proyect — Etapa 1, paso C-1 del Work Plan.

Adjunto PLAN-SEMILLA-1C.md, que es el estado real: migraciones 013, 013b y
013c aplicadas; pasos 1B y 1B+ y el gate de la §6.0 verificados en pantalla
y pusheados, HEAD en 75dfe20; CLAUDE.md ya patcheado al estado post-1B — la
§8 de este documento está GASTADA, no volver a aplicarla.

Leelo antes de nada. Lo que está cerrado ahí no se rediscute: D-1 a D-19,
las doce correcciones de hecho, y el criterio de aceptación de la §2.

Objetivo de la sesión:
  1. C-1 — mover tarea entre fases, con el código realocado del
     watermark destino. Es lo que le da salida al bloqueo de D-20.

Ya cerrado y fuera de discusión: §6.0, §6.1, §6.6, §6.2 (1C-b: alta y
edición de fases, D-16), y D-21, que quedó desacoplada de la cascada.
Pendiente después de C-1: 1C-c (borrar fase), D-22 (gate de usuarios),
reordenar fases y D-19.

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
