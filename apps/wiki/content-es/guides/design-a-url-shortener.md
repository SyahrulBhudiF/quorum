---
title: Diseñar un acortador de URL o Pastebin
seoTitle: Diseñar Pastebin o Bit.ly: guía de diseño de sistemas
summary: Diseña un acortador de URL o Pastebin: genera claves únicas, elige 301 o 302, guarda los pastes grandes en almacenamiento de objetos y pon una caché en la ruta de lectura.
section: guides
order: 20
aliases: system design primer, pastebin, design pastebin, bit.ly, url shortener, tinyurl, bitly, short links, link shortener, system design interview, design tinyurl, diseño de sistemas, acortador de URL, enlaces cortos, entrevista de diseño de sistemas, diseñar tinyurl
---

Un acortador de URL es una consulta clave-valor con muchas lecturas y una ruta de escritura pequeña. Genera una clave única de 7 caracteres para cada URL larga, guarda el par en una base de datos y pon una caché delante de la redirección, porque las lecturas superan a las escrituras en unas cien a una. Las decisiones interesantes son cómo generas claves sin colisiones y qué estado de redirección devuelves.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), y su [solución para Pastebin](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md) merece leerse junto a esta página. El Primer pide "Pastebin.com (o Bit.ly)", así que esta página cubre ambos. El enlace corto es el mismo, y un paste añade un cuerpo demasiado grande para la fila de una tabla.

## Requisitos

Funcionales:

- Crear una URL corta a partir de una larga, con un alias personalizado opcional.
- Redirigir una URL corta a su destino.
- Los enlaces pueden caducar. Contar los clics es deseable.
- Variante Pastebin: un usuario envía un bloque de texto y recibe un enlace, de forma anónima, con una caducidad opcional. Cualquiera con el enlace lee el texto.
- Un trabajo en segundo plano elimina los enlaces y pastes caducados, y las visitas mensuales salen de los logs, así que no tienen que ser en vivo.

No funcionales:

- Las redirecciones responden en menos de 100 ms en el percentil 99.
- Las redirecciones siguen funcionando cuando la ruta de escritura está caída, así que la disponibilidad pesa más que la consistencia estricta.
- Las claves cortas no se pueden adivinar en orden, y una clave nunca se reasigna a otra URL.

## Estima la carga

Supón 100 millones de enlaces nuevos al mes y una proporción de lecturas a escrituras de 100 a 1.

- Escrituras: 100.000.000 / (30 x 86.400 s) son unas 40 por segundo.
- Lecturas: 40 x 100 son 4.000 por segundo de media, y unas 12.000 en el pico si permites 3x.
- Almacenamiento: 500 bytes por fila (clave, URL, marcas de tiempo) x 100 millones x 12 meses x 5 años son 3 TB.
- Espacio de claves: 7 caracteres en base62 dan 62^7, unos 3,5 billones de claves. Eso supera de sobra los 6.000 millones de enlaces.

Para la variante Pastebin, supón 10 millones de pastes al mes con unos 1 KB de texto cada uno. Son 10 GB de texto nuevo al mes, unos 360 GB en tres años, y una proporción de lecturas a escrituras de 10 a 1. Los números son pequeños, así que importa más la forma que el tamaño. Los pastes reales varían, y algunos llegan a megabytes.

Cuarenta escrituras por segundo caben en una primaria de Postgres. Doce mil lecturas por segundo no pertenecen ahí, y por eso importa la caché.

## El diseño

Una petición pasa por un [Balanceador de carga](/components/lb), luego por [Servidores de aplicaciones](/components/server) sin estado, luego por una [Caché](/components/cache) y después por la [Base de datos](/components/database).

### Generar la clave

Hay dos opciones honestas.

| Enfoque  | Cómo                                                 | Coste                                                                       |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Hash     | Toma los primeros 7 caracteres de un hash de la URL  | Colisiones, así que compruebas y reintentas. La misma URL da la misma clave |
| Contador | Incrementa un contador global y codifícalo en base62 | Las claves secuenciales se adivinan, y el contador es un punto único        |

