# Cajitas frente a alternativas en México

Investigación realizada **2026-10-14**. Fuentes: documentación pública oficial, consultada con búsqueda y lectura web. No se accedió a cuentas, apps bancarias privadas, APIs de dinero ni datos de clientes. No se descargaron recursos visuales de competidores ni se ejecutó scraping de Nu o Mercado Pago. Este documento complementa [los patrones anteriores](reference-patterns.md); las observaciones web siguientes no son evidencia de ejecución de las apps privadas.

## Qué demuestra la revisión

**Separar ahorro por metas ya es una función común en México.** Nu, BBVA, Mercado Pago, Banorte y Scotiabank documentan espacios para destinar dinero a objetivos; Fintual documenta inversiones separadas por objetivo. BBVA Plan ya combina nombre, cantidad, fecha y reglas de aportación. Por eso, “cajitas con metas” no sostiene una afirmación de exclusividad.

La propuesta que podemos desarrollar es un **diario de ahorro en español de México**, con una mascota original, registros de dinero que permanece fuera de Cajitas, uso básico sin conexión y respaldos controlados por la persona. Esta es una decisión de producto, no una ventaja de mercado demostrada: no se midieron preferencias, retención ni todas las alternativas.

## Comparación documentada

| Alternativa | Observación de su documentación | Diferencia que importa para Cajitas |
| --- | --- | --- |
| **Nu: Cajitas** [M1] | Cajitas nombrables dentro de Cuenta Nu, separación del saldo de gasto y rendimientos; hasta 10 cajitas. Distingue disponibilidad ordinaria de Ahorro Congelado, cuyo dinero se libera al vencer el plazo. | Nuestro registro no constituye una cajita bancaria. Una fecha de compromiso no congela dinero; debe presentarse como **fecha de tu meta**. No copiar límites, rendimientos ni promesas de protección. |
| **Mercado Pago: Apartados** [M2–M3] | La página principal indexada presenta Apartados. El blog oficial de Cuenta Negocio describe espacios para asignar saldo a objetivos sin cambiarlo de cuenta. | Es una función real del mercado, pero la evidencia obtenida es parcial y corresponde en parte a negocio. No afirmar que tenemos automatización, disponibilidad o condiciones equivalentes. |
| **BBVA: Apartados** [M4] | Hasta 7 apartados; nombre, prioridad, cantidad y programación editables. Puede separar automáticamente una cantidad al recibir nómina BBVA. Para disponer del apartado se devuelve el dinero al saldo de cuenta. | Adaptar claridad de nombre y propósito, sin simular una separación bancaria. Un diario no necesita los límites operativos del banco. La prioridad puede ayudar a elegir el próximo pasito. |
| **BBVA: Plan** [M5–M6] | Metas con nombre, cantidad y fecha; propuestas de aportación, compras por porcentaje o redondeo, aportaciones voluntarias y una modalidad programada que mueve dinero desde la cuenta. | Nombre, monto y fecha deben estar claros. Podemos calcular un plan semanal o cada 15 días; registrar una aportación requiere confirmación de que ocurrió fuera de Cajitas. |
| **Banorte: Mis Apartados y Ahorro Programado** [M7] | El comunicado oficial de 2024 describe separar ingresos para objetivos de corto y mediano plazo; menciona renta, servicios, viajes y pago de tarjetas entre etiquetas utilizadas. | Ofrecer plantillas de emergencias y gastos próximos además de viajes. Es evidencia histórica de uso, no validación de la interfaz o condiciones actuales. |
| **ScotiaMóvil: Apartados** [M8] | Apartados únicos o recurrentes, hasta 5; edición de nombre, imagen, monto y recurrencia. Documenta retiro/abono manual en cualquier momento y aclara que estos apartados no generan intereses. | Personalización y recurrencia no implican inversión. Nuestro organizador puede servir para metas cuyo dinero está en efectivo o cualquier institución. |
| **Fintual México: objetivos** [M9] | Inversiones simultáneas con riesgos y plazos distintos; permite repartir un depósito entre varios objetivos. | Adoptar la separación conceptual entre objetivos. Un reparto manual futuro necesitaría una operación atómica para no contar dos veces; no hace falta replicar perfiles de riesgo ni inversiones. |
| **Spendee: organizador manual** [M10–M11] | Documenta transacciones futuras/recurrentes para wallets manuales e importación CSV en wallets de efectivo; advierte que importar no detecta duplicados ni reconoce transferencias automáticamente. | Es comparable como registro, aunque no es una app mexicana. Conservar historial y exportación; posponer importaciones complejas hasta resolver duplicados. La documentación consultada no demuestra funcionamiento sin conexión en México. |

