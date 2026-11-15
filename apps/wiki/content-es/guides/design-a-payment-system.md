---
title: Diseñar un sistema de pagos
seoTitle: Diseñar un sistema de pagos: recorrido de diseño de sistemas
summary: Diseña un sistema de pagos para una entrevista de diseño de sistemas: usa claves de idempotencia, evita los cobros duplicados, coordina los pasos con una saga y un outbox, y concilia.
section: guides
order: 24
aliases: payment system, payments, stripe, double charge, idempotency, saga, outbox, reconciliation, ledger, system design interview, sistema de pagos, pagos, cobro duplicado, idempotencia, conciliación, libro mayor, entrevista de diseño de sistemas
---

Un sistema de pagos mueve el dinero exactamente una vez aunque las redes fallen y los clientes
reintenten. Dale a cada intento de pago una clave de idempotencia, registra el estado en un libro
mayor dentro de una sola transacción de base de datos, llama al proveedor de pagos, como Stripe, y
coordina los pasos que lo rodean con una saga y un outbox transaccional. Concilia tus registros con
los del proveedor cada día, porque algo seguirá sin cuadrar.

## Requisitos

Funcionales:

- Crear un pago para un pedido, capturarlo y reembolsarlo.
- Mostrar el estado del pago al cliente y a soporte.
- Admitir uno o más proveedores.

No funcionales:

- No cobrar nunca dos veces y no perder nunca un cobro. La corrección vale más que la latencia.
- Cada cambio de estado es auditable.
- Sobrevivir a una caída del proveedor, a un timeout y a un fallo entre dos pasos cualesquiera.

## Estima la carga

Supón 10 millones de pedidos al mes.

- Tasa: 10,000,000 / (30 x 86,400) son unos 4 por segundo de media. Una oferta flash a 20 veces son unos 80 por segundo.
- Almacenamiento: cada pago escribe unas 5 filas de libro mayor de 300 B, así que 10,000,000 x 5 x 300 B son 15 GB al mes.
- Latencia del proveedor: un cobro con tarjeta tarda de 1 a 3 segundos, así que a 80 por segundo mantienes de 160 a 240 peticiones abiertas a la vez.

Es poco. Una sola base de datos relacional lo soporta. La dificultad es la corrección, no la escala.

## El diseño

### El camino de la petición

El cliente llama a tu API con una clave de idempotencia que generó para esta compra. El
[Servidor de aplicaciones](/components/server) guarda la clave y una fila de pago PENDING en una sola
transacción, y luego llama al [Proveedor de pagos](/components/psp) con la misma clave. Consulta
[Claves de idempotencia](/patterns/idempotency-keys).

### Cobro duplicado

El fallo clásico: el cobro agota el tiempo a los 10 segundos pero tuvo éxito, el cliente reintenta y
el cliente paga dos veces. Con una clave, el proveedor y tu propia tabla devuelven el primer
resultado. La comprobación y la escritura deben ser atómicas, así que usa un índice único sobre la clave.

### Orquestar los pasos

Reservar stock, cobrar y luego enviar toca tres servicios, así que ninguna transacción única lo
cubre. Usa una [saga](/patterns/saga): cada paso es una transacción local, y un fallo ejecuta
compensaciones, como un reembolso. Publica cada paso con un [outbox transaccional](/patterns/transactional-outbox)
para que el cambio en la base de datos y el evento nunca discrepen, y deja que una [Cola](/components/queue)
los transporte. El commit en dos fases es la alternativa, y [sus costes](/patterns/two-phase-commit)
suelen descartarlo.

### Libro mayor y conciliación

Guarda el dinero como un libro mayor de doble entrada de solo anexado en una [Base de datos](/components/database),
nunca como un saldo mutable. Cada noche compara tu libro mayor con el informe de liquidación del
proveedor y marca las diferencias para que las revise una persona.

## Dónde se rompe

**El proveedor está caído.** Los checkouts fallan como errores aguas arriba. Encola el intento y
reintenta más tarde, o conmuta a un segundo proveedor. Consulta [Caída del Proveedor de pagos](/incidents/psp-outage).

