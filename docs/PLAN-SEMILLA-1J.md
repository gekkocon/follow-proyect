# Plan semilla — 1J: limpieza de deuda técnica de bajo riesgo

**29 ago 2026.** Nace al cerrar 1I (tres frentes cerrados y pusheados:
nomenclatura de roles c9d5ada, deuda 34 array_agg d93eb82, hallazgo 36
refresh UI e4f9bc3). Continúa desde ese corte limpio.

`PLAN-SEMILLA-1I.md` queda cerrado y trackeado.

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | e4f9bc3 (cierre 1I, pusheado a origin/main) |
| SQL pendiente | ninguno |

## 2. Los dos frentes de 1J, independientes entre sí

### 2.1 — Drizzle muerto

Cerrado antes de esta sesión, en el commit 29dc134 (ver
docs/CHANGELOG.md, entrada "Eliminado — Drizzle"). src/db/, drizzle/,
drizzle.config.ts, los cuatro scripts db:* y las cinco dependencias
huérfanas (drizzle-orm, drizzle-kit, postgres, @libsql/client, tsx)
ya no existen en el repo. Confirmado por inventario de solo lectura
el 29 ago 2026: cero carpetas, cero imports, cero menciones en
package.json. Sin trabajo pendiente.

### 2.2 — Constantes duplicadas (deuda 4)

Doble lista de etiquetas en `constants.ts` y `task-constants.ts`.
Agregar un estado hoy obliga a tocar enum + 2 archivos + types.ts +
StatusBadge/PriorityBadge. Objetivo: consolidar en una sola fuente sin
romper ningún import existente.

## 3. Orden sugerido

1. 2.1 primero — Drizzle es borrado puro, sin riesgo de romper UI.
2. 2.2 segundo — consolidar constantes toca más archivos activos
   (StatusBadge, PriorityBadge, formularios), requiere más cuidado.

## 4. Primer paso del chat nuevo

    Proyecto follow-proyect — 1J: limpieza de deuda técnica de bajo
    riesgo (Drizzle muerto, constantes duplicadas).

    Adjunto PLAN-SEMILLA-1J.md y CLAUDE.md. El estado real es el de
    su §1; el HEAD lo leo de mi terminal, no del documento.
