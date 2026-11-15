---
title: Diseña un motor de búsqueda como Google
seoTitle: "Diseña un motor de búsqueda como Google: guía de entrevista"
summary: Diseña un motor de búsqueda web para una entrevista de diseño de sistemas: rastreo, índice invertido, ranking, servicio con shards y la ruta de la consulta, y lo que enseña Quorum.
section: guides
order: 36
aliases: google, web search, search engine, crawler, web crawler, inverted index, pagerank, ranking, elasticsearch, system design primer, system design interview, búsqueda web, motor de búsqueda, rastreador, índice invertido, entrevista de diseño de sistemas
---

Un motor de búsqueda web son dos sistemas unidos por un índice. Una canalización offline rastrea páginas, construye un índice invertido y puntúa cada página, y un nivel online de shards del índice responde cada consulta preguntando a todos y combinando los mejores resultados. El rastreo puede ser lento y aproximado. El servicio tiene que responder en una fracción de segundo.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), en su [lista de preguntas adicionales](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions).

## Requisitos

Funcionales:

- Rastrear la web pública y mantener las páginas razonablemente frescas.
- Recibir una consulta de texto y devolver las páginas más relevantes, de diez en diez.
- Mostrar un título y un fragmento de cada resultado.

No funcionales:

- Latencia de consulta muy por debajo de medio segundo en el percentil 99.
- Disponibilidad muy alta para las consultas. Un índice desactualizado es aceptable, uno no disponible no.
- Cortesía: nunca martillar un sitio mientras se rastrea.

## Estima la carga

Supón 50 mil millones de páginas en el índice, 100 KB de HTML sin procesar cada una y 5 mil millones de consultas al día.

- Almacenamiento bruto: 50 mil millones por 100 KB son 5 PB. El índice guarda términos y posiciones y no el texto completo, así que calcula 1 PB para el índice y unos pocos más para las copias guardadas de las páginas.
- Tasa de consultas: 5 mil millones divididos entre 86,400 segundos son unas 58,000 consultas por segundo de media, y quizá 150,000 en el pico.
- Tasa de rastreo: refrescar toda la web una vez al mes significa 50 mil millones de páginas en 2.6 millones de segundos, unas 19,000 descargas por segundo. Las páginas populares se refrescan a diario, así que prevé más.
- Shards: si una máquina guarda 100 GB de índice entre memoria y disco, 1 PB necesita unas 10,000 máquinas, antes de las réplicas.

El almacenamiento y el fan-out son lo difícil. Una sola consulta tocará miles de máquinas.

## El diseño

### Rastreador

Una URL frontier es una cola priorizada de páginas por descargar. Los fetchers sacan de ella, respetan robots.txt y mantienen una espera por host para que un sitio reciba una petición cada pocos segundos. De cada página descargada se calcula un hash para detectar duplicados, se extraen sus enlaces y los enlaces nuevos vuelven a la frontier. La frontier se particiona por host para que la cortesía sea fácil de imponer. El trabajo pasa por una [Cola](/components/queue) hacia una flota de [Workers](/components/worker).

### Constructor del índice

Las páginas sin procesar llegan al [Almacenamiento de objetos](/components/storage). Un trabajo por lotes como MapReduce tokeniza cada página y emite pares de término a documento, y luego los agrupa en el [índice invertido](/glossary/inverted-index): para cada término, una lista ordenada de los documentos que lo contienen, con posiciones. El mismo trabajo cuenta enlaces para calcular una puntuación de calidad de la página, la idea detrás de PageRank en el artículo original de Google. Reconstruye el índice por lotes y publica una nueva generación de shards cuando esté lista.

### Índice con shards

Divide el índice por documento, de modo que cada shard guarde las listas completas de términos de su propia porción de páginas. La alternativa, dividir por término, hace que una consulta lea por la red unas pocas listas enormes. Con el sharding por documento cada consulta va a todos los shards, pero cada shard trabaja solo y devuelve sus mejores resultados. Cada shard tiene varias réplicas, que añaden capacidad de consulta y sobreviven al fallo de una máquina. Mira el [sharding](/patterns/sharding).

### Ruta de la consulta

