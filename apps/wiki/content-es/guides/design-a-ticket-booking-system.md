---
title: Diseña un sistema de reserva de entradas
seoTitle: "Diseña un sistema de reserva de entradas: guía de entrevista"
summary: Diseña un sistema de reserva de entradas para una entrevista de diseño de sistemas: ventas flash, sobreventa, retenciones con caducidad, colas y consistencia, y lo que enseña Quorum.
section: guides
order: 29
aliases: ticket booking, ticketmaster, flash sale, overselling, seat reservation, booking, inventory, system design interview, reserva de entradas, venta flash, sobreventa, reserva de asientos, inventario, entrevista de diseño de sistemas
---

Un sistema de entradas vende un stock fijo a una multitud que llega de golpe, así que el diseño protege dos cosas. Una sala de espera admite usuarios al ritmo que el sistema puede atender, y una base de datos con consistencia fuerte retiene cada asiento unos minutos con una caducidad. Navegar puede ser con datos antiguos y en caché. Reservar un asiento no.

## Requisitos

Funcionales:

- Explorar eventos y ver qué asientos están libres.
- Seleccionar asientos, retenerlos mientras se paga y luego confirmar la compra.
- Un asiento nunca se vende dos veces.
- Liberar los asientos retenidos si el pago no termina.

No funcionales:

- Consistencia fuerte en el inventario. La disponibilidad puede ceder durante un pico, porque es mejor rechazar una petición que vender dos veces.
- Sobrevivir a un salto de 100x en el tráfico en el momento en que se abre una venta.
- Un pago se cobra exactamente una vez, incluso tras un reintento.

## Estima la carga

Supón un estadio de 50,000 asientos y 2 millones de aficionados que llegan en el primer minuto.

- Carga de navegación: 2M de usuarios que cargan 5 páginas cada uno en 60 segundos son 10M de peticiones, unas 170,000 por segundo. Un día normal baja de 1,000 por segundo, así que es un pico de 170x.
- Intentos de reserva: si el 10% de los usuarios llega a la selección de asientos, 200,000 intentos compiten por 50,000 asientos, unos 3,300 por segundo en el pico.
- Retenciones: 50,000 asientos retenidos durante 5 minutos son como mucho 50,000 retenciones activas. Es minúsculo para Redis, y la carga es la contención y no el tamaño de los datos.

Dominan las lecturas y las escrituras compiten por un stock pequeño.

## El diseño

### Sala de espera

Una cola virtual delante de toda la venta. Los usuarios reciben un token y una posición, y el sistema los admite a un ritmo fijo, por ejemplo 2,000 por minuto, igual a lo que puede atender el pago. Es [descarte de carga](/patterns/load-shedding) y [limitación de tasa](/patterns/rate-limiting) con buena cara. Las páginas estáticas y el mapa de asientos salen de una [CDN](/components/cdn).

### Lecturas de disponibilidad

El mapa de asientos lo lee todo el mundo y cambia despacio. Sírvelo desde una [Caché](/components/cache) con un TTL corto de uno o dos segundos. Un mapa desactualizado hace que un usuario pulse un asiento que acaba de irse, y el paso de reserva lo rechaza. Es aceptable.

### Retenciones con caducidad

Seleccionar un asiento ejecuta una escritura condicional atómica: pon el asiento en HELD con un ID de retención y una caducidad solo si ahora está libre. Hazlo en una [Base de datos](/components/database) relacional con un bloqueo de fila o un `UPDATE ... WHERE status = 'free'`, o en Redis con `SET NX EX`. Un trabajo en segundo plano, o la propia caducidad, devuelve los asientos sin pagar al conjunto. Mira los [modelos de consistencia](/patterns/consistency-models).

### Reserva y pago

El pago parte de la retención. Envía el cobro a un proveedor como Stripe con una [clave de idempotencia](/patterns/idempotency-keys) derivada del ID de retención, para que un timeout y un reintento nunca cobren dos veces. Si tiene éxito, cambia HELD a SOLD en una transacción. Para flujos de varios pasos, una [saga](/patterns/saga) con una liberación compensatoria maneja un cobro fallido.

### Trabajo asíncrono

Los correos de confirmación, las entradas en PDF y la analítica pasan por una [Cola](/components/queue) hacia [Workers](/components/worker). Mira la [nivelación de carga con colas](/patterns/queue-load-leveling).

## Dónde se rompe

**El pico del minuto de apertura.** La demanda va a muchas veces lo normal y cada capa se llena a la vez. El autoescalado es demasiado lento porque los servidores nuevos tardan minutos, así que admite usuarios por la sala de espera, escala con antelación según un horario y descarta primero las peticiones baratas. El incidente del juego es [Oferta flash](/incidents/flash-sale), y el [autoescalado, reactivo y programado](/patterns/autoscaling-reactive-and-scheduled) es la prevención.

