# Graph Report - nomina-ccsa  (2026-10-26)

## Corpus Check
- 30 files · ~18,972 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .xls 2, .css 2, (none) 1)

## Summary
- 209 nodes · 304 edges · 19 communities (15 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2ae60612`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- package.json
- compilerOptions
- index.cjs
- compilerOptions
- dependencies
- devDependencies
- database.cjs
- .oxlintrc.json
- settings.json
- React + TypeScript + Vite
- tsconfig.json
- Contexto Global: Sistema de Nómina y Asistencia (nomina-ccsa)
- 3. Componentes y Patrones UI
- git-workflow/SKILL.md
- web-backend/SKILL.md
- IncidenciasView.tsx
- scripts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `compilerOptions` - 15 edges
3. `App()` - 11 edges
4. `DayConfig` - 10 edges
5. `formatDisplayDate()` - 9 edges
6. `UniqueWorker` - 8 edges
7. `scripts` - 7 edges
8. `VisualDatePicker()` - 7 edges
9. `AsistenciasView()` - 7 edges
10. `getTurnoOnDate()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Directrices de Frontend & UX/UI (nomina-ccsa)` --references--> `IncidentItem`  [INFERRED]
  .gemini/skills/web-frontend/SKILL.md → src/types/index.ts
- `4. Estrategia de Migración y Plan de Acción` --references--> `AsistenciasView()`  [INFERRED]
  DESIGN_SYSTEM.md → src/components/views/AsistenciasView.tsx
- `4. Estrategia de Migración y Plan de Acción` --references--> `IncidenciasView()`  [INFERRED]
  DESIGN_SYSTEM.md → src/components/views/IncidenciasView.tsx
- `4. Estrategia de Migración y Plan de Acción` --references--> `TrabajadoresView()`  [INFERRED]
  DESIGN_SYSTEM.md → src/components/views/TrabajadoresView.tsx
- `4. Estrategia de Migración y Plan de Acción` --references--> `TurnosView()`  [INFERRED]
  DESIGN_SYSTEM.md → src/components/views/TurnosView.tsx

## Import Cycles
- None detected.

## Communities (19 total, 4 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.15
Nodes (30): 4. Estrategia de Migración y Plan de Acción, react, App(), CreateShiftModal(), CreateShiftModalProps, EditDayModal(), EditDayModalProps, EditWorkerModal() (+22 more)

### Community 1 - "package.json"
Cohesion: 0.10
Nodes (17): name, private, type, version, concurrently, express, multer, oxlint (+9 more)

### Community 2 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 3 - "index.cjs"
Cohesion: 0.12
Nodes (13): cors, xlsx, app, cleanupExpiredRules(), cors, db, express, formatDateKey() (+5 more)

### Community 4 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 5 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, better-sqlite3, cors, express, multer, react, react-dom, tailwindcss (+2 more)

### Community 6 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently, oxlint, @types/node, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 7 - "database.cjs"
Cohesion: 0.29
Nodes (5): better-sqlite3, Database, db, dbPath, path

### Community 8 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 9 - "settings.json"
Cohesion: 0.14
Nodes (13): general, editor, hooks, BeforeTool, tokenBudget, $schema, run_shell_command, tools (+5 more)

### Community 11 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 13 - "Contexto Global: Sistema de Nómina y Asistencia (nomina-ccsa)"
Cohesion: 0.40
Nodes (4): Arquitectura de Conocimiento (Graphify), Contexto Global: Sistema de Nómina y Asistencia (nomina-ccsa), Flujo de Trabajo Obligatorio, Stack del Proyecto

### Community 14 - "3. Componentes y Patrones UI"
Cohesion: 0.18
Nodes (10): 1. Fundamentos Tipográficos, 2. Paleta de Colores (Modo Claro y Oscuro), 3. Componentes y Patrones UI, Botones (`button`), Inputs y Selectores, Modo Claro (Light Mode), Modo Oscuro (Dark Mode), Sistema de Diseño y Experiencia de Usuario (UX/UI) - Nómina CCSA (+2 more)

### Community 17 - "IncidenciasView.tsx"
Cohesion: 0.50
Nodes (3): Directrices de Frontend & UX/UI (nomina-ccsa), IncidenciasViewProps, IncidentItem

### Community 18 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:all, lint, preview, server

## Knowledge Gaps
- **7 isolated node(s):** `tailwindcss`, `@types/node`, `@types/react`, `@types/react-dom`, `concurrently` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 124 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `xlsx` connect `index.cjs` to `App.tsx`, `package.json`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **What connects `tailwindcss`, `@types/node`, `@types/react` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.148664343786295 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `package.json`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10476190476190476 - nodes in this community are weakly interconnected._
- **Why does `4. Estrategia de Migración y Plan de Acción` connect `App.tsx` to `3. Componentes y Patrones UI`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._