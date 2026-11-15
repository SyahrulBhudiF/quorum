---
title: Diseñar un almacén clave-valor para un motor de búsqueda
seoTitle: Diseñar una caché de consultas de un motor de búsqueda: guía de entrevista
summary: Diseña una caché de consultas delante de un backend de búsqueda para una entrevista de diseño de sistemas: expulsión LRU, TTL, sharding de la caché, consultas calientes y lo que enseña Quorum.
section: guides
order: 33
aliases: query cache, search cache, lru cache, key-value cache, memcached, redis, cache invalidation, system design primer, system design interview, caché de consultas, caché de búsquedas, caché LRU, caché clave-valor, invalidación de caché, entrevista de diseño de sistemas
---

Una caché de consultas se sitúa entre los servidores web y el backend de búsqueda y responde desde
memoria las búsquedas repetidas. Indexa por la consulta normalizada, expulsa las entradas menos
usadas recientemente y haz que cada una expire tras un TTL corto para que los resultados no se queden
obsoletos mucho tiempo. Cuando un nodo no puede contener el conjunto caliente, reparte las claves
entre varios nodos de caché por hash.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), y su [solución para la caché de consultas](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/query_cache/README.md) merece leerse junto a esta página.

## Requisitos

Funcionales:

- Una búsqueda vista hace poco se devuelve desde la caché.
- Una búsqueda que no se ha visto va al backend, y la respuesta se guarda.
- Las consultas populares siguen en caché, y las raras pueden salir.

No funcionales:

- Las consultas tardan en torno a un milisegundo, así que la caché debe vivir en memoria.
- El servicio sigue en pie cuando muere un nodo de caché. Fallar la caché es lento, y nunca debe ser un error.
- Los resultados pueden tener unos minutos, pero una página eliminada no debe aparecer durante horas.

## Estima la carga

Supón 10 mil millones de búsquedas al mes y 2.5 millones de segundos en un mes.

- Tasa media: 10B / 2.5M son 4,000 búsquedas por segundo. El pico, a tres veces la media, es 12,000.
- El tráfico está sesgado. Supón que 50 millones de consultas distintas generan el 90% de las búsquedas, y el resto son únicas.
- Tamaño de entrada: la consulta normalizada ocupa unos 50 bytes, y una página de diez títulos y fragmentos unos 2 KB. Así, 50M de entradas son unos 100 GB.
- Carga del backend: con una tasa de aciertos del 90%, el backend ve el 10% de 12,000, o 1,200 por segundo en el pico. Sube la tasa de aciertos al 95% y ve 600.

Un nodo de Redis contiene cómodamente unas pocas decenas de gigabytes, así que 100 GB significan cuatro o cinco nodos. El ahorro en el backend importa más que la factura de memoria.

## El diseño

### Normalización de consultas

Antes de cualquier búsqueda, la API de consultas pasa el texto a minúsculas, quita el marcado, recorta espacios y corrige errores tipográficos evidentes. «Cheap Flights NYC» y «cheap flights nyc » deben dar con la misma clave. Cada consulta que unes sube la tasa de aciertos gratis.

### La caché

La API de consultas consulta un almacén en memoria como Redis o Memcached. Un acierto responde al instante. Un fallo pregunta al backend de búsqueda, escribe el resultado bajo la clave y lo devuelve. Eso es [cache-aside](/patterns/cache-aside), y la lógica es de la aplicación. Si un nodo de caché está caído, la llamada pasa al backend.

### Expulsión LRU

La memoria es finita, así que la caché descarta la entrada que lleva más tiempo sin tocarse. La construcción clásica es un mapa hash de la clave a un nodo de una lista doblemente enlazada. Una lectura mueve su nodo a la cabeza, y una inserción con la caché llena quita la cola. Ambas operaciones tardan tiempo constante. Redis lo aproxima muestreando unas pocas claves, lo que es más barato y suficientemente cercano.

### TTL e invalidación

Los resultados de búsqueda cambian cuando cambian las páginas o se mueven los rankings, y la caché no puede saberlo. Dale a cada entrada un TTL de unos minutos. Las consultas populares se refrescan a menudo porque expiran a menudo, y las raras apenas importan. Para retiradas urgentes, como una orden de retirada, publica un borrado para las claves afectadas.

### Sharding de la caché

