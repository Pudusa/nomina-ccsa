# Contexto Global: Sistema de Nómina y Asistencia (nomina-ccsa)

## Stack del Proyecto
- **Frontend:** React (TypeScript), Vite, Componentes modularizados, Estilos híbridos (CSS global + Inline styles para precisión de layout).
- **Backend:** Node.js (Express), SQLite (`better-sqlite3`), Servicios de asistencia y nómina.
- **Testing y Calidad:** Verificación de compilación estricta (`npm run build`).

## Arquitectura de Conocimiento (Graphify)
Este proyecto cuenta con un grafo de conocimiento en `graphify-out/` con nodos clave, estructura de comunidades y relaciones entre archivos.

Reglas:
- Cuando exista `graphify-out/graph.json`, ejecuta `graphify query "<pregunta>"` antes de realizar tu primera búsqueda (`grep`) o lectura de archivo fuente para cualquier consulta sobre el código.
- Después de modificar código, ejecuta `graphify update .` para mantener el grafo actualizado (solo AST).

## Flujo de Trabajo Obligatorio y Metodología
1. **Planificación Inicial:** Entrar obligatoriamente en modo planificación (`enter_plan_mode`) ante cualquier solicitud de tarea para entender la idea y evitar errores por falta de contexto.
2. **Entender e Investigar:** Usa las herramientas de búsqueda antes de editar. Nunca asumas la estructura del proyecto.
3. **Análisis de Código:** Analizar rigurosamente cada fragmento de código antes de escribirlo para evitar código innecesario, redundante o erróneo.
4. **Ediciones Quirúrgicas:** Utilizar siempre la herramienta `replace` para modificaciones puntuales (agregar, cambiar o borrar palabras/líneas específicas), evitando reescribir archivos enteros o bloques de código que ya funcionan correctamente.
5. **Ejecutar:** Aplica cambios siguiendo los principios DRY y SOLID. Respeta el estilo de código existente y escribe comentarios en español.
6. **Control de Errores y Lecciones:** Registrar y recordar los errores cometidos durante el proceso para saber qué hacer y qué evitar en iteraciones futuras.
7. **Verificar:** Ejecuta siempre las validaciones y compilaciones necesarias (`npm run build`) antes de dar por terminada la tarea.
