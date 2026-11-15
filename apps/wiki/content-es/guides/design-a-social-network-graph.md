---
title: Diseña las estructuras de datos de una red social
seoTitle: "Diseña un grafo de red social: guía de diseño de sistemas"
summary: Diseña un grafo de red social para una entrevista de diseño de sistemas: listas de amigos, camino más corto entre usuarios, sharding de personas, caché, y lo que enseña Quorum.
section: guides
order: 32
aliases: social network, social graph, friend graph, shortest path, bfs, six degrees, sharding people, graph database, system design primer, system design interview, red social, grafo social, grafo de amigos, camino más corto, seis grados, base de datos de grafos, entrevista de diseño de sistemas
---

Un grafo social es un conjunto de personas, cada una con una lista de IDs de amigos, repartido entre muchos servidores según un hash del ID de la persona. Un servicio de búsqueda asocia un ID con el servidor que guarda a esa persona. Para encontrar el camino más corto entre dos usuarios, ejecuta una búsqueda en anchura que obtenga las listas de amigos por lotes, y guarda en caché a las personas populares para que la búsqueda rara vez llegue a un disco.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), y su [solución para el grafo social](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/social_graph/README.md) merece leerse junto a esta página.

## Requisitos

Funcionales:

- Un usuario busca a otra persona y ve la cadena de amigos más corta entre ambos.
- Las amistades son mutuas y sin peso.
- Añadir o quitar un amigo actualiza ambos lados.

No funcionales:

- El grafo no cabe en una sola máquina.
- Alta disponibilidad, con una latencia de lectura lo bastante baja para que una búsqueda se sienta instantánea.
- El tráfico es desigual. Las celebridades y unas pocas búsquedas populares atraen la mayor parte.

## Estima la carga

Supón 100 millones de usuarios, 50 amigos cada uno y 1,000 millones de búsquedas al mes.

- Aristas: 100,000,000 x 50 son 5 mil millones de entradas dirigidas, o 2.5 mil millones de amistades guardadas dos veces.
- Almacenamiento: a 8 bytes por ID de amigo, 5 mil millones de entradas son 40 GB de IDs. Añade datos de perfil e índices y siguen siendo solo cientos de gigabytes, así que el límite es la memoria y la tasa de consultas, no el disco.
- Tasa de búsquedas: 1,000,000,000 / 2,500,000 segundos son unas 400 búsquedas por segundo.
- Coste de la búsqueda: un camino de 4 saltos expande 50 amigos por salto. Solo el salto 3 alcanza 125,000 personas y el salto 4 unos 6 millones. Una búsqueda puede tocar millones de listas de amigos, y ese es el coste real.

## El diseño

### Sharding de personas

Reparte las personas entre Person Servers con `hash(person_id) mod N`. Un hash reparte la carga de forma uniforme, mientras que un rango de IDs amontona las cuentas nuevas en el último servidor. Usa [hashing consistente](/patterns/consistent-hashing) o un mapa de shards para que añadir un servidor mueva solo una parte de las personas. Mira el [sharding](/patterns/sharding).

### El servicio de búsqueda

Los clientes y el servicio de grafo necesitan saber qué servidor guarda a una persona. Un pequeño Lookup Service mantiene ese mapa en memoria, replicado, y los clientes lo guardan en caché. Con hashing, la búsqueda es aritmética y el servicio es solo el mapa de shards actual.

### Camino más corto con BFS

En una máquina ejecutarías BFS desde el origen, expandiendo amigos nivel a nivel hasta que aparece el destino. Entre shards, el User Graph Service hace lo mismo, pero obtiene por lotes. Reúne cada ID de un nivel, los agrupa por shard y envía una petición por shard. Eso convierte millones de llamadas en unos pocos cientos por nivel.

Un truco mejor es buscar desde ambos extremos a la vez y parar cuando las dos fronteras se encuentran. Dos búsquedas de profundidad 2 alcanzan unas 2,500 personas cada una, mientras que una búsqueda de profundidad 4 alcanza millones.

### Caché

