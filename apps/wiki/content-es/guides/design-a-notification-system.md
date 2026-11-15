---
title: Diseñar un sistema de notificaciones
seoTitle: Diseñar un sistema de notificaciones: guía de diseño de sistemas
summary: Diseña un sistema de notificaciones para una entrevista de diseño de sistemas: encola las peticiones, envía con workers, reintenta con seguridad, deduplica y usa una cola de mensajes muertos.
section: guides
order: 23
aliases: notification system, push notifications, email delivery, sms, fan-out, message queue, retries, system design interview, sistema de notificaciones, notificaciones push, envío de correo, cola de mensajes, reintentos, entrevista de diseño de sistemas
---

Un sistema de notificaciones recibe un evento, decide quién debe enterarse y envía push, correo o SMS
sin hacer esperar a quien llama. Acepta la petición, escríbela en una cola y deja que los workers la
recojan y llamen al proveedor, como APNs, FCM, SES o Twilio. Los reintentos hacen que la entrega sea
al menos una vez, así que deduplica con una clave de idempotencia y aparta en una cola de mensajes
muertos los mensajes que siguen fallando.

## Requisitos

Funcionales:

- Enviar push, correo y SMS, desde una llamada de API o desde un evento.
- Respetar las preferencias de los usuarios y las bajas.
- Admitir plantillas y envíos programados.

No funcionales:

- Quien llama recibe respuesta en milisegundos, así que el envío es asíncrono.
- Entrega al menos una vez, y ningún duplicado que el usuario pueda ver.
- Ráfagas de millones no deben tumbar el producto.
- Un proveedor lento o roto no debe bloquear a los demás.

## Estima la carga

Supón 10 millones de usuarios y 5 notificaciones por usuario al día.

- Volumen: 10,000,000 x 5 son 50 millones al día, o 50,000,000 / 86,400, unas 580 por segundo de media.
- Pico: una campaña envía a todos a la vez. 10 millones de mensajes en 10 minutos son 10,000,000 / 600, unos 16,700 por segundo.
- Workers: si una llamada al proveedor tarda 100 ms, un hilo de worker hace 10 por segundo, así que 16,700 por segundo necesitan unos 1,700 hilos, o 20 máquinas de 100 hilos cada una.
- Almacenamiento: 50 millones de filas de registro al día a 200 B son 10 GB al día.

La media es fácil. El pico de la campaña es 30 veces mayor, y la cola lo absorbe.

## El diseño

### Entrada

Una API sin estado valida la petición, comprueba las preferencias, estampa una clave de idempotencia
y encola. Devuelve 202 al instante. Consulta [El trabajo lento, a una cola y a workers](/patterns/slow-work-to-a-queue-and-workers).

### Cola y workers

Usa una cola, o un tema, por canal para que un proveedor de correo lento no retrase el push. Los
workers extraen en paralelo, llaman al proveedor y confirman si sale bien. La cola convierte una
ráfaga en un drenaje constante, como explica la [nivelación de carga con colas](/patterns/queue-load-leveling).
Varios workers que comparten una cola son [consumidores competidores](/patterns/competing-consumers).

### Fan-out

«Notificar a todos los seguidores» se convierte en un mensaje por destinatario. Hazlo en dos pasos: un
evento se expande en una lista de destinatarios por lotes, y luego cada lote se expande en mensajes.
Un registro como Kafka sirve cuando varios servicios necesitan el mismo evento, como en
[Publicación-suscripción](/patterns/publish-subscribe) y [Fan-out en escritura y en lectura](/patterns/fan-out-on-write-and-on-read).

### Reintentos e idempotencia

Una llamada al proveedor puede agotar el tiempo después de haber tenido éxito. Reintenta con
[backoff y jitter](/patterns/retry-with-backoff), y envía la clave de idempotencia de la notificación
para que el reintento sea inofensivo. Si el proveedor no acepta esa clave, guarda en Redis un
conjunto de enviados indexado por el ID de la notificación. Consulta [Claves de idempotencia](/patterns/idempotency-keys).

### Mensajes muertos

