# Graph Report - nomina-ccsa  (2026-10-14)

## Corpus Check
- 24 files · ~10,613 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .xls 2, .css 2, (none) 1)

## Summary
- 160 nodes · 227 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `270cbaf5`
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
- scripts
- React + TypeScript + Vite
- tsconfig.json
- GEMINI.md

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `compilerOptions` - 15 edges
3. `App()` - 10 edges
4. `formatDisplayDate()` - 9 edges
5. `VisualDatePicker()` - 7 edges
6. `scripts` - 6 edges
7. `AsistenciasView()` - 6 edges
8. `UniqueWorker` - 6 edges
9. `DayConfig` - 6 edges
10. `EditWorkerModal()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `EditDayModalProps` --references--> `DayConfig`  [EXTRACTED]
  src/components/modals/EditDayModal.tsx → src/types/index.ts
- `EditWorkerModalProps` --references--> `UniqueWorker`  [EXTRACTED]
  src/components/modals/EditWorkerModal.tsx → src/types/index.ts
- `TrabajadoresViewProps` --references--> `UniqueWorker`  [EXTRACTED]
  src/components/views/TrabajadoresView.tsx → src/types/index.ts
- `TurnosViewProps` --references--> `DayConfig`  [EXTRACTED]
  src/components/views/TurnosView.tsx → src/types/index.ts
- `App()` --calls--> `CreateShiftModal()`  [EXTRACTED]
  src/App.tsx → src/components/modals/CreateShiftModal.tsx

## Import Cycles
- None detected.

## Communities (14 total, 3 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.16
Nodes (25): App(), CreateShiftModal(), CreateShiftModalProps, EditDayModal(), EditDayModalProps, EditWorkerModal(), EditWorkerModalProps, AsistenciasView() (+17 more)

### Community 1 - "package.json"
Cohesion: 0.11
Nodes (16): name, private, type, version, express, multer, oxlint, react (+8 more)

### Community 2 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 3 - "index.cjs"
Cohesion: 0.12
Nodes (12): cors, app, cleanupExpiredRules(), cors, db, express, formatDateKey(), multer (+4 more)

### Community 4 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 5 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, better-sqlite3, cors, express, multer, react, react-dom, xlsx

### Community 6 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, oxlint, @types/node, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react

### Community 7 - "database.cjs"
Cohesion: 0.29
Nodes (5): better-sqlite3, Database, db, dbPath, path

### Community 8 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 9 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, server

### Community 11 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **5 isolated node(s):** `@types/node`, `@types/react`, `@types/react-dom`, `oxlint`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 96 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `xlsx` connect `package.json` to `App.tsx`, `index.cjs`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **What connects `@types/node`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Why does `react` connect `package.json` to `App.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `index.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._