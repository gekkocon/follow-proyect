# Dashboard Agencia FEMCO — Funcionalidades

> Resumen funcional del producto, módulo por módulo. Se actualiza al cerrar cada fase de desarrollo.
> Para detalle técnico (arquitectura, archivos, SQL) ver `CHANGELOG.md` y las memorias de Claude Code.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres + Auth) + Zustand + React Hook Form + Zod + date-fns

**Última fase cerrada:** Etapa 2 del Work Plan — bloques emergentes (bugs, deuda técnica, preguntas/RFC) y sus orígenes desde tarea/subtarea.

---

## 🔐 Autenticación y Seguridad

- Login con email y contraseña real (Supabase Auth) — sin usuarios de prueba
- Acceso solo para cuentas creadas previamente por un administrador
- Rutas internas protegidas por middleware: sin sesión activa no se accede a ninguna pantalla del dashboard
- Cierre de sesión disponible desde cualquier pantalla (Header)

## 📊 Dashboard

- Resumen en tiempo real: total de proyectos, proyectos activos, atrasados, tareas pendientes/bloqueadas, % de avance global
- Lista de proyectos recientes con su progreso
- Gráfica de distribución de tareas por estado
- Tareas próximas a vencer en los siguientes 7 días
- Visibilidad filtrada por rol: pm/developer/designer solo ven datos de sus proyectos; admin ve todo

## 📁 Proyectos

- Alta, edición y eliminación de proyectos (nombre, descripción, estado, prioridad, fechas, responsable)
- Barra de progreso por proyecto (promedio de avance de sus fases)
- Vista de detalle: fases, tareas y subtareas editables inline, sin ventanas emergentes
- Gestión de equipo por proyecto (asignar/quitar miembros y su rol dentro del proyecto)
- Múltiples responsables por tarea o subtarea
- Cada fase, tarea y subtarea tiene un código corto y estable, compuesto en tres niveles: `F0` (fase), `F0-T01` (tarea dentro de esa fase), `F0-T01-S01` (subtarea dentro de esa tarea)
- Carga y actualización masiva de tareas por archivo JSON (ver *Carga masiva de tareas*)

## 🗂️ Fases

Toda tarea vive dentro de una fase — es el primer nivel de organización de un proyecto.

- Alta, edición y eliminación de fases (nombre, objetivo, estado, prioridad, fechas). El código (`F0`, `F1`…) se asigna solo, correlativo dentro del proyecto.
- Una fase con tareas no se puede eliminar: hay que mover o borrar sus tareas primero. El código de una fase eliminada no se reutiliza.
- Una tarea se puede mover a otra fase. Al moverla, **el código se realoca**: toma el siguiente número libre de la fase de destino y el código anterior queda quemado en la fase de origen — no se congela ni viaja con la tarea.
- **Bloque "Sin fase":** una sección aparte, colapsable, para tareas que no pertenecen a ninguna fase (proyectos con tareas anteriores a la existencia de fases, o creadas por la importación masiva — ver más abajo). No entran en el cálculo de avance de ninguna fase individual, pero sí en el avance general del proyecto.

## ✅ Tareas y subtareas

- Dar de alta una tarea a mano exige elegir la fase a la que pertenece — no existe la tarea "suelta" desde el alta manual (a diferencia de la importación, ver más abajo).
- Las subtareas cuelgan de una tarea, no de una fase directamente.
- Edición inline en ambos niveles: título, descripción, estado, prioridad, fechas, responsables. Las tareas además admiten marcarse como bloqueadas con un motivo.

## 📥 Carga masiva de tareas

En el detalle de un proyecto, arriba de la lista de fases, hay dos botones que trabajan con archivos JSON. Se parecen pero hacen cosas distintas y **no son intercambiables**: **Importar tareas** está activo; **Actualizar tareas** está deshabilitada hoy (ver su sección más abajo).

### Modelo de códigos

Tres niveles, cada uno único dentro de su contenedor:

| Nivel | Formato | Único dentro de |
|---|---|---|
| Fase | `F0`, `F1`… | proyecto |
| Tarea | `T01` | fase |
| Subtarea | `S01` | tarea |

El código completo que se ve en pantalla es la combinación de los tres: `F0-T01-S01`. Es un **nombre**, no una posición: no cambia si se reordenan las filas dentro de su contenedor, y si una fila se borra su código queda quemado y no se le asigna a ninguna otra.

Las tareas cargadas antes de que existieran los códigos pueden no tener uno. Esas **no se pueden alcanzar por código** en ningún flujo que lo use como identificador.

---

### Importar tareas

Crea tareas y subtareas nuevas a partir de un JSON anidado. Se puede pegar el texto o cargar un archivo `.json`.

```json
{
  "tasks": [
    {
      "title": "Diseño de planos",
      "priority": "Alta",
      "status": "En progreso",
      "responsable": "Ana Pérez",
      "subtasks": [
        { "title": "Plano de cimentación", "priority": "Media" },
        { "title": "Plano eléctrico", "priority": "Media", "due_date": "2026-03-10" }
      ]
    }
  ]
}
```

