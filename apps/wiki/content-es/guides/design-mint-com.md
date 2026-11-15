---
title: Diseñar Mint.com
seoTitle: Diseñar Mint.com: recorrido de entrevista de diseño de sistemas
summary: Diseña una app de finanzas al estilo Mint.com para una entrevista de diseño de sistemas: sincronización de cuentas, categorización de transacciones, presupuestos y alertas, y lo que enseña Quorum.
section: guides
order: 31
aliases: mint, mint.com, personal finance, plaid, bank sync, transaction categorization, budget, system design primer, system design interview, finanzas personales, sincronización bancaria, categorización de transacciones, presupuesto, entrevista de diseño de sistemas
---

Mint extrae transacciones de los bancos, etiqueta cada una con una categoría y compara los totales mensuales con un presupuesto. Ejecuta la extracción bancaria como trabajos asíncronos en una cola, porque los bancos son lentos y poco fiables. Categoriza con una tabla de búsqueda de vendedores, guarda las transacciones en un almacén shardeado por usuario y calcula los totales del presupuesto según llegan transacciones nuevas, para que el panel lea una tabla pequeña precalculada.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), y su [solución para Mint.com](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/mint/README.md) merece leerse junto a esta página.

## Requisitos

Funcionales:

- Un usuario vincula una cuenta bancaria o de tarjeta.
- El servicio sincroniza las transacciones nuevas al vincular, al refrescar manualmente y a diario para los usuarios activos recientemente.
- Cada transacción recibe una categoría, y el usuario puede cambiarla.
- El usuario fija presupuestos mensuales por categoría y recibe una notificación al acercarse o pasarse del límite.

No funcionales:

- Lecturas de alta disponibilidad. Un panel desactualizado está bien, uno ausente no.
- Las credenciales bancarias nunca se guardan en texto plano.
- Las notificaciones pueden llegar con minutos de retraso.

## Estima la carga

Supón 10 millones de usuarios, 3 cuentas financieras cada uno y unos 5.000 millones de transacciones nuevas al mes.

- Ritmo de escritura: 5.000.000.000 / 2.500.000 segundos son unas 2.000 transacciones por segundo.
- Almacenamiento: a 50 bytes por fila, 5.000 millones al mes son 250 GB, que son 9 TB en tres años. Eso cabe cómodamente en una base de datos shardeada.
- Trabajos de sincronización: 30 millones de cuentas refrescadas a diario son unos 350 trabajos por segundo de media. Los bancos son lentos, así que supón que un trabajo tarda 20 segundos. Son 7.000 trabajos en vuelo.
- Lecturas: 500 millones al mes son unas 200 por segundo. La carga es intensiva en escritura.

## El diseño

### Vincular una cuenta

El cliente llama a la API de cuentas, que guarda la institución y un token o credencial cifrados en una [Base de datos](/components/database) relacional. La mayoría de las apps reales usan un agregador como Plaid y guardan solo el token que devuelve, nunca la contraseña del banco.

### Extraer las transacciones

Descargar de un banco tarda segundos y falla a menudo, así que la API nunca lo hace en línea. Pone un trabajo en una [Cola](/components/queue) como SQS y vuelve. Un grupo de [Workers](/components/worker) toma los trabajos, llama al banco, guarda la respuesta en bruto en [Almacenamiento de objetos](/components/storage) y la convierte en filas. Mira [nivelación de carga con colas](/patterns/queue-load-leveling). La sincronización diaria es un planificador que encola trabajos para los usuarios activos en los últimos 30 días, repartidos a lo largo del día.

### Categorizar

Mantén un diccionario de vendedor a categoría sembrado con los comercios populares. Cincuenta mil entradas son unos pocos megabytes, así que cada Worker lo tiene en memoria. Para los vendedores desconocidos, usa el cambio manual más común entre usuarios, y recurre a "Sin categoría". Recategorizar las filas viejas queda fuera del alcance.

### Transacciones y presupuestos

Escribe las transacciones en un almacén particionado por `user_id`, ya que toda consulta es por usuario. Cuando un Worker inserta una fila, también suma el importe a una fila `monthly_spending` de ese usuario, mes y categoría, y lo compara con el presupuesto. Si el total cruza un umbral, encola un trabajo de notificación. El panel lee esa tabla pequeña, no las transacciones. Mira [precómputo](/patterns/precomputation) y [sharding](/patterns/sharding).

