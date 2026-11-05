# NovaGiv — Lógica de negocio y brief para diseño

> Documento para el diseñador. Explica qué es la web, quién la usa, qué hace cada pantalla y
> qué reglas hay que respetar, para que puedas proponer un diseño moderno sin tener que leer
> código. Al final hay una sección de **libertades y restricciones** de diseño.

---

## 1. Qué es NovaGiv

NovaGiv es un streamer que en sus transmisiones en vivo ve películas, series y anime con su
comunidad, hace votaciones y karaokes. Después de cada stream, el video se **resube a ok.ru**
(una plataforma de video rusa, parecida a YouTube).

El problema: ok.ru es un desorden. No tiene buscador útil, no agrupa por serie, no deja
saber "qué vi el martes pasado" ni retomar donde lo dejaste.

**La web de NovaGiv es el índice ordenado de esos resubidos.** No aloja videos: los
reproduce embebidos desde ok.ru y aporta todo lo demás: catálogo con pósters, búsqueda,
filtros, episodios ordenados, fechas de stream, "me gusta", "ver después" e historial.

**Propuesta de valor en una frase:** *"Todos los streams de NovaGiv, ordenados y listos para
ver, en un solo lugar."*

### Tono y personalidad
- Comunidad de streaming, público joven, hispanohablante (todo el sitio está en español).
- Ambiente "noche de pelis con amigos", gamer/streamer, no corporativo.
- La identidad actual es **oscura con acentos violeta y neón** (ver §8).

---

## 2. Tipos de usuario

| Usuario | Qué puede hacer | Peso en el tráfico |
|---|---|---|
| **Visitante** (sin cuenta) | Ver todo el catálogo, buscar, filtrar, reproducir. Ve un badge «Nuevo» en lo añadido desde su última visita. | La mayoría. Hay que darles motivos para volver y para registrarse. |
| **Usuario registrado** | Lo anterior más: dar **me gusta**, guardar en **ver después**, tener **historial** y la fila **«Seguir viendo»**. | Comunidad fiel. |
| **Administrador** (el streamer o su equipo) | Gestionar el catálogo: importar desde ok.ru, editar títulos, pósters, géneros y episodios, publicar u ocultar. Es el único que ve los contadores de vistas. | 1–3 personas. |

> La cuenta se usa con **nombre de usuario** (no con correo) para iniciar sesión. El correo
> solo sirve para recuperar o confirmar la cuenta.

---

## 3. Conceptos del dominio (vocabulario)

Para que el diseño hable el mismo idioma que el producto:

- **Colección / título**: una ficha del catálogo con su póster. Puede ser:
  - **De video único**: **Película**, **Especial / Votación** o **Karaoke**. Se pulsa y se reproduce.
  - **Episódica**: **Serie** o **Anime**. Tiene una lista de **episodios** (cada stream es un
    episodio) y a veces **temporadas**.
- **Episodio**: un video concreto. Tiene número, título, **fecha del stream**, duración y a
  veces miniatura.
- **Fecha de stream**: el dato más importante del producto. La gente recuerda *"la noche en
  que vimos X"*, no el nombre de la colección. Por eso cada tarjeta muestra el **rango de
  fechas** (p. ej. «12 mar – 30 jun 2026») y el catálogo se agrupa **por año de stream**.
- **Estado** (solo series/anime): **En emisión** o **Finalizada**.
- **Géneros**: etiquetas libres (Acción, Comedia, Fantasía…). Una colección puede tener varias.
- **Borrador / Publicado**: lo que se importa entra oculto hasta que el admin lo publica.
- **Nuevo**: añadido desde la última visita de ese navegador.
- **Visto**: la cuenta ya abrió esa colección.

> **Tipos ocultos temporalmente:** «Especiales / Votaciones» y «Karaokes» existen pero aún no
> tienen contenido, así que hoy no aparecen en las pestañas. **El diseño debe contemplarlos**
> porque se activarán más adelante.

---

## 4. Mapa del sitio

```
Público
├── /                    Catálogo (home)
├── /v/[título]          Reproductor + ficha + episodios
│                        (desde el catálogo se abre como ventana modal encima de la rejilla;
│                         por enlace directo, como página completa)
├── /login               Iniciar sesión
└── /register            Crear cuenta

Con cuenta
├── /me-gusta            Mis me gusta
├── /ver-despues         Ver después
├── /historial           Historial (dónde me quedé en cada colección)
└── /account             Mi cuenta (usuario, correo, contraseña + accesos a las 3 listas)

Administración
├── /admin               Tabla del catálogo (incluye borradores)
├── /admin/import        Importar desde ok.ru
├── /admin/media/new     Crear colección
└── /admin/media/[id]    Editar colección
```

