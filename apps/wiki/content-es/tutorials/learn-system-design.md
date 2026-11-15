---
title: Aprende diseño de sistemas jugando
seoTitle: Aprende diseño de sistemas jugando un juego gratis
summary: Un orden de lectura y juego que te lleva desde tu primer servidor hasta escalar los datos, sobrevivir a los fallos y responder preguntas de entrevista.
section: tutorials
order: 6
aliases: learn system design, system design course, system design roadmap, system design for beginners, system design study plan, learn scalability, aprender diseño de sistemas, curso de diseño de sistemas, hoja de ruta de diseño de sistemas, diseño de sistemas para principiantes, plan de estudio de diseño de sistemas, aprender escalabilidad
---

Aprendes diseño de sistemas más rápido viendo cómo un Diseño se rompe bajo tráfico y arreglándolo, así que este camino alterna jugar y leer. Cada etapa empieza con unos minutos en Quorum y luego te envía a las páginas que explican lo que acabas de ver. Si paras después de cualquier etapa, te llevas una idea completa, no la mitad de una.

## Etapa 1: un servidor, una base de datos

Juega [Tu primera Empresa](/tutorials/first-company) y después [Tu primer cuello de botella](/tutorials/first-bottleneck). Verás cómo un solo servidor llega a su límite y aprenderás a leer las tarjetas que te dicen qué Nodo está lleno. Lee [Capacidad, utilización y colas](/explanation/queues) para entender por qué un Nodo se vuelve lento mucho antes de llenarse, y [Latencia y percentiles](/explanation/latency) para ver por qué el promedio esconde a tus usuarios más lentos.

## Etapa 2: más servidores y después una caché

Añade un segundo servidor detrás de un [Balanceador de carga](/components/lb) y después pon una [Caché](/components/cache) delante de la [Base de datos](/components/database). Lee [servidores de aplicaciones sin estado](/patterns/stateless-app-servers), [cache-aside](/patterns/cache-aside) y [escalado vertical y horizontal](/patterns/vertical-and-horizontal-scaling). La guía [Sobrevivir a un pico de tráfico](/guides/survive-a-traffic-spike) muestra las mismas ideas bajo presión.

## Etapa 3: cuando la base de datos es el límite

Añade una [Réplica de lectura](/components/replica) y un [Pooler de conexiones](/components/pooler). Lee [réplicas de lectura](/patterns/read-replicas), [estrategias de replicación](/patterns/replication-strategies) y [sharding](/patterns/sharding), y después [hashing consistente](/patterns/consistent-hashing) para ver cómo una clave encuentra su servidor. [Escalar la base de datos](/guides/scale-the-database) recorre el orden de los pasos.

## Etapa 4: trabajo que puede esperar

Pon una [Cola](/components/queue) y un [Worker](/components/worker) detrás de los trabajos lentos. Lee [nivelación de carga con colas](/patterns/queue-load-leveling), [publicación-suscripción](/patterns/publish-subscribe) y [claves de idempotencia](/patterns/idempotency-keys), porque una cola que reintenta necesita una petición que sea segura de repetir.

## Etapa 5: fallos

Juega [Tu primer incidente](/tutorials/first-incident) y después lee [Cómo funcionan los incidentes](/explanation/incidents) y [Errores y reintentos](/explanation/errors-and-retries). La [guía de tormentas de reintentos](/guides/stop-a-retry-storm) muestra cómo una política de reintentos convierte una lentitud breve en una caída. Luego lee [tiempos de espera](/patterns/timeouts), el [circuit breaker](/patterns/circuit-breaker) y el [descarte de carga](/patterns/load-shedding).

## Etapa 6: ponlo en palabras

Lee [Conceptos de diseño de sistemas](/explanation/system-design-concepts) para ver el mapa completo y después prueba las [preguntas de entrevista de diseño de sistemas](/guides/system-design-interview-questions). Cada una te da los requisitos, la estimación de carga, el diseño y lo que se rompe, y te dice qué construir en el juego para verlo.

## Preguntas frecuentes

### ¿Necesito saber programar para aprender diseño de sistemas?

No. El diseño de sistemas trata de qué piezas usar y cómo encajan, así que solo necesitas saber qué es un servidor, una base de datos y una petición. Quorum enseña el resto mostrando cómo fluyen las peticiones por las piezas que colocas.

### ¿Cuánto se tarda en aprender diseño de sistemas?

Las ideas centrales caben en unas pocas semanas de estudio concentrado. Jugar cada etapa veinte o treinta minutos y leer las páginas enlazadas basta para mantener una conversación sobre cómo escalar un servicio web, y las últimas etapas te dan la profundidad que piden las entrevistas senior.

### ¿Quorum es gratis?

Sí. Funciona en tu navegador, sin cuenta y sin descarga, y el código fuente es abierto.
