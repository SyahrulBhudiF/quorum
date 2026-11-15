---
title: Diseñar un servicio de sincronización de archivos como Dropbox
seoTitle: Diseñar Dropbox: guía de diseño de sistemas de sincronización de archivos
summary: Diseña un servicio de sincronización de archivos como Dropbox: fragmentación, almacenamiento de objetos, una base de datos de metadatos, sincronización y deduplicación, y lo que enseña Quorum.
section: guides
order: 28
aliases: system design primer, file storage, dropbox, google drive, file sync, chunking, deduplication, object storage, system design interview, almacenamiento de archivos, sincronización de archivos, fragmentación, deduplicación, almacenamiento de objetos, entrevista de diseño de sistemas
---

Un servicio de sincronización de archivos divide cada archivo en fragmentos, guarda cada fragmento una sola vez en almacenamiento de objetos bajo su hash, y mantiene el árbol de archivos en una base de datos de metadatos. Los clientes suben solo los fragmentos que le faltan al servidor y se enteran de los cambios por un canal de notificaciones. Los bytes son baratos y la base de datos de metadatos es la parte difícil.

Esta pregunta está en la [lista de preguntas adicionales](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions) del [System Design Primer](https://github.com/donnemartin/system-design-primer).

## Requisitos

Funcionales:

- Subir, descargar y borrar archivos de hasta varios gigabytes.
- Sincronizar una carpeta entre los dispositivos de un usuario, y compartir archivos con otros usuarios.
- Conservar el historial de versiones, para poder deshacer una sobrescritura.

No funcionales:

- Durabilidad por encima de todo. Perder un archivo es el peor resultado.
- Una edición pequeña en un archivo grande no debe volver a subir el archivo entero.
- Un cambio aparece en los demás dispositivos en pocos segundos.
- Las subidas se reanudan tras una conexión cortada.

## Estima la carga

Supón 50 millones de usuarios, 10 millones activos al día. Cada usuario guarda 10 GB de media y cambia 20 archivos al día, con un cambio medio de 1 MB.

- Almacenamiento: 50M x 10 GB = 500 PB. Con replicación 3x, o con codificación de borrado a cerca de 1.5x, son de 750 PB a 1.5 EB.
- Ancho de banda de subida: 10M x 20 x 1 MB = 200 TB al día, o 200 TB / 86,400 = unos 2.3 GB por segundo.
- Metadatos: un tamaño de fragmento de 4 MB da 10 GB / 4 MB = 2,500 fragmentos por usuario, así que 50M x 2,500 = 125,000 millones de registros de fragmentos. A 100 bytes cada uno, son 12.5 TB. Los metadatos son pequeños en bytes y grandes en filas.
- Comprobaciones de sincronización: 10M de usuarios consultando cada 30 segundos son 330,000 peticiones por segundo si no envías los cambios por push.

## El diseño

### Fragmentación

El cliente divide un archivo en fragmentos fijos de unos 4 MB, o en fragmentos definidos por contenido cuyas fronteras se mueven con el contenido. Calcula el hash SHA-256 de cada fragmento. Los fragmentos fijos son simples, y los definidos por contenido evitan que una inserción al principio de un archivo cambie todos los fragmentos siguientes.

### Almacenamiento de bloques

Los fragmentos van a [Almacenamiento de objetos](/components/storage), con el hash como clave. La subida va directa desde el cliente con una URL prefirmada, así que el Servidor de aplicaciones nunca transporta los bytes. Un fragmento es inmutable, lo que hace triviales el cacheo, la replicación y las [reglas de ciclo de vida](/patterns/object-storage-and-lifecycle-rules).

### Base de datos de metadatos

Una [Base de datos](/components/database) relacional, con sharding por usuario o por carpeta, guarda el árbol de archivos. Cada fila de archivo tiene una versión y una lista ordenada de hashes de fragmentos. Los metadatos necesitan transacciones, porque un cambio de nombre o el commit de una versión nueva debe ser atómico. Lee el patrón de [sharding](/patterns/sharding) para ver cómo dividirla.

### Deduplicación

Antes de subir, el cliente pregunta qué hashes ya tiene el servidor, y envía solo los que faltan. Si dos usuarios suben el mismo instalador, la segunda subida no envía nada. La deduplicación entre usuarios revela si un archivo existe, así que algunos servicios deduplican solo dentro de una cuenta.

### Sincronización

Cada dispositivo guarda un cursor, el ID del último cambio que ha visto. Un servicio de notificaciones mantiene una conexión por dispositivo, mediante [long polling o SSE](/patterns/long-polling-and-sse) o un WebSocket, y le avisa de que algo cambió. El dispositivo llama entonces a una API para pedir los cambios posteriores a su cursor y descarga los fragmentos nuevos. Los conflictos, cuando dos dispositivos editan el mismo archivo, producen un archivo de "copia en conflicto" y no una edición perdida.

### Ruta de descarga

Los archivos compartidos y populares están detrás de una [CDN](/components/cdn). Los archivos privados se obtienen de Almacenamiento de objetos con URLs firmadas de corta duración.

## Dónde se rompe

**Puntos calientes de metadatos.** Un tenant empresarial con millones de archivos cae en un solo shard, y las comprobaciones de sincronización se acumulan en él. Haz sharding por árbol de carpetas dentro de los tenants grandes, y cachea los listados. Mira las [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards) y el incidente [Shard caliente del tenant grande](/incidents/hot-shard).

**Subidas lentas.** Un archivo grande en una conexión mala retiene una conexión del servidor durante minutos. Sube los fragmentos directo al almacenamiento, y manda el posprocesado, como los análisis de virus y las miniaturas, por una cola. Mira [El trabajo lento, a una cola y a workers](/patterns/slow-work-to-a-queue-and-workers).

**Coste de almacenamiento.** Cada versión de cada archivo se acumula, y la mayoría no se vuelve a leer. Mueve las versiones antiguas a una clase más barata, haz que caduquen por política y cuenta las referencias de los fragmentos para que borrar sea seguro. El coste crece como una partida descontrolada, como en el incidente [Factura descontrolada](/incidents/runaway-bill).

## Constrúyelo en Quorum

Dos Tableros cubren la mitad de almacenamiento de la respuesta. El primero es el paso previo a cualquier fragmentación: sacar los bytes de los archivos de la Base de datos. Mira la carga de la Base de datos y el p99, que bajan ambos cuando los archivos salen de sus filas. Usa un [Servidor de aplicaciones](/components/server), una [Base de datos](/components/database) y [Almacenamiento de objetos](/components/storage), y el único cambio respecto al Tablero anterior es adónde van los archivos. [Servidores de aplicaciones sin estado](/patterns/stateless-app-servers) es el patrón.

::Design{id="files-in-storage"}

El segundo Tablero tiene la forma real de Dropbox, tal como la describió Dropbox para su almacén Magic Pocket. El Almacenamiento de objetos guarda bloques inmutables con el hash como clave, y la Base de datos es el índice de bloques, con cuatro shards sobre una clave hash. El Servidor de aplicaciones calcula el hash de un bloque, lo escribe en el almacenamiento y luego escribe el hash y su ubicación en el índice. Mira lo pequeño que es el índice junto a los bytes, y si algún shard va más caliente que los demás. Ese es el punto de "los bytes son baratos, los metadatos son difíciles" del diseño anterior, y [index the blobs](/patterns/index-the-blobs) lo recorre.

::Design{id="dropbox-block-index"}

Investiga [Almacenamiento de objetos](/research/object-storage), después [Reglas de ciclo de vida del almacenamiento](/research/lifecycle-rules), y fija una ventana de ciclo de vida y una clase de almacenamiento. Vigila el Gasto mientras se llena el almacén, y fíjate en que una petición a un objeto archivado falla como un timeout. Manda las subidas por una [Cola](/components/queue) y [Workers](/components/worker), y ejecuta el Sandbox [Subidas lentas](/sandboxes/slow-uploads). Para el crecimiento de los metadatos, trabaja con [Escalar la base de datos](/guides/scale-the-database).

El juego no tiene fragmentación, hashing, deduplicación ni protocolo de sincronización. Modela el almacén, sus clases, la ruta de subida y la base de datos que guarda el resto.

## Preguntas frecuentes

### ¿Cómo guarda Dropbox los archivos?

Divide los archivos en bloques de unos pocos megabytes, guarda cada bloque una sola vez en un almacén de bloques con su hash como clave, y mantiene el árbol de archivos y las listas de bloques en una base de datos de metadatos. Los clientes suben solo los bloques que le faltan al servidor.

### ¿Por qué dividir los archivos en fragmentos?

Los fragmentos hacen reanudables las subidas, permiten que una edición pequeña suba un fragmento y no el archivo entero, y hacen posible la deduplicación. También paralelizan las transferencias.

### ¿Cómo funciona la deduplicación de archivos?

Calcula el hash de cada fragmento y busca el hash antes de subir. Si el almacén ya lo tiene, añade una referencia y omite la transferencia. Borra un fragmento solo cuando su contador de referencias llega a cero.

### ¿Cómo se enteran los otros dispositivos de que un archivo cambió?

Cada dispositivo guarda un cursor y mantiene una conexión con un servicio de notificaciones. Un cambio envía un aviso, y el dispositivo pide al servicio de metadatos los cambios posteriores a su cursor.
