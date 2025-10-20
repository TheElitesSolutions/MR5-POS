# Design System Quick Start

Quick reference for the MR5 POS Design System. For full documentation, see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

## Quick Reference

### Spacing (8-Point Grid)

```tsx
// Tight spacing (8px)
<div className="gap-2 p-2 space-y-2">

// Default spacing (16px)
<div className="gap-3 p-3 space-y-3">  // or gap-4, p-4, space-y-4

// Section spacing (24px)
<div className="gap-6 p-6 space-y-6">

// Large spacing (32px)
<div className="gap-8 p-8 space-y-8">
```

### Typography

```tsx
// Page title
<h1 className="text-2xl font-bold">Title</h1>

// Section heading
<h2 className="text-lg font-semibold">Section</h2>

// Body text (DEFAULT)
<p className="text-base">Regular text</p>

// Label
<Label className="text-sm font-medium">Field</Label>

// Helper text
<p className="text-sm text-muted-foreground">Help</p>

// Caption
<span className="text-xs text-muted-foreground">Caption</span>
```

### Colors

```tsx
// Semantic colors (USE THESE!)
<div className="bg-destructive text-destructive-foreground">Error</div>
<div className="bg-success text-success-foreground">Success</div>
<div className="bg-warning text-warning-foreground">Warning</div>
<div className="text-muted-foreground">Muted text</div>

// DON'T use hard-coded colors
// ❌ className="bg-red-500 text-white"
// ❌ className="text-green-600"
```

### Layout Components

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

// Standard page structure
<POSLayout>
  <PageContainer>
    <PageHeader withBorder>
      <h1 className="text-2xl font-bold">Page Title</h1>
      <p className="text-sm text-muted-foreground">Description</p>
    </PageHeader>

    <PageContent>
      <PageSection title="Section" action={<Button>Action</Button>}>
        <Card>Content</Card>
      </PageSection>
    </PageContent>
  </PageContainer>
</POSLayout>

// Grid layout
<Grid cols={3} gap={6} responsive>
  <Card>Item</Card>
</Grid>

// Flex layout
<Flex direction="row" justify="between" align="center" gap={4}>
  <span>Left</span>
  <Button>Right</Button>
</Flex>

// Vertical stack
<Stack spacing={6}>
  <Card>Item 1</Card>
  <Card>Item 2</Card>
</Stack>
```

### Components

```tsx
// Button sizes (all 8pt-aligned)
<Button size="sm">Small (32px)</Button>
<Button>Default (40px)</Button>
<Button size="lg">Large (48px)</Button>
<Button size="icon"><Icon /></Button>

// Input (matches button height)
<Input className="h-10" />  // 40px

// Card
<Card className="p-6">  // 24px padding
  <CardHeader className="space-y-2">
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Dialog (use dvh, not vh!)
<DialogContent className="max-h-[90dvh] max-w-dialog-md">
  <DialogHeader className="space-y-2">
    <DialogTitle>Title</DialogTitle>
  </DialogHeader>
  Content
</DialogContent>
```

## Common Patterns

### Form Layout

```tsx
<form className="space-y-6">
  <div className="space-y-3">
    <Label htmlFor="username">Username</Label>
    <Input
      id="username"
      className={errors.username ? 'border-destructive' : ''}
    />
    {errors.username && (
      <p className="text-sm text-destructive">
        {errors.username.message}
      </p>
    )}
  </div>

  <div className="space-y-3">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" />
  </div>

  <Button className="w-full" type="submit">
    Submit
  </Button>
</form>
```

### Error Display

```tsx
// Error alert
<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
  <div className="flex items-center space-x-3">
    <AlertCircle className="h-5 w-5 text-destructive" />
    <span className="font-medium text-destructive">Error occurred</span>
  </div>
  <p className="mt-3 text-sm text-destructive">Error details here</p>
</div>

// Success alert
<div className="rounded-lg border border-success/20 bg-success/10 p-4">
  <p className="text-success">Success message</p>
</div>
```

### Header with Actions

```tsx
<Flex direction="row" justify="between" align="center" className="border-b pb-6">
  <div>
    <h1 className="text-2xl font-bold">Page Title</h1>
    <p className="text-sm text-muted-foreground">Description</p>
  </div>
  <Flex gap={3}>
    <Button variant="outline">Secondary</Button>
    <Button>Primary</Button>
  </Flex>
</Flex>
```

### Stats Grid

```tsx
<Grid cols={4} gap={6} responsive>
  <Card className="p-6">
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        Total Sales
      </p>
      <p className="text-3xl font-bold">$12,345</p>
      <p className="text-xs text-success">+12.3% from last month</p>
    </div>
  </Card>
  {/* More stat cards */}
</Grid>
```

## Don'ts

### ❌ Avoid Nested Scrolling

```tsx
// ❌ BAD - Nested scrolling
<div className="overflow-y-auto">
  <div className="h-full overflow-y-auto">
    Content
  </div>
</div>

// ✅ GOOD - Single scroll area
<POSLayout>
  <PageContainer>
    <Card>Content scrolls naturally</Card>
  </PageContainer>
</POSLayout>
```

### ❌ Don't Use Hard-Coded Colors

```tsx
// ❌ BAD
<div className="bg-red-500 text-white">Error</div>
<Button className="bg-green-600 hover:bg-green-700">Success</Button>

// ✅ GOOD
<div className="bg-destructive text-destructive-foreground">Error</div>
<Button variant="default" className="bg-success hover:bg-success/90">Success</Button>
```

### ❌ Don't Use Arbitrary Values

```tsx
// ❌ BAD
<div className="gap-[18px] p-[23px] mb-[37px]">

// ✅ GOOD
<div className="gap-4 p-6 mb-8">
```

### ❌ Don't Use vh in Electron

```tsx
// ❌ BAD - Has 28px discrepancy in Electron
<DialogContent className="max-h-[90vh]">

// ✅ GOOD - Uses dynamic viewport height
<DialogContent className="max-h-[90dvh]">
```

### ❌ Don't Use text-sm for Body Text

```tsx
// ❌ BAD - Too small for reading
<p className="text-sm">This is a long paragraph of text...</p>

// ✅ GOOD - Readable size
<p className="text-base">This is a long paragraph of text...</p>

// ✅ OK - For labels and captions
<Label className="text-sm">Field Label</Label>
<span className="text-sm text-muted-foreground">Helper text</span>
```

## Max-Width Tokens

```tsx
// Form containers
<div className="max-w-form">  // 600px

// Dialog sizes
<DialogContent className="max-w-dialog-sm">  // 400px
<DialogContent className="max-w-dialog-md">  // 600px
<DialogContent className="max-w-dialog-lg">  // 800px

// Text content
<div className="max-w-prose">  // 768px

// Page content
<div className="max-w-page">  // 1280px
```

## Responsive Breakpoints

```tsx
// Mobile-first approach
<div className="
  grid
  grid-cols-1           // Mobile: 1 column
  sm:grid-cols-2        // Small: 2 columns (640px+)
  lg:grid-cols-3        // Large: 3 columns (1024px+)
  gap-6
">
  <Card>Item</Card>
</div>

// Hide/show based on breakpoint
<div className="hidden lg:block">Desktop only</div>
<div className="block lg:hidden">Mobile only</div>
```

## Need Help?

- Full docs: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- Layout components: `renderer/components/layout/`
- UI components: `renderer/components/ui/`
- Example pages: `renderer/app/(auth)/dashboard/`, `menu/`, `stock/`