Aplica un hash a la clave de la consulta y envíala a uno de N nodos. El módulo simple reordena casi todo cuando cambia N, así que usa [hashing consistente](/patterns/consistent-hashing), que mueve solo cerca de 1/N de las claves. Consulta [sharding](/patterns/sharding) para el caso general. Pon una réplica detrás de cada shard si perder las claves de un nodo inundaría el backend.

## Dónde se rompe

**Expira una entrada popular.** Diez mil peticiones de la misma consulta de moda fallan a la vez y todas llegan al backend. Deja que una sola petición reconstruya la entrada mientras las demás esperan o toman la copia obsoleta, y añade jitter a los TTL. Consulta [Protección contra estampidas de caché](/patterns/cache-stampede-protection).

**Una caché fría.** Tras un reinicio o un despliegue, la tasa de aciertos es cero y el backend recibe toda la carga. Calienta la caché con las consultas más frecuentes del día anterior antes de enviar tráfico. Consulta [Calentamiento de caché y caché en niveles](/patterns/cache-warming-and-tiered-caching).

**Un shard caliente.** Una consulta de una celebridad es una clave en un nodo. Replica las claves calientes o mantén una pequeña caché local en cada servidor de la API de consultas. Consulta [Claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards).

**Rotación por expulsión.** Un rastreador recorre millones de consultas únicas y expulsa las entradas calientes reales. No guardes en caché las consultas vistas solo una vez.

## Constrúyelo en Quorum

El primer Diseño muestra el camino de lectura. Pone una [Caché](/components/cache) delante de la [Base de datos](/components/database), y la estrategia por defecto de la Caché es cache-aside con un TTL y un tamaño. Mira cómo baja la carga de la Base de datos al subir la proporción de aciertos.

::Design{id="cache-aside"}

El segundo Diseño activa dos protecciones contra estampidas en la Caché, y responde al problema de la entrada popular. Compara su pie de figura con la versión sin protección en [Protección contra estampidas de caché](/patterns/cache-stampede-protection).

::Design{id="stampede-guarded"}

El tercer Diseño es una Base de datos con varios shards y una clave hash. En el juego los shards son Bases de datos, no nodos de Caché, pero el efecto sobre el reparto de claves es el que explicarías para una caché. Consulta [Sharding](/patterns/sharding) para ver qué hace la elección de la clave.

::Design{id="sharded-hash-key"}

El último Diseño pone un [Motor de búsqueda](/components/search) junto a la Base de datos, lo más parecido en el juego al backend que hay detrás de tu caché.

::Design{id="search-engine"}

Investiga [Caché](/research/caching) y [Protección contra estampidas](/research/stampede-protection) para desbloquear los interruptores. El incidente [Estampida de caché](/incidents/stampede) pone a prueba el caso del arranque en frío, y el Sandbox [Estampida](/sandboxes/stampede) te deja ejecutarlo tú mismo.

El juego no tiene lista LRU, ni normalización de consultas, ni invalidación por clave, ni anillo de hashing consistente. Una Caché tiene un tamaño y una proporción de aciertos, no entradas individuales.

## Preguntas frecuentes

### ¿Cómo funciona una caché LRU?

Combina un mapa hash con una lista doblemente enlazada. Una búsqueda encuentra el nodo a través del mapa y lo mueve a la cabeza de la lista, y cuando la caché está llena se quita el nodo de la cola. Ambos pasos tardan tiempo constante.

### ¿Cómo invalidas una caché de consultas de búsqueda?

Casi siempre no lo haces. Un TTL corto de unos minutos deja que cada entrada expire sola, lo cual es simple y suficiente para resultados ordenados. Para casos urgentes, borra las claves concretas cuando se publique el cambio.

### ¿Cómo haces sharding de una caché entre servidores?

Aplica un hash a la clave y asígnala a un nodo, preferiblemente con hashing consistente para que añadir un nodo mueva solo una pequeña parte de las claves. Los clientes o un proxy como Twemproxy hacen el enrutamiento.

### ¿Qué dice el System Design Primer sobre la caché de consultas?

El Primer la limita a aciertos de caché, fallos de caché y alta disponibilidad, con una caché LRU construida con una tabla hash y una lista enlazada. Esta página cubre el mismo terreno y añade los casos de sharding y de estampida.