**Los reintentos causan duplicados.** Reintentar sin clave es el cobro duplicado. Arregla primero la
clave y luego añade [reintentar con backoff](/patterns/retry-with-backoff). Consulta [Cobro duplicado](/incidents/double-charge).

**Una oferta flash satura el checkout.** La demanda se multiplica por veinte y la base de datos y el
proveedor se saturan. Descarta el tráfico de poco valor y conserva los checkouts, como en el
[descarte de carga](/patterns/load-shedding), y consulta [Oferta flash](/incidents/flash-sale).

**Un fallo entre el cobro y el registro.** El proveedor cobró pero tu fila dice PENDING. El outbox y
un barredor que pregunta al proveedor por las filas PENDING antiguas cierran este hueco, y la
conciliación atrapa lo que quede.

## Constrúyelo en Quorum

Coloca un Proveedor de pagos después del Servidor de aplicaciones en una Empresa de comercio
electrónico, y una Base de datos para los checkouts. Investiga [Checkout](/research/checkout) y
[Claves de idempotencia](/research/idempotency-keys). El incidente [Cobro duplicado](/incidents/double-charge)
solo ocurre cuando el Enlace del cobro reintenta y no hay clave de idempotencia, que es el fallo de la
entrevista en miniatura.

El primer Diseño es la mitad de reintentos de esa historia. Un Servidor de aplicaciones llama a una
[Base de datos](/components/database) infradimensionada por un Enlace con un timeout corto y
reintentos con backoff, así que las llamadas fallidas esperan y se reparten. Mira el Apdex y el p99, y
lo pocas llamadas extra que recibe la Base de datos comparado con los reintentos ingenuos. El Enlace
de cobro al [Proveedor de pagos](/components/psp) recibe la misma política. El backoff limita el daño
de un reintento, y solo la clave de idempotencia hace seguro un reintento, así que hacen falta ambos.
Consulta [reintentar con backoff](/patterns/retry-with-backoff).

::Design{id="retries-backoff"}

El segundo Diseño es el lado de la cola, que transporta los pasos que ocurren después del cobro. El
Servidor de aplicaciones entrega el trabajo a una [Cola](/components/queue) y los [Workers](/components/worker)
la drenan, con una cola de mensajes muertos y tres intentos para que una tarea que falla no bloquee la
fila. Mira la profundidad de la Cola y la carga de la Base de datos, porque los Workers leen y
escriben junto a los usuarios. Representa los eventos que tu outbox publicaría, como un recibo o una
actualización de stock, aunque el Diseño del juego es un trabajo de exportación y no una saga.
Consulta [El trabajo lento, a una cola y a workers](/patterns/slow-work-to-a-queue-and-workers).

::Design{id="queue-and-workers"}

Investiga [Outbox transaccional](/research/outbox) para el lado de los eventos, y el Sandbox
[Pago desactualizado](/sandboxes/stale-checkout) muestra por qué los checkouts necesitan lecturas frescas.

El juego cubre el cobro, los reintentos, los duplicados y la caída del proveedor con un segundo
proveedor. No tiene saga, ni libro mayor, ni conciliación, así que eso lo aprendes en las páginas de patrones.

## Preguntas frecuentes

### ¿Cómo evitas los cobros duplicados en un sistema de pagos?

Envía una clave de idempotencia con cada cobro y guárdala con el resultado bajo un índice único. Un
reintento con una clave conocida devuelve el resultado guardado y no cobra nada.

### ¿Qué es una clave de idempotencia?

Un valor único que el cliente genera una vez por operación y envía en cada intento. El servidor lo
usa para reconocer una repetición y reproducir la primera respuesta en lugar de actuar de nuevo.

### ¿Qué es el patrón saga en los pagos?

Una saga divide un flujo de negocio en transacciones locales, una por servicio, y deshace los pasos
terminados con acciones compensatorias cuando falla uno posterior. Un reembolso tras un envío fallido
es una compensación.

### ¿Qué es la conciliación de pagos?

Es una comparación programada de tu libro mayor con los registros del proveedor o del banco. Encuentra
cobros que existen solo en un lado, como un fallo entre el cobro y el registro, para que una persona
pueda corregirlos.
