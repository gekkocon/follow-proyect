# Plan semilla — 1E: cerrar 1D-a

**27 ago 2026.** Nace al cerrar el paso 6 de 9 de 1D-a.

`PLAN-SEMILLA-1D.md` queda **congelado** como registro: se consulta, no se
amplía. `docs/ARQUITECTURA-WORKPLAN.md` sigue siendo la fuente del modelo.

---

## 0. Cómo usar este documento

Adjuntarlo al chat nuevo junto con `CLAUDE.md`, los dos desde la carpeta del
repo. Pegar el bloque de la §7 verbatim.

Lo cerrado no se rediscute: D-1 a D-46.

---

## 1. Estado al arrancar

**El HEAD lo lee el terminal, no este documento.**

| | |
|---|---|
| Último paso cerrado | 1D-a, paso 6 de 9 |
| SQL pendiente | ninguno |
| Migración más alta | 013e. No existe 014. |

**Conteos medidos el 27 ago 2026, después del paso 6. Volver a medirlos.**

| Proyecto | Fases | Tareas | Huérfanas | `phase_code_seq` | `orphan_task_code_seq` |
|---|---|---|---|---|---|
| 5 | 0 | 2 | 2 | 1 — F0 quemado | 3 |
| 7 | 5 (F0–F4) | 35 | 5 | 5 | 6 |
| 9 | 1 (F1) | 3 | 1 | 4 | **8** |

**Total de huérfanas: 8.** Son 3 proyectos, no 4: el proyecto 12 fue una
prueba ya borrada.

`phases.task_code_seq` de p9·F1 quedó en **3** tras la prueba del paso 5.
Contadores de p7 sin cambios: F0 8, F1 5, F2 5, F3 4, F4 9.

---

## 2. Lo que 1D-a ya cerró

**Pasos 1 a 6 de 9, todos verificados en base y en pantalla.**

1. **Medición.** V1 a V8, V10 a V14.
2. **`createAuthServerClient` en el importador.** `project-import-actions.ts`,
   solo `importProjectTasks`. `updateProjectTasks` sigue con anon.
3. **Migración 013e.** Sobrecarga `import_project_tasks(bigint, jsonb, bigint)`,
   fase destino obligatoria y sin default. Pass 3 resiembra
   `phases.task_code_seq`, no `projects.orphan_task_code_seq`. `EXCEPTION WHEN
   unique_violation` con mensaje en castellano. `REVOKE` a PUBLIC y a `anon` por
   nombre, `GRANT` a `authenticated`.
4. **Select de fase destino obligatorio** en `ImportTasksPanel`. Nativo, con
   `<option value="">` de placeholder. `resetPreview()` en su `onChange`.
   `canConfirm` exige `phaseId !== null`.
5. **Primera importación dentro de una fase**, probada extremo a extremo.
6. **Cierre de la última fábrica de huérfanas.** Tres ediciones en
   `ProjectTasksClient.tsx`: borrado del pie de alta sin fase, empty state
   reescrito, botón Importar deshabilitado sin fases.

**Queda UN solo `<NewTaskRow>` en el repo**, en `ProjectTasksClient.tsx:443`,
y recibe `phaseId`. Ninguna vía de UI crea tareas huérfanas.

---

## 3. Lo que falta: pasos 7, 8 y 9

**Paso 7 — crear la primera fase del proyecto 5.**
Nace como **F1**, no F0: `phase_code_seq` está en 1 y el contrato de fase es
PRE. Nombre pendiente de decidir. Evitar "Fase 1": F0–F3 de p7 se llaman así y
es deuda de claridad.

**Paso 8 — mudar las 8 huérfanas. EL ORDEN ES VINCULANTE.**
Los códigos salen del watermark en el momento del click. Mover en otro orden
produce otros códigos. `moveTaskToPhase` **sobrescribe el `code` viejo** y no lo
guarda en ningún lado: esta tabla es su único registro. `legacy_code` conserva
F30–F34 y no se toca (D-37).

| Orden | Tarea hoy | id | legacy | Destino | Código previsto |
|---|---|---|---|---|---|
| 1º | p5·T01 Investigar conexión Workana | 12 | F0 | p5 · fase del paso 7 | T01 |
| 2º | p5·T02 GPT generador de propuestas | 13 | F1 | p5 · fase del paso 7 | T02 |
| 1º | p7·T01 GBP ajustes 30 jul | 66 | F30 | p7 · F0 | T09 |
| 2º | p7·T02 Manual de Marca | 67 | F31 | p7 · F0 | T10 |
| 3º | p7·T03 Infraestructura y accesos | 68 | F32 | p7 · F0 | T11 |
| 4º | p7·T04 GBP reseñas | 69 | F33 | p7 · F0 | T12 |
| 5º | p7·T05 Blog infra + editorial | 70 | F34 | p7 · F0 | T13 |
| 6º | p9·T07 Sandbox C | 253 | — | p9 · F1 | T03 |

