---
title: Conceptos de diseño de sistemas
seoTitle: Conceptos de diseño de sistemas explicados, con ejemplos
summary: Los conceptos detrás de la mayoría de las preguntas de diseño de sistemas, agrupados por el problema que resuelve cada uno, con una página para cada uno y una forma de probarlo en el juego.
section: explanation
order: 20
aliases: system design concepts, system design basics, system design cheat sheet, distributed systems concepts, scalability concepts, system design fundamentals, conceptos de diseño de sistemas, fundamentos de diseño de sistemas, guía rápida de diseño de sistemas, conceptos de sistemas distribuidos, conceptos de escalabilidad
---

La mayoría de las preguntas de diseño de sistemas se reducen a unas cincuenta ideas, y cada una responde a un problema concreto: demasiado tráfico, datos que no caben en una máquina, una dependencia que falla, un número que esconde la imagen real. Esta página las agrupa por problema. Cada entrada enlaza a una página que la explica, y la mayoría tiene un Componente o un Sandbox en Quorum donde puedes verla funcionar con tráfico en vivo.

## Cuando un servidor no basta

Empieza por hacer que la capa de aplicación sea algo que puedas copiar. Los [servidores de aplicaciones sin estado](/patterns/stateless-app-servers) no guardan ninguna sesión en memoria, así que cualquier copia puede responder cualquier petición. Después, [varios servidores de aplicaciones tras un balanceador de carga](/patterns/several-app-servers-behind-a-load-balancer) reparten el trabajo. Elegir entre [escalado vertical y horizontal](/patterns/vertical-and-horizontal-scaling) es una cuestión de coste, y [escalar primero hacia arriba](/patterns/scale-up-first) sostiene que una máquina más grande suele ser la respuesta más barata durante más tiempo del que la gente espera.

- [Algoritmos de balanceo de carga](/patterns/load-balancing-algorithms): round robin, menos conexiones, y qué hace cada uno cuando un servidor es lento.
- [Balanceo de carga de capa 4 y capa 7](/patterns/layer-4-and-layer-7-load-balancing): enrutar por conexión o por contenido de la petición.
- [Sesiones pegajosas](/patterns/sticky-sessions): fijar a un usuario a un servidor, y por qué eso hace más difícil reducir.
- [Autoescalado de la capa de cómputo](/patterns/autoscale-the-compute-tier): añadir copias cuando sube la carga, y por qué un arranque lento hace que lleguen tarde.

## Leer los mismos datos una y otra vez

Una caché responde las lecturas repetidas desde memoria para que la base de datos no tenga que hacerlo. [Cache-aside](/patterns/cache-aside) es la opción por defecto, y [write-through y write-behind](/patterns/write-through-and-write-behind) cambian el momento en que una escritura llega a la base de datos. Una clave caliente que expira puede enviar a todos los lectores a la base de datos a la vez, y la [protección contra estampidas de caché](/patterns/cache-stampede-protection) lo evita.

- [CDN push y pull](/patterns/cdn-push-and-pull): servir archivos desde un servidor cercano al lector.
- [Archivos estáticos en almacenamiento de objetos y una CDN](/patterns/static-files-on-object-storage-and-a-cdn): sacar por completo las imágenes y las descargas de los servidores de aplicaciones.
- [Calentamiento de caché y caché por niveles](/patterns/cache-warming-and-tiered-caching): arrancar en caliente tras un reinicio, y apilar cachés.
- [Precomputación](/patterns/precomputation): hacer el trabajo costoso antes de que alguien lo pida.

## Cuando la base de datos es el límite

Las lecturas y las escrituras golpean la base de datos de forma distinta, así que escalan de forma distinta. Las [réplicas de lectura](/patterns/read-replicas) copian los datos a servidores que solo responden lecturas, y las [estrategias de replicación](/patterns/replication-strategies) explican qué le pasa a una escritura por el camino. Cuando el límite son las escrituras, el [sharding](/patterns/sharding) reparte los datos entre servidores, y el [hashing consistente](/patterns/consistent-hashing) decide qué servidor es dueño de una clave sin mover la mayoría de las claves cuando cambia el conjunto de servidores.

- [Claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards): una clave que recibe la mayor parte del tráfico rompe un reparto uniforme.
- [Pool de conexiones](/patterns/connection-pooling): una base de datos acepta pocas conexiones, y muchos servidores de aplicaciones pueden agotarlas.
- [Vistas materializadas y desnormalización](/patterns/materialized-views-and-denormalization): guardar la respuesta en lugar de calcularla en cada lectura.
- [Almacenes de documentos y de columnas anchas](/patterns/document-and-wide-column-stores): cuando los datos cambian de forma o las escrituras superan una máquina.
- [Búsqueda de texto completo e índice invertido](/patterns/full-text-search-and-inverted-index): por qué un motor de búsqueda va junto a la base de datos.
- [Separación OLTP y OLAP](/patterns/oltp-and-olap-split): mantener los informes fuera de la base de datos que toma los pedidos.

## Cuando las copias de los datos no coinciden

Cuando los datos viven en más de un lugar, las copias pueden diferir durante un tiempo, y un diseño tiene que decir cuánto es aceptable. [CAP y PACELC](/patterns/cap-and-pacelc) enuncian el tradeoff, y los [modelos de consistencia](/patterns/consistency-models) enumeran las opciones desde la estricta hasta la eventual. Las [lecturas y escrituras con quórum](/patterns/quorum-reads-and-writes) permiten que un almacén elija su punto en esa línea por cada petición.