Con contadores, entrega a cada Servidor de aplicaciones un rango de, digamos, 10.000 IDs desde un coordinador pequeño, para que genere claves en local sin llamada de red. Mezcla el contador con una permutación biyectiva si te preocupa que se adivinen. Una clave aleatoria con comprobación de colisiones también sirve, con un índice único como última barrera.

### Redirecciones

Si devuelves 301, los navegadores guardan la redirección para siempre, así que los clics repetidos nunca te llegan, pero pierdes las analíticas de clics y no puedes cambiar el destino. Si devuelves 302, cada clic llega a tu servidor, lo que mantiene las analíticas y deja que los enlaces caduquen. La mayoría de los acortadores que venden estadísticas usan 302.

### La ruta de lectura

Las lecturas siguen [cache-aside](/patterns/cache-aside): consulta la caché por clave, y si falla, lee la base de datos y llena la caché con un TTL. Unos pocos enlaces son muy populares, así que una caché con el 20% de claves más calientes atiende la mayor parte del tráfico. Mira [Añadir una caché](/patterns/add-a-cache).

### Pastebin: el texto va a almacenamiento de objetos

Un paste es más grande que un enlace, y puede ser mucho más grande. Guarda el texto en [Almacenamiento de objetos](/components/storage) bajo su propia clave, y deja que la [Base de datos](/components/database) guarde solo la clave corta, la ruta de almacenamiento, la hora de creación y la caducidad. La fila se queda en unos cientos de bytes, así que el índice y la caché siguen siendo pequeños, y el almacén barato carga con el grueso. Una lectura busca la clave y luego trae el objeto. La ruta de escritura guarda primero el objeto y después la fila, así que un fallo deja un objeto huérfano que un barredor puede encontrar, y nunca una fila que apunta a nada.

La caducidad tiene dos partes. Una lectura comprueba la caducidad y responde "desaparecido" para un paste viejo, así que los usuarios nunca ven uno. Después un trabajo en segundo plano busca filas pasadas de fecha y borra la fila y su objeto, que es donde se ahorra en la factura de almacenamiento. Una regla de ciclo de vida del bucket puede hacer la mitad de los objetos, como en [almacenamiento de objetos y reglas de ciclo de vida](/patterns/object-storage-and-lifecycle-rules).

Las visitas no necesitan ser en vivo, así que cuéntalas fuera de línea. Escribe cada petición en el log de acceso, y un trabajo nocturno suma las visitas por enlace y mes en una tabla del almacén. Así el conteo queda fuera de la ruta de redirección.

## Dónde falla

**Un enlace viral provoca una estampida en la caché.** Cuando caduca una clave popular, miles de peticiones fallan a la vez y llegan a la base de datos. Agrupa las recargas o refresca antes de tiempo, como en [protección contra estampidas de caché](/patterns/cache-stampede-protection). El incidente [Estampida de caché](/incidents/stampede) lo muestra.

**Una clave se lleva todo el tráfico.** Un tuit de una celebridad calienta una clave, y un almacén particionado por hash lo manda todo a un shard. Mantén esa clave en la caché y replícala. Mira [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards) y el incidente [Clave caliente](/incidents/hot-key).

**La base de datos supera una sola máquina.** Con 3 TB y 12.000 lecturas por segundo, añade primero [réplicas de lectura](/patterns/read-replicas), y después [shardea](/patterns/sharding) por clave. Una forma clave-valor se shardea limpiamente porque ninguna consulta cruza claves. Si las escrituras superan una primaria, un almacén de documentos o clave-valor es un buen hogar para las filas de metadatos, y el Primer también lo lista como tema de conversación.

## Constrúyelo en Quorum

La ruta de lectura es la parte que el juego puede mostrar. Coloca Usuarios, un Balanceador de carga, dos Servidores de aplicaciones, una Caché y una Base de datos, y enlázalos en ese orden. Investiga [Caché](/research/caching) para desbloquear la Caché. El Sandbox [Mayoría de lecturas](/sandboxes/read-mostly) es el mismo problema: dominan las lecturas, la CPU de la Base de datos sube y la Caché lo arregla.

