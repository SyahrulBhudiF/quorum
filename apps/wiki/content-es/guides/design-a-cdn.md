---
title: Diseñar una red de distribución de contenido como Cloudflare
seoTitle: Diseñar una CDN como Cloudflare: guía de entrevista
summary: Diseña una CDN para una entrevista de diseño de sistemas: cachés edge, enrutamiento anycast y DNS, jerarquía de caché, purga y escudo del origen, y lo que enseña Quorum.
section: guides
order: 38
aliases: cdn, content delivery network, cloudflare, akamai, fastly, edge cache, anycast, origin shield, cache purge, system design primer, system design interview, red de distribución de contenido, caché edge, escudo del origen, purga de caché, entrevista de diseño de sistemas
---

Una CDN son muchos servidores de caché en muchas ciudades, con una capa de enrutamiento que envía a cada usuario a uno cercano. Un servidor edge responde desde su caché cuando puede, pregunta a una caché regional cuando no puede, y solo entonces pregunta al origen. El enrutamiento se hace con anycast o DNS, y un sistema de purga elimina el contenido obsoleto en todas partes.

Esta es una de las preguntas de la [lista de preguntas adicionales](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions) del [System Design Primer](https://github.com/donnemartin/system-design-primer).

## Requisitos

Funcionales:

- Servir archivos estáticos, imágenes y vídeo desde un lugar cercano al usuario.
- Obtener del origen del cliente en un fallo, y cachear según reglas y TTL.
- Purgar una URL o una etiqueta en toda la red.

No funcionales:

- Baja latencia, idealmente un salto corto desde el usuario.
- Absorber un tráfico muy superior al que podría soportar el origen, incluidos los ataques.
- Seguir sirviendo cuando falla un centro de datos o un enlace.

## Estima la carga

Supón 200 puntos de presencia, 50 Tbps de tráfico pico en toda la red y un objeto medio de 500 KB.

- Tasa de peticiones: 50 Tbps son 6.25 TB por segundo. Dividido entre 500 KB, son unos 12.5 millones de peticiones por segundo.
- Por punto de presencia: 12.5 millones entre 200 son unas 62,000 peticiones por segundo de media, y los sitios más grandes reciben varias veces eso.
- Carga del origen: con una tasa de aciertos del 95%, el 5% de 12.5 millones son 625,000 peticiones por segundo que llegan a los orígenes en total. Repartidas entre un millón de clientes es poco, pero el objeto frío de un cliente aún puede atraer a todos los edges a la vez.
- Almacenamiento: un punto de presencia que cachea 50 TB del contenido más caliente necesita cientos de discos, así que los edges usan RAM para los objetos más calientes y SSD para el resto.

El ancho de banda domina el coste, y la tasa de aciertos decide lo que ven los orígenes.

## El diseño

### Enrutar al usuario

Dos métodos llevan a un usuario a un edge. Con [GeoDNS](/glossary/geodns), el servidor DNS de la CDN responde con la dirección de un punto de presencia cercano, elegido según la ubicación del resolvedor y la salud de los servidores. Con [anycast](/glossary/anycast), cada punto de presencia anuncia la misma dirección IP por BGP, y el enrutamiento de internet envía cada paquete al más cercano topológicamente. Cloudflare usa anycast, y el tráfico se aleja de un sitio caído cuando se retira su anuncio. DNS da un control más fino, y anycast reacciona más rápido y además reparte el tráfico de ataque.

### Caché edge

El edge termina TLS y luego busca el objeto por clave de caché, normalmente la URL más algunas cabeceras seleccionadas. Un acierto devuelve desde memoria o SSD. Cada servidor guarda una porción del contenido del punto de presencia, elegida con un hash de la clave, de modo que el sitio cachea más objetos distintos y no los mismos objetos calientes en cada máquina. La expulsión es LRU o una variante. La clave de caché debe dejar fuera los parámetros de seguimiento e incluir todo lo que cambie la respuesta, o los usuarios verán las páginas de otros.

### Jerarquía de caché y escudo del origen

Un edge que falla pregunta a una caché de nivel superior de su región, y solo ese nivel va al origen. Con 200 edges que buscarían cada uno el mismo vídeo nuevo, un nivel de escudo convierte 200 peticiones al origen en un puñado. Los fallos concurrentes por un objeto en un mismo nivel se agrupan en una sola petición. Mira [calentamiento de caché y caché por niveles](/patterns/cache-warming-and-tiered-caching).

### Obtención del origen y frescura

La CDN obtiene el contenido con las cabeceras `Cache-Control` que envía el origen. Los TTL fijan cuánto vive un objeto, y `stale-while-revalidate` sirve una copia algo vieja mientras una petición la refresca. Los archivos grandes se obtienen por rangos, para que un espectador pueda empezar antes de que se haya cacheado todo el archivo.

### Purga

Una petición de purga va a un plano de control que la reparte a cada punto de presencia, normalmente por un bus de mensajes. Purgar por URL es sencillo. Purgar por etiqueta, por ejemplo todo lo de un producto, necesita un índice de etiquetas a objetos cacheados. La purga global rápida, en torno a un segundo, es un argumento de venta en Fastly y Cloudflare. Mira [CDN push y pull](/patterns/cdn-push-and-pull).

## Dónde se rompe

**Arranque en frío tras una purga.** Una purga global vacía todos los edges, y todos vuelven a pedir al origen a la vez. El nivel de escudo y la agrupación de peticiones absorben la mayor parte. Purga por etiqueta y no todo.

**Clave de caché equivocada.** Dejar la cookie fuera de la clave puede servir la página de cuenta de un usuario a otro. Nunca caches respuestas que establecen cookies a menos que la clave las tenga en cuenta. Mira el incidente [Fuga de página cacheada](/incidents/page-leak).

**Objetos de cola larga.** La mayoría de las peticiones son de archivos populares, pero una enorme cantidad de archivos se pide una sola vez. Esos siempre fallan y expulsan de la caché objetos útiles. Admite un objeto solo en su segunda petición.

**Tráfico de ataque.** Un DDoS dirigido a las direcciones de la propia CDN se reparte por cientos de sitios con anycast, y un [WAF](/components/waf) filtra lo que queda. Mira [WAF y gestión de bots](/patterns/waf-and-bot-management).

## Constrúyelo en Quorum

La [CDN](/components/cdn) del juego es la caché edge. El primer Tablero pone una CDN delante del origen. Mira cómo bajan las cargas del Servidor de aplicaciones y de la Base de datos, y cómo la proporción de aciertos, el TTL y la purga al desplegar cambian frescura por aciertos.

::Design{id="cdn-in-front"}

El segundo muestra pull, donde el edge se llena desde el origen en un fallo, como en el paso de obtención del origen.

::Design{id="cdn-pull"}

El tercero es [Open Connect](/patterns/own-the-edge) de Netflix, una CDN construida y colocada por la propia empresa, con una CDN para los bytes y una Caché para los datos personales.

::Design{id="netflix-own-cdn"}

El cuarto es el problema del enrutamiento. Mira lo que pagan los Usuarios lejanos cuando entran por una sola región de origen, y compáralo con [Multirregión con GeoDNS](/patterns/multi-region-with-geodns).

::Design{id="far-users"}

Investiga [Entrega de contenido](/research/cdn) y [Caché por niveles](/research/tiered-caching), y lee [Archivos estáticos en almacenamiento de objetos y una CDN](/patterns/static-files-on-object-storage-and-a-cdn). El incidente [Pico de estreno](/incidents/premiere-spike) prueba un edge bajo una ráfaga, y el Sandbox [Usuarios lejanos](/sandboxes/far-away) muestra la distancia como causa de la lentitud.

El juego modela una sola CDN gestionada y solo pull. No tiene puntos de presencia que coloques, ni anuncios anycast, ni purga por etiqueta, ni un escudo por región que configures. Los niveles son un efecto de la investigación y no una topología.

## Preguntas frecuentes

### ¿Cómo enruta una CDN a los usuarios al servidor más cercano?

O bien DNS devuelve la dirección de un punto de presencia cercano, o bien cada sitio anuncia la misma dirección anycast y el enrutamiento de internet entrega cada paquete al más cercano. Anycast además aleja el tráfico de un sitio caído de forma automática.

### ¿Qué es un escudo del origen?

Es un nivel de caché adicional entre los edges y tu origen. Muchos edges que fallan en el mismo objeto preguntan al escudo, y solo el escudo lo obtiene del origen.

### ¿Cómo purga una CDN el contenido en todas partes?

Un plano de control envía la purga a cada punto de presencia, que descarta los objetos que coinciden. Las purgas por etiqueta necesitan un índice de etiquetas a objetos, para que un solo comando pueda limpiar un grupo entero.

### ¿Cuál es la diferencia entre las CDN push y pull?

Con pull, el edge obtiene un objeto de tu origen la primera vez que alguien lo pide. Con push, subes tú mismo los archivos a la CDN, lo que conviene a archivos grandes que cambian poco.
