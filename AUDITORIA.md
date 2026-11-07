# Auditoría técnica — NovaGiv

> Fecha: 2026-11-07 · Alcance: todo el repositorio (`app/`, `components/`, `lib/`, `proxy.ts`, `next.config.ts`, `supabase/schema.sql`, `scripts/`).
> Stack: Next.js 16.2 (App Router) · React 19.2 · Supabase (SSR + RLS) · Vercel.
>
> Marca cada tarea con `[x]` al completarla. Los IDs (`SEC-1`, `COST-2`…) sirven para referirse a ellas.

## Resumen

| Severidad | Nº | Más importantes |
|---|---|---|
| CRÍTICO | 0 | — |
| ALTO | 7 | Redirección abierta en `?next=`, el contador de vistas evita el rate limit, `remotePatterns` comodín (agotan cuota de imágenes), sin cabeceras de seguridad, escritura no atómica de episodios, todo el sitio se renderiza dinámico, saltos de CLS en la home |
| MEDIO | 14 | Rate limit en memoria, `getUser()` repetido, historial sin límite, scroll infinito vía Server Action, falta de validación de esquemas en admin… |
| BAJO | 12 | Código muerto, `sessionStorage` sin `try/catch`, JSON-LD, tipos de Supabase… |

**Lo que ya está bien hecho** (no requiere acción): RLS activado en todas las tablas y funciones `security definer` con `search_path` fijo; `search_media` limita `p_limit` a 60 en SQL; el webhook de email verifica la firma HMAC con `timingSafeEqual` y una ventana de tiempo; Turnstile + rate limit por IP y por usuario en login/registro/reset; mensajes de error genéricos (no se puede averiguar si una cuenta existe); `server-only` en todos los módulos que tocan secretos; `.env*` ignorado y sin secretos en el historial de git; `error.tsx` muestra solo el `digest`; el proxy no consulta el servidor de auth para visitantes sin cookie; sitemap/robots/`generateMetadata`/OG image ya implementados.

---

## 1. Consumo de recursos y cuotas en Vercel

### Image Optimization

- [x] **COST-0 · [MEDIO] Configuración de imágenes y `sizes`** — ya aplicado: `deviceSizes`/`imageSizes` reducidos, solo WebP, `minimumCacheTTL` de 30 días, `sizes` en el banner y `unoptimized` en las miniaturas de episodios de ok.ru.

- [x] **COST-1 · [ALTO] `remotePatterns` con comodines permiten que cualquiera gaste tu cuota de transformaciones**
  - `next.config.ts:17-40` — `*.supabase.co`, `*.okcdn.ru`, `*.mycdn.me`, `m.media-amazon.com`, `*.anilist.co`, `image.tmdb.org`, `cdn.myanimelist.net`.
  - **Por qué:** `/_next/image?url=…&w=…` es un endpoint público. Con `*.supabase.co`, *cualquier* proyecto Supabase del mundo (o cualquier imagen de Amazon/TMDB) puede transformarse a tu costa: basta un script que pida URLs distintas para agotar las 5K transformaciones del plan.
  - **Solución:** fijar el hostname exacto de tu proyecto Supabase (`<ref>.supabase.co`) y añadir `pathname` a cada patrón (p. ej. `/storage/v1/object/public/**`, `/images/M/**` para Amazon, `/t/p/**` para TMDB). Quitar `picsum.photos` en producción y los hosts de ok.ru (sus miniaturas ya van con `unoptimized`).

- [ ] **COST-2 · [BAJO] El banner del perfil es un placeholder de picsum en producción**
  - `lib/mock-data.ts:14` — `https://picsum.photos/seed/novagiv-banner/1600/400`, y además se precarga con `priority` (ver CWV-2).
  - **Solución:** subir un banner real a `public/` (import estático → se optimiza en build, sin coste en runtime) o quitarlo.

### Function Invocations y Fluid Active CPU

