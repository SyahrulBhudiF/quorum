---
title: Diseñar el ranking de ventas de Amazon por categoría
seoTitle: Diseñar el ranking de ventas de Amazon por categoría: guía de entrevista
summary: Diseña un ranking de ventas por categoría para una entrevista de diseño de sistemas: registra eventos, un trabajo por lotes que agrega la semana, una caché para las lecturas y lo que enseña Quorum.
section: guides
order: 34
aliases: sales rank, amazon best sellers, top products by category, mapreduce, batch aggregation, leaderboard, system design primer, system design interview, ranking de ventas, más vendidos de Amazon, productos principales por categoría, agregación por lotes, clasificación, entrevista de diseño de sistemas
---

Un ranking de ventas es un trabajo por lotes con una caché delante. Los eventos de venta caen en un registro, un trabajo cada hora suma las unidades de la última semana por producto y categoría, y las listas ordenadas de los primeros puestos se escriben en una tabla pequeña. Los lectores nunca tocan los eventos en bruto, porque toda la respuesta cabe en memoria y es la misma para todos.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), y su [solución para el ranking de ventas](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/sales_rank/README.md) merece leerse junto a esta página.

## Requisitos

Funcionales:

- Calcular los productos más vendidos de la última semana en cada categoría.
- Mostrar la lista principal de una categoría a cualquier comprador.
- Un producto puede estar en varias categorías, y una categoría no tiene subcategorías.

No funcionales:

- Las listas se refrescan al menos cada hora. Un ranking de una hora de antigüedad está bien.
- Las lecturas son rápidas y de alta disponibilidad.
- El cálculo pesado nunca ralentiza el checkout.

## Estima la carga

Supón 1,000 millones de ventas al mes, 10 millones de productos, 1,000 categorías y 100,000 millones de vistas de listas al mes. Un mes son unos 2.5 millones de segundos.

- Escrituras: 1B / 2.5M son 400 ventas por segundo.
- Lecturas: 100B / 2.5M son 40,000 vistas por segundo. Son 100 lecturas por cada venta.
- Tamaño del evento: unos 50 bytes (hora, producto, categoría, cantidad, precio). Un mes son 50 GB de eventos, y la ventana de una semana unos 12 GB.
- Por hora: 1B / 720 son aproximadamente 1.4M de eventos nuevos, una pequeña parte de la ventana.
- Salida: 1,000 categorías por los 100 primeros productos a unos 16 bytes son 1.6 MB para todo el sitio.

La entrada es un problema de lotes modesto. La salida es diminuta. Las escrituras no son lo difícil, y las lecturas son baratas si nunca llegan a una base de datos que calcule algo.

## El diseño

### Registro de eventos

Cada venta emite un evento. La API de ventas lo anexa a un registro y a una [Cola](/components/queue) o flujo, y un consumidor escribe lotes en almacenamiento de objetos como S3. Los anexados son rápidos, ordenados por tiempo y nunca bloquean el checkout. Una venta con dos categorías produce una fila por categoría.

### El trabajo de agregación

Cada hora un trabajo por lotes lee los últimos siete días de eventos y ejecuta dos pasos al estilo MapReduce. Primero, mapea cada evento al par (categoría, producto) con su cantidad, y luego reduce sumando. Segundo, ordena por categoría y por unidades, en orden descendente, usando la fase de shuffle del framework. Spark lo hace hoy en pocas líneas, pero la forma es la misma. El trabajo conserva los primeros cientos por categoría y descarta el resto.

Un refinamiento: suma los totales de la última hora a un total guardado de seis días, en lugar de releer los siete días. El trabajo se mantiene proporcional a los datos nuevos.

### La tabla de ranking

El trabajo escribe una tabla `sales_rank` en una [Base de datos](/components/database) SQL, indexada por categoría y posición. El cambio es atómico: escribe la tabla nueva y luego cambia un puntero, para que un lector nunca vea una lista a medias. Consulta [Vistas materializadas y desnormalización](/patterns/materialized-views-and-denormalization), porque esta tabla es justo el resultado de una consulta almacenado.

### El camino de lectura

La API de lectura sirve una categoría desde una [Caché](/components/cache) delante de la tabla. Con un conjunto de trabajo de 1.6 MB, la tasa de aciertos es casi del 100%, y 40,000 lecturas por segundo son una carga ligera para unos pocos nodos de Redis. Fija el TTL en torno al periodo de refresco y la caché se rellena tras cada trabajo. Las páginas estáticas de categoría también pueden ir en una [CDN](/components/cdn). Eso es [precomputación](/patterns/precomputation).

