---
title: Diseñar un servicio de streaming de vídeo
seoTitle: Diseñar un servicio de streaming de vídeo: guía de entrevista
summary: Diseña un servicio de streaming de vídeo para una entrevista de diseño de sistemas: subida, cola de transcodificación, almacenamiento de objetos, CDN y bitrate adaptativo, y lo que enseña Quorum.
section: guides
order: 27
aliases: video streaming, youtube, netflix, transcoding, cdn, adaptive bitrate, hls, system design interview, streaming de vídeo, transcodificación, bitrate adaptativo, entrevista de diseño de sistemas
---

Un servicio de vídeo tiene dos rutas. Las subidas van a almacenamiento de objetos, y luego una cola alimenta una flota de workers de transcodificación que cortan cada vídeo en segmentos cortos a varios niveles de calidad. Los espectadores nunca tocan tus servidores para ver el vídeo: una CDN sirve los segmentos, y el reproductor cambia de calidad según varía el ancho de banda.

## Requisitos

Funcionales:

- Los creadores suben vídeos de hasta varios gigabytes.
- Los espectadores reproducen un vídeo en un par de segundos en cualquier dispositivo y conexión.
- La búsqueda y los metadatos, como el título y el número de vistas, funcionan junto a la reproducción.

No funcionales:

- La reproducción empieza en menos de 2 segundos y sin rebuffering en una conexión normal.
- Las subidas sobreviven a una conexión caída.
- El almacenamiento es duradero. Un original perdido no se puede recrear.
- El egress es el mayor coste, así que el diseño debe mantener el tráfico fuera del origen.

## Estima la carga

Supón 100 millones de espectadores diarios, cada uno viendo 5 vídeos de 5 minutos, y 500.000 subidas al día de 5 minutos cada una.

- Egress: 100M x 5 x 5 min son 2.500 millones de minutos al día. A una media de 3 Mbps, son 3 Mbps x 60 s / 8 = 22,5 MB por minuto, así que 2,5B x 22,5 MB = 56 PB al día. Los espectadores concurrentes en el pico son unos 2,5B / 1.440 x 3, aproximadamente 5 millones de streams, o 15 Tbps.
- Almacenamiento de subidas: un original de 5 minutos en 1080p ocupa unos 300 MB, así que 500.000 x 300 MB = 150 TB al día. Las versiones transcodificadas añaden alrededor de 2x.
- Transcodificación: 500.000 vídeos al día son unos 6 por segundo, y cada uno tarda varios minutos de CPU por versión.

Ningún origen puede servir 15 Tbps, así que la CDN es el diseño. El lado de escritura es pequeño en comparación.

## El diseño

### Subida

El cliente parte el archivo en trozos y sube cada uno directamente a [Almacenamiento de objetos](/components/storage) con una URL prefirmada. El Servidor de aplicaciones solo emite la URL y registra los metadatos. La subida directa evita que un archivo de varios gigabytes ocupe una ranura del Servidor de aplicaciones, y los trozos permiten reanudar una subida fallida. Mira [claim check](/patterns/claim-check).

### Cola de transcodificación

Cuando la subida termina, un mensaje va a una [Cola](/components/queue). Los [Workers](/components/worker) toman un trabajo, parten el vídeo en segmentos de unos segundos y codifican cada segmento en varias resoluciones y bitrates, por ejemplo de 240p a 4K. Los segmentos se codifican en paralelo, así que una película de dos horas termina en minutos. Esto es [el trabajo lento, a una cola y a workers](/patterns/slow-work-to-a-queue-and-workers). Los trabajos pueden ejecutarse dos veces, así que escribe las salidas bajo claves deterministas.

### Disposición del almacenamiento

Los originales se quedan en Almacenamiento de objetos en una clase fría. Los segmentos de cada versión y un archivo de manifiesto por vídeo van a su lado. Una [base de datos de metadatos](/components/database) guarda título, propietario, estado y la ubicación del manifiesto. Las [reglas de ciclo de vida](/patterns/object-storage-and-lifecycle-rules) mueven los vídeos viejos y poco populares a clases más baratas.

### CDN

La CDN va primero en la ruta de visionado. Cachea segmentos en ubicaciones de borde cerca del espectador y recurre a una caché regional, y luego al Almacenamiento de objetos. El vídeo se cachea muy bien y la popularidad está sesgada, así que la proporción de aciertos es muy alta. Lee [archivos estáticos en almacenamiento de objetos y una CDN](/patterns/static-files-on-object-storage-and-a-cdn) y [CDN push y pull](/patterns/cdn-push-and-pull).

### Bitrate adaptativo

El manifiesto, en formato HLS o DASH, lista cada versión y sus segmentos. El reproductor descarga un segmento, mide cuánto tardó y elige en consecuencia la calidad del siguiente. Un teléfono limitado baja a 360p en lugar de detenerse.

## Dónde falla

