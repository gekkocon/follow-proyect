# Plan semilla — 1I: cabos sueltos (refresh UI, array_agg, nomenclatura de roles)

**28 ago 2026.** Nace al cerrar 1H. Continúa desde el corte limpio
tras el push a db85070.

`PLAN-SEMILLA-1H.md` y `PLAN-SEMILLA-1G.md` quedan **cerrados y
trackeados**, referencia si hace falta releer el patrón de gates.

---

## 1. Estado al arrancar

**El HEAD lo lee el terminal, no este documento.**

| | |
|---|---|
| Último commit conocido | db85070 (cierre 1H, pusheado a origin/main) |
| SQL pendiente | ninguno |
| Sandbox de datos | proyecto 13, vacío de nuevo tras la limpieza de 1H |
| Cuenta de prueba disponible | jorohoan@gmail.com / 12345678, hoy en role=developer, sin membresías activas |

## 2. Qué ya está cerrado (no rediscutir)

- 1G: gate de rol+membresía en los tres allocators (deuda 24).
- 1H: gate de rol en las siete acciones de borrado (deuda 17),
  validación de pertenencia al padre (deuda 18), limpieza de
  assignments (deuda 19), labels de progreso separados (deuda 37,
  presentación únicamente — la fórmula de work-plan.ts no se tocó).

## 3. Los tres frentes de 1I, independientes entre sí

### 3.1 — Hallazgo 36: ¿es real el problema de refresh tras borrado?

En la sesión de 1H, revisión de código no encontró causa: los tres
call sites de borrado (fase/tarea/subtarea) sí llaman al mecanismo
de refresh() (que relee getProjectWorkPlan directo, sin depender de
cache de Next) y los revalidatePath apuntan a la ruta correcta. El
síntoma reportado durante las pruebas de Playwright (fila visible
tras un borrado exitoso, hasta recargar a mano) no tiene una causa
clara en el código estático.

Tarea: reproducir en vivo, en el navegador real (no en el entorno
de Playwright que tuvo problemas con confirm() nativos), un
borrado exitoso de fase/tarea/subtarea, y observar si la fila
desaparece sola o si hace falta recargar. Si se reproduce, recién
ahí investigar la causa (posible carrera entre el DELETE y la
siguiente lectura de getProjectWorkPlan, según hipótesis (b) de la
sesión anterior). Si NO se reproduce, cerrar el ítem 36 de CLAUDE.md
como "no reproducido, probablemente artefacto del entorno de
Playwright de esa sesión".

### 3.2 — Deuda 34: array_agg personalizado en public

Descubierto el 28 ago 2026 al debuggear un error 42809
(pg_get_functiondef() falla sobre funciones de agregación) durante
una query de auditoría en 1G. Sin investigar origen ni alcance.

Tarea: correr una consulta de solo lectura contra pg_proc para
traer la definición completa de esa función de agregación, entender
qué hace, cuándo se creó (si hay pistas en comentarios o en algún
migration file que la referencie), y evaluar si sombrea al agregado
nativo de forma peligrosa (afecta queries sin search_path
explícito) o si es inofensiva. Decidir con Hikashi si se elimina,
se renombra, o se deja documentada como intencional.

### 3.3 — Nomenclatura de roles (decisión pendiente §10 del instructivo)

Recomendación ya escrita en el instructivo v2 §12: adoptar
admin/pm/developer/designer como nomenclatura definitiva y dejar de
mantener la equivalencia con Admin/Coordinador/Colaborador. Esto NO
requiere migración de enum (ya son los valores reales en Postgres)
— es una decisión de dejar de documentar/mencionar la nomenclatura
vieja en cualquier lugar que la arrastre todavía.

Tarea: grep de "Coordinador" y "Colaborador" en todo el repo
(código, comentarios, docs) para confirmar si queda algún resto de
la nomenclatura vieja fuera de los propios documentos de
instructivo/arquitectura (que la mencionan como contraste
histórico, no como algo a corregir). Si no hay restos reales en
código/UI, cerrar la decisión pendiente en CLAUDE.md §10 sin tocar
nada más. Si aparece algo (ej. un label en la UI, un comentario
desalineado), decidir puntualmente si se corrige.

## 4. Orden sugerido

1. 3.3 primero — es la más rápida, probablemente un grep y un
   cierre de decisión, sin código.
2. 3.2 segundo — investigación acotada de una sola función.
3. 3.1 último — requiere reproducción manual en navegador, más
   lento, y su resultado no depende de los otros dos.

Ninguno bloquea a los otros; se pueden reordenar libremente si
alguno resulta más rápido o más lento de lo esperado.

## 5. Primer paso del chat nuevo

    Proyecto follow-proyect — 1I: tres cabos sueltos independientes
    (refresh de UI tras borrado, array_agg sombreado, nomenclatura
    de roles).

    Adjunto PLAN-SEMILLA-1I.md y CLAUDE.md. El estado real es el de
    su §1; el HEAD lo leo de mi terminal, no del documento.

    Los tres frentes (§3.1, 3.2, 3.3) son independientes — se puede
    cerrar cualquiera primero. Orden sugerido en §4, no obligatorio.

    Convención: todo bloque de código va precedido por su línea de
    destino.
      ▶ DESTINO: CLAUDE CODE 🤖
      ▶ DESTINO: SUPABASE 👾
      ▶ DESTINO: HUMANO 👽
      ▶ DESTINO: CODEX · MODO EXPLORACIÓN 🔍 (playwright-cli)
