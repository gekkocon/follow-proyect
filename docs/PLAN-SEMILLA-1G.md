# Plan semilla — 1G: gate de rol + membresía en los tres allocators restantes

**28 ago 2026.** Nace al cerrar deuda 25. Continúa desde el corte
limpio tras 1G paso 1 + 1b.

`PLAN-SEMILLA-1F.md` sigue **congelado**.

---

## 1. Estado al arrancar

**El HEAD lo lee el terminal, no este documento.**

| | |
|---|---|
| Último commit conocido | c3f81dc (1G paso 1b) |
| SQL pendiente | ninguno aplicado; el de la receta de 6 pasos está diseñado pero no escrito en forma final |
| Datos de prueba | limpios — fase F2, tarea F1-T04, subtarea F1-T04-S01 del proyecto 5, todas borradas y verificadas en 0 filas |

## 2. Qué ya está cerrado (no rediscutir)

- **Deuda 25** cerrada (commits 6a2897f, b8882d6, aca36b9).
- **Diseño de autorización** para los tres allocators (cerrado con
  Hikashi, no volver a preguntar):
  - `alloc_phase_code`: gate por `role IN ('admin','pm')`. Sin
    chequeo de membresía.
  - `alloc_task_code_in_phase` y `alloc_subtask_code`: gate por
    `role IN ('admin','pm','developer','designer')` **y**
    (`role = 'admin'` **o** fila en `project_members` para el
    `project_id` resuelto vía `phase_id` / `task_id → phase_id`).
  - `rol_en_proyecto` no participa — confirmado sin uso en control
    de flujo en todo el repo.
- **1G paso 1 + 1b, completo:** los CUATRO call sites de estos tres
  allocators (no tres — `moveTaskToPhase` se sumó en 1b) ya invocan
  con `createAuthServerClient()`, no `createServerClient()`.
  Verificado manualmente en el navegador, tsc/lint limpios en las
  dos sesiones. Commits `1f8ddf8` (paso 1: `createPhase`,
  `createProjectTask`, `createProjectSubtask`) y `c3f81dc` (paso 1b:
  `moveTaskToPhase`).
- **`tasks.phase_id`** y **`phases.project_id`**: confirmado 0 filas
  nulas en ambas, medido el 28 ago 2026. El join
  `task → phase → project` es seguro sin manejo especial de
  huérfanas.
- **Definiciones completas de las tres funciones**, medidas el 28
  ago 2026 (pegar de este chat si hace falta reconstruirlas):
  `alloc_phase_code` (PRE-incremento), `alloc_task_code_in_phase` y
  `alloc_subtask_code` (POST-incremento, ancho dinámico
  `GREATEST(2, length(...))`). Ninguna tiene `SECURITY DEFINER`
  declarado — son invoker por default de plpgsql, confirmar si hace
  falta declararlo explícito o alcanza con el default.

## 3. Lo que falta, en orden

1. **Verificar en prod** que el código de 1G paso 1/1b (cuatro call
   sites con `createAuthServerClient()`) sigue funcionando igual
   que antes del cambio — crear/mover fase, tarea, subtarea como
   admin, sin errores visibles. Sin SQL nuevo todavía, este paso no
   debería cambiar nada observable.
2. **Antes de escribir el SQL del gate: localizar la sonda mencionada
   en `CLAUDE.md` §8** ("medida extremo a extremo el 27 ago 2026 con
   una sonda, en los cuatro cuadrantes"). Si existe como archivo en
   `/migrations` o como función todavía viva en la base, usar esa
   sintaxis exacta de `request.jwt.claims ->> 'email'` para las tres
   funciones nuevas — no reescribirla de memoria. Si no se encuentra
   el archivo, grep de `request.jwt.claims` en todo `/migrations` y
   en `schema.sql`.
3. **SQL, receta de 6 pasos de `CLAUDE.md` §8**, sobre las tres
   funciones, con el gate ya diseñado en la §2: `SECURITY INVOKER`
   explícito, chequeo de rol/membresía en el cuerpo (usando la
   sintaxis confirmada en el paso 2), `REVOKE EXECUTE ... FROM anon`
   por nombre, `GRANT EXECUTE ... TO authenticated`.
4. **Verificar `pg_proc.proacl`** después de cada función, y probar
   el camino bloqueado (un usuario con rol operativo sin membresía
   en el proyecto, intentando crear tarea/subtarea ahí) además del
   camino permitido. Necesita una cuenta de prueba no-admin con
   contraseña conocida — no se pudo verificar el camino negativo en
   deuda 25 por falta de esto; si sigue faltando, decidir si vale la
   pena crear una cuenta de prueba dedicada.
5. **Registrar en `CLAUDE.md`:** cerrar deuda 24, listar los cuatro
   call sites corregidos (no tres), referenciar todos los commits.

## 4. Primer paso del chat nuevo

    Proyecto follow-proyect — 1G, continuación: SQL del gate de rol
    + membresía en los tres allocators restantes.

    Adjunto PLAN-SEMILLA-1G.md (versión actualizada tras 1G paso 1
    y 1b) y CLAUDE.md. El estado real es el de su §1; el HEAD lo
    leo de mi terminal, no del documento.

    El diseño de autorización está cerrado (§2) — no rediscutir.
    Los cuatro call sites de código ya están en main. Lo que falta
    es la §3: verificar en prod, localizar la sintaxis exacta de la
    sonda de jwt.claims antes de escribir el SQL nuevo, aplicar la
    receta de 6 pasos, verificar ACL y camino bloqueado, y registrar
    el cierre en CLAUDE.md.

    Convención: todo bloque de código va precedido por su línea de
    destino.
      ▶ DESTINO: CLAUDE CODE 🤖
      ▶ DESTINO: SUPABASE 👾
      ▶ DESTINO: HUMANO 👽