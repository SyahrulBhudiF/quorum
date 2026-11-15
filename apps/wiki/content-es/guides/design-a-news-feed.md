---
title: Diseñar un news feed o timeline de Twitter
seoTitle: Diseñar un news feed o timeline de Twitter: guía
summary: Diseña un news feed o timeline de Twitter: elige fan-out en escritura o en lectura, trata las cuentas de famosos, añade búsqueda de publicaciones y construye la forma en Quorum.
section: guides
order: 25
aliases: system design primer, twitter timeline, facebook feed, news feed, timeline, twitter, instagram, facebook, home feed, fan-out, system design interview, feed de noticias, línea de tiempo, feed de inicio, entrevista de diseño de sistemas
---

Un news feed es un sistema con muchas más lecturas que escrituras, así que construye el timeline de cada usuario cuando alguien publica y guárdalo en una caché. Eso es fan-out en escritura. Las cuentas con millones de seguidores lo rompen, así que sus publicaciones se piden en el momento de la lectura y se mezclan, lo que da el híbrido que Twitter describió en público. El ranking y un timeline en caché por usuario se apoyan encima.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), y su [solución para el timeline de Twitter](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/twitter/README.md) merece leerse junto a esta página. El primero pide el timeline y la búsqueda, o el feed de Facebook y la búsqueda, así que esta página cubre también la búsqueda sobre publicaciones.

## Requisitos

Funcionales:

- Un usuario publica texto o una imagen, y sigue o deja de seguir otras cuentas.
- Un usuario abre un feed de inicio con las publicaciones recientes de las cuentas que sigue, primero las más nuevas o con ranking.
- Un usuario también puede abrir el timeline propio de otra cuenta, que lista solo las publicaciones de esa cuenta.
- Un usuario busca publicaciones por palabra clave.
- Abrir el feed es la primera pantalla, así que debe sentirse instantáneo.

No funcionales:

- Lecturas del feed por debajo de 200 ms en el percentil 99.
- Una publicación nueva aparece en los feeds de los seguidores en pocos segundos. Un retraso de segundos es aceptable, perder la publicación no.
- Alta disponibilidad. Un feed obsoleto es mejor que una página de error, lo que significa que la consistencia eventual es aceptable.

## Estima la carga

Supón 300 millones de usuarios activos al día, cada uno abriendo el feed 10 veces al día y publicando una vez de media. Supón 200 seguidores por cuenta de media.

- Lecturas: 300M x 10 = 3000 millones de cargas de feed al día, o 3.000.000.000 / 86.400 = unas 35.000 por segundo. El pico, a 3x, ronda las 100.000 por segundo.
- Escrituras: 300M de publicaciones al día son unas 3500 publicaciones por segundo.
- Fan-out: 3500 x 200 = 700.000 inserciones de timeline por segundo de media.

La búsqueda añade su propia carga de lectura. Si los usuarios hacen una búsqueda por cada diez cargas de feed, son unas 3500 búsquedas por segundo de media.

Las lecturas superan a las publicaciones 10 a 1, y el fan-out convierte cada publicación en 200 escrituras pequeñas. Una entrada de timeline es un ID de publicación y una marca de tiempo, unos 16 bytes. Guardar las 800 entradas más nuevas para 300M de usuarios son 300M x 800 x 16 = unos 3,8 TB, que caben en un clúster de Redis.

## El diseño

### API y servicio de publicaciones

El cliente llama a la API a través de un [Balanceador de carga](/components/lb) hacia [Servidores de aplicaciones](/components/server) sin estado. Una publicación se escribe en el almacén de publicaciones, una base de datos con sharding por ID de publicación, y luego se pasa a un trabajo de fan-out mediante una [Cola](/components/queue). El usuario espera solo la primera escritura. Mira [El trabajo lento, a una cola y a workers](/patterns/slow-work-to-a-queue-and-workers).

### Fan-out en escritura

Los [Workers](/components/worker) leen la lista de seguidores del autor y luego insertan el ID de la publicación en el timeline de cada seguidor en la [Caché](/components/cache). Leer un feed pasa a ser una sola consulta. [Fan-out en escritura y en lectura](/patterns/fan-out-on-write-and-on-read) cubre el intercambio: más escrituras y almacenamiento a cambio de lecturas rápidas.

