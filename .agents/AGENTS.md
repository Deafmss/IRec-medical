# iRec Development Rules & Guidelines

This document contains Workspace-specific instructions and behavioral constraints that all AI coding assistants must strictly follow.

## 🩺 Absolute Clinical Truth & Patient Transparency

1. **Explicit Simulation Disclaimers:**
   - The system must **NEVER** display simulated clinical data, diagnostic conclusions, or sensor readings to patients or healthcare professionals without explicitly stating that they are simulated, educational, or for demonstration purposes.
   - Any telemetry, mock sensor values, or test data must carry clear, visible disclaimers in the user interface.

2. **No Misleading UI Placeholders:**
   - Avoid placeholders that look like actual clinical calculations.
   - Maintain 100% honesty about system status (e.g., if the Gemini AI API is offline or not configured, show clear errors instead of silently rendering mock diagnostic reports).

3. **Interoperability and Standards Integrity:**
   - Maintain strict conformance with clinical models (e.g., FHIR formatting in exports, authentic CID-10 coding) and do not introduce fake or invalid codes in patient records.

---

## 🐛 Known Defect Backlog — READ THIS BEFORE WRITING CODE

A full page-by-page audit of this codebase (50 source files, ~35,000 lines) catalogued **588 defects**. They are documented in `.agents/bugs/`:

- **`.agents/bugs/INDEX.md`** — working rules, confidence labels, and the execution order of the 19 modules. **Read this first.**
- **`.agents/bugs/STATUS.md`** — progress checklist. Update it as you go.
- **`.agents/bugs/NN-*.md`** — one file per module, each with the defect, its location, the failure scenario, the offending code, and a suggested fix.

**Mandatory when working on this repository:**

1. Before modifying any file, check whether it already has open defects listed in `.agents/bugs/`. Fixing a known defect while you are already in that file is cheaper than a separate pass.
2. Never introduce a new defect of a kind already catalogued — especially fabricated clinical data, which violates the Clinical Truth rules above. Roughly 99 of the 588 defects are violations of those very rules.
3. Work one module per session. One commit per defect, with the ID in the message: `fix(IREC-0042): ...`.
4. Do not mark an item done in `STATUS.md` without evidence. Paste the command output.

## ✅ Runtime Error Gate

`npm run lint:ci` fails the build on ESLint rules that indicate a guaranteed runtime defect (`no-undef`, `no-duplicate-case`, `react-hooks/rules-of-hooks`, and others listed in `scripts/ci-lint-gate.mjs`). It runs in CI before the build.

`vite build` does **not** catch these — it does not resolve identifiers at compile time. That is precisely how three `ReferenceError`s reached production. Run `npm run lint:ci` locally before opening a PR.
