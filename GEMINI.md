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

## Flujo de Trabajo Obligatorio
1. **Entender:** Usa las herramientas de búsqueda antes de editar. Nunca asumas la estructura del proyecto.
2. **Planificar:** Si el cambio requiere modificar más de 2 archivos, muestra un plan breve antes de escribir código.
3. **Ejecutar:** Aplica cambios siguiendo los principios DRY y SOLID. Respeta el estilo de código existente y escribe comentarios en español.
4. **Verificar:** Ejecuta siempre las validaciones y compilaciones necesarias (`npm run build`) antes de dar por terminada la tarea.
