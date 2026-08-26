# Plan semilla — Etapa 1 del Work Plan

**26 ago 2026.** Cierre de la sesión de relevamiento. Todo lo de acá se decidió con
evidencia sobre la base; no es hipótesis.

---

## 0. Cómo usar este documento

Adjuntarlo al chat nuevo junto con `CLAUDE.md` **actualizado desde el repo**.
Primer pedido del chat nuevo: el `R-FILE` completo de `docs/ARQUITECTURA-WORKPLAN.md`,
que todavía no fue leído por la capa de conversación.

---

## 1. Estado del repo

```
HEAD      1c45705  docs: corregir encabezado del relevamiento a base única
sincronía al día con origin/main
árbol     limpio
```

Últimos commits de la sesión:

| Commit | Qué trajo |
|---|---|
| `1c45705` | Encabezado del relevamiento corregido a base única |
| `eed520f` | `docs/INSTRUCTIVO-REPORTES.md`, relevamiento al repo, banner en la `012` |

Sin SQL pendiente de correr. Ninguna migración a medias.

---

## 2. Estado de la base

**Se eliminó el proyecto ERP Showroom** durante esta sesión. Era el de mayor volumen.
Borrado limpio, verificado: cero tareas huérfanas, cero subtareas huérfanas, cero
dependencias rotas.

```
proyectos    2
tasks       37
subtasks   106
```

- **Proyecto 5** — "Conectar Claude Code con Workana": 2 tareas, 0 subtareas. Plano.
- **Proyecto 7** — "The Showroom Miami - Plan de Trabajo Bilingüe": 35 tareas, 106 subtareas.

---

## 3. Decisiones cerradas en esta sesión

### 3.1 Revisión campo por campo — checklist §11, ítem 1 · CERRADO

| Acción | Campos | Evidencia |
|---|---|---|
| **Eliminar** | `start_date`, `estimated_cost`, `dependencies` | 100 % vacíos en ambas tablas, siempre. Cierra deudas técnicas #7 y #8. |
| **Conservar** | `description`, `due_date`, `code`, `status`, `completed` | Uso real y medible. |
| **Agregar** | `completed_at` | Se setea solo al pasar a `done`. |

`priority` **queda sin veredicto**: da 0 % NULL pero tiene DEFAULT, así que el dato no
distingue "elegida" de "autocompletada". Se conserva como está.

`is_blocked` está en **0 % de uso**: nadie bloqueó nada nunca. Cómo modelarlo ya está
cerrado en `ARQUITECTURA-WORKPLAN.md` §1 (booleano, no estado) y no se reabre — pero si
entra a la Etapa 1, entra sabiendo esto.

### 3.2 `import_work_plan` como función nueva — checklist §11, ítem 2 · CERRADO

`import_project_tasks` es ancla de estabilidad y no se toca. El JSON del Work Plan tiene
un nivel que la función vieja no sabe producir; extenderla rompería el criterio de
aceptación de la Fase 8B. Función nueva.

### 3.3 SEO Técnico va como fase

F21–F29 no tienen prefijo `Fase N` pero forman un arco completo con 24 subtareas.
Se migran como una fase. Total: **5 fases** en el proyecto 7.

---

## 4. Evidencia — por qué se decidió así

### 4.1 La fase vive en el título, no en el schema

Ocho tareas del proyecto 7 arrancan con `Fase 0 - `, `Fase 1 - `. Cinco dicen lo mismo.
La gente escribe la fase como prefijo de texto **porque no hay columna donde ponerla**.

Misma patología con las fechas: `start_date` está 100 % NULL, y hay títulos que dicen
`Ajustes ejecutados 30 jul 2026`. No es que no les importen las fechas — es que falta la
columna para la fecha en que algo terminó. De ahí `completed_at`.

### 4.2 El código NO correlaciona con la fase

```
Fase 0  →  F0, F1, F2, F3, F4, F10, F19, F20
Fase 1  →  F5, F6, F7, F8, F18
Fase 2  →  F9, F11, F12, F13
Fase 3  →  F14, F15, F16, F17
```

F10 cae en Fase 0, entre F9 y F11 que están en Fase 2. F18 salta a Fase 1.

**Cualquier regla automática basada en el número del código produce un plan incorrecto**,
y se ve tan ordenado que nadie lo notaría. La migración no infiere: mapea con la tabla
de la sección 5.

### 4.3 Profundidad del árbol — medida ANTES del borrado

Sobre 194 tareas: mediana **0**, máximo **150**, p90 **11,7**, y 60,3 % con cero
subtareas. Dos poblaciones conviviendo, no una distribución con outlier.

> Estos números ya no describen la base actual, pero **las conclusiones de UI siguen
> vigentes**: que un proyecto haya llegado a 150 subtareas en un nodo es un hecho sobre
> cómo trabaja la agencia. Dimensionar contra los números chicos de hoy construye algo
> que se rompe la próxima vez.