Estado esperado al cerrar: **la fase nueva de p5 con 2 tareas y
`task_code_seq` 2**; **p7·F0 con 13 tareas y `task_code_seq` 13**;
**p9·F1 con 3 y contador 3**.

**Las ocho filas van en el orden de la tabla, empezando por las dos de p5.**
Los números de orden 1º a 6º de las filas de p7 y p9 quedaron corridos: leer
la tabla de arriba hacia abajo, no por su número. Las dos de p5 son las únicas
que NO pierden su código: la fase del paso 7 nace con `task_code_seq` en 0, así
que reciben T01 y T02, los mismos que tienen hoy (D-46).

Los destinos 4º y 5º eran los dudosos: si alguno cambia de fase, **recalcular
los códigos de los que le siguen antes de mover**.

**Paso 9 — cierre.** `select count(*) from tasks where phase_id is null` = **0**.

---

## 4. Limpiezas cosméticas pendientes

Ninguna urgente. Las tres juntas, en una sola edición, después del paso 9.

1. `ProjectTasksClient.tsx` — dos líneas en blanco consecutivas en la juntura
   del bloque borrado (693-694).
2. `ProjectTasksClient.tsx:701` — `setShowNewTask(false)` inerte en el
   `onSaved` del `PhaseForm`. El `showNewTask` del padre quedó congelado en
   `false`: nada lo prende. Sus cuatro lecturas (562, 575, 590, 608) son
   tautologías.
3. `ImportTasksPanel.tsx` — `setImporting(true)` y `setImportError(null)`
   duplicados, uno por rama del if/else de `handleConfirm`.

---

## 5. Decisiones cerradas en 1D-a

- **D-33** — partición 1D-a / 1D-b confirmada. El `NOT NULL` no puede llegar
  antes de que el importador sepa de fases.
- **D-34** — las 8 se mudan a mano, sin fase "Sin clasificar" autocreada.
- **D-35** — el importador recibe `p_phase_id` obligatorio; el payload no lleva
  códigos de fase. Enmienda: 013e también resiembra `phases.task_code_seq`.
- **D-36** — el bloque "Sin fase" queda de **solo lectura mínima** durante
  1D-a: no se crean, se gestionan las existentes. Costo cero: `isPhase` ya lo
  impedía. Desaparece en 1D-b.
- **D-37** — `legacy_code` no se toca al mudar. El código huérfano se pierde y
  su registro es la tabla de la §3.
- **D-38** — proyecto sin fases: "Crear la primera fase" habilitado; "Importar
  varias" visible pero deshabilitada, con la leyenda debajo. **El bloqueo se
  comunica antes de entrar, no adentro.**
- **D-39** — 1D hereda las deudas 16, 17, 24 y 25. 013e no re-otorga `anon`:
  no es un gate, es no regresar.
- **D-40** — las 5 huérfanas de p7 van a fases existentes F0–F4; p9·T07 se muda
  a F1. Cero borrados.
- **D-41** — el cambio de cliente va antes del SQL, y solo. Aislamiento de
  diagnóstico, no de seguridad.
- **D-42** — los permisos se verifican con `has_function_privilege`, no solo
  con `proacl`: resuelve PUBLIC y la herencia de roles.
- **D-43** — los guiones de WorkGPT declaran el parche de `window.confirm` por
  adelantado. El pane auto-descarta los `confirm()` nativos devolviendo `false`.
- **D-44** — la detección de duplicados del importador es **project-wide**, no
  phase-scoped. La fase destino no acota el preview.
- **D-45** — cuando la terminal del dev server no sea accesible, el gate de
  compilación se cumple con el `mtime` del artefacto compilado de la ruta
  (`.next/server/app/(dashboard)/projects/[id]/page.js`) comparado contra la
  hora del sistema. Es evidencia directa; el renglón `✓ Compiled /ruta` es
  indirecta.
- **D-46** — las 2 huérfanas del proyecto 5 se mudan a la fase que crea el
  paso 7, y van primero en el orden. Son las únicas dos de las ocho que
  conservan su código: la fase nueva nace con `task_code_seq` en 0, así que
  reciben T01 y T02, los mismos que tienen hoy.

---

## 6. Correcciones de hecho, cerradas en 1D-a

1. **Los watermarks POST guardan el ÚLTIMO usado.** Medido en vivo: alocar T08
   dejó el contador en 8 con deriva 0, y borrar la tarea lo dejó en deriva 1. El
   `+1` de p5 y p7 no es residuo de migración: es **una huérfana borrada en cada
   uno**. El hueco T06 de p7 encaja exacto.
