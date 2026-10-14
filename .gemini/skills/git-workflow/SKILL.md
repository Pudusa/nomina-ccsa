---
name: git-workflow
description: Gestión de Git, preparación de commits, revisión de diffs y Conventional Commits. Usar cuando el usuario pida hacer commit, revisar estado o preparar cambios.
---

# Flujo de Git Automatizado

Cuando se solicite hacer commit o revisar cambios:
1. Ejecuta `git status` y `git diff --staged` para auditar los cambios.
2. Formatea el mensaje del commit siguiendo Conventional Commits:
   - `feat:` nuevas características (ej. vista de incidencias, filtros quincenales).
   - `fix:` corrección de errores (ej. ajuste de selectores o espaciado).
   - `refactor:` refactorización sin cambios funcionales.
   - `style:` estilos de UI/UX.
3. Propón el mensaje al usuario antes de ejecutar `git commit`.