Las listas de amigos de las personas populares aparecen en muchas búsquedas. Pon una [Caché](/components/cache) delante de los Person Servers y guarda los resultados recientes de BFS para los pares populares. TAO de Facebook es esta idea a escala. Mira la [caché delante del grafo](/patterns/cache-in-front-of-the-graph).

## Dónde se rompe

**Una celebridad.** Una persona con 50 millones de amigos está en una parte enorme de los caminos y atrae una avalancha de lecturas a un shard. Replica o divide su entrada entre copias y limita cuántos amigos expande una búsqueda desde un nodo. Mira las [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards).

**Un camino largo.** Si no aparece ningún camino en 4 o 5 saltos, para y di "muy lejos". Un BFS sin límite puede costar más que el resto del sistema.

**Charla entre shards.** Cada salto toca muchos servidores, así que la latencia de cola la marca el más lento. Agrupa peticiones, fija timeouts y considera las [peticiones hedged](/patterns/hedged-requests).

**Resharding.** Añadir servidores mueve personas. Mantén la clave en el ID de la persona, como en [pon el shard en el ID](/patterns/put-the-shard-in-the-id), para que un movimiento no renumere a nadie.

## Constrúyelo en Quorum

El paso del sharding se puede jugar directamente. Este tablero tiene una [Base de datos](/components/database) con varios shards sobre una clave hash:

::Design{id="sharded-hash-key"}

Mira cómo se reparte la carga y compárala con la clave de rango de [Claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards), donde los usuarios nuevos caen en un solo shard.

El segundo tablero es el paso de caché, una [Caché](/components/cache) delante de una Base de datos con shards, modelada sobre TAO de Meta:

::Design{id="meta-cache-graph"}

Muestra un grafo con muchas lecturas servido sobre todo desde la Caché, con las escrituras pasando por ella hasta el shard. El tablero dibuja una región, no la replicación completa de TAO.

El tercer tablero es el problema de la celebridad. Una clave caliente en la Caché, con división de claves:

::Design{id="hot-key-split"}

Lee la cifra de capacidad, que se mantiene entera cuando la clave caliente se reparte entre los shards de la Caché. Investiga [Sharding](/research/sharding) y [Caché](/research/caching), y mira [Escalar la base de datos](/guides/scale-the-database). Los incidentes [Shard caliente del tenant grande](/incidents/hot-shard) y [Clave caliente](/incidents/hot-key) son los fallos de arriba, y el Sandbox [Clave caliente](/sandboxes/hot-key) te deja probar la solución.

El juego no tiene un grafo. No modela listas de amigos, BFS, búsqueda bidireccional ni un servicio de búsqueda, y una petición es una sola consulta a un shard, no un recorrido por muchos. El coste del camino más corto lo calculas en papel, como arriba.

## Preguntas frecuentes

### ¿Cómo se encuentra el camino más corto entre dos usuarios de una red social?

Ejecuta una búsqueda en anchura desde el origen, que encuentra el camino más corto en un grafo sin pesos. Para un grafo grande, busca desde ambos usuarios a la vez y para cuando las dos búsquedas se encuentren, así cada lado solo avanza unos pocos saltos.

### ¿Cómo se hace sharding de un grafo social?

Aplica un hash al ID de cada persona para elegir el servidor que guarda a esa persona y su lista de amigos. Un servicio de búsqueda o un mapa de shards le dice al servicio de grafo dónde vive cada ID.

### ¿Debería una red social usar una base de datos de grafos?

El ejercicio del Primer pide hacerlo sin una, con servidores con shards y un servicio de búsqueda. Las bases de datos de grafos como Neo4j encajan con grafos más pequeños, y con miles de millones de aristas muchas empresas construyen almacenes propios como TAO sobre MySQL con shards.

### ¿Qué dice el System Design Primer sobre el grafo social?

Acota el problema a la búsqueda del camino más corto entre dos personas, con las personas repartidas en Person Servers detrás de un Lookup Service. Esta página mantiene esa forma y añade el agrupamiento por lotes, la búsqueda bidireccional y el problema de la celebridad.