---

## 5. Pantallas en detalle

### 5.1 Catálogo (home) — la pantalla más importante

Es por donde entra casi todo el mundo. De arriba abajo, hoy tiene:

**A. Cabecera del streamer**
- Avatar de NovaGiv con indicador **En vivo / Offline** (punto rojo pulsante si está en directo).
- Nombre + badge de estado.
- Bio («Resubidos organizados de mis transmisiones…»), o el **título del directo** si está en vivo.
- Botones de redes: Twitch, YouTube, Discord, X, sitio web.
- Zona de cuenta: «Ingresar» / «Crear cuenta», o para usuarios: «Me gusta», nombre de usuario,
  «Panel» (si es admin) y «Salir».
- Banner de fondo opcional, muy atenuado.

> **Oportunidad:** cuando el streamer está **en vivo**, sería el momento ideal para un CTA
> fuerte («Ver directo en Twitch»). Hoy solo cambia un badge.

**B. «Seguir viendo»** (solo usuarios con historial)
- Fila horizontal deslizable con hasta 12 pósters pequeños + «Ep. N».
- Enlace «Ver historial».
- Es un atajo para volver, no un lugar para explorar.

**C. Barra de filtros** (fija al hacer scroll)
- **Pestañas por tipo**: Todos · Películas · Series · Anime (+ Especiales y Karaokes cuando se activen).
- **Buscador**: busca en títulos, descripciones **y en episodios**, incluida la fecha
  («30 junio» o «2026-06-30»).
- **Género** (lista generada a partir del contenido real, con el número de títulos de cada uno).
- **Ordenar por**: Más recientes · Stream más reciente · Stream más antiguo · A-Z · Año.
- **Fecha**: año y mes de stream, o un rango «Desde / Hasta».
- **Chips de filtros activos** debajo, que se quitan uno a uno, y «Limpiar todo».
- En **móvil** solo se ven las pestañas y el buscador; el resto va en un panel lateral con un
  contador de filtros activos.

**D. Rejilla de títulos**
- Por defecto, **agrupada por año de stream** con encabezados («2026 · 34 colecciones»).
- 2 columnas en móvil y hasta 6 en escritorio.
- **Scroll infinito** (carga de 24 en 24) + botón «Cargar más» + contador «48 de 210».
- Estado vacío: «Sin resultados. Prueba con otro título, género, categoría o rango de fechas.»

**Tarjeta de título** (componente clave, se repite cientos de veces):

| Zona | Contenido |
|---|---|
| Póster (proporción **2:3**, vertical) | Imagen. Al pasar el ratón: zoom suave + botón ▶ central. |
| Esquina superior izquierda | Hasta 2 géneros. |
| Esquina superior derecha | **«Nuevo»** (destacado) **o** **«Visto»** (discreto). Nunca los dos: gana «Visto». |
| Esquina inferior izquierda | ❤ me gusta (y 👁 vistas solo para admin). Se oculta si están en 0. |
| Esquina inferior derecha | Series/anime: «24 ep.» · Películas: duración «1h 52m». |
| Debajo del póster | Título (máx. 2 líneas) · Año · Estado (En emisión/Finalizada) · 📅 rango de fechas de stream. |
| Si hay búsqueda | «🔍 3 episodios coinciden», y al pulsar se abre directamente en ese episodio. |

### 5.2 Reproductor / ficha del título

Se abre como **modal encima del catálogo** (al cerrar vuelves a la rejilla en el mismo punto)
o como página propia si se entra por un enlace compartido.

- **Video** embebido de ok.ru (16:9). No controlamos el reproductor interno (ver §7).
- **Selector de tamaño del reproductor**: Pequeño · Mediano · Grande · Pantalla completa (se recuerda).
- **Título** + «· Episodio 12: [título]» si es episódica.
- **Acciones**: ◀ ▶ episodio anterior/siguiente (también con las flechas del teclado),
  **❤ Me gusta** (con contador) y **🔖 Ver después**. Sin sesión, invitan a iniciar sesión.
- **Metadatos**: géneros, año, rango de fechas de stream, total de me gusta (y vistas para admin).
- **Descripción**.
- **Lista de episodios** (series/anime):
  - Contador «Episodios (48)» y **buscador interno** («Buscar episodio o fecha…»).
  - Agrupada por **temporada** si hay más de una.
  - Cada fila: miniatura (si hay) · «N. Título» · fecha de stream · ❤ · duración.
  - El episodio activo está resaltado y la lista se desplaza hasta él.
  - Puede haber colecciones con **200+ episodios**: tiene que seguir siendo usable.