Una consulta llega a un front-end detrás de un [Balanceador de carga](/components/lb). El front-end limpia la consulta, corrige la ortografía y comprueba una [Caché](/components/cache) de consultas recientes, ya que una pequeña parte de las consultas se repite todo el día. En un fallo de caché reparte la consulta a una réplica de cada shard. Cada shard intersecta sus listas de términos, puntúa los candidatos con una fórmula barata y devuelve sus 100 mejores. La raíz combina esas listas, una segunda etapa reordena los mejores cientos con un modelo más pesado y el front-end obtiene los fragmentos de los diez finales.

## Dónde se rompe

**Latencia de cola del fan-out.** La consulta espera al más lento de miles de shards, así que una réplica lenta hace lenta toda la respuesta. Envía una petición de respaldo a otra réplica tras una espera corta, y devuelve resultados parciales si un shard no cumple su plazo. Mira las [peticiones hedged](/patterns/hedged-requests) y la [latencia de cola](/patterns/tail-latency).

**Consultas calientes.** Un término de última hora inunda los mismos shards en un minuto. Guarda en caché páginas de resultados enteras para las consultas populares, con un TTL corto para que las noticias sigan frescas.

**Un índice desactualizado.** El rastreo se retrasa y los resultados apuntan a páginas muertas o cambiadas. Rastrea los sitios importantes con más frecuencia y mantén un pequeño índice en tiempo real para las páginas recientes, que se combina con el principal al consultar.

**Spam y trampas de rastreo.** Los calendarios infinitos y las granjas de enlaces se comen el presupuesto de rastreo y contaminan el ranking. Limita la profundidad por host, detecta casi duplicados y puntúa por confianza y no solo por coincidencia de texto.

## Constrúyelo en Quorum

El juego modela la mitad del servicio. El primer tablero pone un [Motor de búsqueda](/components/search) junto a la Base de datos, así que las búsquedas dejan de competir con las lecturas normales. Muestra el índice invertido haciendo su trabajo en la ruta de la consulta.

::Design{id="search-engine"}

El segundo tablero es la misma idea ajustada. Muestra shards y réplicas en el Motor de búsqueda y el intervalo de refresco, que es el compromiso de frescura del problema del índice desactualizado de arriba.

::Design{id="search-index-tuned"}

El tercero cambia la búsqueda por palabra clave por un [Índice vectorial](/components/vec), el paso de vecino más cercano que la búsqueda moderna añade para coincidencias por significado. Fíjate en cómo se sitúa la búsqueda junto a la Base de datos y la llamada al modelo.

::Design{id="vector-index"}

Investiga [Búsqueda de texto completo](/research/full-text-search) para desbloquear el Motor de búsqueda, y lee [Búsqueda junto a la base de datos](/patterns/search-beside-the-database), [Búsqueda de texto completo y el índice invertido](/patterns/full-text-search-and-inverted-index) y [Búsqueda vectorial y embeddings](/patterns/vector-search-and-embeddings). La [Caché](/components/cache) para consultas populares se explica en [Añadir una caché](/patterns/add-a-cache).

El juego no modela el rastreo, la URL frontier, la cortesía, el ranking basado en enlaces, la corrección ortográfica ni una canalización de reconstrucción. Tampoco tiene fan-out sobre miles de shards, así que la latencia de cola del fan-out sigue siendo teoría de entrevista.

## Preguntas frecuentes

### ¿Cómo funciona tan rápido la búsqueda de Google?

Mantiene un índice invertido en memoria repartido en miles de shards, así que cada consulta lee unas pocas listas cortas de términos y no páginas enteras. Cada shard responde en paralelo y las consultas populares salen directamente de una caché.

### ¿Qué es un índice invertido?

Asocia cada palabra con la lista ordenada de los documentos que la contienen. Una consulta de dos palabras obtiene dos listas y las intersecta, lo cual es mucho más barato que recorrer cada página.

### ¿Cómo se rastrea la web sin sobrecargar los sitios?

Mantén una cola de URL particionada por host e impón una espera entre peticiones al mismo host. Obedece robots.txt y reduce el ritmo cuando un sitio se ralentiza o devuelve errores.

### ¿Hay una pregunta de motor de búsqueda en el System Design Primer?

Sí, está en la lista de preguntas adicionales del Primer, que tiene enlaces de lectura y ninguna respuesta resuelta. Esta página es una respuesta resuelta, escrita a partir del artículo de Google y la práctica general.
