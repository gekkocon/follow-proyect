# Dashboard Agencia FEMCO — Funcionalidades

> Resumen funcional del producto, módulo por módulo. Se actualiza al cerrar cada fase de desarrollo.
> Para detalle técnico (arquitectura, archivos, SQL) ver `CHANGELOG.md` y las memorias de Claude Code.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres + Auth) + Zustand + React Hook Form + Zod + date-fns

**Última fase cerrada:** 8B — Actualización masiva de tareas por código

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
- Visibilidad filtrada por rol: Coordinador/Colaborador solo ven datos de sus proyectos; Administrador ve todo

## 📁 Proyectos

- Alta, edición y eliminación de proyectos (nombre, descripción, estado, prioridad, fechas, responsable)
- Barra de progreso por proyecto (tareas completadas vs. totales)
- Vista de detalle: tareas y subtareas editables inline, sin ventanas emergentes
- Gestión de equipo por proyecto (asignar/quitar miembros y su rol dentro del proyecto)
- Múltiples responsables por tarea o subtarea
- Cada tarea y subtarea tiene un código corto y estable (`F0`, `F0-T01`) para nombrarla fuera de la app
- Carga y actualización masiva de tareas por archivo JSON (ver *Carga masiva de tareas*)

## 📥 Carga masiva de tareas

En el detalle de un proyecto, arriba de la lista de tareas, hay dos botones que trabajan con archivos JSON. Se parecen pero hacen cosas opuestas y **no son intercambiables**:

| | **Importar tareas** | **Actualizar tareas** |
|---|---|---|
| Qué hace | crea filas nuevas | modifica filas existentes |
| Forma del JSON | objeto anidado, subtareas dentro de su tarea | array plano, un objeto por fila |
| Cómo identifica la fila | no la identifica: siempre crea | por el código (`F3`, `F3-T08`) |
| Si el título ya existe | la crea igual, duplicada | no aplica |
| Puede borrar algo | no | no |

Los dos flujos piden **Vista previa** antes de habilitar la confirmación, y ninguno de los dos escribe nada hasta que se confirma. Cada operación es todo-o-nada: si una fila falla, no se aplica ninguna.

### Códigos de tarea

Cada tarea tiene un código corto y estable: `F0`, `F1`, `F2`… Cada subtarea lleva el de su tarea más su propio número: `F0-T01`, `F0-T02`… El código es un **nombre**, no una posición: no cambia si se reordenan las tareas, y si una tarea se borra su código queda quemado y no se le asigna a ninguna otra. Sirve para hablar de una tarea fuera de la app y es la llave del flujo de actualización.

Las tareas cargadas antes de que existieran los códigos pueden no tener uno. Esas **no se pueden actualizar por este flujo**, y la vista previa avisa cuántas hay en el proyecto.

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

---

### Actualizar tareas

Modifica tareas y subtareas que **ya existen**, identificándolas por su código. El JSON es un **array plano**: las subtareas no van anidadas, van como un elemento más de la lista.

```json
[
  { "code": "F3", "status": "En progreso", "priority": "Alta" },
  { "code": "F3-T08", "title": "Plano eléctrico revisado", "completed": true },
  { "code": "F4", "assignees": ["Ana Pérez", "Luis Gómez"] },
  { "code": "F5", "due_date": "2026-04-15", "estimated_cost": 12000 }
]
```

**El guion decide de qué se trata:** un código sin guion (`F3`) es una tarea; uno con guion (`F3-T08`) es una subtarea, y lo que va antes del guion tiene que ser el código de una tarea real del proyecto. Los códigos se pasan a mayúsculas automáticamente, así que `f3` y `F3` son lo mismo.

#### Semántica: se escribe solo lo que está presente

Es un *patch*, no un reemplazo. **Solo se modifican los campos que aparecen en el objeto.** Todo lo que no se menciona queda intacto, y nunca se borra nada por omisión. Si se quiere vaciar un campo que admite estar vacío, hay que mandarlo explícitamente en `null`.

En el ejemplo de arriba, `F3` cambia su estado y su prioridad; su título, sus fechas, su costo y sus responsables no se tocan.

#### Qué se puede actualizar

