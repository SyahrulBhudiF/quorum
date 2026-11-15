---
title: Diseña un sistema que escale a millones de usuarios
seoTitle: "Diseña un sistema para millones de usuarios: guía de escalado"
summary: Escala de una sola máquina a millones de usuarios para una entrevista de diseño de sistemas: balanceador de carga, réplicas, caché, CDN, colas, sharding, y lo que enseña Quorum.
section: guides
order: 35
aliases: scale to millions of users, scaling aws, horizontal scaling, vertical scaling, load balancer, sharding, read replicas, system design primer, system design interview, escalar a millones de usuarios, escalado horizontal, escalado vertical, balanceador de carga, réplicas de lectura, entrevista de diseño de sistemas
---

No diseñas un sistema para un millón de usuarios el primer día. Empiezas con un servidor que ejecuta la aplicación y la base de datos, y arreglas el recurso que se agote primero: una máquina más grande, un balanceador de carga y más servidores de aplicaciones, una caché, réplicas de lectura, una CDN, una cola para el trabajo lento y, por último, sharding. Cada paso responde a un cuello de botella medido, y cada uno añade algo que operar.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), y su [solución para escalar en AWS](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/scaling_aws/README.md) merece leerse junto a esta página.

## Requisitos

Funcionales:

- Un usuario puede leer y escribir sus propios datos.
- El servicio crece de un puñado de usuarios a decenas de millones sin reescribirse.

No funcionales:

- Las lecturas superan a las escrituras en unas 20 a 1.
- Datos relacionales, así que las transacciones y los joins importan desde el principio.
- La disponibilidad mejora en cada paso, porque una sola máquina es un punto único de fallo.

## Estima la carga

Supón 10 millones de usuarios registrados, con un 20% activo un día cualquiera.

- Peticiones: 2M de usuarios diarios con 50 peticiones cada uno son 100M al día, unas 1,160 por segundo. El pico, a cinco veces, es 6,000.
- Escrituras: 1 petición de cada 20 escribe, así que unas 300 escrituras por segundo en el pico.
- Almacenamiento: 1 KB por escritura con una media de 60 escrituras por segundo son unos 5 GB al día. Un año son menos de 2 TB.

Una base de datos soporta unos pocos miles de consultas simples por segundo, así que 6,000 peticiones con unas cuantas consultas cada una superan una sola máquina. Un año de datos cabe en un disco, así que el tamaño del almacenamiento no es lo que obliga a hacer sharding. A la larga lo es la tasa de escritura.

## El diseño

Recórrelo como una escalera. En cada peldaño, nombra el cuello de botella que te llevó allí.

### Una máquina

El servidor web y la base de datos comparten una máquina, con un nombre DNS que apunta a ella. Es lo correcto para los primeros miles de usuarios. Vigila CPU, memoria, disco y red para saber qué se agota primero.

### Una máquina más grande

Cuando se agota la CPU o la memoria, compra una instancia mayor. No requiere cambios de código. Los límites son el coste, un techo de tamaño y un punto único de fallo. Mira el [escalado vertical y horizontal](/patterns/vertical-and-horizontal-scaling).

### Separa la aplicación de la base de datos y añade un balanceador de carga

Mueve la base de datos a su propio host o a un servicio gestionado como RDS, y guarda los archivos estáticos en almacenamiento de objetos. Cuando el nivel de aplicación se sature, ejecuta varios servidores de aplicaciones sin estado detrás de un [balanceador de carga](/patterns/several-app-servers-behind-a-load-balancer) como un ELB o HAProxy. El balanceador de carga también comprueba el estado y descarta los servidores caídos.

### Caché

La mayoría de las lecturas tocan las mismas pocas filas. Una caché como Redis delante de la base de datos convierte la mayoría en búsquedas en memoria. Mira [añadir una caché](/patterns/add-a-cache) y [cache-aside](/patterns/cache-aside).

### Réplicas de lectura

Cuando las lecturas siguen superando a la primaria, añade réplicas. La aplicación envía las escrituras a la primaria y las lecturas a las réplicas, y el retraso de replicación hace que un usuario quizá no vea su propia escritura de inmediato. Mira [enruta lecturas y escrituras por separado](/patterns/route-reads-and-writes-apart) y [lee tus propias escrituras](/patterns/read-your-writes).

### CDN

Las imágenes, los scripts y el vídeo van a una [CDN](/patterns/static-files-on-object-storage-and-a-cdn) como CloudFront, que los sirve cerca del usuario y quita ese tráfico de tus servidores.

### Colas y workers

