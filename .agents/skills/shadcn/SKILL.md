---
name: shadcn
description: >-
  Standardized instructions, guidelines, and component patterns for shadcn UI.
  Use when designing, building, or refactoring React/Next.js frontend components
  with consistent design tokens, accessible Radix primitives, and globals.css styling.
---

# shadcn UI Design System Skill

This skill governs the persistent design system for the frontend codebase using **shadcn UI** architecture.

## Core Tenets
1. **Single Source of Truth for Styling (`globals.css`)**:
   - All theme colors, border radii, card backgrounds, and semantic accents are defined exclusively via CSS variables in `src/app/globals.css`.
   - Never use arbitrary hardcoded hex codes across components. Use standard semantic utility classes:
     - Backgrounds: `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-accent`, `bg-secondary`
     - Foreground Text: `text-foreground`, `text-card-foreground`, `text-muted-foreground`, `text-primary-foreground`
     - Borders: `border-border`, `border-input`
     - Focus Rings: `ring-ring`
     - Radii: `rounded-lg`, `rounded-md`, `rounded-sm` (governed by `--radius`)

2. **Component Layering (`@/components/ui/*`)**:
   - All primitive UI components live in `src/components/ui/` (`button.tsx`, `card.tsx`, `badge.tsx`, `table.tsx`, `dialog.tsx`, `tabs.tsx`, `input.tsx`, etc.).
   - Use `class-variance-authority` (cva) for component variants.
   - Combine classes using the standard `cn()` utility from `@/lib/utils`.

3. **Persistent Layouts & Information Density**:
   - **Page Headers**: Distinct title (`text-2xl font-bold tracking-tight`), description (`text-sm text-muted-foreground`), and top-right primary actions.
   - **Cards**: Use `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, `<CardContent>`, `<CardFooter>`.
   - **Tables**: Use standard `<Table>`, `<TableHeader>`, `<TableRow>`, `<TableHead>`, `<TableBody>`, `<TableCell>`.
   - **Badges**: Use `<Badge variant="default | secondary | destructive | outline">`.

4. **Accessibility & Radix Primitives**:
   - All modals, dropdowns, and tabs must use Radix headless primitives wrapped with shadcn styling for keyboard accessibility and smooth transitions.
