---
title: Diseñar un sistema de caché como Memcached
seoTitle: Diseñar una caché tipo Memcached: guía de entrevista
summary: Diseña una caché distribuida como Memcached para una entrevista de diseño de sistemas: slabs y LRU, hashing consistente, enrutamiento en el cliente, invalidación, estampidas y Quorum.
section: guides
order: 37
aliases: memcached, redis, distributed cache, in-memory cache, lru, slab allocator, consistent hashing, cache invalidation, cache stampede, system design primer, system design interview, caché distribuida, caché en memoria, asignador de slabs, hashing consistente, invalidación de caché, estampida de caché, entrevista de diseño de sistemas
---

Una caché al estilo Memcached es una flota de nodos en memoria sin inteligencia propia, con la inteligencia en el cliente. Cada nodo guarda pares clave-valor en memoria y expulsa el menos usado recientemente cuando se llena, y la biblioteca cliente aplica un hash a cada clave sobre un anillo de nodos para que cada clave caiga siempre en el mismo. Los nodos no saben nada unos de otros.

Esta es una de las preguntas de la [lista de preguntas adicionales](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions) del [System Design Primer](https://github.com/donnemartin/system-design-primer).

## Requisitos

Funcionales:

- `get`, `set` y `delete` por clave, con un TTL opcional.
- Valores de hasta 1 MB aproximadamente.
- Añadir y quitar nodos sin un reinicio completo.

No funcionales:

- Latencia inferior al milisegundo en un nodo, y unos pocos milisegundos de extremo a extremo.
- Un throughput muy alto, sin una única máquina que estorbe.
- La caché puede perder datos. La fuente de la verdad está en otro sitio.

## Estima la carga

Supón un sitio con 500,000 lecturas por segundo en el pico y una tasa de aciertos del 95%, con un valor medio de 2 KB.

- Tráfico de caché: 500,000 lecturas por segundo. Cada nodo atiende quizá 100,000 operaciones por segundo, así que 5 nodos lo cubren y 10 dan margen.
- Fallos: el 5% de 500,000 son 25,000 lecturas por segundo enviadas a la base de datos. Subir la tasa de aciertos al 99% lo baja a 5,000.
- Memoria: 200 millones de elementos calientes por 2 KB son 400 GB. Con 64 GB de memoria útil por nodo, son 7 nodos. Planea 10 para que ningún nodo trabaje al límite.
- Ancho de banda: 500,000 por 2 KB son 1 GB por segundo, así que cada uno de los 10 nodos lleva unos 100 MB por segundo.

La memoria fija el número de nodos, y el throughput solo lo confirma.

## El diseño

### Enrutamiento en el cliente

La biblioteca cliente guarda la lista de nodos y elige el nodo de cada clave. Usa [hashing consistente](/patterns/consistent-hashing): los nodos y las claves se asignan a un anillo con un hash, y una clave pertenece al siguiente nodo en sentido horario. Añadir o quitar un nodo mueve solo su parte de las claves, mientras que `hash(key) % n` movería casi todas. Cada nodo aparece muchas veces en el anillo como nodos virtuales, para igualar los segmentos. Ningún coordinador está en la ruta de la petición, así que no hay nada que pueda fallar salvo un nodo.

### El nodo

Un nodo es una tabla hash en memoria tras un protocolo de red sencillo, con un bucle de eventos multihilo. Memcached evita la fragmentación del heap con un asignador de slabs. La memoria se corta en páginas de 1 MB, y cada página se divide en fragmentos iguales de una sola clase de tamaño, por ejemplo 96 bytes, 120 bytes, 152 bytes y así sucesivamente. Un elemento va a la clase más pequeña en la que cabe. Esto desperdicia algo de espacio dentro de los fragmentos y evita el coste de una asignación de propósito general.

### Expulsión

Cada clase de tamaño mantiene su propia lista LRU. Una lectura mueve el elemento a la cabeza, y cuando una clase se llena se expulsa la cola. Los elementos caducados se descartan cuando alguien los lee o cuando pasa un rastreador en segundo plano. Redis ofrece otras políticas, como LRU aproximado y LFU, que muestrean unas pocas claves en lugar de seguir el orden completo.

### Invalidación

La mayoría de las apps usan [cache-aside](/patterns/cache-aside). Una lectura consulta la caché, recurre a la base de datos en un fallo y llena la caché. Una escritura actualiza la base de datos y luego borra la clave. Borrar es mejor que actualizar porque dos escritores que compiten pueden dejar el valor más antiguo en una caché que se actualizó. Los TTL acotan el daño de cualquier carrera que aún se cuele.

### Replicación y fallo

Memcached a secas no replica. Cuando un nodo muere, sus claves fallan y la base de datos las vuelve a llenar. Los sitios grandes como Facebook y Netflix añaden un pool de réplicas o escriben en varias zonas, para que la pérdida de un solo nodo no se convierta en una oleada sobre la base de datos.

## Dónde se rompe

**Una estampida de caché.** Una clave caliente caduca y miles de lectores fallan y golpean juntos la base de datos. Deja que un lector la reconstruya mientras los demás esperan, refresca las claves un poco antes de que caduquen, o sirve el valor viejo mientras una petición lo refresca. Mira [protección contra estampidas de caché](/patterns/cache-stampede-protection).

**Un nodo frío.** Un nodo reiniciado o recién añadido está vacío, así que toda su parte del tráfico va a la base de datos. Caliéntalo con una lista de claves antes de enviarle tráfico. Mira [calentamiento de caché y caché por niveles](/patterns/cache-warming-and-tiered-caching).

**Una clave caliente.** El hashing consistente reparte claves, no carga, así que una clave viral queda en un solo nodo. Replica esa clave en varios nodos, o guarda una copia pequeña en la memoria del propio servidor de aplicaciones. Mira [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards).

**Datos obsoletos.** Un lector lento escribe un valor viejo tras un borrado. Usa TTL cortos y, para datos críticos, versiona el valor o lee de la base de datos.

## Constrúyelo en Quorum

La [Caché](/components/cache) del juego es el nodo. El primer Tablero pone una Caché delante de la Base de datos, así que las lecturas repetidas se detienen en memoria. Mira la carga de la Base de datos y la proporción de lecturas obsoletas en el Ledger.

::Design{id="cache-in-front"}

El segundo Tablero activa las protecciones contra estampidas. Compáralo con la versión sin protección en la página del patrón y observa la carga de la Base de datos tras un arranque en frío.

::Design{id="stampede-guarded"}

El tercero añade calentamiento de caché y un segundo nivel, que es la respuesta al nodo frío.

::Design{id="cache-warmed-tiered"}

El cuarto muestra una clave hash que reparte los datos entre varias Bases de datos, la misma idea de colocación que usa el cliente para los nodos de caché.

::Design{id="sharded-hash-key"}

Investiga [Caché](/research/caching) y [Protección contra estampidas](/research/stampede-protection), y ejecuta el incidente [Estampida de caché](/incidents/stampede). Los Sandboxes [Estampida](/sandboxes/stampede) y [Clave caliente](/sandboxes/hot-key) aíslan los dos fallos. Un [Balanceador de carga](/components/lb) también puede repartir por hash consistente.

El juego no modela slabs, clases de tamaño, una lista LRU, una biblioteca cliente ni un anillo de nodos de caché que añades de uno en uno. La presión de expulsión aparece solo como una tasa de aciertos que cae cuando la memoria es demasiado pequeña.

## Preguntas frecuentes

### ¿Cómo decide Memcached dónde vive una clave?

El cliente aplica un hash a la clave sobre un anillo de servidores y elige el siguiente en sentido horario. Los servidores nunca hablan entre sí, así que añadir un servidor mueve solo una pequeña parte de las claves.

### ¿Cuál es la diferencia entre Memcached y Redis?

Memcached es una caché simple y multihilo de cadenas. Redis añade estructuras de datos, persistencia y replicación, y ejecuta los comandos en un solo hilo.

### ¿Cómo mantienes una caché consistente con la base de datos?

Escribe en la base de datos y luego borra la clave cacheada, para que la siguiente lectura la vuelva a llenar. Un TTL limita cuánto puede dañar un borrado fallido.

### ¿Cómo evitas una estampida de caché?

Deja que una petición reconstruya una clave caducada mientras las demás la esperan, y refresca las claves populares un poco antes. Servir un valor algo viejo mientras una petición refresca es la tercera opción.
