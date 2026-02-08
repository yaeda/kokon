# AGENTS.md

This document is a guide for Agents / Contributors working on this repository.
This project is implemented as a Single Page Application (SPA) using TypeScript.

## 1. Project Overview

- TypeScript / React / Vite / Vitest / Tailwind CSS
- Built as an SPA

## 2. Specification Management

- The single source of truth for specifications is `docs/SPEC.md`
- Any change that affects specifications must update `docs/SPEC.md` together with the implementation
- Divergence between implementation and specification is not allowed

## 3. Coding Guidelines

- Adopt a functional programming pattern
- Keep side effects at the boundaries and minimize state
- Prioritize type safety
  - `any` is prohibited in principle
  - Use `import type` for type-only imports

## 4. Lint / Formatter

- Use **ESLint**
  - Enable TypeScript, React, React Hooks, and accessibility (a11y) linting
- Use **Prettier**
  - Formatting results are authoritative and not subject to discussion
- Tailwind CSS class order must be handled by automatic formatting
- Commits or merges with lint errors are not allowed

## 5. Development Flow

- Develop using feature-based branches and separate PRs per feature
- Principle: 1 PR = 1 purpose
- If a change includes a specification update, `docs/SPEC.md` must be updated in the same PR

## 6. Commit Messages

- Follow **Conventional Commits**
- Format: `<type>(<scope>): <subject>`

## 7. Notes

- Keep dependencies up to date whenever reasonably possible
- This document and `docs/SPEC.md` should be updated as the project evolves
