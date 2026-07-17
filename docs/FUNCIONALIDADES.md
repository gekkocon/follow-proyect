# Dashboard Agencia FEMCO — Funcionalidades

> Resumen funcional del producto, módulo por módulo. Se actualiza al cerrar cada fase de desarrollo.
> Para detalle técnico (arquitectura, archivos, SQL) ver `CHANGELOG.md` y las memorias de Claude Code.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres + Auth) + Zustand + React Hook Form + Zod + date-fns

**Última fase cerrada:** 6B — PWA + Responsive + Branding dinámico

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
