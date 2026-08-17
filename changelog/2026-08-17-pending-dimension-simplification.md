# Nota de modificación: Simplificación de cotas de escaleras y railing

Fecha: 2026-08-17

Estado: Implementado

Origen: DCR Product Lab

## Decisión

El canvas debe mostrar únicamente las cotas necesarias para definir o editar la geometría. Las propiedades derivadas deben consultarse en las opciones del objeto seleccionado.

## Escaleras

- Mantener únicamente la cota editable de ancho en el nacimiento de la escalera.
- Mantener la anotación seleccionable `STAIRS n · xR · yT`.
- Mantener las cotas de los tramos restantes de la arista base cuando existan.
- Eliminar las dos cotas laterales de `total run`.
- Eliminar la cota exterior que repite el ancho de la escalera.
- Mostrar `total rise`, `total run`, dimensión de riser y dimensión de tread en las opciones del objeto seleccionado.

## Railing

- Eliminar las cotas automáticas de railing del canvas.
- Mostrar longitud, cantidad de paneles, cantidad de postes y tipo de railing en las opciones del objeto seleccionado.

## Principio de interfaz

Las cotas visibles en el canvas deben ayudar directamente a definir o editar la geometría. La información derivada que no sea necesaria para manipular el objeto debe permanecer en sus opciones, reduciendo obstrucciones visuales y facilitando la selección de elementos.

## Implementación

El canvas conserva la anotación central de la escalera, la cota editable de su nacimiento y las cotas de los tramos restantes de la arista base. Las cotas de los laterales, la repetición exterior del ancho y las cotas automáticas de railing fueron retiradas. No se modificaron los cálculos geométricos ni las cantidades estructuradas de los objetos.