| Campo | Tareas | Subtareas |
|---|---|---|
| `title` — título | ✅ | ✅ |
| `description` — descripción | ✅ | ✅ |
| `status` — estado | ✅ | ✅ |
| `priority` — prioridad | ✅ | ✅ |
| `start_date` — fecha de inicio | ✅ | ✅ |
| `due_date` — fecha límite | ✅ | ✅ |
| `estimated_cost` — costo estimado | ✅ | ✅ |
| `assignees` — responsables | ✅ | ✅ |
| `is_blocked` — bloqueada | ✅ | ❌ no existe en subtareas |
| `blocked_reason` — motivo de bloqueo | ✅ | ❌ no existe en subtareas |
| `completed` — completada | ❌ no existe en tareas | ✅ |

**No se pueden actualizar nunca:** `code`, `id`, `project_id` ni `task_id`. Mandar cualquiera de ellos —o cualquier campo inventado— hace que el archivo se rechace entero.

> **Nota sobre `status` y `completed` en subtareas.** Son dos campos independientes y el sistema **no** deriva uno del otro. Marcar `"status": "done"` sin mandar `"completed": true` deja el estado en "Finalizada" pero el tilde de la subtarea sin marcar. La vista previa lo advierte; si se quieren los dos, hay que mandar los dos.

#### Responsables

- Si la clave `assignees` **no viene**, la lista de responsables no se toca.
- Si **viene**, reemplaza la lista completa. No agrega: pisa.
- `"assignees": []` deja la fila sin ningún responsable.
- Los nombres se buscan por el nombre completo del usuario, sin distinguir mayúsculas ni espacios sobrantes. **Un nombre que no corresponda a ningún usuario bloquea la confirmación** en vez de ignorarse en silencio.

#### La vista previa: cuatro grupos

Antes de confirmar, el panel separa el contenido del archivo en:

1. **A actualizar** — el código existe y hay cambios reales. Se lista campo por campo, con el valor actual y el nuevo.
2. **Sin cambios** — el código existe pero los valores mandados son idénticos a los que ya tiene. No se toca nada.
3. **No encontradas** — el código no existe en el proyecto. Se listan los códigos, para poder detectar un error de tipeo.
4. **Errores** — problemas que impiden confirmar. El botón queda deshabilitado hasta que el archivo se corrija.

Además avisa, sin bloquear, si el proyecto tiene tareas o subtareas **sin código**, indicando cuántas: esas filas no son alcanzables por este flujo.

#### Qué bloquea la confirmación

- Un **código repetido** dentro del mismo archivo.
- Un **código de subtarea cuyo prefijo** no corresponde a ninguna tarea real del proyecto (por ejemplo `F9-T01` cuando no existe `F9`).
- Un **estado o prioridad que no se reconoce** (`"En Progeso"`). No se asume un valor por defecto: se frena, porque un valor por defecto convertiría un error de tipeo en un cambio silencioso.
- Un **responsable inexistente**.
- Un **campo que no pertenece a esa tabla** (`is_blocked` en una subtarea, `completed` en una tarea) o una clave desconocida.
- Un **elemento sin `code`**, o con el título vacío.
- Crear una fila nueva **sin `title`**, cuando el toggle de creación está encendido.

#### Toggle "Crear las no encontradas"

Viene **apagado**, y conviene dejarlo así salvo que se quiera exactamente lo contrario.

- **Apagado:** los códigos que no existen se reportan en la vista previa y se omiten. No se crea nada.
- **Encendido:** esos códigos se crean como filas nuevas, con el código indicado en el archivo.

El motivo del valor por defecto: si `F30` está mal tipeado y en realidad era `F3`, con el toggle apagado aparece en "no encontradas" y se corrige; con el toggle encendido se convierte, sin decir nada, en una tarea nueva llamada `F30`.

#### Después de confirmar

El sistema informa cuántas filas se actualizaron, cuántas se crearon y cuántas se omitieron. **El total de "actualizadas" incluye también las que no cambiaron**: es la cantidad de filas alcanzadas, no la cantidad de campos modificados. El desglose fino está en la vista previa, antes de confirmar.

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
- Migraciones `010_task_codes.sql` (códigos) y `011_update_project_tasks.sql` (actualización masiva) también se ejecutan **a mano** en Supabase, **una sola vez**: hay un único proyecto Supabase, no hay entorno de ensayo separado. Sin la 010 falla la importación; sin la 011 la actualización deja ver la vista previa pero falla al confirmar
- Confirmar en Supabase Auth los Redirect URLs del dominio de producción tras cada nuevo deploy
