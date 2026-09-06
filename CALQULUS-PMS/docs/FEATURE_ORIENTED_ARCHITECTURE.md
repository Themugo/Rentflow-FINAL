# Feature-Oriented Architecture Guide

This document describes the feature-oriented architecture pattern used in the CALQULUS RMS application.

## Overview

The application follows a feature-oriented architecture that separates concerns across several layers:

```
features/
├── feature-name/
│   ├── pages/              # Page components (route-level)
│   │   ├── FeaturePage.tsx         # Route entry point (thin wrapper)
│   │   └── FeatureContainer.tsx    # Container component (state/logic)
│   ├── components/        # Presentation components
│   │   ├── FeatureHeader.tsx       # Header with filters
│   │   ├── FeatureTable.tsx       # Data table
│   │   └── FeatureCard.tsx        # Card components
│   ├── dialogs/            # Reusable dialogs
│   │   ├── CreateDialog.tsx       # Create form dialog
│   │   ├── EditDialog.tsx         # Edit form dialog
│   │   └── ConfirmDialog.tsx      # Confirmation dialog
│   ├── hooks/              # Custom React hooks
│   │   ├── useFeatureData.ts     # Data fetching (React Query)
│   │   └── useFeatureUI.ts        # UI state management
│   ├── services/           # Business logic & API calls
│   │   └── feature.service.ts     # Service layer
│   └── types/               # Feature-specific types
│       └── feature.types.ts       # TypeScript interfaces
```

## Component Types

### 1. Container Components (FeatureContainer.tsx)

Container components are responsible for:
- Managing application state
- Handling business logic
- Coordinating data fetching
- Passing props to presentation components

```tsx
export function FeatureContainer() {
  // Data fetching
  const { data, isLoading, refetch } = useFeatureData();
  
  // UI state
  const {
    filters,
    selection,
    dialogs,
    updateFilter,
    toggleSelection,
    openDialog,
    closeDialog,
  } = useFeatureUI();
  
  // Business logic handlers
  const handleCreate = async (data: CreateData) => {
    await createFeature(data);
    refetch();
  };
  
  // Render presentation components
  return (
    <div>
      <FeatureHeader ... />
      <FeatureTable ... />
      <CreateDialog ... />
    </div>
  );
}
```

### 2. Presentation Components (components/*.tsx)

Presentation components are pure UI components that:
- Receive data and callbacks as props
- Have no direct data fetching
- Focus on rendering and user interaction
- Are easily testable

```tsx
interface FeatureTableProps {
  data: Feature[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onView: (item: Feature) => void;
  onEdit: (item: Feature) => void;
}

export function FeatureTable({
  data,
  isLoading,
  selectedIds,
  onToggleSelect,
  onView,
  onEdit,
}: FeatureTableProps) {
  // Pure rendering logic
  return (
    <Table>
      {data.map(item => (
        <TableRow key={item.id}>
          <TableCell>
            <Checkbox 
              checked={selectedIds.has(item.id)}
              onCheckedChange={() => onToggleSelect(item.id)}
            />
          </TableCell>
          {/* ... */}
        </TableRow>
      ))}
    </Table>
  );
}
```

### 3. Custom Hooks

#### useFeatureData.ts
Handles data fetching with React Query:
- Query key management
- Data fetching functions
- Mutations for CRUD operations
- Cache invalidation

```tsx
export function useFeatureData() {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['features'],
    queryFn: fetchFeatures,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const createMutation = useMutation({
    mutationFn: createFeature,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });
  
  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    refetch: () => query.refetch(),
    create: createMutation.mutateAsync,
  };
}
```

#### useFeatureUI.ts
Manages UI state without business logic:
- Filter state
- Selection state
- Dialog open/close state
- Form state

```tsx
export function useFeatureUI(initialFilters?: FilterState) {
  const [filters, setFilters] = useState(initialFilters ?? defaultFilters);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [dialogs, setDialogs] = useState({ /* ... */ });
  
  const toggleSelection = useCallback((id: string) => {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  
  return {
    filters,
    selection,
    dialogs,
    toggleSelection,
    // ...
  };
}
```

### 4. Service Layer (services/*.ts)

Service files contain:
- API calls to Supabase
- Data transformations
- Business logic helpers
- Type definitions

```tsx
// services/feature.service.ts
export async function fetchFeatures() {
  const { data, error } = await supabase
    .from('features')
    .select('*, relations(*)')
    .order('created_at', { ascending: false });
  
  if (error) {
    logError('fetchFeatures', error);
    throw error;
  }
  
  return data;
}

export async function createFeature(payload: CreatePayload) {
  const { data, error } = await supabase
    .from('features')
    .insert(payload)
    .select()
    .single();
  
  if (error) {
    logError('createFeature', error);
    throw error;
  }
  
  return data;
}
```

### 5. Dialog Components (dialogs/*.tsx)

Dialogs are reusable modal components:
-封装表单逻辑
- Handle validation
- Call parent callbacks on success
- Manage loading and error states

```tsx
interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createFeature(formData);
      onOpenChange(false);
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Form fields */}
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Benefits

1. **Separation of Concerns**: Each layer has a clear responsibility
2. **Testability**: Presentation components can be easily unit tested
3. **Reusability**: Dialogs and hooks can be shared across features
4. **Maintainability**: Changes to one layer don't affect others
5. **Performance**: React.memo can be applied to pure components

## Refactoring Guidelines

When refactoring a large component (e.g., 500+ lines):

1. **Identify the component type** - Is it a page, container, or presentation?
2. **Extract services** - Move API calls to service files
3. **Create hooks** - Extract stateful logic to custom hooks
4. **Build presentation components** - Create pure UI components
5. **Create dialogs** - Extract reusable dialogs
6. **Wire it together** - Container component orchestrates everything

## Example: Refactoring Contracts.tsx

Before (1638 lines):
- Inline state management
- Mixed business logic and UI
- No separation of concerns

After:
- `ContractsContainer.tsx` - ~200 lines (state/logic)
- `useContractsUI.ts` - ~150 lines (UI state)
- `useContractsData.ts` - ~220 lines (data fetching)
- `contracts.service.ts` - ~180 lines (API calls)
- `ContractsHeader.tsx` - ~100 lines (presentation)
- `CreateContractDialog.tsx` - ~200 lines (dialog)
- `Contracts.tsx` - ~15 lines (export only)

## Naming Conventions

| Type | Suffix | Example |
|------|--------|---------|
| Page | Page.tsx | Leases.tsx |
| Container | Container.tsx | LeasesContainer.tsx |
| Hook | useName.ts | useLeasesData.ts |
| Service | .service.ts | leases.service.ts |
| Dialog | Dialog.tsx | CreateLeaseDialog.tsx |
| Component | .tsx | LeaseCard.tsx |

## Migration Checklist

When migrating a feature:

- [ ] Create `services/` directory with `.service.ts` file
- [ ] Create `hooks/` with `useFeatureUI.ts` and `useFeatureData.ts`
- [ ] Create `dialogs/` with reusable dialog components
- [ ] Create `components/` with presentation components
- [ ] Create `FeatureContainer.tsx` in `pages/`
- [ ] Update `Feature.tsx` to export container
- [ ] Run tests to verify feature parity
- [ ] Run typecheck to verify TypeScript
- [ ] Run lint to verify code style