- Lo único obligatorio es `title`. Las fechas y el resto son opcionales.
- El estado y la prioridad se pueden escribir en español (`"Alta"`, `"En progreso"`) o con el código interno (`"high"`, `"in_progress"`).
- `responsable` / `responsables` funcionan como alias de `assignee_names`.
- El código se puede indicar con `code`; si no viene, el sistema lo genera solo.
- La vista previa dice cuántas tareas y subtareas se van a crear, y **avisa si hay títulos repetidos** contra las que ya existen. Es un aviso, no un bloqueo: la importación crea la fila igual.
- `dependencies` se acepta en el JSON, solo para tareas (ya no para subtareas). Si una tarea con dependencias pasa a "En progreso" y alguna de las tareas referenciadas todavía no está "Completada", aparece el aviso "Depende de tareas sin cerrar" junto a esa tarea — es solo una señal visual, no bloquea el cambio de estado.
- En un proyecto que ya tiene fases, las tareas importadas **nacen en el bloque "Sin fase"**, a diferencia del alta manual (que siempre exige elegir una fase). Hay que moverlas a mano después si corresponde.

---

### Actualizar tareas

Modificaba tareas y subtareas existentes, identificándolas por su código, sin tocar lo que no se mencionaba en el JSON. **Está deshabilitada hoy**: direccionaba las filas por el código de dos niveles del modelo anterior a las fases (`F3-T08`), que ya no existe bajo el modelo de tres niveles actual. Vuelve en la Etapa 3 como una función nueva (`update_work_plan`), adaptada a fase/tarea/subtarea.

## 🐛 Bloques emergentes

Debajo de las fases, en el detalle del proyecto: tres secciones colapsables — **Bugs**, **Deuda Técnica** y **Preguntas/RFC** — para lo que aparece durante el trabajo y no es parte del plan original.

- **Alta independiente**, desde el botón de cada sección ("Nuevo bug", "Nueva deuda técnica", "Nueva pregunta/RFC"), sin origen asociado.
- **Alta con origen prellenado**: desde una tarea o una subtarea hay un menú ("Reportar bug" / "Registrar deuda técnica" / "Abrir pregunta/RFC") que abre el formulario de alta en la sección correspondiente, con el código de esa tarea o subtarea ya cargado como origen (visible como una etiqueta fija mientras se completa el alta). El origen solo puede ser una tarea o una subtarea — no una fase.
- Cada ítem tiene su propio código: `BUG-014`, `TD-007`, `QRFC-004`.
- **Campos comunes:** título, descripción, prioridad (baja/media/alta/crítica), estado (abierto / en progreso / esperando decisión / resuelto / descartado, visible al editar), responsables (mismo selector múltiple que tareas y subtareas).
- **Campos propios de un bug:** severidad (menor/mayor/bloqueante), entorno, versión, pasos para reproducir, comportamiento esperado, comportamiento real, resolución.
- **Campos propios de una deuda técnica:** impacto (bajo/medio/alto), solución propuesta, esfuerzo estimado, fase objetivo (opcional).
- **Campos propios de una pregunta/RFC:** opciones a evaluar, recomendación, decisión final.
- **Checklist interno** por ítem: agregar, tildar y borrar pasos menores. No se pueden reordenar todavía.
- **Contador de vínculos:** una tarea o subtarea con bugs, deuda o preguntas vinculados muestra "· N emergente(s)" junto a su código.
- **Editar orígenes** de un ítem ya creado: en modo edición se ven sus orígenes actuales y se pueden agregar o quitar vínculos a otras tareas o subtareas del proyecto.
- **Eliminar** un ítem solo está disponible para Administrador o Project Manager.

## ✅ Tareas (vista global)

- Listado de todas las tareas de todos los proyectos en un solo lugar
- Filtros por estado, prioridad y responsable (colapsables en móvil)
- Cambio de estado inline sin entrar al proyecto
- Motivo de bloqueo visible al expandir la tarea
- Alertas visuales para tareas vencidas

## 👥 Usuarios

- Alta, edición y baja de miembros del equipo
- Rol asignable: Administrador, Project Manager, Desarrollador, Diseñador
- Activar/desactivar usuarios sin eliminarlos
- Contador de tareas y proyectos asignados por usuario
- Creación genera acceso real (email + contraseña); edición permite cambiar email o restablecer contraseña

## ⚙️ Configuración

- Identidad de marca: nombre de la agencia, logo, favicon (ícono de pestaña) y color principal
- Cambios reflejados al instante en toda la app: menú lateral, login, título de la pestaña del navegador
- Selector de colores predefinidos o color personalizado (hex)

## 📱 Móvil / PWA

- Experiencia completa en celular, equivalente a escritorio
- Instalable como app (ícono en pantalla de inicio, sin barra de navegador)
- Menú inferior de navegación rápida en móvil, con ítems visibles según rol
- Pantalla de "sin conexión" si se pierde el internet, en vez de fallar silenciosamente

---

## Roles y permisos (referencia rápida)

| Rol | Ve todos los proyectos | Gestiona equipo de proyecto | Accede a Usuarios | Accede a Configuración |
|---|---|---|---|---|
| Administrador | ✅ | ✅ | ✅ | ✅ |
| Project Manager | ❌ (solo donde participa) | ✅ | ✅ | ❌ |
| Desarrollador / Diseñador | ❌ (solo donde participa) | ❌ | ❌ | ❌ |

---

## Pendientes conocidos

- Subida de archivos real para logo/favicon (hoy solo se aceptan URLs externas)
- Migración `favicon_url` en `brand_settings` debe ejecutarse manualmente en Supabase si aún no se corrió
- Confirmar en Supabase Auth los Redirect URLs del dominio de producción tras cada nuevo deploy
