---
title: Preguntas de entrevista de diseño de sistemas
seoTitle: Preguntas de entrevista de diseño de sistemas con soluciones paso a paso
summary: Diecinueve preguntas comunes de entrevista de diseño de sistemas, la mayoría del System Design Primer, cada una con requisitos, una estimación de carga, un diseño, lo que se rompe y qué construir en el juego.
section: guides
order: 19
aliases: system design interview, system design questions, system design interview prep, hld questions, high level design questions, design a, entrevista de diseño de sistemas, preguntas de diseño de sistemas, preparar entrevista de diseño de sistemas, preguntas de diseño de alto nivel, diseñar un
---

Las primeras catorce preguntas vienen del [System Design Primer](https://github.com/donnemartin/system-design-primer), el repositorio de preparación de entrevistas más usado. Cada página de abajo responde una pregunta como lo haría un buen candidato: enuncia los requisitos, estima la carga, construye el diseño pieza por pieza y nombra lo que se rompe primero. Después muestra qué colocar en el Tablero de Quorum, para que veas el fallo en lugar de memorizarlo.

| Pregunta                                                                                                | La idea que enseña                                                      |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Diseñar un acortador de URL o Pastebin](/guides/design-a-url-shortener)                                | Claves únicas y una carga de lectura intensiva servida desde una caché  |
| [Diseñar un feed de noticias o la línea de tiempo de Twitter](/guides/design-a-news-feed)               | Fan-out en escritura frente a fan-out en lectura                        |
| [Diseñar un web crawler](/guides/design-a-web-crawler)                                                  | Colas, cortesía y deduplicación de una frontera enorme                  |
| [Diseñar Mint.com](/guides/design-mint-com)                                                             | Sincronizar cuentas y sacar los informes por lotes de la base principal |
| [Diseñar las estructuras de datos de una red social](/guides/design-a-social-network-graph)             | Hacer sharding de un grafo y encontrar caminos entre personas           |
| [Diseñar un almacén clave-valor para un motor de búsqueda](/guides/design-a-query-cache)                | Cachear consultas con LRU, sharding e invalidación                      |
| [Diseñar el ranking de ventas de Amazon por categoría](/guides/design-a-sales-rank)                     | Agregar eventos en listas top precalculadas                             |
| [Diseñar un sistema que escale a millones de usuarios](/guides/design-a-system-for-millions-of-users)   | La escalera desde una máquina hasta datos con sharding                  |
| [Diseñar un servicio de sincronización de archivos como Dropbox](/guides/design-a-file-storage-service) | Fragmentación, metadatos y sincronización                               |
| [Diseñar un motor de búsqueda como Google](/guides/design-a-search-engine)                              | Rastreo, índice invertido y servicio con sharding                       |
| [Diseñar un almacén clave-valor como Redis o Dynamo](/guides/design-a-key-value-store)                  | Particionado, replicación y quórums                                     |
| [Diseñar un sistema de caché como Memcached](/guides/design-a-cache-like-memcached)                     | Expulsión, hashing entre nodos y estampidas                             |
| [Diseñar una app de chat como WhatsApp](/guides/design-a-chat-system)                                   | Conexiones de larga duración y orden de los mensajes                    |
| [Diseñar una red de distribución de contenido como Cloudflare](/guides/design-a-cdn)                    | Cachés edge, enrutamiento y escudo del origen                           |
| [Diseñar un limitador de tasa](/guides/design-a-rate-limiter)                                           | Contar peticiones de forma justa entre muchos servidores                |
| [Diseñar un sistema de notificaciones](/guides/design-a-notification-system)                            | Colas, reintentos y entrega idempotente                                 |
| [Diseñar un sistema de pagos](/guides/design-a-payment-system)                                          | No cobrar dos veces cuando todo se reintenta                            |
| [Diseñar un servicio de streaming de vídeo](/guides/design-a-video-streaming-service)                   | Pipelines de subida, almacenamiento de objetos y CDN                    |
| [Diseñar un sistema de reserva de entradas](/guides/design-a-ticket-booking-system)                     | Reservar inventario escaso durante una venta relámpago                  |

Si una pregunta usa un término que no conoces, [Conceptos de diseño de sistemas](/explanation/system-design-concepts) agrupa cada idea por el problema que resuelve. Si partes de cero, [Aprende diseño de sistemas jugando](/tutorials/learn-system-design) te da un orden.

## Preguntas frecuentes

### ¿Cómo abordo una pregunta de entrevista de diseño de sistemas?

Pide primero los requisitos, estima la carga, esboza el diseño más simple que funcione, y luego encuentra su primer cuello de botella y arréglalo. Cada guía de aquí sigue ese orden, porque el orden es lo que vigilan los entrevistadores.

### ¿Qué buscan los entrevistadores en una respuesta de diseño de sistemas?

Buscan requisitos claros, números que justifiquen cada decisión y un relato honesto de los tradeoffs. Nombrar una tecnología importa menos que decir lo que cuesta y cuándo elegirías otra cosa.

### ¿Puede un juego ayudar de verdad a preparar una entrevista?

Ayuda con la parte que leer no puede enseñar: el orden en que falla un sistema a medida que crece la carga. Ver cómo una base de datos se satura, luego una caché absorbe las lecturas y después se llena la cola te da una intuición sobre los cuellos de botella que un diagrama no da.