- La URL cambia con cada episodio, así que se puede compartir un episodio concreto.
- Al compartir el enlace en redes se genera una **imagen de vista previa** automática
  (póster + título + tipo + fechas).

### 5.3 Listas personales: Me gusta · Ver después · Historial

Las tres pantallas tienen la misma estructura:
- «← Volver al catálogo», título con icono y subtítulo
  («Una entrada por colección, en el punto donde la dejaste»).
- Lista de filas: póster pequeño · título · «Episodio N: título» o tipo · «Visto el 3 de junio de 2026».
- Botón para quitar cada entrada (en Historial y Ver después).
- Estado vacío con CTA «Explorar el catálogo».

Diferencias de negocio:
- **Me gusta**: un video concreto (película o episodio). Tiene contador público.
- **Ver después**: un video concreto. **Sin contador público** (es privado).
- **Historial**: **una entrada por colección**, apuntando al último episodio visto. Alimenta «Seguir viendo».

### 5.4 Cuenta, login y registro
- **Login**: usuario + contraseña. Captcha (Cloudflare Turnstile) en los formularios.
- **Registro**: usuario (3–20 caracteres: minúsculas, números y _) + correo + contraseña.
- **Mi cuenta**: cambiar usuario, correo y contraseña, y accesos a «Mis me gusta», «Ver después» e «Historial».
- Mensajes de error y éxito dentro del formulario.

### 5.5 Panel de administración (prioridad secundaria de diseño)
Herramienta interna; debe ser funcional y coherente con la marca, no espectacular.
- **Catálogo**: tabla con Título · Tipo · Estado · Año · Episodios · Publicado (interruptor) · Editar/Eliminar. Incluye borradores.
- **Importar desde ok.ru**: lista los canales recientes de ok.ru y los importa como borradores.
- **Formulario de colección**: datos generales (título, slug, tipo, URL del póster, géneros, año,
  descripción, duración, estado, calificación 0-10), canal de ok.ru de origen y un **editor de
  episodios** (temporada, número, título, URL, fecha de stream, duración), con opción de mover
  episodios entre colecciones.

---

## 6. Reglas de negocio que afectan a la interfaz

1. **La fecha de stream es la protagonista.** Hay que poder buscar, filtrar, ordenar y agrupar
   por ella, y debe verse en tarjetas, fichas y episodios.
2. **«Nuevo» se calcula por navegador**, no por cuenta: así funciona también para visitantes.
   En la primera visita nada aparece como nuevo. Solo marca colecciones nuevas, no episodios nuevos.
3. **«Visto» gana a «Nuevo»** en la tarjeta.
4. **Las vistas solo las ve el admin** (decisión temporal; volverán a ser públicas). Los me gusta sí son públicos.
   El diseño debe funcionar **con y sin** el contador de vistas.
5. **Los contadores en 0 no se muestran**, para que un catálogo recién lanzado no se llene de ceros.
6. **Un me gusta por persona y video**, y se puede quitar.
7. **El historial y «Seguir viendo» solo existen con cuenta**: buen argumento para incentivar el registro.
8. **Los borradores nunca se ven en público.**
9. **Los filtros viven en la URL**: cualquier búsqueda o filtro se puede compartir o guardar en favoritos.
10. **Cerrar el reproductor = volver atrás**: el botón «atrás» del navegador cierra el modal.

---

## 7. Restricciones técnicas que el diseño debe respetar

| Restricción | Implicación de diseño |
|---|---|
| El video es un **iframe de ok.ru** | No se pueden diseñar los controles del reproductor (play, barra, volumen); solo lo que lo rodea. Siempre 16:9. |
| **Pósters verticales 2:3** con calidad variable | La tarjeta debe verse bien con imágenes de distinta calidad y colores. |
| **Miniaturas de episodio opcionales** | La fila de episodio debe funcionar con y sin miniatura. |
| **Títulos largos o crípticos** (p. ej. «H1NMTSR») | Truncado a 2 líneas; las fechas ayudan a identificar el título. |
| **Volumen**: cientos de colecciones y miles de episodios | Rejilla densa, scroll infinito y listas de episodios largas. |
| **Solo modo oscuro** (hoy) | Se puede proponer modo claro, pero el oscuro es el principal (contexto de cine/stream). |
| **Móvil primero** | Buena parte del tráfico llega desde enlaces compartidos en el móvil. Nada de scroll horizontal accidental. |
| Stack: Tailwind CSS v4 + componentes shadcn/Base UI + iconos Lucide | Conviene un sistema basado en tokens (colores, radios, espaciados) e iconografía de línea. Lucide no tiene logos de marcas. |
| Accesibilidad | Navegación por teclado (las flechas cambian de episodio), foco visible y buen contraste sobre fondos oscuros. |