- [ ] **COST-3 · [ALTO] Todo el sitio público se renderiza de forma dinámica en cada visita**
  - `app/layout.tsx:60` (`getStreamerProfile`), `components/layout/site-header.tsx` (`AccountMenu` → `getAccount` → `cookies()`), `lib/catalog.ts:169` (`cookies()` para la última visita), `lib/queries.ts:215` (`getMediaBySlug` usa el cliente con cookies), `lib/auth.ts:73`.
  - **Por qué:** cualquier lectura de `cookies()`/`headers()`/`searchParams` en el layout o la página obliga a un renderizado dinámico. Cada visita a `/` o `/v/[slug]` — incluidas las de bots y las precargas de `<Link>` — es una invocación de función + consultas a Supabase, aunque el 95 % del contenido sea idéntico para todos los visitantes anónimos. `React.cache()` solo deduplica *dentro* de una petición.
  - **Solución (por fases):**
    1. Separar las lecturas públicas en funciones que usen un cliente **sin sesión** (como ya hace `getSitemapEntries`) y cachearlas entre peticiones con `unstable_cache` / `"use cache"` + `cacheTag("catalog")`. Las acciones de admin (`lib/actions/media.ts`, `okru-import.ts`, `channel-collections.ts`) ya llaman a `revalidatePath` → cambiar a `revalidateTag("catalog")`.
    2. Activar `cacheComponents: true` (Partial Prerendering en Next 16): el shell (cabecera, perfil, filtros, primera página del catálogo) queda estático en la CDN, y solo las piezas que dependen del usuario (`AccountMenu`, `ContinueWatching`, insignias «Visto»/«Nuevo») se envuelven en `<Suspense>` y se renderizan de forma dinámica.
    3. `canSeeViewCounts` hace que `getMediaBySlug` dependa del usuario: devolver el ítem sin contadores en la parte cacheada y añadir los contadores en una isla aparte solo para admins.

- [ ] **COST-4 · [MEDIO] El proxy llama a `getUser()` (ida y vuelta al servidor de Auth) en cada petición de un usuario con sesión**
  - `lib/supabase/middleware.ts:66` — el matcher cubre todas las páginas, incluidas las peticiones RSC de precarga.
  - **Por qué:** un usuario con sesión que navega por el catálogo genera una llamada HTTP a Supabase Auth por cada petición (más latencia y CPU, y presión sobre los límites de Auth).
  - **Solución:** usar `supabase.auth.getClaims()` (verifica el JWT en local con claves asimétricas; requiere activar *JWT Signing Keys* en Supabase) en el proxy y en las páginas; reservar `getUser()` para operaciones sensibles (cambio de email/contraseña, `/admin`).

- [ ] **COST-5 · [MEDIO] `getUser()` se repite varias veces por render**
  - `lib/auth.ts:36` (`getAccount`), `lib/queries.ts:336, 377, 421, 515` (`getLikedVideos`, `getWatchLaterVideos`, `getWatchHistory`, `getViewerVideoIds`).
  - **Por qué:** en `/` con sesión se hacen 2 viajes a Auth (`getAccount` + `getWatchHistory`); en `/v/[slug]`, 2 más el del proxy. Cada uno es latencia en serie.
  - **Solución:** una sola función cacheada por petición, `getSessionUser = cache(...)`, que usen todas (o `getClaims()`, ver COST-4).

- [ ] **COST-6 · [MEDIO] El scroll infinito usa una Server Action (POST, nunca cacheable)**
  - `components/media/catalog-feed.tsx:60` → `lib/actions/catalog.ts`.
  - **Por qué:** cada página de 24 títulos es una invocación de función que ni la CDN ni el navegador pueden cachear, aunque el resultado sea el mismo para todos los anónimos.
  - **Solución:** un Route Handler `GET /api/catalog?…&offset=` con `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` para la parte pública; el estado del usuario («Visto», «Nuevo») se resuelve en el cliente o en una petición aparte pequeña (ids → booleanos).

