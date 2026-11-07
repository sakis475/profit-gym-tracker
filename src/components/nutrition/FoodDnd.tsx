import { useMemo, useState } from 'react'
import { Box, InputAdornment, Paper, TextField, Typography } from '@mui/material'
import { DragIndicator as DragIndicatorIcon, Search as SearchIcon } from '@mui/icons-material'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { formatNutrient, quantityUnitLabel, unitPer } from '../../lib/nutrition'
import { normalizeSearch } from '../../lib/workoutStats'
import type { FoodRow } from '../../types/entityTypes'

// Drag and drop of foods onto meals, shared by the meal plan and the food diary.
// Each of them supplies the DndContext and decides what a drop does.

// Below this width there is no room for the food list beside the meals; adding goes through the dialog
const SIDEBAR_BREAKPOINT = 'md'
// Below the sticky app bar
const STICKY_TOP = 80

// A food dragged from the list
export type FoodDragData = { kind: 'food'; food: FoodRow }

// The food list on the left of `children`, or nothing but `children` on a narrow screen
export function WithFoodSidebar({ foods, children }: { foods: FoodRow[]; children: React.ReactNode }) {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', [SIDEBAR_BREAKPOINT]: '280px minmax(0, 1fr)' },
                gap: 3,
                alignItems: 'start',
            }}
        >
            <FoodSidebar foods={foods} />
            <Box sx={{ minWidth: 0 }}>{children}</Box>
        </Box>
    )
}

// All foods, searchable, to drag onto a meal. Sticks beside the meals while they scroll.
function FoodSidebar({ foods }: { foods: FoodRow[] }) {
    const [search, setSearch] = useState('')
    const shown = useMemo(() => {
        const q = normalizeSearch(search.trim())
        return q ? foods.filter((f) => normalizeSearch(f.name).includes(q)) : foods
    }, [foods, search])

    return (
        <Paper
            variant="outlined"
            sx={{
                display: { xs: 'none', [SIDEBAR_BREAKPOINT]: 'flex' },
                flexDirection: 'column',
                position: 'sticky',
                top: STICKY_TOP,
                maxHeight: `calc(100vh - ${STICKY_TOP + 16}px)`,
            }}
        >
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Foods: drag onto a meal</Typography>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>
            <Box sx={{ overflowY: 'auto', p: 1 }}>
                {shown.map((food) => <DraggableFood key={food.id} food={food} />)}
                {shown.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                        {foods.length === 0 ? 'No foods yet. Add them in the Foods tab.' : 'No foods match.'}
                    </Typography>
                )}
            </Box>
        </Paper>
    )
}

function DraggableFood({ food }: { food: FoodRow }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `food:${food.id}`,
        data: { kind: 'food', food } satisfies FoodDragData,
    })

    return (
        <Box
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${food.name} onto a meal`}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                cursor: 'grab',
                touchAction: 'none',
                opacity: isDragging ? 0.4 : 1,
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            <DragIndicatorIcon fontSize="small" color="action" />
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>{food.name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                    per {unitPer(food.unit)} · {formatNutrient(food.kcal, 'kcal')} kcal · P {formatNutrient(food.protein, 'protein')} g
                </Typography>
            </Box>
        </Box>
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

// What follows the pointer while dragging
export function DragPreview({ name }: { name: string }) {
    return (
        <Paper elevation={6} sx={{ px: 1.5, py: 1, cursor: 'grabbing', display: 'inline-block' }}>
            <Typography sx={{ fontWeight: 500 }}>{name}</Typography>
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
