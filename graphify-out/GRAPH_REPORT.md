# Graph Report - nomina-ccsa  (2026-10-27)

## Corpus Check
- 34 files · ~34,191 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .xls 2, .css 2, (none) 1)

## Summary
- 223 nodes · 318 edges · 20 communities (14 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2f4b3869`
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
- 2. Paleta de Colores (Gris Suave & Verde Profesional de Alto Contraste)
- git-workflow/SKILL.md
- web-backend/SKILL.md
- Directrices de Frontend & UX/UI (nomina-ccsa)
- scripts
- check_db.js

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `compilerOptions` - 15 edges
3. `App()` - 12 edges
4. `DayConfig` - 10 edges
5. `AsistenciasView()` - 8 edges
6. `UniqueWorker` - 8 edges
7. `scripts` - 7 edges
8. `react` - 7 edges
9. `VisualDatePicker()` - 7 edges
10. `formatDisplayDate()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Directrices de Frontend & UX/UI (nomina-ccsa)` --references--> `IncidentItem`  [INFERRED]
  .gemini/skills/web-frontend/SKILL.md → src/types/index.ts
- `EditDayModalProps` --references--> `DayConfig`  [EXTRACTED]
  src/components/modals/EditDayModal.tsx → src/types/index.ts
- `EditWorkerModalProps` --references--> `UniqueWorker`  [EXTRACTED]
  src/components/modals/EditWorkerModal.tsx → src/types/index.ts
- `AsistenciasViewProps` --references--> `WorkerDaySummary`  [EXTRACTED]
  src/components/views/AsistenciasView.tsx → src/types/index.ts
- `TurnosViewProps` --references--> `DayConfig`  [EXTRACTED]
  src/components/views/TurnosView.tsx → src/types/index.ts

## Import Cycles
- None detected.

## Communities (20 total, 6 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.12
Nodes (33): react, App(), CustomDropdown(), CustomDropdownProps, Option, CreateShiftModal(), CreateShiftModalProps, EditDayModal() (+25 more)

### Community 1 - "package.json"
Cohesion: 0.12
Nodes (17): name, private, type, version, concurrently, cors, express, oxlint (+9 more)

### Community 2 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 3 - "index.cjs"
Cohesion: 0.10
Nodes (16): multer, xlsx, app, attendanceService, cleanupExpiredRules(), cors, db, express (+8 more)

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
Cohesion: 0.18
Nodes (8): better-sqlite3, db, Database, dists, Database, db, dbPath, path

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
Nodes (4): Arquitectura de Conocimiento (Graphify), Contexto Global: Sistema de Nómina y Asistencia (nomina-ccsa), Flujo de Trabajo Obligatorio y Metodología, Stack del Proyecto

### Community 14 - "2. Paleta de Colores (Gris Suave & Verde Profesional de Alto Contraste)"
Cohesion: 0.18
Nodes (10): 1. Fundamentos Tipográficos y Accesibilidad, 2. Paleta de Colores (Gris Suave & Verde Profesional de Alto Contraste), 3. Componentes y Patrones UI de Escritorio, Botones (`button`), Colores de Estado y Acentos (Verde Profesional), Fondo y Superficies, Modales Centrados de Alta Visibilidad, Sistema de Diseño y Experiencia de Usuario (UX/UI) - Nómina CCSA (Escritorio Pro & Accesibilidad) (+2 more)

### Community 18 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:all, lint, preview, server

## Knowledge Gaps
- **7 isolated node(s):** `tailwindcss`, `@types/node`, `@types/react`, `@types/react-dom`, `concurrently` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 132 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `xlsx` connect `index.cjs` to `App.tsx`, `package.json`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `tailwindcss`, `@types/node`, `@types/react` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12244897959183673 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `package.json`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.11695906432748537 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._