Decisiones de UI que quedan fijas:

- **Sin chevron en nodos sin hijos.** Seis de cada diez no abren nada.
- **Lista plana**, sin virtualización ni paginado. El caso normal es de ~12 ítems.
- **Corte en ~25 con botón "mostrar N más"** para el caso extremo. Sin librería.

### 4.4 Tasa de llenado (post-borrado)

| Campo | tasks (37) | subtasks (106) |
|---|---|---|
| `description` vacía | 13,5 % | 6,6 % |
| `priority` NULL | 0 % | 0 % |
| `start_date` NULL | **100 %** | **100 %** |
| `due_date` NULL | 70,3 % | 75,5 % |
| `estimated_cost` NULL | **100 %** | **100 %** |
| `dependencies` vacía | **100 %** | **100 %** |
| `is_blocked` true | 0 % | — |
| `completed` true | — | 40,6 % |
| `code` NULL | 0 % | 0 % |

`code` en 0 % NULL: la Fase 8A quedó perfecta.

---

## 5. Mapeo de fases — criterio de aceptación de la migración

| Fase | Códigos actuales | Tasks | Subtasks |
|---|---|---|---|
| Fase 0 | F0, F1, F2, F3, F4, F10, F19, F20 | 8 | 29 |
| Fase 1 | F5, F6, F7, F8, F18 | 5 | 13 |
| Fase 2 | F9, F11, F12, F13 | 4 | 11 |
| Fase 3 | F14, F15, F16, F17 | 4 | 10 |
| SEO Técnico | F21 – F29 | 9 | 24 |
| *(sin fase — retroactivas)* | F30 – F34 | 5 | 19 |
| *(proyecto 5 — plano)* | F0, F1 | 2 | 0 |
| | **Total** | **37** | **106** |

**Si la migración produce otro número, falló.** Esta reconciliación es la verificación,
igual que la query de contadores en la 8A: no alcanza con que el script corra sin error.

Al asignar fase se limpia el prefijo `Fase N - ` del título: el dato pasa a vivir en su
columna.

### F30 – F34 no son plan

Verbos en pasado, fecha en el título, 12 de 14 en `done`. Son registros retroactivos de
trabajo ya hecho, cargados para dejar constancia. Material de **Handoff**, que por
instructivo vive fuera del Work Plan.

Handoff todavía no existe, así que migran con `phase_id = NULL` y se reubican cuando el
módulo exista. No se pierde nada.

---

## 6. Lo que queda abierto

### 6.1 Los códigos actuales se destruyen — decidir mitigación

Con "código que se realoca al mover" ya cerrado, F19 pasa a ser algo como `F0-T06`. Todo
lo que hoy diga "F19" en un chat, un mail al cliente o una nota deja de resolver. Las
tareas retroactivas, que son las más citables, son justamente las afectadas.

Dos salidas baratas: una columna `legacy_code` en la migración, o la tabla de mapeo
guardada en `docs/`. **Decidir antes de migrar, no después.**

### 6.2 `CLAUDE.md` §10 desactualizada

Sigue listando como abiertas las decisiones 1, 3 y 4 — roles, `assignee_id`, Drizzle —
que ya están cerradas. Corregir junto con la Etapa 1.

### 6.3 Arquitectura del Work Plan

`CLAUDE.md` §10 la lista como decisión abierta (tablas separadas vs. `work_items`
genérico) mientras el estado base habla de `phases / tasks / subtasks / assignments`.
**Resolver contra `ARQUITECTURA-WORKPLAN.md`, que es la fuente.**

Importa para el SQL: con tablas separadas, el índice único `(project_id, code)` de la 8A
choca cuando una fase se llame `F0` y una tarea también.

---

## 7. Orden de deploy — cambia a partir de acá

Eliminar `start_date`, `estimated_cost` y `dependencies` es **migración destructiva**,
así que el orden se invierte respecto de todo lo anterior:

1. `git push` del código que ya no usa esas columnas
2. Verificar producción andando
3. **Recién ahí** correr el `DROP`

Con una sola base, al revés deja la app leyendo columnas que ya no existen.

---

## 8. Primer paso del chat nuevo

```txt
Proyecto follow-proyect.
SESIÓN DE REPORTE — no modificar nada, no commitear, no correr build,
no ejecutar SQL. Aplica docs/INSTRUCTIVO-REPORTES.md.

R-FILE  docs/ARQUITECTURA-WORKPLAN.md  · COMPLETO, sin recorte

Es un documento largo. Si no entra en un mensaje, partirlo SOLO entre
secciones completas y numerar "parte 1/N". Nunca cortar una sección
por la mitad.

Al cerrar, fuera del sobre:
  MANIFIESTO: <n> sobres · <n> líneas totales · <completo | parte X de N>
```

Con eso: entidades, migración con la reconciliación 37/106 como verificación, y el plan
de los 9 archivos con acceso directo a las tablas.