### La regla del famoso

Por encima de un umbral, digamos 100.000 seguidores, omite el fan-out. Cuando un usuario carga el feed, el Servidor de aplicaciones obtiene su timeline en caché, pide las publicaciones recientes de los pocos famosos que sigue y las mezcla por tiempo.

### Búsqueda sobre publicaciones

La búsqueda es una ruta de lectura distinta del timeline. Cada publicación nueva se escribe también en un índice de búsqueda, un índice invertido que asocia cada palabra con las publicaciones que la contienen, ejecutado como un clúster de shards. Una consulta se divide en términos, se envía a cada shard, y cada shard devuelve sus mejores coincidencias. Un coordinador las mezcla, les da ranking y las devuelve, lo que se llama scatter and gather. Mantén el índice en memoria en máquinas rápidas, porque la búsqueda es de mucha lectura y los usuarios notan una respuesta lenta. Una publicación se vuelve buscable uno o dos segundos después de escribirse, porque el índice se refresca por lotes, y ese retraso es aceptable por la misma razón que un feed puede ir segundos por detrás. Alimenta el índice desde el almacén de publicaciones mediante una cola o un flujo de cambios, no desde la app en la misma petición, para que un fallo no deje a los dos en desacuerdo. Mira la [búsqueda de texto completo y el índice invertido](/patterns/full-text-search-and-inverted-index) y la [búsqueda junto a la base de datos](/patterns/search-beside-the-database).

### Ranking

Un feed cronológico ordena por marca de tiempo. Un feed con ranking toma unos cientos de candidatos principales y les asigna una puntuación, con señales como la actualidad, la cercanía con el autor y la interacción pasada. Puntúa en el momento de la lectura sobre el conjunto de candidatos, nunca sobre todo el grafo.

### El timeline del usuario

El timeline propio de una cuenta es una lectura simple de las publicaciones de ese autor, las más nuevas primero, desde el almacén de publicaciones. No necesita fan-out, así que lo sirve un índice de base de datos por autor y tiempo, con una [Caché](/components/cache) delante de las cuentas populares.

### Caché de timelines y contenido multimedia

Los timelines viven en Redis como listas con tope, con las entradas más nuevas primero. Los cuerpos de las publicaciones se obtienen por ID de una segunda caché y del almacén de publicaciones. Las imágenes van a [Almacenamiento de objetos](/components/storage) detrás de una [CDN](/components/cdn), como en [archivos estáticos en almacenamiento de objetos y una CDN](/patterns/static-files-on-object-storage-and-a-cdn).

## Dónde se rompe

**La publicación del famoso.** Una cuenta con 50 millones de seguidores convierte una publicación en 50 millones de escrituras, y los workers se retrasan durante minutos. La solución es el híbrido de arriba. El lado de lectura tiene el problema equivalente: millones de usuarios piden la misma publicación, así que una clave de caché va caliente. Divide esa clave entre varios nodos, como en las [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards). La versión del juego es el incidente [Clave caliente](/incidents/hot-key).

**Timelines fríos.** Un usuario vuelve tras un mes y no tiene timeline en caché, o la Caché se reinicia vacía y cada fallo va a la base de datos a la vez. Reconstruye bajo demanda con la ruta de lectura, y calienta la Caché antes de que reciba tráfico. Ese fallo es una [Estampida de caché](/incidents/stampede), y la [protección contra estampidas de caché](/patterns/cache-stampede-protection) la detiene.

**Usuarios inactivos.** Mantener timelines para todos desperdicia memoria en gente que nunca vuelve. Guarda unos cientos de entradas para los usuarios activos en el último mes, y reconstruye el timeline de un usuario antiguo desde el almacén de publicaciones con la ruta de lectura cuando vuelva.