Tras unos pocos intentos, mueve el mensaje a una [cola de mensajes muertos](/patterns/dead-letter-queue)
y alerta por su profundidad, para que una dirección errónea no retenga a los workers.

## Dónde se rompe

**Una tormenta de reintentos.** Un proveedor se ralentiza, todos los workers reintentan y la carga se
duplica. Añade backoff, un presupuesto de reintentos y un circuit breaker. Consulta
[Tormenta de reintentos](/incidents/retry-storm) y [circuit breaker](/patterns/circuit-breaker).

**Un mensaje envenenado.** Una carga malformada falla para siempre y sigue dando vueltas. La solución
es una cola de mensajes muertos con un valor de máximo de intentos. Consulta [Mensaje envenenado](/incidents/poison).

**La campaña ahoga el correo transaccional.** Un restablecimiento de contraseña espera detrás de diez
millones de promociones. Usa colas separadas por prioridad y dale a la urgente sus propios workers.

## Constrúyelo en Quorum

Investiga [Colas de mensajes](/research/queues) y [Notificaciones](/research/notifications), y coloca
una [Cola](/components/queue), un [Worker](/components/worker) y un [Proveedor de notificaciones push](/components/msgp).

El primer Diseño es todo el camino de envío. El Servidor de aplicaciones solo entrega la notificación a
la Cola, los Workers la drenan y el Proveedor de notificaciones push es el último salto. La Cola tiene
activada la cola de mensajes muertos, dos copias de Worker hacen el envío, y el Enlace de los Workers
al proveedor tiene un timeout corto y reintentos con backoff. Mira la profundidad de la Cola y el
rendimiento del proveedor, ya que el proveedor descarta mensajes por encima de su límite. Usa un
[Servidor de aplicaciones](/components/server), una Cola, un Worker y un Proveedor de notificaciones
push, y [Plataforma de mensajes para fan-out](/patterns/message-platform-for-fan-out) es el patrón.

::Design{id="push-fan-out"}

El segundo Diseño aísla la respuesta al mensaje envenenado. Una tarea que falla en cada intento se
reintenta unas veces con una pausa y luego se aparta, así que una sola carga mala no puede retener a
los Workers. Mira el valor de Máximo de intentos y qué pasa con una tarea que sigue fallando. En el
juego se pierde una vez apartada, ya que no hay una cola que inspeccionar. Usa una [Cola](/components/queue),
un [Worker](/components/worker) y una [Base de datos](/components/database), y
[cola de mensajes muertos](/patterns/dead-letter-queue) es el patrón.

::Design{id="queue-dlq"}

Investiga [Claves de idempotencia](/research/idempotency-keys) para los duplicados.

El juego cubre la cola, los workers y el salto al proveedor, y el incidente del mensaje envenenado.
Envía un mensaje por petición sin preferencias por usuario, así que el fan-out a una lista de
destinatarios, las plantillas y la programación no están modelados. El Proveedor de notificaciones
push descarta mensajes por encima de su límite, así que sigues vigilando su rendimiento.

## Preguntas frecuentes

### ¿Por qué usar una cola de mensajes para las notificaciones?

Deja que la API responda de inmediato y absorbe las ráfagas, ya que los workers drenan la cola a su
propio ritmo. También aísla a un proveedor lento del resto del sistema.

### ¿Cómo evitas enviar notificaciones duplicadas?

Dale a cada notificación una clave de idempotencia y regístrala cuando el envío tiene éxito. Un
reintento con una clave conocida no hace nada. La entrega sigue siendo al menos una vez, y la clave
hace que el efecto visible sea una sola vez.

### ¿Cómo manejas las notificaciones fallidas?

Reintenta con backoff exponencial y jitter unas cuantas veces. Después mueve el mensaje a una cola de
mensajes muertos, alerta por su profundidad y reprodúcelo cuando se haya corregido la causa.

### ¿Cómo envías una notificación a millones de usuarios?

Divídela en lotes de destinatarios y encola cada lote, y deja que los workers expandan los lotes en
mensajes por usuario. Limita la tasa hacia el proveedor para que el envío se mantenga dentro de su cuota.