## Qué implementar o mejorar primero

Estas son **inferencias de diseño**, no conclusiones de que un competidor carece de las funciones. La base actual ya tiene tarjetas, progreso, frecuencia 7/15/30 días, archivo, mascota, visitas y menú móvil “Más”; mejorar esos flujos evita añadir módulos redundantes.

1. **Una tarjeta que responda “cuánto me falta”.** Mantener nombre, ahorro registrado y objetivo; añadir un texto explícito **“Te faltan $…”** y una fecha identificada como meta. Etiquetar **“Dónde lo guardas”**, sin hacer parecer que Cajitas mantiene el dinero. Permitir institución libre/efectivo, o ampliar opciones de diario para incluir BBVA, Banorte y Scotiabank. La elección solo clasifica registros; no crea integraciones. Dar acceso claro a edición y conservar los detalles de movimientos en un desplegable.
2. **Un próximo pasito útil.** Reutilizar el plan existente para sugerir una sola cajita y cantidad según su fecha y frecuencia elegida. La persona puede cambiar la sugerencia. Abrir el registro con el monto sugerido editable y confirmar **“Registrar lo que ya aparté”**. La sugerencia no debe crear movimientos sola ni presentarse como capacidad de ahorro personalizada: no conocemos ingresos ni gastos. Si la fecha pasó, pedir ajuste de fecha/plan en vez de calcular una aportación ficticia.
3. **Hábito amable sin presión para aportar diariamente.** Conservar visitas independientes de pesos y quitar del inicio la racha de días con depósitos: una persona que cumple cada quincena rompe esa racha aunque respete su plan. Quitar la tristeza de la mascota al registrar un retiro; una emergencia o una meta cumplida son usos normales del ahorro. Mostrar progreso de la meta y compañía por visitas. Celebraciones breves y movimiento reducible permiten mantener el prado y los personajes originales.

## Qué simplificar, retirar o posponer

| Decisión | Razón y alcance |
| --- | --- |
| **Cambiar “desbloqueo” por fecha de meta/compromiso.** | Nu sí describe congelamiento de fondos [M1]; Cajitas no puede hacerlo. Mantener la fecha y el aviso preciso sobre registro, evitando lenguaje o iconos que sugieran bloqueo bancario. |
| **Conservar Rendimiento y Conexiones en herramientas secundarias.** | El menú móvil ya tiene “Más”. Aplicar la misma jerarquía a pantallas grandes; el uso diario es consultar una meta, registrar y revisar actividad. No retirar APIs de fases previas: reducir protagonismo visual. |
| **No sumar saldo de Bitso al ahorro registrado.** | Son cantidades con distinta procedencia y posiblemente unidades distintas; una consulta externa no demuestra asignación a una meta. Mantener separación y etiquetas. |
| **Posponer rankings de tasas y promesas de rentabilidad.** | Promociones, condiciones y productos cambian. Esta investigación no verifica un conjunto homogéneo de tasas vigentes; no se publican porcentajes ni una recomendación de inversión. El simulador existente debe seguir identificando su fuente y supuestos. |
| **Posponer reparto múltiple, redondeos e importación bancaria extensa.** | Hay patrones reales [M6, M9, M11], pero añaden cálculo, conciliación y riesgo de duplicación. Primero resolver bien el registro de una aportación, su historial y respaldo. |
| **Evitar tienda, moneda virtual, penalización y premios por monto.** | No hacen falta para aprender cuánto falta o formar el hábito. No se ha demostrado que mejoren esta app. La personalización sencilla y las visitas existentes cumplen la intención de compañía. |

## Fuentes y evidencia reproducible

Todas consultadas el 14 de octubre de 2026. “Leída” significa que el lector web devolvió el contenido público; no que se verificó el producto con una cuenta.