### Informes

Los gráficos de tendencia de varios años escanean muchas filas. Envíalos a un almacén de datos, no a la primaria. Mira [informes fuera de la primaria, en un almacén](/patterns/reports-off-the-primary-warehouse).

## Dónde falla

**Un banco está lento o caído.** Los trabajos de ese banco se acumulan y retienen Workers. Usa timeouts cortos, [reintentos con backoff](/patterns/retry-with-backoff) y un tope de concurrencia por banco para que un banco no pueda quedarse con todos los Workers. Mira [bulkhead](/patterns/bulkhead).

**Los trabajos se ejecutan dos veces.** Las colas entregan al menos una vez. Haz las inserciones idempotentes usando el ID de transacción del banco como clave de cada transacción. Mira [claves de idempotencia](/patterns/idempotency-keys).

**Todos sincronizan a la vez.** Un disparador diario a las 6 a. m. crea un pico. Añade jitter al calendario de cada usuario.

**La ruta de lectura caliente.** Una avalancha de paneles a fin de mes golpea unas pocas tablas grandes. Cachea las filas de resumen. Mira [cache-aside](/patterns/cache-aside).

## Constrúyelo en Quorum

La canalización de sincronización es la parte que el juego modela mejor. Este tablero pone una Cola entre el Servidor de aplicaciones y la Base de datos, con una [Cola](/components/queue) y un [Worker](/components/worker) que vacían a su propio ritmo:

::Design{id="queue-leveled"}

Mira qué espera el usuario, que es solo el encolado, y qué pasa con la profundidad de la Cola cuando el trabajo llega más rápido de lo que los Workers lo vacían. Esa es la ráfaga de sincronización bancaria.

Los bancos fallan, así que el segundo tablero compara políticas de reintento frente a una dependencia lenta, con el mismo timeout corto en un Enlace hacia una Base de datos infradimensionada:

::Design{id="retries-backoff"}

El Diseño usa backoff y muestra los errores y el p99 frente a la versión ingenua en [Reintentos con backoff y jitter](/patterns/retry-with-backoff). El backoff mantiene bajas las llamadas extra, pero no arregla la capacidad.

El tercer tablero saca los informes de la primaria, usando un [Almacén de datos](/components/warehouse):

::Design{id="reports-on-warehouse"}

Muestra los escaneos de informes yendo al Almacén de datos mientras las peticiones normales se quedan con la Base de datos. Eso coincide con la separación de los gráficos de tendencia.

Investiga [Trabajos en segundo plano](/research/background-jobs), [Colas de mensajes](/research/queues), [Tiempos de espera y reintentos](/research/timeouts) y [Almacenamiento de datos](/research/data-warehouse). Los incidentes [El informe tumba la Base de datos](/incidents/report-db) y [Tormenta de reintentos](/incidents/retry-storm) son los fallos de arriba, y [Detener una tormenta de reintentos](/guides/stop-a-retry-storm) recorre una solución.

El juego no tiene conexiones bancarias, credenciales, categorías, presupuestos ni notificaciones por umbral. Las notificaciones existen solo como tema de investigación, no como alertas de presupuesto, y la Empresa no tiene un modelo de datos por usuario.

## Preguntas frecuentes

### ¿Cómo sincroniza Mint las transacciones de los bancos?

Usa una cola de trabajos de sincronización y un grupo de workers que llaman a cada banco o a un agregador como Plaid. La petición del usuario solo encola un trabajo, y el worker guarda las transacciones nuevas cuando el banco responde.

### ¿Cómo se categorizan transacciones a escala?

Busca al vendedor en un diccionario de comercios conocidos guardado en memoria. Para los vendedores desconocidos, usa la categoría que la mayoría de los usuarios eligió a mano, y deja que el usuario la cambie.

### ¿Cómo envías alertas de presupuesto sin retrasar las sincronizaciones?

Actualiza el total mensual al escribir cada transacción, y pon un trabajo de notificación en una cola aparte cuando cruce el límite. Las alertas pueden llegar con unos minutos de retraso, así que se quedan fuera de la ruta de sincronización.

### ¿Está Mint.com en el System Design Primer?

Sí. La [solución del Primer](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/mint/README.md) cubre la vinculación de cuentas, la extracción, la categorización y los presupuestos, y esta página cubre el mismo terreno con sus propias estimaciones.