Este tablero muestra la consulta de redirección. Mira la carga de la Base de datos con la Caché puesta, porque cada acierto es una lectura que la Base de datos nunca ve. Usa un [Servidor de aplicaciones](/components/server), una [Caché](/components/cache) y una [Base de datos](/components/database), y la Caché está configurada como [cache-aside](/patterns/cache-aside) con un TTL, la misma regla de llenar al fallar que en el diseño de arriba.

::Design{id="cache-aside"}

Pasadas unas pocas miles de lecturas por segundo, la larga cola de enlaces fríos sigue llegando a la Base de datos. Este tablero da a una Base de datos cuatro shards sobre una clave hash, lo que reparte los enlaces por igual porque un hash no tiene favoritos. Mira si algún shard va más caliente que el resto, y fíjate en que el único [Servidor de aplicaciones](/components/server) es grande para que los shards sean el límite. Es la respuesta "shardea por clave" del paso de escalado, descrita en [sharding](/patterns/sharding).

::Design{id="sharded-hash-key"}

El tercer tablero es el otro paso de escalado. Las lecturas van a la [Base de datos](/components/database) primaria o a una [Réplica de lectura](/components/replica), y las escrituras van solo a la primaria, lo que encaja con un servicio cuyas escrituras son decenas por segundo. Mira cómo las dos copias se reparten las lecturas, y el ajuste de read-your-writes en el Servidor de aplicaciones, que devuelve a la primaria a un usuario que acaba de crear un enlace para que el enlace nuevo funcione al instante. El patrón son las [réplicas de lectura](/patterns/read-replicas).

::Design{id="read-replica"}

Cuando la Caché se enfría, el Sandbox [Estampida](/sandboxes/stampede) enseña la solución.

El juego cubre la ruta de lectura y el nivel de almacenamiento. No tiene código de estado de redirección ni generador de claves, así que la elección entre 301 y 302 y el esquema de IDs se quedan en el papel. El Almacenamiento de objetos existe como Componente, pero no se modelan el cuerpo de un paste, un trabajo de caducidad ni un conteo de visitas basado en logs.

## Preguntas frecuentes

### ¿Debe un acortador de URL usar 301 o 302?

Usa 302 si quieres analíticas de clics o enlaces que caduquen, porque el navegador te pregunta cada vez. Usa 301 si quieres reducir carga y no cambiar nunca el destino, ya que los navegadores lo guardan de forma permanente.

### ¿Cómo se generan URLs cortas únicas?

Codifica un contador en base62, con cada Servidor de aplicaciones alquilando un bloque de IDs para no necesitar una llamada por enlace. O genera una clave aleatoria de 7 caracteres y confía en un índice único para rechazar la rara colisión. Hacer un hash de la URL funciona, pero necesita manejo de colisiones.

### ¿Qué longitud debe tener la clave corta?

Siete caracteres base62 dan unos 3,5 billones de claves, lo que cubre miles de millones de enlaces con margen para que las claves aleatorias rara vez colisionen. Seis dan 56.000 millones y bastan para la mayoría de los productos.

### ¿En qué se diferencia Pastebin de un acortador de URL?

Un paste guarda un cuerpo, así que el texto va a almacenamiento de objetos y la base de datos guarda la clave, la ruta y la caducidad. Un enlace corto guarda solo una URL, que cabe en la fila. La generación de claves, la caché y las réplicas funcionan igual en ambos.

### ¿Cómo se caducan los pastes?

Comprueba la caducidad en cada lectura para que un paste viejo nunca se muestre, y luego borra las filas caducadas y sus objetos en un trabajo en segundo plano. Una regla de ciclo de vida del bucket puede limpiar los objetos.

### ¿Cómo se escala un acortador de URL?

Cachea las claves calientes, añade réplicas de lectura para la larga cola y luego shardea la tabla por clave. Las escrituras son solo decenas por segundo, así que lo que crece es la ruta de lectura.