- [Consenso y elección de líder](/patterns/consensus-and-leader-election): cómo un grupo de servidores acuerda un valor o un líder.
- [Leer tus escrituras](/patterns/read-your-writes): asegurar que un usuario ve lo que acaba de guardar.
- [Commit en dos fases](/patterns/two-phase-commit) y la [saga](/patterns/saga): dos formas de cambiar datos en varios lugares, y lo que cuesta cada una cuando falla un paso.
- [CRDTs](/patterns/crdts): tipos de datos que se fusionan sin coordinador.

## Trabajo que no tiene que ocurrir ahora

Una cola permite que un productor rápido entregue trabajo a un consumidor más lento. [Trabajo lento a una cola y workers](/patterns/slow-work-to-a-queue-and-workers) es el movimiento básico, y la [nivelación de carga con colas](/patterns/queue-load-leveling) muestra por qué suaviza un pico. La [publicación-suscripción](/patterns/publish-subscribe) envía un evento a muchos consumidores, y los [consumidores concurrentes](/patterns/competing-consumers) comparten una cola entre muchos workers.

- [Cola de mensajes fallidos](/patterns/dead-letter-queue): adónde va un mensaje después de fallar demasiadas veces.
- [Claves de idempotencia](/patterns/idempotency-keys): hacer que una petición reintentada sea segura de repetir.
- [Outbox transaccional](/patterns/transactional-outbox): guardar un cambio y anunciarlo sin perder una de las dos cosas.
- [Captura de cambios de datos](/patterns/change-data-capture): convertir los cambios de la base de datos en eventos.
- [Fan-out en escritura y en lectura](/patterns/fan-out-on-write-and-on-read): hacer el trabajo cuando se publica un post o cuando se lee.
- [Long polling y SSE](/patterns/long-polling-and-sse) y [WebSockets](/patterns/websockets-tier-for-realtime): enviar actualizaciones a un cliente.

## Cuando algo falla

Una dependencia lenta es más peligrosa que una muerta, porque los llamadores esperan y se acumulan. Los [tiempos de espera](/patterns/timeouts) acotan la espera. [Reintentar con backoff](/patterns/retry-with-backoff) se recupera de fallos breves, y el [circuit breaker](/patterns/circuit-breaker) evita que los reintentos martilleen un servicio caído. El [bulkhead](/patterns/bulkhead) impide que una dependencia que falla use todos los hilos.

- [Descarte de carga](/patterns/load-shedding): descartar el trabajo menos valioso para mantener rápido el resto.
- [Limitación de tasa](/patterns/rate-limiting): poner un tope a lo que puede enviar cada cliente.
- [Backpressure](/patterns/backpressure): decirle a un productor que vaya más despacio.
- [Degradación gradual](/patterns/graceful-degradation): apagar una funcionalidad en lugar de fallar toda la página.
- [Peticiones con cobertura](/patterns/hedged-requests): enviar una segunda petición cuando la primera es lenta.
- [Health checks y failover](/patterns/health-checks-and-failover): detectar un servidor caído y mandar el tráfico a otro sitio.
- [Ingeniería del caos](/patterns/chaos-engineering): romper cosas a propósito para descubrirlo antes.

## Medir un sistema

No puedes arreglar lo que lees mal. [Percentiles, no promedios](/patterns/percentiles-not-averages) muestra cómo una media esconde a los usuarios más lentos, y la [latencia de cola](/patterns/tail-latency) explica por qué las peticiones más lentas dominan cuando una página hace muchas llamadas. [Latencia frente a throughput](/patterns/latency-vs-throughput) y la [ley de Little](/patterns/littles-law) conectan los dos números.

- [Disponibilidad y nueves](/patterns/availability-and-nines): qué significan 99.9 y 99.99 por ciento en minutos de caída.
- [SLOs y presupuestos de error](/patterns/slos-and-error-budgets): acordar cuánto fallo es aceptable.
- [Señales doradas, RED y USE](/patterns/golden-signals-red-and-use): las pocas métricas que conviene vigilar primero.
- [RPO y RTO](/patterns/rpo-and-rto): cuántos datos puede costar un desastre y cuánto puede tardar la recuperación.

## Preguntas frecuentes

### ¿Cuáles son los conceptos de diseño de sistemas más importantes para aprender primero?

Aprende primero balanceo de carga, caché, replicación, sharding y colas, porque casi toda pregunta de entrevista usa al menos tres de ellos. Añade después tiempos de espera, reintentos y percentiles, ya que explican por qué fallan los sistemas bajo carga y cómo notarlo.

### ¿Cómo practico diseño de sistemas sin un compañero de entrevista?

Construye un sistema, pásale tráfico y observa qué parte falla primero. Quorum lo hace sobre un Tablero: colocas los Componentes, la Simulación envía peticiones a través de ellos, y cada arreglo mueve el cuello de botella a otro sitio, así que aprendes el orden en que se rompen los sistemas reales. El [tutorial del primer cuello de botella](/tutorials/first-bottleneck) es un comienzo corto.

### ¿El diseño de sistemas es solo para entrevistas?

No. Las mismas ideas deciden si un servicio real sobrevive a un día de lanzamiento o a una venta relámpago, y las páginas de [incidentes](/incidents) muestran cómo se ve cada uno cuando sale mal. Las entrevistas evalúan el mismo razonamiento, con un reloj más corto y menos datos.