2. **Las secuencias de id NO son transaccionales; los contadores en columna,
   sí.** `tasks_id_seq` quedó en 257 con `MAX(id)` 253. Que
   `orphan_task_code_seq` valiera exactamente 8 prueba que hubo **una sola**
   asignación exitosa.
3. **Los cuatro índices únicos de código son parciales, con
   `WHERE code IS NOT NULL`.** Una fila sin código es invisible para la
   unicidad. Hoy hay cero, pero la deuda 14 permite que nazca una y el
   `phase_id NOT NULL` de 1D-b no la tapa. Candidata a `code NOT NULL` en la
   misma migración.
4. **Un contador de fase atrasado NO falla en silencio: falla ruidoso y feo.**
   El índice único rechaza con 23505 crudo y cada intento quema un código hasta
   curarse solo. El reseed de 013e es por UX, no por integridad.
5. **`z.object` descarta claves desconocidas en silencio.** Una `phase_id` en el
   payload del importador no daría error: se perdería. Por eso el destino viaja
   como argumento.
6. **El "runtime error" de Fast Refresh era el 404 de un proyecto borrado**, no
   el work plan. `/projects/5` carga con la consola limpia salvo el ruido de
   Service Worker. Hilo cerrado.
7. **Dos puertas convergen en una fábrica.** El pie de alta y el botón "Crear la
   primera" del empty state prendían el mismo `showNewTask`. Cerrar una sola
   habría dejado un clic sin efecto y sin error. Es la misma forma del hallazgo
   de D-17 en 1C.

---

## 7. Primer paso del chat nuevo

    Proyecto follow-proyect — 1E: cerrar 1D-a (pasos 7, 8 y 9).

    Adjunto PLAN-SEMILLA-1E.md y CLAUDE.md. El estado real es el de su
    §1; el HEAD lo leo de mi terminal, no del documento.

    El semilla 1D está CONGELADO: registro de D-1 a D-45.

    Objetivo: cerrar 1D-a. En este orden:
      1. Re-medir el estado de la §1 contra la base antes de escribir nada.
      2. Paso 7: crear la primera fase del proyecto 5. Nace como F1.
      3. Paso 8: mudar las 8 huérfanas EN EL ORDEN de la tabla de la §3.
      4. Paso 9: count(*) where phase_id is null = 0.

    El paso 8 es el único irreversible de todo 1D-a: base única, sin
    backups, y moveTaskToPhase sobrescribe el código viejo.

    Contexto operativo:
      - Claude Code puede bloquear Bash, Write y Edit por un clasificador.
        Prompts como trabajo de desarrollo normal: nada de descargas con
        hash, nada de SQL de permisos, nada de git.
      - Verificación en pantalla: hard reload y el renglón
        `✓ Compiled /ruta`, o el mtime del artefacto compilado (D-45).
      - Ruido de consola: error en la carga = ruido; tras un click = parar.
      - El SQL va a mi editor de Supabase. El git, a mi terminal.
      - Las pruebas de navegador van a WorkGPT como guion paso a paso, con
        el parche de window.confirm declarado por adelantado (D-43).
      - Cuando dos hipótesis producen el mismo píxel, el gate es la base.
      - Declarar los números esperados ANTES de correr la query.
      - Todo archivo del repo lo modifica Claude Code, con anclas que
        exijan exactamente una coincidencia. Un ancla por subcadena no
        distingue código de comentario: declarar la expectativa sobre
        líneas que no empiecen con --.

    Convención: todo bloque de código va precedido por su línea de destino.
      ▶ DESTINO: CLAUDE CODE 🤖 (terminal del repo)
      ▶ DESTINO: SUPABASE 👾 (SQL a mano, base única y viva)
      ▶ DESTINO: WORKGPT 👁️ (pruebas de navegador)
      ▶ DESTINO: HUMANO 👽 (Hikashi)

---

## 8. Cierre — 27/28 ago 2026

Pasos 7, 8 y 9 completados y verificados extremo a extremo.

- Paso 7: fase F1 "Estructura" creada en proyecto 5, `task_code_seq` inicial 0.
- Paso 8: las 8 huérfanas movidas en el orden de la §3. Siete coincidieron
  exacto con el código previsto. La octava (p9·T07 Sandbox C, id 253) salió
  como **F1-T04**, no F1-T03 como preveía la tabla: el `task_code_seq` de
  p9·F1 medido en la §1 (valor 3) ya reflejaba un código quemado por la
  prueba del paso 5 de 1D-a, dato que la tabla de la §3 no propagó a su
  forecast. No es un defecto de la app — es la misma aritmética POST
  verificada en las siete filas anteriores.
- Paso 9: `select count(*) from tasks where phase_id is null` devolvió 0 en
  toda la base, no solo en los tres proyectos tocados.

**1D-a queda cerrado.** Este documento pasa a estado congelado, igual que
1D-b lo hizo con 1D-a: se consulta, no se amplía.