**Cola de fan-out acumulada.** Una ráfaga de publicaciones tras un gran evento llena la cola y los feeds se quedan obsoletos. Vigila la profundidad de la cola y añade workers, y acepta que los feeds vayan unos segundos por detrás. [Nivelación de carga con colas](/patterns/queue-load-leveling) explica por qué una cola que crece significa que los workers son más lentos que las llegadas.

## Constrúyelo en Quorum

El juego cubre bien la elección de fan-out, y dos Tableros la muestran. El fan-out es un ajuste del [Servidor de aplicaciones](/components/server), y ambos Tableros usan los mismos Usuarios, una [Caché](/components/cache) y una [Base de datos](/components/database), así que el ajuste es la única diferencia.

El primer Tablero es fan-out en lectura. Una petición de feed lee las últimas publicaciones de cada cuenta que sigue el usuario, así que una lectura se convierte en muchas consultas. Mira la carga de la Base de datos y la latencia del feed, que es donde se nota el coste de la lectura.

::Design{id="fanout-pull"}

El segundo Tablero es fan-out en escritura. Cada publicación se escribe en los timelines de los seguidores, así que una petición de feed lee una sola lista, y el coste pasa a las escrituras. Compara la carga de la Base de datos y la Caché con el primer Tablero. Investigar [Fan-out híbrido](/research/hybrid-fanout) convierte el push en el híbrido, de modo que las cuentas más seguidas se piden en el momento de la lectura, y la Caché de aquí divide las claves calientes para que una cuenta famosa no sature un shard. Esa es la regla del famoso del diseño anterior.

::Design{id="fanout-push"}

El tercer Tablero es la ruta de búsqueda. Las consultas de búsqueda van a un [Motor de búsqueda](/components/search) y la Base de datos guarda las filas, así que las búsquedas dejan de cargar la capa que sirve el timeline. Mira la carga de la Base de datos y compárala con una ejecución sin Motor de búsqueda. No modela scatter and gather ni un retraso de refresco que puedas ver por publicación, aunque el Motor de búsqueda tiene un ajuste de intervalo de refresco.

::Design{id="search-engine"}

Después ejecuta el Sandbox [Clave caliente](/sandboxes/hot-key), donde un famoso publica y tú mantienes el Apdex. El [Almacén de columnas anchas](/components/wide) es el hogar habitual de los timelines a esa escala.

El juego no tiene modelo de ranking, ni grafo de seguidores, ni un paso de mezcla que puedas ajustar. Tampoco modela la longitud del timeline ni una caché por usuario. La mecánica de lectura, escritura, clave caliente y búsqueda es lo que enseña.

## Preguntas frecuentes

### ¿Un news feed debe usar fan-out en escritura o en lectura?

Usa fan-out en escritura para la mayoría de las cuentas, porque los feeds se leen mucho más a menudo de lo que se escriben las publicaciones y un timeline ya construido carga con una consulta. Usa fan-out en lectura para las cuentas con enormes cantidades de seguidores. La mayoría de los sistemas reales usan ambos.

### ¿Cómo se trata el problema del famoso en un news feed?

No envíes las publicaciones de un famoso a cada seguidor. Guárdalas una vez y mézclalas en el timeline de cada lector cuando se carga el feed. Cachea las publicaciones recientes del famoso para que millones de lectores no golpeen una sola fila de la base de datos.

### ¿Cómo se hace el ranking de un news feed?

Genera unos cientos de publicaciones candidatas a partir de la caché de timelines y de la lectura de famosos, y luego puntúalas con un modelo que use señales de actualidad, relación e interacción. Devuelve los mejores resultados. Puntuar solo los candidatos mantiene baja la latencia.

### ¿Cómo funciona la búsqueda en un feed?

Cada publicación se escribe también en un índice de búsqueda, un índice invertido repartido en shards. Una consulta va a cada shard y los mejores resultados se mezclan y se ordenan. Los resultados van un segundo o dos por detrás de la publicación, algo que los usuarios aceptan.

### ¿Dónde se guardan los timelines?

En un almacén en memoria como Redis, como una lista con tope de IDs de publicación por usuario. Las entradas más antiguas caen por el final, y un usuario que se desplaza más allá de la caché recurre a una consulta a la base de datos.