- [ ] **COST-7 · [MEDIO] La imagen OG se genera en cada petición y descarga el póster sin timeout ni límite de tamaño**
  - `app/v/[slug]/opengraph-image.tsx:33` — `fetch(url)` sin `signal` ni límite de bytes; depende de `getMediaBySlug` (cookies → dinámica).
  - **Por qué:** cada vez que alguien comparte un enlace, cada bot de Discord/WhatsApp/X pide la imagen → se genera de nuevo (CPU de `ImageResponse` + descarga del póster). Un CDN lento mantiene la función viva hasta el timeout (Fluid Active CPU / duración).
  - **Solución:** `AbortSignal.timeout(3000)`, rechazar respuestas con `content-length` > ~2 MB, leer el ítem con el cliente sin sesión y cacheado (COST-3) y devolver `Cache-Control: public, s-maxage=86400, stale-while-revalidate`.

### Fast Origin Transfer y CDN

- [ ] **COST-8 · [MEDIO] «Seguir viendo» carga el historial entero con todos los episodios de cada título para mostrar 12**
  - `lib/queries.ts:413-445` (`getWatchHistory`), usado por `components/media/continue-watching.tsx:24`.
  - **Por qué:** `select *, episodes(...)` por cada título del historial, sin `limit`. Con un historial de 100 series de 200 episodios, la home de ese usuario mueve miles de filas en cada visita.
  - **Solución:** `getWatchHistory({ limit })` con `.limit(SHELF_LIMIT)` para la estantería, y en la consulta de los ítems pedir solo el episodio referenciado (o `episodes(count)` + el episodio por `episode_ref`) en lugar de la lista completa. Un `count` aparte para el texto «Ver todo el historial (N)».

- [ ] **COST-9 · [MEDIO] `/me-gusta`, `/ver-despues`, `/historial` y el panel de admin no tienen paginación**
  - `lib/queries.ts:330, 369, 413` y `lib/queries.ts:183` (`getAllMediaItemsForAdmin`: todo el catálogo con todos los episodios).
  - **Solución:** paginar (offset/cursor de 50) y, en el dashboard de admin, pedir `episodes(count)` en vez de las filas completas.

- [ ] **COST-10 · [BAJO] Sin cabeceras `Cache-Control` explícitas en respuestas propias**
  - El sitemap (`app/sitemap.ts`) se genera en cada petición. **Solución:** `export const revalidate = 3600` en `sitemap.ts`.

---

## 2. Seguridad y superficie de ataque

- [x] **SEC-1 · [ALTO] Redirección abierta en `?next=` (comprobado)**
  - `lib/url.ts:18-22` (`safeRedirectPath`), usado en `app/auth/confirm/route.ts:43,46`, `lib/supabase/middleware.ts:97` y `lib/actions/auth.ts:76,139`.
  - **Por qué:** el filtro rechaza `//` y `/\`, pero el parser de URL de WHATWG **elimina tabuladores y saltos de línea**: `new URL("/\t/evil.com", base)` → `https://evil.com/`. Un enlace `https://novagiv…/login?next=/%09/evil.com` lleva al usuario, *tras iniciar sesión correctamente*, a un dominio del atacante (phishing con la confianza ya ganada). Lo mismo con `/auth/confirm?…&next=`.
  - **Solución:** resolver y comparar el origen en lugar de mirar prefijos:
    ```ts
    export function safeRedirectPath(value?: string | null): string | null {
      if (!value || /[\u0000-\u001F\\]/.test(value)) return null;
      try {
        const url = new URL(value, "http://x.invalid");
        if (url.origin !== "http://x.invalid") return null;
        return url.pathname + url.search + url.hash;
      } catch { return null; }
    }
    ```