| ID | Fuente oficial y fecha publicada cuando consta | Evidencia y límite |
| --- | --- | --- |
| M1 | [Nu: ¿Qué son las Cajitas de Cuenta Nu?](https://blog.nu.com.mx/productos-nu/cuenta-nu/que-son-las-cajitas-de-cuenta-nu/) — publicación original 2023-04-18, página declara actualización octubre 2026 | Leída; referencia web `turn679880view0`, líneas 92–168. No se verificaron condiciones individuales, app privada ni rendimientos. |
| M2 | [Mercado Pago México](https://www.mercadopago.com.mx/) | Resultado indexado oficial `turn465622search26`: presencia de Apartados. Sin inspección de interfaz privada. |
| M3 | [Mercado Pago: Apartados para organizar dinero del negocio](https://www.mercadopago.com.mx/blog/apartados-organizar-dinero-negocio-objetivos) y [ayuda: dinero en Apartados](https://www.mercadopago.com.mx/ayuda/40435) | Blog indexado `turn465622search2`. Ambas aperturas devolvieron **403** (`turn679880view1`/`view2`); no se intentó eludir la restricción. Solo se usa el fragmento indexado del blog, sin afirmar límites, fechas objetivo o disponibilidad personal. |
| M4 | [BBVA México: Apartados](https://www.bbva.mx/personas/productos/cuentas/apartados.html) | Leída; `turn831258view3`, líneas 236–283. |
| M5 | [BBVA México: Plan](https://www.bbva.mx/personas/productos/cuentas/plan.html) | Leída; `turn770886view0`, líneas 243–316. |
| M6 | [BBVA: cumple tus metas con Plan](https://www.bbva.mx/personas/landings/06/cumple-tus-metas-con-plan-bbva.html) | Leída; `turn615444view0`, líneas 32–66 y 78–113. La ruta de acceso que describe difiere de M5; no se toma como navegación actual verificada. |
| M7 | [Banorte: planeación y gastos en Banorte Móvil](https://www.banorte.com/GFB/Noticias-GFB/Millennials-la-generacion-que-mas-planea-y-programa-sus-gastos-en-Banorte-Movil.html) — 2024-10-07 | Leída; `turn770886view1`, líneas 20–41. Comunicado histórico; no demuestra condiciones actuales. |
| M8 | [Scotiabank México: Apartados ScotiaMóvil](https://www.scotiabank.com.mx/servicios-bancarios/scotiamovil/apartados.aspx) | Leída; `turn831258view1`, líneas 46–54 y 79–113. |
| M9 | [Ayuda Fintual México: más de una inversión](https://ayuda.fintual.mx/es/articles/8218891-puedo-tener-mas-de-una-inversion) — 2024-04-19 | Leída; `turn831258view0`, líneas 12–28. No se investigó desempeño de fondos. |
| M10 | [Spendee: scheduled transactions](https://help.spendee.com/article/229-scheduled-transactions) — actualización 2026-08-19 | Leída; `turn615444view1`, líneas 0–23. Referente internacional de organización manual; disponibilidad por región/plan no verificada. |
| M11 | [Spendee: data import](https://help.spendee.com/article/209-data-import) — actualización 2021-11-18 | Leída; `turn615444view2`, líneas 0–3. Advertencia documentada, con antigüedad explícita. |

## Incertidumbres y siguiente validación

- **Observado:** texto público que describe funciones. **Inferido:** que una tarjeta más simple, una acción siguiente y visitas sin presión podrían hacer Cajitas más fácil de usar. **Desconocido:** el impacto real, interfaces privadas, calidad de sincronización, uso sin conexión de los competidores, requisitos específicos de cada cliente y todas las alternativas disponibles en México.
- La denominación consultada de Mercado Pago México es **Apartados**. “Reservas” aparece en comunicaciones regionales; no se presume que sea el nombre actual para usuarios mexicanos.
- Antes de prometer una diferencia comercial, probar con personas que ahorren semanalmente/quincenalmente, en efectivo y en varias instituciones: ¿comprenden que el dinero sigue fuera?, ¿pueden registrar sin duplicar?, ¿identifican cuánto falta y el siguiente paso? Esta revisión no sustituye esa validación.
- La investigación de mercado está contestada con fuentes documentales y límites explícitos. La comprobación privada de apps está **sin realizar**, por alcance. Las recomendaciones son trabajo propuesto, no afirmaciones de funciones ya terminadas.

## Decisiones implementadas en 0.3

Se añadió cuánto falta en cada tarjeta, vista previa de aportación al definir la meta, monto sugerido editable y montos rápidos sin registros automáticos. Actividad permite corregir errores manuales, con integridad de saldo histórico; las coincidencias manual/correo requieren selección y confirmación, estudiadas en [REA matching](rea-matching.md).

Se conservan las mascotas y el estilo pastel, con cinco ilustraciones originales. La compañía toma el lugar de la racha de depósitos en el indicador principal; la racha sigue como dato secundario. El brief original pide confirmación y tristeza temporal en un retiro anticipado: se conserva ese comportamiento solo si la fecha del retiro es anterior al compromiso, con mensajes de acompañamiento. Un retiro después del compromiso no entristece al compañero, aunque esta revisión propone explorar su eliminación en pruebas con personas.

Se mantienen la fecha de desbloqueo y su cuenta regresiva de compromiso, con el aviso explícito de que no es bancario. Proveedores adicionales, aportaciones compartidas, clasificación de gastos y rankings de tasas quedan fuera de esta entrega. Estas decisiones no equivalen a mejoras de retención o facilidad de uso medidas en el mercado.
