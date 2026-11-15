---
title: Diseñar una app de chat como WhatsApp
seoTitle: Diseñar una app de chat como WhatsApp: diseño de sistemas
summary: Diseña una app de chat como WhatsApp: WebSockets, orden de mensajes, confirmaciones de entrega, presencia y particionado, y lo que enseña Quorum.
section: guides
order: 26
aliases: system design primer, chat, messaging, whatsapp, slack, discord, websocket, presence, system design interview, guía de diseño de sistemas, mensajería, presencia, entrevista de diseño de sistemas
---

Un sistema de chat mantiene un WebSocket abierto por cada usuario conectado, en una capa de gateways que no hace nada más. Los mensajes van a un almacén particionado por conversación, de modo que una conversación se mantiene ordenada en una sola partición. Las confirmaciones de entrega y la presencia son eventos pequeños que se apoyan encima, y cuestan más de lo que parece.

Esta pregunta está en la [lista de preguntas adicionales](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions) del [System Design Primer](https://github.com/donnemartin/system-design-primer).

## Requisitos

Funcionales:

- Conversaciones individuales y de grupo, con texto y contenido multimedia.
- Los mensajes llegan en orden dentro de una conversación.
- Confirmaciones de enviado, entregado y leído, y un indicador de conexión.
- Los usuarios sin conexión reciben sus mensajes cuando vuelven, y el historial se consulta desplazándose hacia atrás.

No funcionales:

- Entrega en menos de 200 ms a un destinatario conectado.
- Ningún mensaje perdido, y ningún duplicado visible para el usuario.
- Millones de conexiones inactivas, lo que es un problema de memoria y no de CPU.

## Estima la carga

Supón 100 millones de usuarios activos al día, con 20 millones conectados a la vez en el pico. Cada usuario envía 40 mensajes al día, y un mensaje medio pesa 100 bytes.

- Mensajes: 100M x 40 = 4000 millones al día, o 4.000.000.000 / 86.400 = unos 46.000 por segundo. El pico, a 3x, ronda los 140.000.
- Almacenamiento: 4B x 100 bytes = 400 GB al día, unos 146 TB al año antes de replicar. Multiplícalo por tres con las réplicas.
- Conexiones: 20M de sockets abiertos. Si una máquina gateway aguanta 500.000, son unas 40 máquinas más margen.

El número de conexiones fija la flota de gateways, y la tasa de mensajes fija el almacén.

## El diseño

### Capa de gateways

Los clientes se conectan por [WebSockets](/patterns/websockets-tier-for-realtime) a una flota de servidores gateway. El gateway autentica una vez y después mantiene el socket abierto. Elige un runtime que mantenga una conexión de forma barata, como Erlang o Go, porque un hilo por conexión no llega a un millón. Las peticiones de vida corta, como el inicio de sesión y el historial, van a [Servidores de aplicaciones](/components/server) normales y no al gateway.

### Enrutado entre gateways

Alice y Bob están en gateways distintos. Un servicio de sesiones, normalmente Redis, asocia el ID de usuario con su gateway. El gateway del remitente busca el gateway del destinatario y le reenvía el mensaje, a menudo mediante canales de [publicación-suscripción](/patterns/publish-subscribe) por conversación.

### Almacén de mensajes y orden

Escribe cada mensaje en un almacén particionado por ID de conversación, como Cassandra o DynamoDB, con un ID de mensaje que se ordena por tiempo. Discord lo hace así, y [partition messages by channel](/patterns/partition-messages-by-channel) muestra el esquema. Una conversación corresponde a una partición, así que un único escritor asigna números de secuencia crecientes y el orden es una propiedad de la partición. Nunca hace falta un orden global.

### Entrega y confirmaciones

Envía y espera un ack del dispositivo del destinatario. Sin ack, el mensaje queda en el almacén como no entregado y se vuelve a enviar al reconectar. La entrega es al menos una vez, así que los clientes descartan los duplicados por ID de mensaje. Mira la [entrega al menos una vez](/glossary/at-least-once-delivery) y las [claves de idempotencia](/patterns/idempotency-keys). Una confirmación de lectura es otro mensaje pequeño de vuelta al remitente.

### Presencia

Cada cliente envía un latido cada 30 segundos, y el servicio de sesiones fija una clave con una expiración de 60 segundos. No difundas cada cambio a todos los amigos. Consulta la presencia cuando se abre una conversación, y envía los cambios solo de las conversaciones que están en pantalla.

### Usuarios sin conexión

Guarda el mensaje, envía una notificación push móvil a través de un proveedor de push, y entrega lo pendiente al reconectar desde el último ID de mensaje que tiene el cliente.

## Dónde se rompe

**Tormentas de reconexión.** Un gateway se reinicia o un corte de red tira 500.000 sockets, y todos los clientes se reconectan en el mismo segundo. El gateway se calienta despacio y rechaza a la mitad, que reintenta y empeora la situación. Los clientes deben aplicar backoff con jitter, y el gateway debe admitir conexiones a un ritmo fijo. Este es el incidente [Tormenta de reconexiones](/incidents/reconnect), y el [reintento con backoff](/patterns/retry-with-backoff) es la solución.

**Conversaciones calientes.** Un grupo con un millón de miembros, o un canal de un evento en directo, envía todo su tráfico a una partición. Divide esa conversación en más shards por intervalo de tiempo, pon una caché delante de los mensajes recientes y mira las [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards).

**Fan-out de presencia.** Un usuario con 5000 contactos que entra y sale de línea sin parar envía 5000 actualizaciones cada vez. Limita los cambios, agrúpalos y consúltalos de forma perezosa. La presencia es lo primero que se degrada bajo carga, y el [descarte de carga](/patterns/load-shedding) debe quitarla antes que los mensajes.

## Constrúyelo en Quorum

Dos Tableros cubren las dos capas de la respuesta. El primero es la capa de conexiones. Un [Hub en tiempo real](/components/ws) está detrás de una [API Gateway](/components/gw), junto a un [Servidor de aplicaciones](/components/server) normal y una [Base de datos](/components/database), y los tipos del Enlace envían al Hub solo el tráfico en tiempo real. El Hub corre en Node.js con Clustering, Presencia y Backoff de reconexión activados. Mira cuántas conexiones aguanta el Hub y cuánto cuesta la presencia por mensaje. Investiga [WebSockets](/research/websockets) y después compara runtimes. El incidente [Tormenta de reconexiones](/incidents/reconnect) muestra entonces lo que hace un reinicio sin backoff, y [Capa de WebSockets para tiempo real](/patterns/websockets-tier-for-realtime) es el patrón.

::Design{id="realtime-hub"}

El segundo Tablero es el almacén de mensajes, tal como lo construyó Discord. El [Almacén de columnas anchas](/components/wide) es el clúster de mensajes, con tres réplicas por clave y un quórum de dos. El Hub en tiempo real es la capa de gateways y una [Caché](/components/cache) guarda el estado de los canales calientes. Mira los ajustes del quórum, porque por ellos una lectura ve el último mensaje incluso después de que falle un Nodo. [Partition messages by channel](/patterns/partition-messages-by-channel) es el ejemplo resuelto.

::Design{id="discord-channel-partitions"}

El juego no modela el orden de mensajes, los números de secuencia, las confirmaciones ni la entrega push a usuarios sin conexión. Enseña capacidad de conexiones, coste de la presencia, comportamiento de reconexión y particionado.

## Preguntas frecuentes

### ¿Una app de chat debe usar WebSockets o polling?

Usa WebSockets, porque una conexión persistente entrega un mensaje en cuanto llega y evita miles de peticiones vacías. El long polling o los eventos enviados por el servidor sirven como alternativa detrás de proxies restrictivos. Mira [long polling y SSE](/patterns/long-polling-and-sse).

### ¿Cómo mantienes en orden los mensajes de chat?

Particiona por ID de conversación y deja que un escritor por partición asigne números de secuencia crecientes. El cliente ordena por ese número, así que no importa que los mensajes lleguen desordenados por la red. Nunca necesitas un orden global.

### ¿Cómo funcionan las confirmaciones de entrega en un sistema de chat?

El servidor envía un ack al remitente cuando guarda el mensaje. El dispositivo del destinatario envía un ack cuando lo recibe, y otro cuando el usuario lo lee, y cada ack es un mensaje pequeño que se enruta de vuelta al remitente. Los mensajes sin ack se vuelven a entregar, así que los clientes deduplican por ID.

### ¿Cómo se construye el indicador de conexión?

Los clientes envían latidos a un almacén de sesiones, y la clave expira si los latidos se detienen. Quien lee comprueba la clave al abrir una conversación, en lugar de recibir cada cambio de estado.