## Dónde se rompe

**El trabajo se retrasa.** Los datos crecen y el trabajo horario tarda noventa minutos. Los lectores ven una lista más antigua, y el siguiente trabajo empieza antes de que termine el anterior. Procesa el delta en lugar de toda la ventana, y alerta por la antigüedad del trabajo.

**Una categoría caliente.** Todos cargan «Electrónica» a la vez, así que una clave de caché recibe una gran parte de las lecturas. Replícala o guarda una copia en cada servidor web. Consulta [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards).

**Reducers sesgados.** Un producto superventas crea una clave enorme, y un reducer hace casi todo el trabajo. Preagrega en el mapper y añade sal a la clave si hace falta.

**Rankings más frescos para los artículos calientes.** Si los productos populares deben actualizarse en minutos, añade un contador en streaming junto al trabajo por lotes. El resultado por lotes sigue siendo la fuente de verdad. Consulta [captura de cambios de datos](/patterns/change-data-capture) para alimentar ese flujo.

## Constrúyelo en Quorum

El primer Diseño es una [Base de datos](/components/database) cuyos informes leen un resultado almacenado y no un escaneo en vivo. Esa es la tabla de ranking. Busca respuestas ligeramente obsoletas en el libro de registro, que es el precio del ranking de una hora de antigüedad.

::Design{id="materialized-report"}

El segundo Diseño es el lado de lectura, contenido preparado de antemano y puesto en caché para que cada vista no haga trabajo. Compara su carga con un Diseño que calcula en cada petición.

::Design{id="precomputed"}

El tercer Diseño pone un [Conector CDC](/components/cdc) entre la Base de datos y un [Flujo de eventos](/components/log) que alimenta a seguidores como un [Almacén de datos](/components/warehouse). Es lo más parecido al registro de eventos que alimenta el trabajo por lotes.

::Design{id="cdc-stream"}

El cuarto Diseño pone el trabajo lento en una [Cola](/components/queue) con [Workers](/components/worker), la misma forma que el trabajo que consume los eventos de venta y mantiene rápido el checkout. Mira su pie de figura para ver cómo se drena el backlog.

::Design{id="queue-and-workers"}

Investiga [Vistas materializadas](/research/precompute), [Captura de cambios de datos](/research/cdc) y [Trabajos en segundo plano](/research/background-jobs) para desbloquearlos. El incidente [El informe tumba la Base de datos](/incidents/report-db) muestra qué pasa cuando un escaneo corre en la primaria, y el Sandbox [Analítica en el primario](/sandboxes/analytics-primary) te deja probar la solución. Consulta [Informes fuera de la primaria, en un almacén](/patterns/reports-off-the-primary-warehouse) para la versión mayor.

El juego no ejecuta MapReduce, ni una programación horaria, ni una ordenación distribuida. No tiene eventos de venta con categorías ni listas principales, así que el ranking en sí no está modelado.

## Preguntas frecuentes

### ¿Cómo calculas una lista top-N por categoría a gran escala?

Agrega los eventos por lotes. Suma la cantidad por categoría y producto, ordena dentro de cada categoría y conserva los primeros cientos. Un framework como Spark o Hadoop MapReduce hace la ordenación mediante su paso de shuffle.

### ¿Debe un ranking de ventas ser en tiempo real o por lotes?

Por lotes suele ser lo correcto. Un ranking de una hora de antigüedad rara vez cambia lo que compra un comprador, y un trabajo por lotes es simple y barato. Añade una capa de streaming solo para los pocos artículos en los que importan los minutos.

### ¿Cómo sirves millones de lecturas de un ranking?

Precalcula la respuesta y ponla en caché. El conjunto completo de listas principales ocupa solo un par de megabytes, así que cada lectura es una búsqueda en memoria que no hace ningún cálculo.

### ¿Qué usa el System Design Primer para el ranking de ventas?

El Primer registra las ventas en un almacén de objetos, ejecuta un trabajo MapReduce de dos pasos y escribe una tabla `sales_rank` que sirve una API de lectura. Esta página conserva ese esquema y añade la caché y el caso del trabajo retrasado.