---

## 8. Identidad visual actual (punto de partida, no obligatorio)

| Token | Valor | Uso |
|---|---|---|
| Fondo | `#09090b` | Casi negro |
| Tarjetas | `#18181b` | Superficies |
| Texto | `#f4f4f5` / secundario `#a1a1aa` | |
| **Primario** | `#8b5cf6` (violeta) | Botones, «Nuevo», episodio activo, botón ▶ |
| Neón | `#d946ef` (magenta) | Acento / brillos (`shadow-glow`) |
| En vivo | `#f43f5e` (rojo rosado) | Indicador de directo |
| Gráficos | `#a78bfa`, `#d946ef`, `#22d3ee`, `#f472b6` | Paleta secundaria |
| Radio | ~11 px (`0.7rem`) | Esquinas redondeadas |
| Tipografía | **Geist** (sans) y Geist Mono | |

Hoy el estilo es correcto pero **genérico** (se parece mucho al estilo por defecto de shadcn):
cabecera sobria, rejilla plana y poca jerarquía. Falta personalidad de marca.

---

## 9. Lo que buscamos del diseño

### Objetivos
1. **Personalidad propia**: que se sienta "la casa de NovaGiv" y no una plantilla genérica.
   Vibra de streaming/cine nocturno, moderna.
2. **Home con más jerarquía**: hoy entras y es directamente una rejilla. Proponer, por ejemplo:
   - un **hero** con lo último resubido o lo que está en emisión,
   - un estado **«En vivo ahora»** muy visible cuando hay directo,
   - quizá filas temáticas (Últimos streams · En emisión · Más gustados) antes de la rejilla completa.
3. **Destacar la fecha de stream** como elemento visual distintivo (línea temporal, calendario,
   «hace 3 días»…), porque es lo que diferencia a NovaGiv de un catálogo de películas cualquiera.
4. **Tarjeta más rica pero limpia**: hoy tiene hasta 5 badges sobre el póster. Buscar una jerarquía
   más clara (¿qué va encima del póster y qué debajo? ¿qué aparece solo al pasar el ratón?).
5. **Reproductor tipo "cine"**: el modal debe sentirse inmersivo y mantener la lista de episodios
   cómoda en series de 200 episodios (¿lista lateral en escritorio? ¿por temporadas o meses?).
6. **Incentivar el registro** sin molestar: mostrar el valor de «Seguir viendo», «Ver después» e «Historial».
7. **Filtros potentes pero discretos**, sobre todo en móvil.

### Entregables sugeridos (por prioridad)
1. Home / catálogo: escritorio y móvil, con y sin sesión, con streamer en vivo y offline.
2. Tarjeta de título con todos sus estados (normal, hover, Nuevo, Visto, episodios que coinciden con la búsqueda, película frente a serie).
3. Reproductor: modal y página completa, película y serie con muchos episodios.
4. Barra de filtros: escritorio, panel en móvil y chips activos.
5. Listas personales (una plantilla para las 3) y sus estados vacíos.
6. Login / registro / cuenta.
7. Mini sistema de diseño: colores, tipografía, radios, botones, badges, inputs y estados de carga (skeletons).
8. (Opcional) Admin: tabla y formulario.

### Estados que no hay que olvidar
- Cargando (skeletons de rejilla y filtros).
- Sin resultados de búsqueda.
- Listas vacías.
- Error al cargar más / reintentar.
- Video no disponible.
- Usuario sin sesión que pulsa «Me gusta» o «Ver después».
- Página 404 / título no encontrado.

---

## 10. Libertades y límites

**Libre para cambiar:** paleta (aunque el violeta/neón es parte de la identidad actual),
tipografía, layout de la home, forma de la tarjeta, estructura del reproductor, navegación,
microinteracciones y logo/wordmark.

**No cambia:**
- Las funcionalidades y reglas de §5 y §6.
- El video embebido de ok.ru en 16:9.
- Los pósters en 2:3.
- El idioma: español.
- Los nombres de secciones visibles para el usuario (Seguir viendo, Ver después, Me gusta,
  Historial), salvo que propongas mejores.
