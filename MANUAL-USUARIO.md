# 📖 Manual de Usuario — Sistema Shop

Bienvenido al manual de usuario del **Sistema Shop**, una plataforma de tienda online diseñada para que cualquier emprendedor o negocio pueda vender sus productos de forma sencilla a través de WhatsApp.

---

## 📌 Índice

1. [Introducción](#1-introducción)
2. [Acceso al Panel de Administración](#2-acceso-al-panel-de-administración)
3. [Personalizar la Tienda](#3-personalizar-la-tienda)
4. [Gestión de Categorías](#4-gestión-de-categorías)
5. [Gestión de Productos](#5-gestión-de-productos)
6. [Pedidos](#6-pedidos)
7. [Dashboard / Estadísticas](#7-dashboard--estadísticas)
8. [Tienda Pública](#8-tienda-pública-cómo-funciona-para-el-cliente)
9. [Carrito de Compras](#9-carrito-de-compras)
10. [Consejos para usar el sistema en un negocio real](#10-consejos-para-usar-el-sistema-en-un-negocio-real)

---

## 1️⃣ Introducción

El **Sistema Shop** es una aplicación web que te permite crear y administrar tu propia tienda online sin conocimientos técnicos. Está pensada para pequeños y medianos emprendedores que quieren tener presencia en internet y recibir pedidos de forma organizada.

### 🚀 ¿Qué podés hacer con Shop?

- ✅ Mostrar tus productos con imágenes, precios y stock
- ✅ Organizar productos por categorías
- ✅ Personalizar los colores, logo y diseño de tu tienda
- ✅ Recibir pedidos directamente por WhatsApp
- ✅ Ver estadísticas de ventas y actividad
- ✅ Administrar todo desde un panel de control fácil de usar

### 🌐 URLs principales del sistema

| Página | URL |
|--------|-----|
| 🏪 Tienda pública (inicio) | [`/`](public/index.html) |
| 🛒 Carrito de compras | [`/carrito.html`](public/carrito.html) |
| 🔐 Login del panel admin | [`/admin/login.html`](public/admin/login.html) |
| 📊 Dashboard | [`/admin/dashboard.html`](public/admin/dashboard.html) |
| 📦 Productos | [`/admin/admin.html`](public/admin/admin.html) |
| 🏷️ Categorías | [`/admin/categorias.html`](public/admin/categorias.html) |
| 🛍️ Pedidos | [`/admin/pedidos.html`](public/admin/pedidos.html) |
| 🎨 Personalizar tienda | [`/admin/personalizacion.html`](public/admin/personalizacion.html) |

---

## 2️⃣ Acceso al Panel de Administración

El panel de administración es el centro de control de tu tienda. Desde ahí vas a poder gestionar productos, categorías, pedidos, y personalizar el diseño.

### 🔑 Cómo ingresar

1. Abrí tu navegador web (Chrome, Edge, Firefox, etc.)
2. Ingresá a la URL: [`/admin/login.html`](public/admin/login.html)
3. Ingresá las siguientes credenciales:

   | Campo | Valor |
   |-------|-------|
   | 👤 **Usuario** | `admin` |
   | 🔒 **Contraseña** | `admin123` |

4. Hacé clic en **"Iniciar Sesión"**

> ⚠️ **Importante:** Por seguridad, cambiá la contraseña por defecto apenas empieces a usar el sistema en un negocio real. Consultá la sección de [Consejos](#10-consejos-para-usar-el-sistema-en-un-negocio-real) para más detalles.

### 🧭 Navegación del panel

Una vez dentro, vas a ver un menú lateral con las siguientes secciones:

- 📊 **Dashboard** — Estadísticas y resumen de ventas
- 📦 **Productos** — Agregar, editar y eliminar productos
- 🛒 **Pedidos** — Ver los pedidos recibidos
- 🏷️ **Categorías** — Administrar las categorías de productos
- 🎨 **Personalizar Tienda** — Cambiar colores, logo, y diseño

---

## 3️⃣ Personalizar la Tienda

La sección **Personalizar Tienda** ([`/admin/personalizacion.html`](public/admin/personalizacion.html)) te permite cambiar la apariencia y configuración de tu tienda sin tocar una sola línea de código.

### 3.1 Información General

Acá podés definir los datos básicos de tu negocio:

- **Nombre de la tienda** — El nombre que aparecerá en el encabezado y título de la página (ej: "Pastelería Dulce Sabor")
- **Descripción** — Un texto breve que describe tu negocio (aparece en la sección Hero de la página principal)

### 3.2 Colores

Personalizá la paleta de colores de tu tienda para que coincida con la identidad visual de tu marca:

| Color | ¿Qué afecta? |
|-------|-------------|
| 🎨 **Color primario** | Botones, enlaces, acentos principales |
| 🎨 **Color secundario** | Elementos secundarios, detalles decorativos |
| ⬜ **Color de fondo** | Fondo general de la página |
| 📝 **Color de texto** | Color del texto principal |
| 🔗 **Color de enlaces** | Color de los links y botones secundarios |
| 🖱️ **Hover de enlaces** | Color al pasar el mouse sobre enlaces |

> 💡 **Tip:** Si no sabés qué colores usar, elegí 2 o 3 colores de tu logo y usalos como base.

### 3.3 Fondo / Portada (Hero)

La sección **Hero** es la imagen grande de bienvenida que se ve en la parte superior de tu tienda:

- **Título del Hero** — Un texto llamativo (ej: "Los mejores pasteles de la ciudad")
- **Descripción del Hero** — Un texto secundario debajo del título
- **Imagen de fondo** — Una imagen de portada que represente tu negocio

### 3.4 Pedidos / WhatsApp

Configurá el número de WhatsApp al que llegarán los pedidos:

1. Ingresá el número con código de país (ej: `5491123456789` para Argentina)
2. Hacé clic en **Guardar**
3. Aparecerá un botón flotante de WhatsApp en la tienda pública
4. Cuando un cliente finalice una compra, el pedido se enviará automáticamente a este número

> 📱 **Formato del número:** `códigoPaís + número sin ceros ni signos`. Ejemplo: para un número argentino `(11) 2345-6789`, ingresá `5491123456789`.

### 3.5 Redes Sociales

Vinculá las redes sociales de tu negocio para que aparezcan en el pie de página (footer) de la tienda:

- 📷 **Instagram** — URL completa de tu perfil (ej: `https://instagram.com/tuemprendimiento`)
- 📘 **Facebook** — URL completa de tu página
- 🎵 **TikTok** — URL completa de tu perfil

### 3.6 Imágenes

Subí las imágenes principales de tu tienda:

- **Logo** — Aparecerá en el encabezado de la tienda (tamaño recomendado: 200×200 px)
- **Imagen de portada (Hero)** — Imagen de fondo de la sección de bienvenida (tamaño recomendado: 1920×600 px)

> 📸 **Formatos aceptados:** JPG, PNG, WEBP. Tamaño máximo: 5 MB por imagen.

### 3.7 Restablecer valores

Si querés volver a la configuración original de fábrica, hacé clic en el botón **"Restablecer valores"**. Esto borrará todos los cambios que hayas hecho y volverá a los valores por defecto.

> ⚠️ **Cuidado:** Esta acción no se puede deshacer. Usala solo si estás seguro.

---

## 4️⃣ Gestión de Categorías

La sección **Categorías** ([`/admin/categorias.html`](public/admin/categorias.html)) te permite organizar tus productos en grupos para que los clientes puedan filtrar y encontrar lo que buscan más fácilmente.

### 4.1 ¿Qué son las categorías?

Las categorías son etiquetas que agrupán productos similares. Por ejemplo, si vendés ropa, podrías tener categorías como:

- 👕 Remeras
- 👖 Pantalones
- 👗 Vestidos
- 🧥 Abrigos

### 4.2 Cambiar el nombre de una categoría

1. En la lista de categorías, buscá la que querés renombrar
2. Hacé clic en el botón **✏️ Editar**
3. Escribí el nuevo nombre
4. Hacé clic en **Guardar**

### 4.3 Mostrar / Ocultar categorías

Cada categoría tiene un interruptor (toggle) que permite **mostrarla u ocultarla** en la tienda pública:

- ✅ **Visible** — Los productos de esta categoría se muestran en la tienda
- ❌ **Oculta** — Los productos de esta categoría NO se muestran en la tienda

> 💡 **¿Para qué sirve ocultar categorías?** Si estás preparando nuevos productos o tenés una categoría descontinuada, podés ocultarla temporalmente sin perder los productos ni sus datos.

### 4.4 Efecto en los productos

Es importante entender cómo funciona:

- Si **ocultás una categoría**, todos los productos que pertenezcan a esa categoría **desaparecerán de la tienda pública**
- Los productos **no se eliminan**, solo dejan de verse
- Cuando volvés a mostrar la categoría, los productos reaparecen automáticamente
- En el panel de administración, los productos siempre se ven sin importar el estado de la categoría

---

## 5️⃣ Gestión de Productos

La sección **Productos** ([`/admin/admin.html`](public/admin/admin.html)) es donde vas a administrar todo tu catálogo.

### 5.1 Agregar un producto

1. Hacé clic en el botón **"Agregar Producto"**
2. Completá los siguientes campos:

   | Campo | Descripción |
   |-------|-------------|
   | 📛 **Nombre** | El nombre del producto (ej: "Remera Negra") |
   | 💰 **Precio** | El precio de venta (ej: `2500`) |
   | 📂 **Categoría** | Seleccioná una categoría existente del menú desplegable |
   | 📦 **Stock** | Cantidad disponible (ej: `10`). Si no manejás stock, poné un número alto |
   | 🖼️ **Imágenes** | Podés subir **una o varias imágenes** del producto. Hacé clic en "Seleccionar imágenes" y elegí los archivos |

3. Hacé clic en **"Guardar"**

> 📸 **Sobre las imágenes:** Podés subir múltiples imágenes por producto. Los clientes podrán verlas en un carrusel (galería deslizable) en la tienda pública.

### 5.2 Editar un producto

1. En la lista de productos, hacé clic en el botón **✏️ Editar** del producto que querés modificar
2. Se abrirá un formulario con los datos actuales del producto
3. Modificá los campos que necesites
4. Hacé clic en **"Guardar cambios"**

### 5.3 Eliminar un producto

1. Hacé clic en el botón **🗑️ Eliminar** del producto
2. Confirmá la eliminación en el mensaje de advertencia

> ⚠️ **Atención:** Eliminar un producto es permanente. No se puede recuperar.

### 5.4 Filtrar y buscar productos

En la parte superior de la lista de productos, encontrás:

- **🔍 Buscador** — Escribí cualquier palabra para filtrar productos por nombre
- **📂 Filtro por categoría** — Seleccioná una categoría para ver solo los productos de esa categoría

Ambos filtros se pueden combinar para encontrar productos rápidamente.

---

## 6️⃣ Pedidos

La sección **Pedidos** ([`/admin/pedidos.html`](public/admin/pedidos.html)) te permite ver todos los pedidos que los clientes realizaron a través de la tienda.

### 6.1 Ver pedidos recibidos

Cada pedido muestra:

- 🆔 **Número de pedido** (ID)
- 👤 **Nombre del cliente**
- 📞 **Teléfono del cliente**
- 📋 **Lista de productos** solicitados (con cantidades y precios)
- 💵 **Total** del pedido
- 📅 **Fecha y hora** en que se realizó

### 6.2 Buscar pedidos por cliente

Usá el campo de búsqueda para encontrar pedidos por nombre de cliente. Es útil cuando un cliente te llama para consultar por su pedido.

### 6.3 Paginación

Si tenés muchos pedidos, la lista se divide en páginas. Usá los botones de **"Anterior"** y **"Siguiente"** para navegar entre ellas.

---

## 7️⃣ Dashboard / Estadísticas

El **Dashboard** ([`/admin/dashboard.html`](public/admin/dashboard.html)) te da una visión general del rendimiento de tu tienda.

### 7.1 Tarjetas de resumen

En la parte superior, ves cuatro indicadores clave:

| Indicador | ¿Qué muestra? |
|-----------|--------------|
| 💰 **Ventas totales** | Suma de todos los pedidos realizados |
| 📦 **Productos** | Cantidad total de productos en tu catálogo |
| 🛍️ **Pedidos** | Cantidad total de pedidos recibidos |
| 📈 **Ventas hoy** | Ventas realizadas en el día actual |

### 7.2 Gráfico de ventas mensuales

Un gráfico de barras que muestra las ventas de los últimos 12 meses. Te permite identificar:

- 📊 Cuáles son tus meses de mayor venta
- 📉 En qué meses bajaron las ventas
- 📈 La tendencia general de tu negocio

### 7.3 Actividad reciente

Una lista de los pedidos más recientes, para que puedas ver al instante qué está pasando en tu tienda.

### 7.4 Detalle de ventas diarias

Una tabla que muestra el desglose de ventas del día actual, incluyendo:

- Productos vendidos
- Cantidades
- Montos
- Clientes

---

## 8️⃣ Tienda Pública (cómo funciona para el cliente)

La tienda pública ([`/`](public/index.html)) es lo que ven tus clientes cuando visitan tu sitio web.

### 8.1 Navegar categorías

En la parte superior de la tienda, los clientes ven los botones de categorías:

- **"Todos"** — Muestra todos los productos disponibles
- **Botones de categorías** — Al hacer clic en una categoría, se filtran solo los productos de esa categoría

### 8.2 Buscar productos

El ícono de 🔍 abre un campo de búsqueda donde los clientes pueden escribir el nombre del producto que están buscando.

### 8.3 Ver productos con imágenes en carrusel

Cuando un producto tiene múltiples imágenes, los clientes pueden deslizarlas con flechas ◀️ ▶️ para ver todas las fotos del producto.

### 8.4 Agregar al carrito

Cada producto tiene un botón **"Agregar al carrito"**. Al hacer clic:

1. El producto se agrega al carrito
2. El contador del carrito (🛒) se actualiza
3. Aparece una vista previa del carrito con los productos agregados

### 8.5 Finalizar compra vía WhatsApp

Cuando el cliente termina de elegir sus productos, hace clic en el carrito y luego en **"Ver carrito"** o va directamente a [`/carrito.html`](public/carrito.html) para finalizar la compra.

---

## 9️⃣ Carrito de Compras

La página del carrito ([`/carrito.html`](public/carrito.html)) es donde los clientes revisan su pedido antes de enviarlo.

### 9.1 Ver productos agregados

Se muestra una lista con todos los productos que el cliente agregó, incluyendo:

- 🖼️ Imagen del producto
- 📛 Nombre
- 💰 Precio unitario
- 🔢 Cantidad
- 💵 Subtotal

### 9.2 Cambiar cantidades

El cliente puede:

- ➕ Aumentar la cantidad de un producto
- ➖ Disminuir la cantidad
- 🗑️ Eliminar un producto del carrito

El total se actualiza automáticamente.

### 9.3 Ingresar nombre y teléfono

Para finalizar, el cliente debe completar:

- 👤 **Nombre** — Su nombre o el de la persona que retira
- 📞 **Teléfono** — Un número de contacto

### 9.4 Enviar pedido por WhatsApp

Al hacer clic en **"Enviar pedido por WhatsApp"**:

1. Se abre automáticamente WhatsApp Web (o la app de WhatsApp en el celular)
2. Se genera un mensaje con el detalle completo del pedido:
   ```
   🛒 *Nuevo Pedido*
   
   👤 Cliente: Juan Pérez
   📞 Teléfono: 1123456789
   
   📋 Productos:
   1. Remera Negra x2 - $5000
   2. Gorra Azul x1 - $2500
   
   💰 Total: $7500
   ```
3. El mensaje se envía al número de WhatsApp que configuraste en el panel de administración

> 💡 **Nota:** El cliente necesita tener WhatsApp instalado en su dispositivo o usar WhatsApp Web.

---

## 🔟 Consejos para usar el sistema en un negocio real

Acá van algunos consejos prácticos para sacarle el máximo provecho al sistema:

### 🛡️ Seguridad

- **Cambiá la contraseña por defecto** — Apenas empieces, cambiá `admin123` por una contraseña segura
- **Usá una contraseña única** — No uses la misma contraseña que en otros servicios
- **Mantené el sistema actualizado** — Si recibís actualizaciones, aplicarlas para tener las últimas mejoras de seguridad

### 🎨 Imagen de marca

- **Usá imágenes de calidad** — Las fotos de tus productos son lo primero que ven los clientes. Usá buena iluminación y fondos limpios
- **Mantené consistencia de colores** — Usá los colores de tu marca en toda la tienda
- **Subí un logo profesional** — El logo es la cara de tu negocio

### 📦 Gestión de productos

- **Categorizá bien tus productos** — Una buena organización ayuda a los clientes a encontrar lo que buscan
- **Actualizá el stock** — Mantené actualizadas las cantidades disponibles para evitar vender algo que no tenés
- **Usá múltiples imágenes** — Mostrar un producto desde varios ángulos aumenta las ventas
- **Precios claros** — Revisá que los precios estén correctos antes de publicar

### 📱 Atención al cliente

- **Respondé rápido por WhatsApp** — Los clientes valoran una respuesta rápida
- **Configurá mensajes automáticos** — Podés usar las herramientas de WhatsApp Business para respuestas rápidas
- **Confirmá los pedidos** — Cuando recibas un pedido, confirmale al cliente que lo recibiste

### 📊 Seguimiento

- **Revisá el Dashboard seguido** — Las estadísticas te ayudan a entender qué productos se venden más
- **Identificá tendencias** — Usá el gráfico de ventas mensuales para preparar stock en temporada alta
- **Escuchá a tus clientes** — Si muchos preguntan por un producto que no tenés, considerá agregarlo

### 🚀 Para empezar

1. ✅ Ingresá al panel de administración
2. 🎨 Personalizá los colores y subí tu logo
3. 📂 Creá las categorías de tus productos
4. 📦 Agregá tus productos con fotos y precios
5. 📱 Configurá tu número de WhatsApp
6. 🌐 Compartí el link de tu tienda con tus clientes
7. 🎉 ¡Empezá a recibir pedidos!

---

> 📌 **¿Tenés dudas o necesitás ayuda?** Consultá con el desarrollador del sistema o revisá la documentación técnica incluida en el proyecto.

---

*Manual generado para el Sistema Shop — Versión 1.0*