**Pico de estreno.** Un estreno de éxito manda a millones de espectadores a los mismos segmentos en el mismo minuto. Un borde frío falla en todos, y los fallos se apilan en el origen. Calienta la CDN de antemano, añade una caché de nivel intermedio que colapse los fallos duplicados y descarta carga antes de que el origen caiga. El incidente del juego es [Pico de estreno](/incidents/premiere-spike), y [calentamiento de caché y caché en niveles](/patterns/cache-warming-and-tiered-caching) es la solución.

**Atasco de transcodificación.** Una ráfaga de subidas deja la cola creciendo durante horas, y los creadores esperan para publicar. Escala los workers según la profundidad de la cola, y pon los trabajos largos en capacidad barata e interrumpible, como las [instancias spot](/glossary/spot-instance). Mira [nivelación de carga con colas](/patterns/queue-load-leveling) y [autoescalado](/patterns/autoscale-the-compute-tier).

**Trabajos envenenados.** Un archivo corrupto bloquea el codificador cada vez, y un reintento ilimitado atasca la cola. Limita los intentos y aparca el trabajo en una [cola de mensajes muertos](/patterns/dead-letter-queue). La versión del juego es [Mensaje envenenado](/incidents/poison).

## Constrúyelo en Quorum

Tres tableros cubren la ruta de visionado y el almacenamiento que hay debajo. El primero quita bytes de la Base de datos. Un [Servidor de aplicaciones](/components/server) envía archivos a [Almacenamiento de objetos](/components/storage), y la [Base de datos](/components/database) guarda solo filas. Mira la barra de carga y el p99 de la Base de datos, que bajan cuando los archivos salen de sus filas. Investiga [Almacenamiento de objetos](/research/object-storage) para colocarlo. Esta es la mitad de subida y originales del diseño, y el tablero es [servidores de aplicaciones sin estado](/patterns/stateless-app-servers) en acción.

::Design{id="files-in-storage"}

El segundo tablero pone una [CDN](/components/cdn) delante del Servidor de aplicaciones, que trae del origen cuando falla. Tiene un TTL largo y purga al desplegar, así que el borde se rellena tras un lanzamiento. Mira cuánto tráfico ven el Servidor de aplicaciones y la Base de datos en comparación con una ejecución sin CDN. Investiga primero [Entrega de contenido](/research/cdn). Mira [CDN push y pull](/patterns/cdn-push-and-pull), y ten en cuenta que el juego modela solo pull.

::Design{id="cdn-pull"}

El tercer tablero es cómo lo hizo Netflix. La CDN representa Open Connect, una caché cercana al espectador que responde con el contenido sin pasar por el origen. Los Servidores de aplicaciones son el plano de control, una [Caché](/components/cache) guarda los datos personales, la Base de datos es la fuente de verdad y el Almacenamiento de objetos guarda el vídeo que el borde no ha cacheado. Mira qué Componente responde a la mayor parte de las peticiones. [Ten tu propio edge: Netflix](/patterns/own-the-edge) cuenta la historia.

::Design{id="netflix-own-cdn"}

Investiga [Caché por niveles](/research/tiered-caching) para subir cuánto vídeo responde el borde, y ejecuta contra él el incidente [Pico de estreno](/incidents/premiere-spike). Para las subidas, enlaza el Servidor de aplicaciones con una [Cola](/components/queue) y un [Worker](/components/worker), y enlaza el Worker con el Almacenamiento de objetos. El Sandbox [Subidas lentas](/sandboxes/slow-uploads) enseña esa ruta.

El juego no tiene paso de transcodificación, versiones ni manifiestos, y un Worker representa cualquier trabajo en segundo plano y no un codificador. El bitrate adaptativo no se modela. La ruta de subida, la clase de almacenamiento y la proporción de aciertos de la CDN son las partes que puedes construir y medir.

## Preguntas frecuentes

### ¿Cómo almacena y sirve vídeos YouTube?

Los originales y las versiones transcodificadas están en almacenamiento de objetos distribuido, con los metadatos en una base de datos aparte. La reproducción viene de cachés de borde de la CDN, y solo los fallos llegan al almacenamiento.

### ¿Qué es el streaming con bitrate adaptativo?

El vídeo se codifica en varias calidades y se corta en segmentos de unos segundos. Un manifiesto los lista, y el reproductor elige la calidad de cada segmento siguiente según el ancho de banda que acaba de medir. La reproducción continúa a menor calidad en lugar de congelarse.

### ¿Por qué usar una cola para transcodificar vídeo?

Transcodificar lleva minutos de CPU por vídeo y las subidas llegan en ráfagas, así que el nivel web no puede hacerlo en línea. Una cola deja que las subidas respondan al instante mientras los workers vacían los trabajos a su ritmo, y los reintentos son seguros.

### ¿Cómo evitas que un vídeo viral sobrecargue el origen?

Cachea los segmentos en el borde, pon una caché compartida de nivel intermedio entre los bordes y el almacenamiento para que los fallos duplicados se colapsen en una sola petición, y calienta la caché para los lanzamientos conocidos.