Todo lo lento, como el correo, el redimensionado de imágenes o la analítica, va a una [cola](/patterns/slow-work-to-a-queue-and-workers) y se ejecuta en workers. La petición vuelve al instante y el backlog se drena a su propio ritmo.

### Sharding

Cuando una sola primaria no soporta la tasa de escritura, divide los datos entre varias bases de datos según una clave como el ID de usuario. Es el paso más caro, porque las consultas y transacciones entre shards se vuelven difíciles. Mira [haz sharding de la base de datos](/patterns/shard-the-database) y el [sharding](/patterns/sharding).

## Dónde se rompe

**Saltarse la medición.** Los equipos añaden una caché cuando el problema real era un índice que faltaba. Perfila primero, arregla lo más barato y vuelve a hacer una prueba de carga. Mira [encontrar el cuello de botella](/guides/find-the-bottleneck).

**Servidores de aplicaciones con estado.** Las sesiones guardadas en la memoria del servidor atan a cada usuario a una máquina, así que el balanceador de carga no puede repartirlos libremente. Guarda las sesiones en la caché o en una cookie firmada.

**Una sola base de datos, después de todo eso.** Diez servidores de aplicaciones y una primaria siguen significando que un fallo lo tumba todo. Añade una réplica en espera en otra zona con failover automático.

**Un shard caliente.** Una mala clave de shard envía la mayor parte del tráfico a una base de datos. Elige una clave que reparta, como en [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards).

## Constrúyelo en Quorum

El juego está construido en torno a esta escalera. Empieza con un servidor que ejecuta su propio Postgres.

::Design{id="one-box"}

Cuando el nivel de aplicación es el límite, añade servidores detrás de un [Balanceador de carga](/components/lb). Este tablero muestra dos [Servidores de aplicaciones](/components/server) más pequeños en lugar de uno grande, y la página [escalado vertical y horizontal](/patterns/vertical-and-horizontal-scaling) compara ambos.

::Design{id="scale-out"}

Cuando la CPU de la Base de datos sube con las lecturas, coloca una [Caché](/components/cache) delante.

::Design{id="cache-in-front"}

Cuando las lecturas siguen superando a la primaria, añade una [Réplica de lectura](/components/replica) y enruta las lecturas hacia ella. Vigila el [Retraso de replicación](/incidents/repl-lag).

::Design{id="read-write-split"}

Cuando las escrituras superan a una sola primaria, haz sharding.

::Design{id="sharded-database"}

El juego también cubre los demás peldaños sin un tablero aquí. Una [CDN](/components/cdn) y un [Almacenamiento de objetos](/components/storage) se llevan los archivos estáticos, y una [Cola](/components/queue) con [Workers](/components/worker) se lleva los trabajos lentos. La guía [Escalar la base de datos](/guides/scale-the-database) ordena los pasos de datos, y [Sobrevivir a un pico de tráfico](/guides/survive-a-traffic-spike) usa varios a la vez. Investiga [Caché](/research/caching), [Balanceo de carga](/research/load-balancing) y [Sharding](/research/sharding) para desbloquear cada paso, y ejecuta el Sandbox [Segundo servidor](/sandboxes/second-server) para el primer movimiento.

El juego no tiene registros DNS que gestionar, ni subredes de VPC, ni servicios específicos de AWS. No modela datos por usuario, así que la clave de shard reparte usuarios simulados y no cuentas reales.

## Preguntas frecuentes

### ¿Cómo se escala una aplicación web a millones de usuarios?

Mide y luego arregla el primer recurso que se agote. Un orden típico es un servidor más grande, un balanceador de carga con varios servidores de aplicaciones, una caché, réplicas de lectura, una CDN, una cola para el trabajo lento y, al final, sharding.

### ¿Cuándo escalar en vertical y cuándo en horizontal?

Escala en vertical primero, porque no requiere cambios de código. Pasa al escalado horizontal cuando una sola máquina sea demasiado cara, demasiado grande o un punto único de fallo.

### ¿Cuándo necesitas hacer sharding de una base de datos?

Cuando el volumen de escrituras o el tamaño de los datos supera lo que una primaria puede manejar, incluso con caché y réplicas. Las lecturas rara vez lo obligan, ya que las réplicas y las cachés escalan las lecturas de forma más barata.

### ¿Exige el System Design Primer usar AWS para esta pregunta?

No. El Primer la resuelve en AWS, pero dice que los principios valen en cualquier sitio. La escalera de balanceador de carga, caché, réplicas, CDN, colas y sharding es la misma en cualquier nube.
