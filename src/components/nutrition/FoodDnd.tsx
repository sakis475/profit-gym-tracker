import { useMemo } from 'react'
import { InputAdornment, Paper, TextField } from '@mui/material'
import { useDroppable } from '@dnd-kit/core'
import { formatNutrient, quantityUnitLabel, unitPer } from '../../lib/nutrition'
import type { FoodRow } from '../../types/entityTypes'
import { WithDragSidebar, type SidebarItem } from '../DragSidebar'

// Drag and drop of foods onto meals, shared by the meal plan and the food diary.
// Each of them supplies the DndContext and decides what a drop does.

// A food dragged from the list
export type FoodDragData = { kind: 'food'; food: FoodRow }

// The food list on the left of `children`, or nothing but `children` on a narrow screen
export function WithFoodSidebar({ foods, children }: { foods: FoodRow[]; children: React.ReactNode }) {
    const items = useMemo<SidebarItem[]>(
        () => foods.map((food) => ({
            dragId: `food:${food.id}`,
            name: food.name,
            detail: `per ${unitPer(food.unit)} · ${formatNutrient(food.kcal, 'kcal')} kcal · P ${formatNutrient(food.protein, 'protein')} g`,
            data: { kind: 'food', food } satisfies FoodDragData,
        })),
        [foods]
    )

    return (
        <WithDragSidebar title="Foods: drag onto a meal" items={items} emptyText="No foods yet. Add them in the Foods tab.">
            {children}
        </WithDragSidebar>
    )
}

// A meal's card that takes drops; the drop's `over.data.current.mealId` says which meal
export function MealDropZone({ mealId, dragging, children }: { mealId: string; dragging: boolean; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: `meal:${mealId}`, data: { mealId } })

    return (
        <Paper
            ref={setNodeRef}
            variant="outlined"
            sx={{
                p: 2,
                transition: 'border-color 120ms, background-color 120ms',
                // While dragging every meal shows it takes drops, the one under the pointer stands out
                borderStyle: dragging ? 'dashed' : 'solid',
                ...(isOver && { borderColor: 'primary.main', borderStyle: 'solid', bgcolor: 'action.hover' }),
            }}
        >
            {children}
        </Paper>
    )
}

// An amount edited in place: Enter or leaving the field commits it, Escape puts the old one back
export function QuantityInput({
    value,
    unit,
    label,
    autoFocus,
    disabled,
    error,
    faded,
    onChange,
    onCommit,
    onCancel,
}: {
    value: string
    unit: string
    label: string
    autoFocus?: boolean
    disabled?: boolean
    error?: boolean
    // For an amount that is only planned, not logged yet
    faded?: boolean
    onChange: (value: string) => void
    onCommit: () => void
    onCancel: () => void
}) {
    return (
        <TextField
            size="small"
            type="number"
            value={value}
            autoFocus={autoFocus}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') onCancel()
            }}
            disabled={disabled}
            error={error}
            inputProps={{ min: 0, step: 'any', inputMode: 'decimal', 'aria-label': label }}
            InputProps={{ endAdornment: <InputAdornment position="end">{quantityUnitLabel(unit)}</InputAdornment> }}
            sx={{ width: 120, flexShrink: 0, ...(faded && { '& input': { color: 'text.secondary' } }) }}
        />
    )
}
