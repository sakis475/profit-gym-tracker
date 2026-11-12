import { useMemo } from 'react'
import { Box, Button, Collapse, InputAdornment, Paper, TextField, Typography } from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { useDroppable } from '@dnd-kit/core'
import {
    contentsNutrients,
    formatNutrient,
    quantityUnitLabel,
    unitPer,
    type FoodContent,
    type Nutrients,
} from '../../lib/nutrition'
import type { FoodRow } from '../../types/entityTypes'
import { WithDragSidebar, type SidebarItem } from '../DragSidebar'
import { useT } from '../../i18n'

// Drag and drop of foods onto meals, shared by the meal plan and the food diary.
// Each of them supplies the DndContext and decides what a drop does.

// A food dragged from the list
export type FoodDragData = { kind: 'food'; food: FoodRow }

// The food list on the left of `children`, or nothing but `children` on a narrow screen
export function WithFoodSidebar({
    foods,
    contents,
    title,
    children,
}: {
    foods: FoodRow[]
    // What goes in each food, by its id
    contents: Map<string, FoodContent[]>
    title?: string
    children: React.ReactNode
}) {
    const m = useT()
    const items = useMemo<SidebarItem[]>(
        () => foods.map((food) => {
            const inside = contents.get(food.id) ?? []
            // With foods in it, it comes to what is in it; its own unit and values don't apply
            const values = inside.length > 0 ? contentsNutrients(inside) : food
            const per = inside.length > 0 ? m.nutrition.foodsInIt(inside.length) : m.foodUnits.per(unitPer(food.unit))
            return {
                dragId: `food:${food.id}`,
                name: food.name,
                detail: `${per} · ${formatNutrient(values.kcal, 'kcal')} ${m.units.kcal} · ${m.nutrients.protein.short} ${formatNutrient(values.protein, 'protein')} ${m.units.g}`,
                data: { kind: 'food', food } satisfies FoodDragData,
            }
        }),
        [foods, contents, m]
    )

    return (
        <WithDragSidebar
            title={title ?? m.nutrition.sidebar.title}
            items={items}
            emptyText={m.nutrition.sidebar.empty}
        >
            {children}
        </WithDragSidebar>
    )
}

// Where something is dropped, as `over.data.current`: a meal, or a food in it (`intoKey`, which
// the page maps back to that food) to put it in
export type DropTarget = { mealId: string; intoKey?: string }

// A meal's card that takes drops
export function MealDropZone({ mealId, dragging, children }: { mealId: string; dragging: boolean; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: `meal:${mealId}`, data: { mealId } satisfies DropTarget })

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

// A food of a meal together with what was put in it. A food dropped here is put in it.
export function IntoDropZone({ mealId, intoKey, children }: { mealId: string; intoKey: string; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: `into:${intoKey}`, data: { mealId, intoKey } satisfies DropTarget })

    return (
        <Box
            ref={setNodeRef}
            sx={{
                borderRadius: 1,
                outline: '2px solid',
                outlineColor: isOver ? 'primary.main' : 'transparent',
                bgcolor: isOver ? 'action.hover' : undefined,
                transition: 'outline-color 120ms, background-color 120ms',
            }}
        >
            {children}
        </Box>
    )
}

// The foods put in another, indented under it, shown while `open`
export function ContentsList({ open, children }: { open: boolean; children: React.ReactNode }) {
    return (
        <Collapse in={open}>
            <Box sx={{ ml: 2, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>{children}</Box>
        </Collapse>
    )
}

// A food made of foods, as its row shows it: what it comes to, the names of what is in it, and
// whether the list of them is open
export type MadeOf = { nutrients: Nutrients; names: string[]; open: boolean; onToggle: () => void }

// What is in a food, by name, under its name: "Γιαούρτι στραγγιστό 2%, Βρώμη, Μέλι"
export function MadeOfNames({ names }: { names: string[] }) {
    return (
        <Typography variant="caption" color="text.secondary" noWrap component="div">
            {names.join(', ')}
        </Typography>
    )
}

// Opens and closes the list of what is in a food. It takes the place of the amount, which a food
// made of foods does not have, so it is as wide.
export function MadeOfToggle({ name, madeOf }: { name: string; madeOf: MadeOf }) {
    const m = useT()
    const count = madeOf.names.length
    return (
        <Button
            size="small"
            color="inherit"
            onClick={madeOf.onToggle}
            aria-expanded={madeOf.open}
            aria-label={madeOf.open ? m.nutrition.hideContents(name) : m.nutrition.showContents(name)}
            endIcon={<ExpandMoreIcon sx={{ transition: 'transform 150ms', transform: madeOf.open ? 'rotate(180deg)' : 'none' }} />}
            sx={{ width: 120, flexShrink: 0, color: 'text.secondary', textTransform: 'none' }}
        >
            {m.nutrition.foodsCount(count)}
        </Button>
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
    dense,
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
    // Smaller, for a food inside another
    dense?: boolean
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
            sx={{
                width: 120,
                flexShrink: 0,
                ...(faded && { '& input': { color: 'text.secondary' } }),
                ...(dense && {
                    '& .MuiInputBase-root': { fontSize: '0.8125rem' },
                    '& .MuiInputBase-input': { py: 0.5 },
                    '& .MuiInputAdornment-root p': { fontSize: '0.75rem' },
                }),
            }}
        />
    )
}