- [ ] **SEC-2 · [ALTO] El contador de vistas se puede inflar sin pasar por el rate limit**
  - **Estado:** código hecho (`lib/actions/views.ts` usa la clave de servicio y pasa `p_user_id`; `supabase/schema.sql` actualizado). **Pendiente:** ejecutar el bloque SQL de `register_video_view` en Supabase y desplegar.
  - `supabase/schema.sql:447-448` — `grant execute on function register_video_view(...) to anon, authenticated`.
  - **Por qué:** el rate limit vive en la Server Action `lib/actions/views.ts`, pero la función SQL también es invocable **directamente** vía PostgREST con la anon key, que es pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). `POST /rest/v1/rpc/register_video_view` en bucle infla cualquier contador sin límite.
  - **Solución:** `revoke execute … from anon, authenticated` y `grant … to service_role`; la Server Action pasa a llamarla con `createAdminClient()` y el `user_id` validado del servidor (la función recibe `p_user_id` en vez de leer `auth.uid()`). Alternativa: rate limit dentro de SQL (tabla `view_events` por IP/hora).

- [x] **SEC-3 · [ALTO] Sin cabeceras de seguridad**
  - `next.config.ts` (no tiene `headers()`), `proxy.ts`.
  - **Por qué:** sin `frame-ancestors`/`X-Frame-Options`, el login y el panel de admin se pueden incrustar en un iframe de otro sitio (clickjacking). Tampoco hay CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ni HSTS.
  - **Solución:** en `next.config.ts`:
    ```ts
    async headers() {
      return [{ source: "/(.*)", headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-src https://ok.ru https://challenges.cloudflare.com" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]}];
    },
    poweredByHeader: false,
    ```
    Una CSP completa (`script-src` con nonce) puede venir después; empezar con las directivas de arriba no rompe nada.

- [ ] **SEC-4 · [MEDIO] El rate limit vive en la memoria de cada instancia**
  - `lib/rate-limit.ts` (lo usan `lib/bot-guard.ts`, `lib/actions/auth.ts` y `lib/actions/views.ts`).
  - **Por qué:** en Vercel (Fluid) hay varias instancias, que se reciclan; cada una lleva su propio conteo y lo pierde en un arranque en frío. El límite real es «N × instancias» y se reinicia al azar. Turnstile mitiga el login, pero no el registro de vistas ni el bot guard.
  - **Solución:** el propio archivo lo prevé: cambiar la implementación por Upstash Redis (`@upstash/ratelimit`, gratuito en Vercel Marketplace) o una tabla de Supabase. También se puede activar el **Firewall de Vercel** (reglas de rate limit por ruta, gratis en Hobby) para `/login`, `/register`, `/recuperar`.

- [ ] **SEC-5 · [MEDIO] Las acciones de admin no validan la entrada con un esquema**
  - `lib/actions/media.ts:15` (`upsertMediaItem(input: MediaFormInput)`), `lib/media-write.ts:163`, `lib/actions/channel-collections.ts`.
  - **Por qué:** los tipos de TypeScript no existen en runtime; una Server Action recibe lo que envíe el cliente. `posterUrl`, `okRuEmbedUrl`, `genres`, `rating`, `status` y `episodes[]` llegan sin validar: un póster de un host no permitido rompe `next/image` en el catálogo, y un `okRuEmbedUrl` que no sea de ok.ru acaba como `src` de un `<iframe>` público.
  - **Solución:** esquema Zod para `MediaFormInput` (`posterUrl` con host en lista blanca, `okRuEmbedUrl` que empiece por `https://ok.ru/videoembed/`, límites de longitud, `episodes.max(1000)`) y `schema.parse(input)` al inicio de cada acción. Añadir `sandbox="allow-scripts allow-same-origin allow-presentation"` al `<iframe>` del reproductor (`components/player/media-player.tsx:316`) como defensa adicional.

- [ ] **SEC-6 · [BAJO] Las acciones de usuario no validan los ids**
  - `lib/actions/likes.ts`, `watch-later.ts`, `history.ts` aceptan cualquier string (Postgres los rechaza, pero se gasta una invocación y un viaje a la BD). **Solución:** reutilizar la validación `UUID` de `lib/actions/views.ts`.

