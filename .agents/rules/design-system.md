---
description: Enforce persistent shadcn UI design system, globals.css tokens, and component reusability.
trigger: always_on
---

# Design System Rules (shadcn UI)

When authoring or modifying any frontend components in `smit-assets-frontend`:

1. **Globals.css is the CSS Single Source of Truth**:
   - Every color, surface, and border must map to CSS variables in `src/app/globals.css`.
   - Use semantic Tailwind classes: `bg-background`, `bg-card`, `text-card-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`.
   - Never write disconnected custom color themes or ad-hoc boxes.

2. **Primitive Reuse**:
   - Always import primitives from `@/components/ui/` (`Button`, `Card`, `Badge`, `Table`, `Dialog`, `Input`, `Tabs`).
   - Use `cn()` from `@/lib/utils` for merging class names.

3. **High Information Density & Visual Polish**:
   - Use crisp borders (`border-border/60`), subtle drop shadows (`shadow-xs` / `shadow-sm`), and consistent padding.
   - Clean badges for statuses, active filters, and unit counts.
   - Professional typography with `font-heading` for headers and `font-mono` for IDs and asset tags.
