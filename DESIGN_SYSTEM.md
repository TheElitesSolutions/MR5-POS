# MR5 POS Design System

## Overview

This document describes the design system for MR5 POS v2. The system is built on an **8-point grid** to ensure visual consistency, harmony, and predictable spacing throughout the application.

## Table of Contents

- [Design Principles](#design-principles)
- [Spacing System](#spacing-system)
- [Typography](#typography)
- [Colors](#colors)
- [Components](#components)
- [Layout Patterns](#layout-patterns)
- [Best Practices](#best-practices)

---

## Design Principles

### 1. **8-Point Grid System**
All spacing, sizing, and layout measurements use multiples of 8 pixels. This creates visual rhythm and makes design decisions faster.

### 2. **Semantic Design Tokens**
Use semantic color names (`text-destructive`, `bg-success`) instead of hard-coded values (`text-red-500`, `bg-green-600`). This ensures consistency and makes theme changes easier.

### 3. **No Nested Scrolling**
Each page should have ONE scrollable area (usually handled by the layout component). Avoid creating nested scroll containers which create poor UX.

### 4. **Mobile-First Responsive**
Design for mobile first, then enhance for larger screens. Use `dvh` instead of `vh` for viewport heights to fix Electron rendering issues.

### 5. **Accessibility First**
- Minimum 48px touch targets on mobile
- Proper color contrast ratios
- Semantic HTML structure
- ARIA labels where needed

---

## Spacing System

### 8-Point Grid Scale

All spacing uses the 8-point grid. The Tailwind config has been updated to align all spacing classes:

| Class | Pixels | Usage |
|-------|--------|-------|
| `gap-2`, `p-2`, `m-2`, `space-y-2` | 8px | Tight spacing, inline elements |
| `gap-3`, `p-3`, `m-3`, `space-y-3` | 16px | Default spacing between related elements |
| `gap-4`, `p-4`, `m-4`, `space-y-4` | 16px | Same as 3 (allows migration period) |
| `gap-6`, `p-6`, `m-6`, `space-y-6` | 24px | Section spacing, card padding |
| `gap-8`, `p-8`, `m-8`, `space-y-8` | 32px | Large section spacing |
| `gap-10`, `p-10` | 40px | Extra-large spacing |
| `gap-12`, `p-12` | 48px | Page-level spacing |
| `gap-16`, `p-16` | 64px | Hero sections, major divisions |

### Common Spacing Patterns

```tsx
// Card padding
<Card className="p-6">...</Card>

// Section spacing
<div className="space-y-6">...</div>

// Form fields
<div className="space-y-3">
  <Label>Field</Label>
  <Input />
</div>

// Page container
<div className="p-6 space-y-8">...</div>
```

---

## Typography

### Font Scale (Major Third Ratio - 1.250)

| Class | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 12px | 16px | Captions, metadata, helper text |
| `text-sm` | 14px | 20px | Labels, secondary text |
| `text-base` | 16px | 24px | **Body text (default)** |
| `text-lg` | 18px | 28px | Subheadings, emphasized text |
| `text-xl` | 20px | 28px | H4, card titles |
| `text-2xl` | 24px | 32px | H3, section headers |
| `text-3xl` | 30px | 36px | H2, page sub-titles |
| `text-4xl` | 36px | 40px | H1, page titles |

### Typography Best Practices

```tsx
// Page title
<h1 className="text-2xl font-bold">Dashboard</h1>

// Body text - use text-base (default)
<p className="text-base text-foreground">Content here...</p>

// Secondary text
<p className="text-sm text-muted-foreground">Helper text</p>

// Error messages - keep readable
<p className="text-sm text-destructive">Error message</p>

// Labels
<Label className="text-sm font-medium">Username</Label>
```

**Important:** `text-base` (16px) is the default body size. Only use `text-sm` for labels, captions, and secondary information.

---

## Colors

### Semantic Color System

Use semantic color tokens instead of hard-coded colors:

```tsx
// ✅ GOOD - Semantic tokens
<div className="bg-destructive text-destructive-foreground">Error</div>
<div className="bg-success text-success-foreground">Success</div>
<Button variant="destructive">Delete</Button>

// ❌ BAD - Hard-coded colors
<div className="bg-red-500 text-white">Error</div>
<div className="bg-green-600 text-white">Success</div>
```

### Available Semantic Colors

- **Primary**: Main brand color
- **Secondary**: Secondary brand color
- **Destructive**: Error states, dangerous actions
- **Success**: Success states, completed actions
- **Warning**: Warning states, caution needed
- **Info**: Informational messages
- **Muted**: Disabled or subtle elements
- **Accent**: Highlights, hover states

Each color has a foreground variant:
```tsx
<div className="bg-primary text-primary-foreground">...</div>
```

---

## Components

### Button

Buttons now align to the 8-point grid:

| Size | Height | Padding | Usage |
|------|--------|---------|-------|
| `sm` | 32px (h-8) | px-3 | Compact actions, inline buttons |
| `default` | 40px (h-10) | px-4 | Standard buttons |
| `lg` | 48px (h-12) | px-8 | Primary CTAs, hero buttons |
| `icon` | 40px (h-10 w-10) | - | Icon-only buttons |

```tsx
<Button size="sm">Small</Button>
<Button>Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Input

Input fields are standardized at 40px height to match button defaults:

```tsx
<Input className="h-10" placeholder="Enter text..." />
```

### Card

Cards use consistent padding and spacing:

```tsx
<Card>
  <CardHeader className="space-y-2 p-6">
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent className="p-6 pt-0">
    Content
  </CardContent>
</Card>
```

### Dialog

Dialogs use `dvh` instead of `vh` for proper Electron rendering:

```tsx
<DialogContent className="max-h-[90dvh] max-w-dialog-md overflow-y-auto">
  <DialogHeader className="space-y-2">
    <DialogTitle>Title</DialogTitle>
  </DialogHeader>
  Content
</DialogContent>
```

**Max-Width Tokens:**
- `max-w-dialog-sm`: 400px - Small dialogs
- `max-w-dialog-md`: 600px - Medium dialogs (default)
- `max-w-dialog-lg`: 800px - Large dialogs
- `max-w-form`: 600px - Form containers
- `max-w-prose`: 768px - Text content
- `max-w-page`: 1280px - Page containers

---

## Layout Patterns

### Layout Primitives

Use the provided layout components to enforce the design system:

```tsx
import {
  PageContainer,
  PageHeader,
  PageContent,
  PageSection,
  Grid,
  Flex,
  Stack
} from '@/components/layout';

export default function MyPage() {
  return (
    <POSLayout>
      <PageContainer>
        <PageHeader withBorder>
          <h1 className="text-2xl font-bold">Page Title</h1>
          <p className="text-sm text-muted-foreground">Description</p>
        </PageHeader>

        <PageContent>
          <PageSection
            title="Section Title"
            description="Section description"
            action={<Button>Action</Button>}
          >
            <Card>Content</Card>
          </PageSection>
        </PageContent>
      </PageContainer>
    </POSLayout>
  );
}
```

### Grid Layouts

```tsx
// Responsive 3-column grid
<Grid cols={3} gap={6} responsive>
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</Grid>

// Fixed 2-column grid
<Grid cols={2} gap={4} responsive={false}>
  <Card>Item 1</Card>
  <Card>Item 2</Card>
</Grid>
```

### Flex Layouts

```tsx
// Horizontal flex with space-between
<Flex direction="row" justify="between" align="center" gap={4}>
  <h2>Title</h2>
  <Button>Action</Button>
</Flex>

// Vertical stack
<Stack spacing={6} divider>
  <Card>Item 1</Card>
  <Card>Item 2</Card>
</Stack>
```

---

## Best Practices

### ✅ DO

1. **Use semantic color tokens**
   ```tsx
   <div className="bg-destructive text-destructive-foreground">Error</div>
   ```

2. **Use layout primitives**
   ```tsx
   <PageContainer>
     <PageHeader withBorder>...</PageHeader>
     <PageContent>...</PageContent>
   </PageContainer>
   ```

3. **Use 8pt-aligned spacing**
   ```tsx
   <div className="space-y-6 p-6">...</div>
   ```

4. **Use dvh for viewport heights**
   ```tsx
   <DialogContent className="max-h-[90dvh]">...</DialogContent>
   ```

5. **Use text-base for body text**
   ```tsx
   <p className="text-base">Regular paragraph text</p>
   ```

### ❌ DON'T

1. **Hard-code colors**
   ```tsx
   // ❌ BAD
   <div className="bg-red-500 text-white">Error</div>

   // ✅ GOOD
   <div className="bg-destructive text-destructive-foreground">Error</div>
   ```

2. **Create nested scrolling**
   ```tsx
   // ❌ BAD - Triple nested scrolling
   <div className="overflow-y-auto">
     <div className="h-full overflow-y-auto">
       <div className="overflow-auto">...</div>
     </div>
   </div>

   // ✅ GOOD - Single scroll handled by layout
   <POSLayout>
     <PageContainer>
       <Card>Content scrolls naturally</Card>
     </PageContainer>
   </POSLayout>
   ```

3. **Use arbitrary spacing values**
   ```tsx
   // ❌ BAD
   <div className="gap-[18px] p-[23px]">...</div>

   // ✅ GOOD
   <div className="gap-4 p-6">...</div>
   ```

4. **Use vh in Electron**
   ```tsx
   // ❌ BAD - 28px discrepancy in Electron
   <DialogContent className="max-h-[90vh]">...</DialogContent>

   // ✅ GOOD - Uses dynamic viewport height
   <DialogContent className="max-h-[90dvh]">...</DialogContent>
   ```

5. **Use text-sm for body text**
   ```tsx
   // ❌ BAD - Too small for body text
   <p className="text-sm">This is a paragraph...</p>

   // ✅ GOOD - Readable body text
   <p className="text-base">This is a paragraph...</p>
   ```

---

## Migration Guide

### Updating Existing Pages

1. **Replace hard-coded colors with semantic tokens**
2. **Remove nested scrolling containers**
3. **Update spacing to 8pt-aligned values**
4. **Use layout primitives for new pages**
5. **Replace vh with dvh in dialogs**

### Example Migration

**Before:**
```tsx
export default function OldPage() {
  return (
    <POSLayout>
      <div className="border-b border-gray-200">
        <div className="space-y-4 p-3 sm:p-4">
          <h1 className="text-xl font-bold text-gray-900">Title</h1>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="space-y-3 p-3 sm:p-4">
            <Card className="border-red-200 bg-red-50">
              <p className="text-sm text-red-600">Error</p>
            </Card>
          </div>
        </div>
      </div>
    </POSLayout>
  );
}
```

**After:**
```tsx
import { PageContainer, PageHeader, PageContent } from '@/components/layout';

export default function NewPage() {
  return (
    <POSLayout>
      <PageContainer>
        <PageHeader withBorder>
          <h1 className="text-2xl font-bold">Title</h1>
        </PageHeader>
        <PageContent>
          <Card className="border-destructive/20 bg-destructive/10">
            <p className="text-base text-destructive">Error</p>
          </Card>
        </PageContent>
      </PageContainer>
    </POSLayout>
  );
}
```

---

## Resources

- **Tailwind Config**: `renderer/tailwind.config.js`
- **Layout Components**: `renderer/components/layout/`
- **UI Components**: `renderer/components/ui/`
- **Design Tokens**: Defined in Tailwind config under `theme.extend`

---

## Questions?

For questions or clarifications about the design system, refer to this document or check the implementation in:
- Layout primitives: `renderer/components/layout/`
- Modified pages: `renderer/app/(auth)/dashboard/`, `menu/`, `stock/`
- Auth pages: `renderer/app/(public)/login/`, `register/`