- [ ] **SEC-7 · [BAJO] `getSiteUrl()` se fía de `x-forwarded-host` si falta `SITE_URL`**
  - `lib/site-url.ts:20-25` — se usa para los enlaces de los emails de registro y reset. En Vercel la cabecera la escribe la plataforma, pero en otro hosting permitiría *host header injection* en los correos.
  - **Solución:** exigir `SITE_URL` en producción (o usar `getPublicSiteUrl()` también aquí).

- [ ] **SEC-8 · [BAJO] Los contadores de vistas «solo para admin» se pueden leer por la API REST**
  - `VIEW_COUNTS_ADMIN_ONLY` los quita del HTML, pero `media_items.view_count`/`episodes.view_count` son legibles con la anon key (`/rest/v1/media_items?select=view_count`).
  - **Solución:** si debe ser secreto de verdad, `revoke select (view_count) on media_items, episodes from anon` y exponerlos solo a través de la vista/RPC.

- [ ] **SEC-9 · [BAJO] El webhook de email no deduplica `webhook-id`**
  - `app/api/auth/email-hook/route.ts` — una petición firmada capturada podría reenviarse dentro de la ventana de 5 minutos (reenvía el mismo email). Riesgo bajo.

**Secretos:** sin hallazgos. Solo tres variables `NEXT_PUBLIC_*` (URL y anon key de Supabase, site key de Turnstile), todas públicas por diseño. `SUPABASE_SERVICE_ROLE_KEY`, `TWITCH_CLIENT_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY` y `SEND_EMAIL_HOOK_SECRET` solo se leen en módulos `server-only` o en scripts. El historial de git no contiene `.env` ni JWTs.

---

## 3. Arquitectura y rendimiento (App Router)

- [ ] **ARQ-1 · [ALTO] Escritura no atómica de colecciones: se pueden perder episodios**
  - `lib/media-write.ts:228-245` (`writeMediaItem`: borra todos los episodios → los inserta) y `lib/actions/media.ts:83-85` (`seedMockData`).
  - **Por qué:** son llamadas separadas a PostgREST, sin transacción. Si el `insert` falla (constraint, timeout, datos inválidos), la colección queda **sin episodios** y los contadores de vistas se pierden. Lo mismo pasa entre el `update` de `media_items` y la gestión de episodios.
  - **Solución:** mover la escritura a una función SQL `save_media_item(p_item jsonb, p_episodes jsonb)` que haga `update/insert` + `delete` + `insert` dentro de una transacción (las funciones plpgsql son atómicas) y llamarla con `supabase.rpc`.

- [ ] **ARQ-2 · [MEDIO] Peticiones en cascada en la vista de un título**
  - `lib/media-view.ts:24-30` (`getMediaBySlug` → después `getViewerVideoIds`); `lib/queries.ts:215-243` (consulta → después `canSeeViewCounts` → `getAccount` → `getUser`).
  - **Solución:** lanzar en paralelo la consulta del ítem y la sesión (`Promise.all([getMediaBySlug(slug), getSessionUser()])`), y hacer que las consultas de likes/«ver después» filtren por `slug` mediante un join, para no tener que esperar al `id`.

- [ ] **ARQ-3 · [MEDIO] No hay `loading.tsx` en las rutas con datos**
  - `app/v/[slug]/`, `app/@modal/(.)v/[slug]/`, `app/historial/`, `app/me-gusta/`, `app/ver-despues/`, `app/account/`.
  - **Por qué:** al pulsar una tarjeta, el modal no aparece hasta que el servidor responde; en una conexión lenta parece que el clic no ha hecho nada.
  - **Solución:** `loading.tsx` con el esqueleto del reproductor en `(.)v/[slug]` y `v/[slug]` (se precarga con el `<Link>` y se muestra al instante).

