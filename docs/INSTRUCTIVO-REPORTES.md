# Instructivo — Protocolo de reportes

**v1 · Agosto 2026 · complementa al Instructivo principal y a `CLAUDE.md`.**
Destino: `docs/INSTRUCTIVO-REPORTES.md` + adjunto al proyecto de Claude.

---

## 0. Por qué existe

La capa de conversación (Claude en el navegador) **no ve el repo ni la base**. El humano
es el transporte. Copiar archivos a mano es lento y frágil: se pega de más, se pega de
menos, se pega reformateado.

Este protocolo define un tipo de sesión distinto al de implementación: **la sesión de
reporte**. Claude Code no modifica nada; solo extrae evidencia en un formato fijo que se
pega de vuelta en la conversación.

Regla de fondo: **evidencia y opinión no se mezclan.** Un resumen no sirve para auditar.
Si se pide un archivo literal, se entrega literal.

---

## 1. Quién transporta qué

| Fuente de evidencia | Quién la extrae | Cómo llega a la conversación |
|---|---|---|
| Repo (archivos, git, build) | Claude Code 🤖 | El humano pega la salida |
| Base de datos | El humano 👽, a mano en el editor de Supabase 👾 | El humano pega el resultado |
| Navegador / UI corriendo | El humano 👽 o Codex 🔍 | Captura o texto |

**Claude Code no toca la base.** Hay una sola base Supabase y es la viva. Claude Code lee
archivos `.sql`, los reporta y los revisa; **no los ejecuta jamás.**

---

## 2. Catálogo de reportes

Cada reporte tiene un ID. Yo lo pido por ID; Claude Code lo devuelve con ese mismo ID.

| ID | Qué es | Uso típico |
|---|---|---|
| `R-BASE` | Estado de sesión: HEAD, rama, árbol, últimos commits, migraciones presentes | Abrir cualquier sesión |
| `R-FILE` | Volcado **literal** de un archivo o rango de líneas | Auditar SQL, revisar un componente |
| `R-TREE` | Inventario de estructura: rutas y tamaños, sin contenido | Ubicar algo, medir alcance |
| `R-GREP` | Dónde se usa un símbolo, tabla o campo | Medir impacto antes de migrar |
| `R-BUILD` | Salida cruda de `npm run lint` / `npm run build` | Cierre de fase |
| `R-DB` | Resultado de una query corrida en Supabase | Relevamiento, verificación de migración |

---

## 3. Reglas duras para Claude Code

1. **Literal es literal.** Sin reindentar, sin reordenar, sin "limpiar", sin traducir
   comentarios, sin arreglar typos. Ni siquiera los evidentes.
2. **No ejecutar nada que escriba.** Ni SQL, ni scripts, ni `db:*`. Un reporte es de solo
   lectura por definición.
3. **No opinar dentro del sobre.** El análisis va después del cierre, bajo
   `NOTAS DE CLAUDE CODE`. Bienvenido, pero separado.
4. **No responder de memoria.** Si el archivo no se abrió en esta sesión, no se reporta.
5. **Truncar solo si se pidió, y declararlo.** Nunca cortar en silencio.
6. **Redactar secretos.** Nunca volcar contenido de `.env*`, ni valores de
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` o cadenas de conexión.
   Se conserva el nombre de la variable y se reemplaza el valor por `‹REDACTADO›`.
   Emails reales de la tabla `users`: reemplazar por `usuario1@…`, `usuario2@…`.
7. **No hacer commit.** Una sesión de reporte termina con el árbol como empezó.

---

## 4. El sobre — formato de salida

Todo reporte va dentro de este envoltorio, en un bloque de código:

```
=== R-FILE · src/lib/supabase/migrations/012_drop_task_assignee_id.sql
=== LÍNEAS: 1–48 de 48 · COMPLETO
--------------------------------------------------------------
<contenido exacto, sin una sola modificación>
--------------------------------------------------------------
=== FIN R-FILE · 48 líneas · sin modificar
```

Si hubo recorte, la segunda línea lo dice y explica por qué:

```
=== LÍNEAS: 180–320 de 746 · RECORTE PEDIDO (resto omitido)
```

Si el archivo no existe:

```
=== R-FILE · ruta/pedida.sql
=== NO EXISTE. Rutas parecidas encontradas: <lista o "ninguna">
```

Después del `FIN`, opcionalmente:

```
NOTAS DE CLAUDE CODE
- Lo que vea, en dos o tres líneas.
```

---

## 5. Cómo pido yo un reporte

Yo emito un bloque con la línea de destino de siempre y el ID adentro. Se pega tal cual
en Claude Code:

```
▶ DESTINO: CLAUDE CODE 🤖 (terminal del repo)

SESIÓN DE REPORTE — no modificar nada, no commitear, no correr build.
Aplica docs/INSTRUCTIVO-REPORTES.md.

R-FILE  scratchpad/relevamiento_prod_abce.sql  · completo
R-GREP  "assignee_id"                          · solo rutas y línea

Devolver cada uno en su sobre. Notas al final, fuera del sobre.
```

Un pedido de reporte **nunca** lleva tarea de implementación pegada. Si en el medio
aparece algo que hay que arreglar, sale en las notas y se decide acá, no en el momento.

---

## 6. Cómo se pega de vuelta

Tal cual salió, sobres incluidos. Sin editar, sin recortar "lo que no importa".
Si son varios reportes, todos en el mismo mensaje.

Si la salida es muy larga para un mensaje: partirla por sobre completo — nunca cortar un
sobre por la mitad — y numerar `parte 1/3`, `2/3`, `3/3`.

---

## 7. Reportes con forma fija

### `R-BASE` — apertura de sesión

Reemplaza el ESTADO BASE escrito a mano. Contiene, en este orden:

```
=== R-BASE
rama:            <nombre>
HEAD:            <hash corto> <asunto del commit>
sincronía:       <adelantado/atrasado/al día respecto de origin>
árbol:           <limpio | lista de archivos modificados>
últimos 5:       <hash + asunto, uno por línea>
migraciones:     <ls de src/lib/supabase/migrations/, solo nombres>
docs presentes:  <ls de docs/, solo nombres>
=== FIN R-BASE
```

### `R-DB` — resultado de query (lo trae el humano)

```
=== R-DB · <nombre del bloque, ej. relevamiento (b) profundidad>
=== QUERY:
<la query exacta que se corrió>
=== RESULTADO: <n> filas
<pegar la tabla o el CSV>
=== FIN R-DB
```

**`0 filas` se escribe explícitamente.** En las verificaciones de contadores, cero filas
es el resultado que cierra la migración; una celda vacía o un "no devolvió nada" no
alcanza como evidencia.

---

## 8. Anti-patrones

Cada uno de estos invalida el reporte:

- «Ya lo revisé, no hay nada destructivo.» → No es evidencia. Pegar el archivo.
- Reformatear el SQL para que se lea mejor.
- Corregir un typo mientras se lee.
- Correr el script para ver qué hace.
- Mezclar el análisis con el contenido dentro del mismo bloque.
- Cortar por la mitad sin declararlo.
- Contestar sobre un archivo que no se abrió en esta sesión.
