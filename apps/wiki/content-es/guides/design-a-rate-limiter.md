---
title: Diseñar un limitador de tasa
seoTitle: Diseñar un limitador de tasa: recorrido de diseño de sistemas
summary: Diseña un limitador de tasa para una entrevista de diseño de sistemas: compara token bucket y ventana deslizante, decide dónde aplicarlo y comparte contadores entre servidores.
section: guides
order: 21
aliases: system design primer, rate limiter, rate limiting, throttling, token bucket, sliding window, leaky bucket, api limits, system design interview, limitador de tasa, limitación de tasa, límites de API, ventana deslizante, entrevista de diseño de sistemas
---

Un limitador de tasa cuenta las peticiones por cliente y rechaza las que superan un límite, normalmente con HTTP 429. Ejecútalo en el gateway, indexa por clave de API o IP, guarda los contadores en Redis para que todos los servidores vean el mismo recuento, y usa un token bucket salvo que necesites ventanas exactas. Lo difícil es el comportamiento del algoritmo ante ráfagas y mantener rápido y correcto un contador compartido.

Esta pregunta está en la [lista de preguntas adicionales](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions) del [System Design Primer](https://github.com/donnemartin/system-design-primer), y la referencia que lista es el artículo de Stripe sobre limitadores de tasa.

## Requisitos

Funcionales:

- Limitar las peticiones por cliente y por endpoint, con reglas distintas para cada nivel.
- Devolver 429 con una cabecera Retry-After cuando quien llama se pasa.

No funcionales:

- Añade menos de 5 ms a una petición, ya que está en todas.
- Funciona en muchos servidores, de modo que un cliente no pueda obtener diez veces su límite llamando a diez máquinas.
- Falla en abierto: si el almacén del limitador está caído, el tráfico pasa.

## Estima la carga

Supón 1 millón de clientes activos y 50,000 peticiones por segundo en el pico, cada una con una comprobación.

- Rendimiento: 50,000 operaciones de contador por segundo. Un nodo de Redis maneja unas 100,000 operaciones simples por segundo, así que cabe en un nodo y una réplica cubre el fallo.
- Memoria: un token bucket necesita un contador de tokens y una marca de tiempo, unos 50 bytes con la clave. 1,000,000 x 50 B son 50 MB.
- Un registro de ventana deslizante guarda una marca de tiempo por petición. A 100 peticiones por cliente por minuto son 100 x 8 B x 1,000,000, u 800 MB. Diez veces más.

## El diseño

La comprobación ocurre antes del trabajo, así que ponla tan pronto como se conozca la identidad del cliente.

### Dónde aplicarlo

En el [API Gateway](/components/gw), las peticiones rechazadas no cuestan nada a los servicios que hay detrás. Un middleware dentro de cada servicio funciona, pero gasta CPU en peticiones que va a rechazar. Un límite por cliente necesita una identidad, así que va después de la autenticación, y un límite grueso por IP puede ir delante.

### Los algoritmos

| Algoritmo                      | Comportamiento                                                            | Coste                                        |
| ------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------- |
| Token bucket                   | Se rellena a la tasa del límite, permite ráfagas hasta el tamaño del cubo | Dos números por cliente                      |
| Leaky bucket                   | Drena a una tasa fija, suaviza la salida                                  | Una cola por cliente                         |
| Ventana fija                   | Contador que se reinicia cada minuto                                      | Hasta 2x el límite en el borde de la ventana |
| Contador de ventana deslizante | Pondera la ventana anterior según el solapamiento                         | Dos contadores, casi exacto                  |
| Registro de ventana deslizante | Guarda cada marca de tiempo                                               | Exacto, la mayor memoria                     |

Stripe y la mayoría de las API públicas usan un token bucket. Consulta [limitación de tasa](/patterns/rate-limiting) y el [token bucket](/glossary/token-bucket).

### Contadores compartidos

Guarda el estado en Redis y actualízalo con un único script Lua atómico, para que la lectura, el rellenado y el decremento no se entrelacen. Dos servidores que leen y luego escriben por separado dejarán pasar ambos la última petición. Dale a cada clave un TTL igual a la ventana, para que los clientes inactivos desaparezcan solos del almacén tipo [Caché](/components/cache).

## Dónde se rompe

**El almacén de contadores se convierte en el punto caliente.** Un cliente con mucho tráfico es una clave, así que un shard. Mantén una pequeña asignación local en cada servidor y sincroniza con Redis por lotes, aceptando un pequeño exceso. Consulta [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards).

**Los clientes limitados reintentan y lo empeoran.** Un cliente rechazado que reintenta al instante añade carga. Envía Retry-After y exige [reintentar con backoff](/patterns/retry-with-backoff). El incidente [Tormenta de reintentos](/incidents/retry-storm) muestra este bucle.

**Un límite bloquea a los usuarios buenos junto con los malos.** Un tope único no distingue un bot de un comprador. Combina el limitador con un [WAF y gestión de bots](/patterns/waf-and-bot-management), y consulta el incidente [Oleada de bots](/incidents/bot-surge). Cuando un servidor está lleno, el [descarte de carga](/patterns/load-shedding) responde a otra pregunta: lo ocupados que estamos, no quién llama.

## Constrúyelo en Quorum

El primer Diseño es el punto de aplicación. Un [API Gateway](/components/gw) con límite de tasa va después de los Usuarios, delante de un [Servidor de aplicaciones](/components/server) y una [Base de datos](/components/database). Investiga [API Gateway](/research/api-gateway) para desbloquearlo, y [Limitación de tasa](/research/rate-limiting) para añadir la opción de ráfaga del token bucket. Por encima del límite el Gateway responde `throttled` y el Servidor de aplicaciones nunca ve la petición, así que mira los errores del pie de figura, que vienen del límite y no de la capacidad. El patrón es la [limitación de tasa](/patterns/rate-limiting).

::Design{id="gateway-rate-limit"}

El segundo Diseño es la otra protección, que responde a una pregunta distinta. El Servidor de aplicaciones es demasiado pequeño para sus Usuarios, y rechaza tipos enteros de petición, primero los de menor valor, una vez que pasa su línea de carga. Mira qué tipos siguen rápidos. El limitador pregunta quién llama, y el descarte pregunta lo ocupado que está el servidor. Usa un [Servidor de aplicaciones](/components/server) y una [Base de datos](/components/database), y el [descarte de carga](/patterns/load-shedding) es el patrón.

::Design{id="shed-low-value"}

El juego cubre la elección del algoritmo en un solo lugar: un tope plano o un token bucket en un único Gateway. Tiene un tope para todo el Gateway, no uno por cliente, y no hay un almacén de contadores compartido, así que las claves por cliente y el recuento distribuido quedan sobre el papel. El incidente [Oleada de bots](/incidents/bot-surge) muestra por qué un tope por sí solo no es un filtro de bots.

## Preguntas frecuentes

### ¿Qué algoritmo de limitación de tasa es el mejor?

Token bucket para la mayoría de las API, porque permite ráfagas cortas y solo necesita dos números por cliente. Usa un contador de ventana deslizante cuando necesites un límite suave y casi exacto sin margen de ráfaga.

### ¿Dónde debe ejecutarse un limitador de tasa?

En el API Gateway o en el edge, antes de los servicios, para que rechazar peticiones sea barato. Añade un segundo límite más grueso cerca de los backends sensibles, como una base de datos o una API de terceros de pago.

### ¿Cómo limitas la tasa entre varios servidores?

Guarda los contadores en un almacén rápido compartido, como Redis, y actualízalos de forma atómica con un script. Cada servidor pregunta al almacén, así que todos ven un único recuento por cliente.

### ¿Qué pasa si el limitador de tasa se cae?

Falla en abierto para la mayoría de las API, para que una caída del limitador no se convierta en una caída del producto. Mantén un límite local grueso en cada servidor como respaldo.
