# NovaGiv

Catálogo web de los resubidos de las transmisiones de **NovaGiv**: películas, series, anime,
especiales/votaciones y karaokes, organizados por fecha de stream. Los videos viven en
[ok.ru](https://ok.ru) y se reproducen embebidos; este sitio es el índice navegable que ok.ru
no ofrece.

---

## Stack

| Pieza | Versión / nota |
|---|---|
| Next.js | 16.2 (App Router, Server Components, Server Actions) |
| React | 19.2 |
| Tailwind CSS | v4 (`@theme inline`, tokens en [app/globals.css](app/globals.css)) |
| Componentes | shadcn sobre [Base UI](https://base-ui.com) (`@base-ui/react`) |
| Backend | Supabase (Postgres + Auth + RLS) vía `@supabase/ssr` |
| Scraping | `cheerio` (fetch plano) y `playwright` (navegador real) |
| Gestor | pnpm |

El tema oscuro está fijado en el `<html>` de [app/layout.tsx](app/layout.tsx); no hay modo claro.

---

## Puesta en marcha

### 1. Instalar

```bash
pnpm install
```

### 2. Variables de entorno

Copia [.env.example](.env.example) a `.env.local` y complétalo. Las obligatorias:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente público |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor. Resuelve *username → email* al iniciar sesión (RLS oculta esa fila a todos menos a su dueño) y lo usa `pnpm okru:sync` |

Opcionales: `SITE_URL` (dominio canónico: los enlaces que Supabase manda por correo, y
también el `canonical`, el `og:url` y el sitemap de cada título — conviene fijarlo en
producción),
`OKRU_COOKIE` (permite al importador ver canales privados/solo-amigos),
`OKRU_PROFILE_URL` (perfil a sincronizar).

> **`OKRU_COOKIE`**: abre ok.ru con tu sesión iniciada → DevTools → Network → cualquier
> petición a ok.ru → Request Headers → copia el valor crudo de `cookie`. Trátalo como una
> contraseña: nunca lo subas al repositorio. Caduca con la sesión.

Sin Supabase configurado el sitio arranca igual y sirve los datos de ejemplo de
[lib/mock-data.ts](lib/mock-data.ts), así que la UI es navegable desde el primer `pnpm dev`.
Lo que no hay en ese modo son cuentas: la cabecera muestra el estado de visitante, y
`/login`, `/register` y todo lo que necesite sesión lo dicen en vez de fallar
([lib/supabase/config.ts](lib/supabase/config.ts) es la única fuente de esa respuesta, y el
proxy la consulta antes que nada).

### 3. Base de datos

Ejecuta [supabase/schema.sql](supabase/schema.sql) completo en el editor SQL de Supabase. Es
idempotente: crea tablas, índices, políticas RLS, triggers y funciones, y también sirve de
migración sobre una versión anterior del mismo archivo.

> **Vuelve a ejecutarlo tras actualizar.** La última versión añade la vista `media_catalog`,
> las funciones `search_media()` y `catalog_facets()` y la columna generada
> `episodes.search_text`, que son de donde sale ahora el catálogo entero. **Hasta que lo
> hagas la rejilla se queda vacía**, con el motivo en el log del servidor: es la única parte
> que no puede fallar en silencio. La versión anterior había añadido `watch_later`,
> `toggle_watch_later()` y el helper `episode_ref_of()`; si te saltaste aquella, «Ver
> después» se queda vacío y su botón responde con un error —eso sí sin romper la página—.
>
> Añadir `episodes.search_text` reescribe la tabla una vez. Es una columna generada, así que
> se mantiene sola; pero si alguna vez cambias el cuerpo de `episode_search_text()` hay que
> borrarla y volver a crearla para que el texto almacenado se recalcule.

### 4. Crear el administrador

Regístrate desde `/register` y luego promueve la cuenta a mano:

```sql
update profiles set role = 'admin' where username = 'tu_usuario';
```

El registro nunca puede crear un admin: el rol está fijado en el trigger
`handle_new_auth_user`, no se lee de los metadatos (que son manipulables por el cliente).

### 5. Desarrollo

```bash
pnpm dev          # http://localhost:3000
pnpm build
pnpm lint
pnpm okru:sync    # importación completa desde ok.ru (ver abajo)
```

---

## Importación desde ok.ru

Hay dos caminos que escriben a través del mismo módulo ([lib/okru-sync.ts](lib/okru-sync.ts)),
de modo que una colección queda igual venga por donde venga:

| | `/admin/import` | `pnpm okru:sync` |
|---|---|---|
| Cómo lee | `fetch` + cheerio | Playwright (navegador real) |
| Alcance | Primeros 20 videos por canal, [15 canales](lib/constants.ts) | Todo el catálogo, scrolleando hasta el final |
| Dónde corre | En el servidor web | En tu máquina (tarda minutos; excedería un timeout serverless) |
| Flags | — | `--dry-run`, `--limit N` |

ok.ru pagina de 20 en 20 y el "cargar más" exige una cabecera `tkn` que el sitio genera en
JavaScript y rota en cada carga: por eso el camino completo necesita un navegador de verdad.

**Las re-ejecuciones son incrementales.** Una colección se identifica por
`media_items.okru_channel_id`, nunca por título ni slug, así que renombrarla en `/admin` no
crea un duplicado: la siguiente sincronización solo añade los videos que faltan y respeta
todo lo que editaste (título, póster, géneros, estado de publicación). Lo importado entra
como borrador (`published = false`) hasta que lo publiques.

Un canal puede repartirse en varias colecciones (por ejemplo, extraer una película suelta);
solo una es la **primaria** (`okru_channel_primary`), y es a la que la sincronización añade
los videos nuevos.

> Los selectores del scraper se obtuvieron por ingeniería inversa del HTML real de ok.ru
> (29 jul 2026). ok.ru no tiene API pública para esto y puede cambiar su markup en cualquier
> momento y romperlos.

---

## Arquitectura

### Rutas

| Ruta | Qué es |
|---|---|
| `/` | Catálogo completo. El estado vive en la URL: `?tab`, `?q`, `?genre`, `?sort`, `?year`, `?month`, `?from`, `?to` |
| `/v/[slug]` | Un título: reproductor, ficha y lista de episodios. `?ep=12` (o `?ep=2x12`) abre un episodio concreto |
| `/login`, `/register` | Se entra con **nombre de usuario**, no con correo |
| `/account` | Cambiar usuario, correo y contraseña |
| `/me-gusta` | Los videos que le gustaron a la cuenta, cada uno enlazando a su episodio |
| `/ver-despues` | Los videos que la cuenta apartó para más tarde |
| `/historial` | Una entrada por colección, en el punto donde se dejó |
| `/auth/confirm` | Aterrizaje de los enlaces que Supabase envía por correo |
| `/admin` | Tabla del catálogo (incluye borradores) |
| `/admin/import` | Asistente de importación desde ok.ru |
| `/admin/media/new`, `/admin/media/[id]` | Formulario de colección |

Un título tiene página propia y, aun así, desde el catálogo se abre como modal:
[app/@modal/(.)v/[slug]](app/@modal/%28.%29v/%5Bslug%5D/page.tsx) **intercepta** esa
navegación y dibuja el reproductor sobre la grilla, que sigue montada con sus filtros y su
scroll intactos. Recargar esa misma URL, o llegar a ella desde fuera, cae en
[app/v/[slug]/page.tsx](app/v/%5Bslug%5D/page.tsx) y renderiza la página completa. Cerrar el
modal es un paso atrás en el historial, así que el botón «atrás» del navegador hace lo
esperable. Ambas rutas cargan por [lib/media-view.ts](lib/media-view.ts), para que no puedan
divergir.

El episodio activo viaja en `?ep=`, que es **temporada×número** y no el id de la fila: guardar
una colección en /admin borra y reinserta todos sus episodios (ver
[lib/media-write.ts](lib/media-write.ts) — por eso los contadores se traspasan por URL de
ok.ru), así que un uuid dejaría de resolver en la siguiente edición. Cambiar de episodio
reescribe la URL con `replaceState` en lugar de navegar: el video ya está en la página, y
apilar historial obligaría a recorrer episodio por episodio al cerrar. Un `?ep=` que no
resuelve reproduce el primero en vez de fallar.

En una colección episódica, **← y →** cambian al episodio anterior y al siguiente, igual que
los botones junto al título. El listener va en fase de captura sobre `window`: el popup del
diálogo de Base UI corta la propagación de las flechas para que no lleguen a widgets de fuera,
así que en fase de burbuja nunca se oirían. Se ignoran con modificadores (Alt+← es «atrás»),
con la tecla mantenida (cada paso carga un iframe y cuenta una vista) y cuando el foco está en
el buscador de episodios o en el menú de tamaño. Con el foco dentro del iframe de ok.ru las
flechas son suyas y adelantan el video: un documento de otro origen no nos pasa sus teclas.

Los enlaces antiguos `?play=<slug>` se redirigen a `/v/<slug>`, porque están compartidos
por ahí.

### Enlaces compartidos e indexación

`metadataBase` sale de `SITE_URL` (ver [lib/site-url.ts](lib/site-url.ts)), y de ahí cuelgan
el `canonical` y el `og:url` de cada título. Cada uno genera además su propia imagen de
vista previa en [opengraph-image.tsx](app/v/%5Bslug%5D/opengraph-image.tsx): póster, título,
tipo, rango de fechas y vistas, renderizados a PNG. El póster se descarga y se inserta como
data URL, de modo que un CDN que rechace la petición degrada a una tarjeta sin imagen en vez
de romper la ruta entera. [sitemap.xml](app/sitemap.ts) lista los títulos publicados —los lee
con la clave anónima, así que RLS deja fuera los borradores— y [robots.txt](app/robots.ts)
mantiene a los buscadores fuera de `/admin`, `/account`, las listas personales y los
formularios de sesión.

### Búsqueda y filtros

El catálogo se filtra **en Postgres** a partir de la URL. La función `search_media()`
([supabase/schema.sql](supabase/schema.sql)) recibe los filtros, ordena, cuenta y devuelve una
página; la vista `media_catalog` que consulta ya trae agregado lo que antes sumaba cada
tarjeta —número de episodios, vistas y me gusta de toda la colección— y las claves
normalizadas contra las que comparan los filtros. [lib/catalog.ts](lib/catalog.ts) la llama y
[lib/media-filter.ts](lib/media-filter.ts) valida cada valor de la URL antes de que llegue
allí; las mismas reglas siguen implementadas en JavaScript para los datos de ejemplo, que es
lo que se ve sin Supabase configurado.

Antes esto era `select("*, episodes(*)")` sin límite y todo el trabajo en JavaScript: el
catálogo entero —pósters, descripciones y una fila por stream— viajaba en cada petición, y
crecía sin techo con el canal. Con 400 colecciones y 60 000 episodios de prueba, esa consulta
son ~26 MB y ~134 ms; una página del catálogo son ~12 KB y ~10-25 ms, y una búsqueda sobre
todos los episodios ~16 ms. Ese último número depende de `episodes.search_text`, una columna
generada que almacena el título y la fecha ya normalizados: construirla al vuelo en cada
búsqueda costaba ~130 ms, leerla cuesta ~12 ms.

La rejilla se llena de 24 en 24 con **scroll infinito**
([catalog-feed.tsx](components/media/catalog-feed.tsx)). La primera página la renderiza el
servidor, así que lo primero que se ve no necesita JavaScript; las siguientes las pide un
`IntersectionObserver` con 800 px de margen —una pantalla de antelación— a través de una
server action, y hay un botón «Cargar más» que hace lo mismo para quien no llegue por el
scroll. El orden de `search_media()` es total (desempata por `created_at` y luego por `id`),
de modo que dos páginas consecutivas no pueden repetir ni saltarse una colección; aun así el
feed descarta los `id` que ya tiene, por si el catálogo cambió entre una y otra. Cambiar un
filtro es una navegación, no un estado del cliente: la página vuelve a montar el feed, así que
nunca se mezclan resultados de dos filtros.

Los encabezados por año cuentan la sección entera, no lo cargado hasta ese momento:
`search_media()` devuelve también el recuento por año de todo el resultado.

Dos de las listas de la barra **no están escritas a mano**, se derivan de los datos: los años
de stream y los géneros, cada uno con el número de colecciones que lo llevan. Salen de
`catalog_facets()`, sobre todo el catálogo publicado y no sobre la página cargada —son las
opciones disponibles, y una barra que solo ofreciera lo que los filtros actuales ya dejaron en
pie sería un callejón sin salida—. El formulario de /admin acepta géneros como texto libre,
así que una lista fija ofrecería géneros vacíos y nunca mostraría uno nuevo.

Como ese texto es libre, en el catálogo conviven grafías del mismo género que solo difieren
en tildes o mayúsculas. Se agrupan en una sola opción, y gana la que conserva los acentos
(«Fantasía» sobre «Fantasia») por ser la correcta; el filtro compara igual, de modo que
`?genre=Fantasia` y `?genre=Fantasía` devuelven lo mismo y los enlaces viejos siguen valiendo.

La barra es *sticky* y en móvil se queda en dos filas —pestañas y buscador—, porque el resto
(género, orden y fechas) se pliega en un `Sheet` con un badge que cuenta lo que hay dentro
([filter-bar.tsx](components/filters/filter-bar.tsx)). Los mismos controles se renderizan
inline en escritorio desde un único componente
([filter-controls.tsx](components/filters/filter-controls.tsx)), así que no hay dos versiones
que mantener. Debajo, los filtros activos aparecen como chips que se quitan uno a uno, con un
«Limpiar todo» que vacía también el buscador y la pestaña.

La búsqueda no mira solo el título de la colección: también su descripción y **los episodios**
—su título y su fecha de stream, para que valga tanto «30 junio» como «2026-06-30»—. En un
catálogo cuyo contenido real son streams sueltos, eso es lo que lo hace encontrable: la
colección se llama «H1NMTSR», pero lo que alguien recuerda es la noche que vio. Cuando lo que
coincide son episodios, la tarjeta lo dice («3 episodios coinciden») y su enlace abre
directamente en el primero, con el `?ep=` correspondiente.

### Lo que recuerda una cuenta

Tres listas:

- **Mis me gusta** (`/me-gusta`) sale de `video_likes`, con una fila por video.
- **Ver después** (`/ver-despues`) sale de `watch_later`, con la misma forma: una fila por
  persona y video, la colección más el episodio si lo hay. Se alterna desde el botón junto al
  me gusta del reproductor con `toggle_watch_later()`, y se vacía desde la propia lista. No
  lleva contador: cuánta gente guardó un video no le importa a nadie más.
- **Historial** y la estantería «Seguir viendo» del catálogo salen de `watch_history`, con
  una fila por colección: dónde retomarla y cuándo se abrió por última vez. La escribe
  `register_video_view()`, el mismo paso que ya contaba la reproducción, así que no hay una
  segunda ida y vuelta ni forma de falsear el historial desde el navegador — la tabla no tiene
  política de inserción.

El historial y «Ver después» guardan el episodio como el mismo `?ep=` que viaja en la URL
(«12», «2x12») y no como su id, por lo de siempre: guardar una colección en /admin reinserta
todos sus episodios y un id quedaría colgando. Es la única diferencia de forma entre
`watch_later` y `video_likes`, y es a propósito: ver «Dos cosas que conviene saber». Ninguna
de las dos tablas tiene política de inserción, así que toda referencia guardada la produjo
`episode_ref_of()` a partir de un episodio real, y siempre con la forma de `episodeParam()`.

Las listas se resuelven contra el catálogo ya cargado en memoria en vez de con un join,
de modo que un título despublicado desde entonces desaparece de la lista en lugar de
renderizarse como una fila muerta.

### «Nuevo» desde la última visita

Las tarjetas añadidas (`created_at`) desde la visita anterior llevan un badge «Nuevo» en la
esquina donde va «Visto»; si la colección ya se abrió, gana «Visto», porque para quien la vio
ya no es novedad. La referencia vive en una cookie propia, `novagiv_visit`, que
[proxy.ts](proxy.ts) actualiza en cada petición ([lib/last-visit.ts](lib/last-visit.ts)) y no
en `profiles`: la mayoría de quienes visitan el catálogo no tienen cuenta, y son justo a
quienes hay que darles un motivo para volver. A cambio, es por navegador y no por cuenta.

- Una visita termina tras **30 minutos** sin peticiones; la siguiente toma como referencia el
  final de la anterior, y la mantiene durante toda la visita, así que los badges no
  desaparecen al primer clic.
- En la primera visita no hay referencia y nada se marca: una tarjeta no puede ser nueva para
  quien nunca ha visto el catálogo.
- La cookie se reescribe como mucho una vez por minuto, y en la request (no solo en la
  respuesta), para que la misma petición que abre la visita ya se renderice con la nueva
  referencia.

Solo mira colecciones: un episodio nuevo en una serie en emisión no la marca, porque
`episodes` no tiene `created_at`.

### Modelo de datos

```
media_items ──< episodes
      │             │
      └──────┬──────┘
          video_likes  (user_id + (episode_id | media_item_id))

media_items ──< watch_later    (user_id + media_item_id + episode_ref?)
media_items ──< watch_history  (user_id + media_item_id → episode_ref)

profiles (1:1 con auth.users)      okru_channels (catálogo para el importador)
```

Sobre `media_items` y `episodes` hay además una vista, `media_catalog`: una fila por colección
con los contadores ya sumados y las claves normalizadas que comparan los filtros. Es de donde
lee `search_media()`, y es `security_invoker`, así que las mismas políticas RLS de las tablas
de debajo deciden lo que ve quien pregunta.

Una colección es **episódica** (series, anime) o de **video único** (película, karaoke,
especial). Esa distinción recorre todo el código: el video único guarda su `okru_embed_url`,
sus vistas y sus me gusta en la propia fila de `media_items`; la episódica los guarda en cada
episodio. Por eso los totales que ve el visitante se derivan al leer —en la vista para la
rejilla, con `totalViewsOf` y `totalLikesOf` de [types/media.ts](types/media.ts) donde ya hay
un `MediaItem` completo en la mano— y nunca se almacenan sumados: mover un episodio a otra
colección no puede descuadrarlos.

Las fechas de stream se guardan como `timestamp` **sin zona horaria** y se formatean sin pasar
por `Date` ([lib/stream-date.ts](lib/stream-date.ts)): un stream de las 00:19 no debe
retroceder un día al renderizarse en un huso negativo.

### Autenticación y roles

Supabase Auth no conoce el concepto de *username*, así que `profiles` es la mitad que falta:
`auth.users` guarda correo y contraseña, `profiles` guarda usuario y rol, y dos triggers los
mantienen sincronizados. El correo está duplicado a propósito, porque iniciar sesión por
usuario obliga a resolverlo contra un correo en el servidor y ese lookup no debería tener que
entrar al esquema `auth`.

Tres capas de defensa, en este orden:

1. [proxy.ts](proxy.ts) → [lib/supabase/middleware.ts](lib/supabase/middleware.ts): refresca
   la cookie de sesión en todo el sitio, bloquea `/admin` por rol y `/account` por sesión.
   Se salta la ida y vuelta al servidor de auth cuando la petición no trae cookie, que es la
   mayor parte del tráfico del catálogo público.
2. `requireAdminClient()` en [lib/auth.ts](lib/auth.ts): falla rápido en las acciones.
3. **RLS en Postgres**: la que realmente manda. El catálogo público solo ve
   `published = true`; escribir exige `is_admin()`.

Detalle que vale la pena conocer: la política de `profiles` se acompaña de un
`grant update (username)`. Un `with check` no puede saber *qué columnas* tocó un `update`, así
que sin ese grant la política aceptaría `set role = 'admin'`.

### Contadores

Ambos son la excepción a "el sitio público no escribe", y cada uno por una vía distinta:

- **Vistas** — `register_video_view`, `security definer`, ejecutable por anónimos. Una vista
  es "abierto en el reproductor" (el iframe de ok.ru nunca informa si se reprodujo de verdad),
  y el cliente la marca en `sessionStorage` para contarla una sola vez por sesión.
- **Me gusta** — `toggle_video_like`, solo para sesiones iniciadas: un me gusta anónimo no se
  podría deshacer y volvería a contarse desde el siguiente navegador. Decide alta o baja y lee
  el nuevo total dentro de una transacción, así que dos personas votando a la vez no se pasan
  un número obsoleto. Los totales se desnormalizan en `like_count` mediante trigger, y volver a
  correr `schema.sql` los recalcula desde los me gusta reales.

Ninguno revalida el catálogo: mover un número no justifica re-renderizar la grilla que hay
detrás del reproductor abierto. Las tarjetas se ponen al día en la siguiente carga.

---

## Revisión de UX y producto — 17 de septiembre de 2026

Hallazgos de una revisión del catálogo, el reproductor, los filtros, el esquema y el panel.
La base es sólida; lo que sigue son huecos concretos, ordenados por impacto.

### Fricciones detectadas

> **Ya resueltos.** Cinco de los hallazgos de abajo están implementados:
>
> - **Página por título y episodio en la URL** — `/v/[slug]`, la ruta que la intercepta como
>   modal, `?ep=`, la imagen OG por título, `sitemap.ts`, `robots.ts`, `error.tsx` y
>   `not-found.tsx`. Ver «Enlaces compartidos e indexación». De paso se corrigió que el foco
>   inicial del modal cayera dentro del iframe de ok.ru, lo que dejaba el diálogo sin poder
>   cerrarse con Escape.
> - **Búsqueda sobre episodios y descripción, y géneros derivados** con su conteo. Ver
>   «Búsqueda y filtros».
> - **La barra de filtros en móvil** — plegada en un `Sheet` con badge, más chips de filtros
>   activos y «Limpiar todo». Pasó de ocupar media pantalla a 109 px en un teléfono de 844 px.
>   De paso se corrigió que el debounce del buscador reescribiera la URL con los parámetros
>   que había capturado 300 ms antes, lo que deshacía «Limpiar todo».
>
> Derivar los géneros sacó a la luz un problema de datos que la lista fija ocultaba: hay
> duplicados en el catálogo. El código agrupa los que solo difieren en tildes o mayúsculas
> («Fantasia»/«Fantasía»), pero quedan pares que son dos nombres distintos para lo mismo y
> solo se arreglan editando los títulos en /admin: «Sobrenatural» (14) y «Supernatural» (7),
> «Recuerdos de vida» (11) y «Recuentos de la vida» (1), «Suspenso» (5) y «Thriller» (1).

**No hay recuperación de contraseña.** El formulario de registro promete que el correo sirve
para "recuperarla" ([register-form.tsx:49](components/auth/register-form.tsx#L49)) y la ruta
de confirmación ya acepta el tipo `recovery`
([auth/confirm/route.ts:13](app/auth/confirm/route.ts#L13)), pero no existen ni el formulario
de "olvidé mi contraseña" ni la página para fijar la nueva. Es la mitad de un flujo ya
construido.

**Trabajo muerto:** `rating` se guarda y se edita en el panel
([media-form.tsx:403](components/admin/media-form.tsx#L403)) pero no se muestra en ninguna
parte del sitio público; `thumbnail_url` de los episodios se scrapea y se guarda pero la lista
del reproductor solo pinta un icono.

### Funcionalidades propuestas

Aprovechando que ya existen cuentas y `video_likes`. Las ocho primeras ya están
implementadas:

| Idea | Por qué encaja | Esfuerzo |
|---|---|---|
| ~~Página "Mis me gusta"~~ **hecho** | La tabla y su RLS ya existen; falta la consulta y la vista | Muy bajo |
| ~~Miniaturas en la lista de episodios~~ **hecho** | `thumbnail_url` ya está poblado y sin usar | Muy bajo |
| ~~Siguiente/anterior episodio y autoplay~~ **hecho** | Hoy hay que volver a la lista para cada stream | Bajo |
| ~~Buscador dentro de la lista de episodios~~ **hecho** | Un canal de 200 streams da una lista interminable dentro del modal | Bajo |
| ~~"Seguir viendo" / historial~~ **hecho** | Las vistas ya se marcan en `sessionStorage`; guardarlas por cuenta da historial y marca de "visto" en la tarjeta | Bajo |
| ~~Badge "Nuevo"~~ **hecho** | Con `created_at` contra la última visita; da motivo para volver | Bajo |
| ~~Atajos de teclado (←/→)~~ **hecho** | El modal ya cierra con Esc; falta navegar episodios | Bajo |
| ~~Lista "ver después"~~ **hecho** | Complementa los me gusta, misma forma de tabla | Medio |
| Comentarios por video | Misma clave que los me gusta; es lo que convierte el catálogo en comunidad. Exige plan de moderación | Medio |
| Estado en vivo real | `isLive` hoy es un mock estático ([mock-data.ts:15](lib/mock-data.ts#L15)); la API Helix de Twitch con `revalidate: 60` lo haría real | Medio |
| Colecciones curadas | "Maratón de terror", "Karaokes 2025": una portada editorial en vez de solo grilla cronológica | Medio |

### Panel de administración

- La tabla del dashboard no tiene buscador, filtros ni paginación
  ([admin/page.tsx:44](app/admin/%28dashboard%29/page.tsx#L44)). Con 200 títulos deja de ser
  usable.
- **Estadísticas**: `view_count` y `like_count` ya están en ambas tablas. Un "top 10 de la
  semana" y una curva de vistas son casi gratis, y le dan al streamer una razón para entrar.
- **Sincronización automática**: hoy `pnpm okru:sync` es manual. Un cron (Vercel Cron o
  `pg_cron`) más una página con el resultado de las últimas ejecuciones cerraría el ciclo.
- **Autocompletar metadatos** desde TMDB o AniList al crear un título: los CDN ya están
  permitidos en [next.config.ts:18](next.config.ts#L18), así que la intención ya estaba ahí.

### Dos cosas que conviene saber

**Un me gusta sobre un episodio no sobrevive a una edición de su colección.**
`video_likes.episode_id` referencia `episodes (id) on delete cascade`, y guardar una colección
en /admin borra y reinserta todos sus episodios ([lib/media-write.ts](lib/media-write.ts)):
los me gusta de esos videos se van con ellos. Las vistas sí se traspasan a mano por URL de
ok.ru, los me gusta no. Ahora que existe una página que los lista, el agujero se nota. El
arreglo es cambiar la clave del me gusta a temporada/número, como ya hacen `?ep=`, el
historial y «Ver después», y traspasarlos en `writeMediaItem` igual que los contadores.
`watch_later` se diseñó así desde el principio precisamente para no heredar este agujero.

**El autoplay es solo al cambiar de episodio.** El iframe de ok.ru es de otro origen y no
avisa de nada, así que no hay forma de saber cuándo termina un video: encadenar al siguiente
por sí solo no es posible con este reproductor. Lo que sí hace es arrancar reproduciendo
cuando el episodio se elige con un clic, que es cuando la política de autoplay del navegador
lo permite.

### Base técnica

- No hay tests ni CI.
- Las primeras imágenes de la grilla no llevan `priority`
  ([media-card.tsx:47](components/media/media-card.tsx#L47)), lo que castiga el LCP. Un
  `placeholder="blur"` o un fondo de color mientras cargan quitaría el efecto de grilla vacía.

### Roadmap sugerido

1. ~~**`/v/[slug]` con intercepting routes**~~ — hecho.
2. ~~**"Mis me gusta" e historial**~~ — hecho.
3. ~~**Filtros en `Sheet` en móvil**~~ — hecho.
4. **Paginación en servidor** — antes de que el catálogo crezca lo suficiente como para dolerte.