**Sobreventa.** Dos peticiones leen "asiento libre" a la vez y ambas escriben "vendido". Ocurre cuando la comprobación y la escritura son pasos separados, o cuando una réplica con retraso responde a la comprobación. Haz que la comprobación y la escritura sean una sola operación atómica en la primaria, y nunca leas el inventario de una réplica para reservar. Mira [lee tus propias escrituras](/patterns/read-your-writes) y el incidente [Retraso de replicación](/incidents/repl-lag).

**Cobros duplicados.** El proveedor de pagos se ralentiza, la aplicación agota el timeout y reintenta, y al cliente se le cobra dos veces. Las claves de idempotencia lo arreglan, y también un tope de reintentos. Mira el incidente [Cobro duplicado](/incidents/double-charge).

**La fila caliente del evento.** Todas las escrituras apuntan al inventario de un evento, así que un shard se lo lleva todo. Haz sharding del inventario por evento y luego por sección de asientos, como en [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards).

## Constrúyelo en Quorum

Tres tableros cubren el pico y la ruta de los datos. El primero es el primo de la sala de espera. Un [Servidor de aplicaciones](/components/server) es demasiado pequeño para sus Usuarios, y rechaza tipos enteros de peticiones, empezando por los de menor valor, cuando pasa su línea de carga, para que los tipos que más ingresan sigan rápidos. Mira los errores del pie de imagen, ya que las peticiones descartadas cuentan como errores. No es una cola con posiciones, pero es la misma idea de admisión. Mira el [descarte de carga](/patterns/load-shedding) y el incidente [Oferta flash](/incidents/flash-sale).

::Design{id="shed-low-value"}

El segundo tablero es la capacidad antes de la venta. Un [Autoescalador](/components/autoscaler) lee la CPU y añade copias del Servidor de aplicaciones, con un horario que las añade antes del pico conocido, y el [Balanceador de carga](/components/lb) usa slow start para que una copia nueva reciba tráfico poco a poco. Mira cuántas copias sirven en el pico. Muestra por qué una venta necesita escalar con antelación, porque los servidores nuevos tardan minutos. Mira el [autoescalado, reactivo y programado](/patterns/autoscaling-reactive-and-scheduled).

::Design{id="autoscaled"}

El tercer tablero es la respuesta de consistencia. Las lecturas van a una [Réplica de lectura](/components/replica) y las escrituras a la [Base de datos](/components/database) primaria, con enrutado de lee tus propias escrituras en el Servidor de aplicaciones, de modo que un usuario que acaba de actuar lee de la primaria y no puede ver una copia antigua. Mira el reparto de carga entre las dos. Navegar puede usar la réplica, y reservar debe leer de la primaria. Mira [enruta lecturas y escrituras por separado](/patterns/route-reads-and-writes-apart).

::Design{id="read-write-split"}

Coloca una [Cola](/components/queue) para el trabajo del pago, un [Proveedor de pagos](/components/psp) para el cobro, e investiga [Claves de idempotencia](/research/idempotency-keys) para ver cómo se detiene el incidente Cobro duplicado. El Sandbox [Checkout obsoleto](/sandboxes/stale-checkout) enseña por qué los pagos leen de la primaria.

El juego no tiene asientos, retenciones, caducidad ni sala de espera, ni un inventario que pueda sobrevenderse. La consistencia aparece solo como retraso de replicación y enrutado de lee tus propias escrituras.

## Preguntas frecuentes

### ¿Cómo se evita sobrevender entradas?

Haz que reservar un asiento sea una sola operación atómica en un único almacén autoritativo, como una actualización condicional que solo tiene éxito si el asiento está libre. Nunca decidas la disponibilidad desde una caché o una réplica en el momento de reservar.

### ¿Cómo funcionan las retenciones de entradas con caducidad?

Cuando un usuario elige un asiento, márcalo como retenido con una hora de caducidad de unos cinco minutos. Si el pago se completa, márcalo como vendido. Si pasa el tiempo, el asiento vuelve al conjunto.

### ¿Cómo manejan las grandes vendedoras de entradas una venta flash?

Ponen a los usuarios en una sala de espera y los dejan entrar al ritmo que el sistema de reservas puede atender, con el contenido estático en una CDN. El control de admisión importa más que el número bruto de servidores.

### ¿Debería un sistema de reservas usar consistencia fuerte o eventual?

Usa consistencia fuerte para el inventario y el pago, porque una venta doble es cara. Usa consistencia eventual para navegar, donde un mapa de asientos de hace un segundo no hace daño.