- [ ] **ARQ-4 · [BAJO] Falta `app/global-error.tsx`**
  - Un error en el root layout (p. ej. al resolver `getStreamerProfile`) no lo captura `app/error.tsx`. **Solución:** añadir `global-error.tsx` con su propio `<html><body>`.

- [ ] **ARQ-5 · [BAJO] `"use client"` — sin hallazgos importantes**
  - Las páginas y layouts son Server Components; `"use client"` está en las hojas (formularios, reproductor, filtros). Lo único mejorable: `components/player/media-player.tsx` (879 líneas) es un único componente cliente que incluye partes estáticas (ficha, géneros, descripción). Separar `MediaDetails` como Server Component reduciría el JS hidratado del modal. Prioridad baja.

---

## 4. Calidad de código y mantenibilidad

- [ ] **CAL-1 · [MEDIO] Las filas de Supabase se tipan con aserciones (`as`)**
  - `lib/queries.ts` (`data as MediaItemRow[]`, `row.media_item_id as string`…), `lib/catalog.ts:233`, `lib/actions/channel-collections.ts`. No hay `any` explícito, pero las aserciones ocultan desajustes entre el esquema y el código.
  - **Solución:** `supabase gen types typescript --project-id <ref> > types/database.ts` y `createClient<Database>()`; las consultas pasan a estar tipadas sin `as`.

- [ ] **CAL-2 · [BAJO] Lógica duplicada**
  - `lib/okru-sync.ts:89` `streamRangeOf` duplica `lib/media-write.ts:36`; `lib/okru-sync.ts:98` `slugify` duplica `lib/text.ts:32`. **Solución:** importar las versiones compartidas (`okru-sync.ts` lo usa también el script de `tsx`, así que deben vivir en módulos sin `server-only`).

- [ ] **CAL-3 · [BAJO] Código y recursos muertos**
  - `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` (plantilla de create-next-app, sin referencias).
  - `components/layout/social-links.tsx:14,17` — entradas `youtube` y `x` ya sin uso.
  - El perfil de producción se llama `MOCK_STREAMER` y vive en `lib/mock-data.ts`: moverlo a `lib/streamer-profile.ts` para que no parezca un dato de prueba.

- [ ] **CAL-4 · [BAJO] Efectos en el cliente**
  - `components/player/media-player.tsx:81-82` — `sessionStorage` sin `try/catch` (lanza error en modo privado de Safari antiguo o con el almacenamiento bloqueado → el reproductor falla). Envolverlo.
  - `components/player/media-player.tsx:841` — `setTimeout` de «Copiado» sin limpiar al desmontar (aviso inofensivo; guardar el id y limpiarlo).
  - `components/filters/filter-bar.tsx:146` — `eslint-disable exhaustive-deps` justificado y documentado; sin cambios.
  - El resto de listeners (`keydown`, `storage`, `IntersectionObserver`) se limpian correctamente.

- [ ] **CAL-5 · [BAJO] Dependencias**
  - `shadcn` está en `dependencies` pero solo se usa su CSS (`globals.css`); comprobar si puede ir a `devDependencies`.
  - Avisos de dependencias incompatibles (`@emnapi/*` ← `@napi-rs/wasm-runtime`): revisar con `pnpm peers check` al actualizar.

---

## 5. SEO, accesibilidad y Core Web Vitals

- [ ] **CWV-1 · [ALTO] Saltos de diseño (CLS) en la home para usuarios con sesión y en móvil**
  - `app/page.tsx:43` (`<Suspense fallback={null}><ContinueWatching/>`) y `app/page.tsx:51` (`CatalogGuestBanner`).
  - **Por qué:** la estantería «Seguir viendo» (~320 px) y el banner de invitado llegan en streaming *después* del primer pintado y **encima** de los filtros y la cuadrícula, empujándolo todo hacia abajo. Es un CLS alto, justo en la página principal.
  - **Solución:** fallback con un esqueleto de altura fija cuando hay cookie de sesión (se puede saber con `cookies()` sin ir a la red), o reservar el espacio con `min-h`. En móvil, renderizar el banner de invitado en el mismo boundary que la cuadrícula.

