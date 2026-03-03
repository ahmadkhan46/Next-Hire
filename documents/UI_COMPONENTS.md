# UI Components & Styling Guide

## Design System

### Color Palette

**Primary Colors**:
- Blue: `#3b82f6` (buttons, links)
- Green: `#10b981` (success states)
- Red: `#ef4444` (destructive actions)
- Gray: `#6b7280` (text, borders)

**Background Colors**:
- White: `#ffffff` (cards, dialogs)
- Light Gray: `#f9fafb` (page background)
- Dark Gray: `#1f2937` (headers)

### Border Radius

- **rounded-3xl** - Dialogs, modals (24px)
- **rounded-2xl** - Inputs, buttons (16px)
- **rounded-xl** - Cards (12px)
- **rounded-lg** - Small elements (8px)

### Spacing

- **p-6** - Dialog padding (24px)
- **p-4** - Card padding (16px)
- **gap-4** - Form field spacing (16px)
- **gap-2** - Button group spacing (8px)

## Component Classes

### Premium Block

```css
.premium-block {
  @apply bg-white rounded-xl shadow-sm border border-gray-200 p-6;
}
```

**Usage**: Main content containers, cards

### Premium Subblock

```css
.premium-subblock {
  @apply bg-gray-50 rounded-lg border border-gray-200 p-4;
}
```

**Usage**: Nested sections within blocks

### Form Input

```css
.form-input {
  @apply w-full px-4 py-2 border border-gray-300 rounded-2xl 
         focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}
```

### Button Variants

**Primary**:
```css
.btn-primary {
  @apply px-4 py-2 bg-blue-600 text-white rounded-2xl 
         hover:bg-blue-700 transition-colors;
}
```

**Secondary**:
```css
.btn-secondary {
  @apply px-4 py-2 bg-gray-200 text-gray-700 rounded-2xl 
         hover:bg-gray-300 transition-colors;
}
```

**Destructive**:
```css
.btn-destructive {
  @apply px-4 py-2 bg-red-600 text-white rounded-2xl 
         hover:bg-red-700 transition-colors;
}
```

## Key Components

### AddCandidateMultiStep

**Location**: `src/components/add-candidate-multi-step.tsx`

**Features**:
- 5-step wizard with progress bar
- State management for all fields
- Add/delete functionality for arrays
- Single transaction at finish
- Validation per step

**Usage**:
```tsx
<AddCandidateMultiStep 
  orgId={orgId}
  onSuccess={() => router.refresh()}
/>
```

### EditCandidateEnhanced

**Location**: `src/components/edit-candidate-enhanced.tsx`

**Features**:
- Tabbed interface (5 tabs)
- Separate API calls per block
- Add/edit/delete for each section
- Real-time updates

**Usage**:
```tsx
<EditCandidateEnhanced 
  candidate={candidate}
  orgId={orgId}
  onUpdate={() => router.refresh()}
/>
```

### CandidateActions

**Location**: `src/app/orgs/[orgId]/candidates/[candidateId]/candidate-actions.tsx`

**Features**:
- Edit button with dialog
- Delete button with confirmation
- Permission-based visibility

### ResumeUploader

**Location**: `src/components/resume-uploader.tsx`

**Features**:
- Drag & drop file upload
- PDF/DOCX support
- Parse button with loading state
- Name mismatch detection

## Dialog Pattern

### Standard Dialog

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-4xl rounded-3xl">
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* Content */}
    </div>
    
    <DialogFooter>
      <Button variant="secondary" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>
        Save
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Confirmation Dialog

```tsx
<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogContent className="rounded-3xl">
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel className="rounded-2xl">
        Cancel
      </AlertDialogCancel>
      <AlertDialogAction 
        className="rounded-2xl bg-red-600 hover:bg-red-700"
        onClick={handleConfirm}
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Form Pattern

### Multi-Field Form

```tsx
<form onSubmit={handleSubmit} className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Field Label
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-2xl 
                 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      required
    />
  </div>
  
  <div className="flex justify-end gap-2">
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-2xl 
                 hover:bg-gray-300"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="px-4 py-2 bg-blue-600 text-white rounded-2xl 
                 hover:bg-blue-700"
    >
      Save
    </button>
  </div>
</form>
```

## List Pattern

### Item List with Actions

```tsx
<div className="space-y-3">
  {items.map((item) => (
    <div 
      key={item.id}
      className="bg-gray-50 rounded-lg border border-gray-200 p-4"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{item.title}</h4>
          <p className="text-sm text-gray-600">{item.description}</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(item)}
            className="text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            className="text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  ))}
</div>
```

## Progress Bar

```tsx
<div className="w-full bg-gray-200 rounded-full h-2">
  <div
    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
  />
</div>
```

## Loading States

### Button Loading

```tsx
<button
  disabled={loading}
  className="px-4 py-2 bg-blue-600 text-white rounded-2xl 
             hover:bg-blue-700 disabled:opacity-50"
>
  {loading ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
      Loading...
    </>
  ) : (
    'Submit'
  )}
</button>
```

### Skeleton Loader

```tsx
<div className="animate-pulse space-y-4">
  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
</div>
```

## Icons

Using Lucide React icons:

```tsx
import { 
  User, Briefcase, GraduationCap, Code, 
  FolderKanban, Plus, Trash2, Edit, 
  Loader2, Check, X, AlertCircle 
} from 'lucide-react'
```

**Common Usage**:
- User - Personal info
- Briefcase - Experience
- GraduationCap - Education
- Code - Technologies
- FolderKanban - Projects
- Plus - Add actions
- Trash2 - Delete actions
- Edit - Edit actions
- Loader2 - Loading states
- Check - Success states
- X - Close/Cancel
- AlertCircle - Warnings

## Responsive Design

### Mobile First

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards */}
</div>
```

### Breakpoints

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

## Accessibility

### Form Labels

Always include labels for inputs:
```tsx
<label htmlFor="email" className="block text-sm font-medium">
  Email
</label>
<input id="email" type="email" />
```

### Button States

```tsx
<button
  disabled={disabled}
  aria-label="Delete candidate"
  className="..."
>
  Delete
</button>
```

### Focus States

All interactive elements have focus states:
```css
focus:ring-2 focus:ring-blue-500 focus:outline-none
```

## Best Practices

1. **Consistent Spacing** - Use Tailwind spacing scale (4px increments)
2. **Rounded Corners** - Use rounded-2xl for inputs/buttons, rounded-3xl for dialogs
3. **Color Usage** - Blue for primary, red for destructive, gray for neutral
4. **Loading States** - Always show loading indicators for async actions
5. **Error Handling** - Display clear error messages with AlertCircle icon
6. **Confirmation** - Use AlertDialog for destructive actions
7. **Responsive** - Test on mobile, tablet, desktop
8. **Accessibility** - Include labels, ARIA attributes, focus states