- [ ] **CWV-2 · [MEDIO] LCP: la imagen precargada no es la que se ve en móvil**
  - `components/profile/profile-header.tsx:31` — el banner lleva `priority`, pero su sección es `hidden md:block`: en móvil se precarga una imagen invisible que compite con las carátulas, que son el LCP real.
  - `components/media/media-card.tsx:63` — ninguna tarjeta lleva `priority`/`fetchPriority`.
  - **Solución:** quitar `priority` del banner (o usar `fetchPriority="low"`) y pasar `priority` a las primeras 4-6 tarjetas de la primera página (`MediaGrid` sabe el índice).

- [ ] **SEO-1 · [BAJO] Sin datos estructurados**
  - `app/v/[slug]/page.tsx` — añadir JSON-LD `VideoObject` / `TVSeries` (nombre, miniatura, `uploadDate` = fecha del stream, `embedUrl`) para que aparezcan resultados enriquecidos.

- [ ] **SEO-2 · [BAJO] Detalles de `robots` y metadatos**
  - `app/robots.ts` — `host` no es una directiva estándar (solo la usaba Yandex); se puede quitar.
  - Las páginas privadas (`/historial`, `/me-gusta`, `/ver-despues`, `/account`) ya están bloqueadas en robots; añadir también `robots: { index: false }` en su `metadata` (robots no impide indexar una URL enlazada desde fuera).
  - `app/layout.tsx:24` — la descripción global aún menciona «especiales y karaokes», que ahora están ocultos.

- [ ] **A11Y-1 · [BAJO] Accesibilidad — en general correcta**
  - `aria-current`, `aria-label` en la navegación, `alt` en las carátulas y `title` en el `<iframe>` ya están. Revisar el contraste de `text-muted-foreground/50` en las pestañas «Pronto» (ahora ocultas) y de `text-outline` en etiquetas pequeñas (`text-[10px]`/`text-[11px]`) frente a WCAG AA.

---

## Plan de acción por fases

### Fase 1 — Seguridad urgente (poco esfuerzo, mucho impacto) · ~1 h
1. **SEC-1** Redirección abierta en `safeRedirectPath`.
2. **COST-1** Restringir `remotePatterns` (evita que terceros agoten tu cuota de imágenes).
3. **SEC-3** Cabeceras de seguridad en `next.config.ts`.
4. **SEC-2** Cerrar `register_video_view` a `anon`/`authenticated` (requiere ejecutar SQL en Supabase).

### Fase 2 — Integridad de datos y abuso · ~2-3 h
5. **ARQ-1** Guardado transaccional de colecciones (función SQL).
6. **SEC-5** Validación con Zod en las acciones de admin + `sandbox` en el iframe.
7. **SEC-4** Rate limit compartido (Upstash o Vercel Firewall).

### Fase 3 — Coste y rendimiento en Vercel · ~1 día
8. **COST-3** Capa de lectura pública cacheada con tags + `cacheComponents` (PPR).
9. **COST-4 / COST-5** `getClaims()` y una única sesión por petición.
10. **COST-6 / COST-7 / COST-10** Catálogo por GET cacheable, OG image con timeout y caché, sitemap con `revalidate`.
11. **COST-8 / COST-9 / ARQ-2** Historial limitado, paginación y eliminación de cascadas.

### Fase 4 — Experiencia y Core Web Vitals · ~2-3 h
12. **CWV-1 / CWV-2** CLS de la home y prioridad del LCP.
13. **ARQ-3 / ARQ-4** `loading.tsx` y `global-error.tsx`.

### Fase 5 — Mantenibilidad y SEO · cuando haya tiempo
14. **CAL-1** Tipos generados de Supabase.
15. **CAL-2 … CAL-5**, **SEO-1 / SEO-2**, **A11Y-1**, **SEC-6 … SEC-9**, **COST-2**, **ARQ-5**.
