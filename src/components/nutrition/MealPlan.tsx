import { useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import {
    Add as AddIcon,
    ArrowDownward as ArrowDownIcon,
    ArrowUpward as ArrowUpIcon,
    Delete as DeleteIcon,
    DragIndicator as DragIndicatorIcon,
    Edit as EditIcon,
    Restaurant as MealsIcon,
} from '@mui/icons-material'
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDraggable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import {
    createMeal,
    createPlanItem,
    deleteMeal,
    deletePlanItem,
    reorderMeals,
    updateMeal,
    updatePlanItem,
} from '../../services/nutrition'
import { defaultQuantity, describeNutrients, foodNutrients, formatNutrient, sumNutrients } from '../../lib/nutrition'
import type { FoodRow, MealPlanWithFood, MealRow, NutritionGoalsRow } from '../../types/entityTypes'
import NutrientTotals from './NutrientTotals'
import FoodEntryDialog, { type FoodEntry } from './FoodEntryDialog'
import { DragPreview, MealDropZone, QuantityInput, WithFoodSidebar, type FoodDragData } from './FoodDnd'

// Stored day is the day of the week, 0 (Sunday) to 6 (Saturday), same as Date.getDay()
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Displayed Monday first
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type Props = {
    plan: MealPlanWithFood[]
    meals: MealRow[]
    foods: FoodRow[]
    goals: NutritionGoalsRow | null
    onChange: () => void
}

type EntryDialog = { item?: MealPlanWithFood; mealId?: string }

// What is being dragged: a food from the list, or a planned item moving to another meal
type DragData = FoodDragData | { kind: 'plan'; item: MealPlanWithFood }

export default function MealPlan({ plan, meals, foods, goals, onChange }: Props) {
    const [day, setDay] = useState(() => new Date().getDay())
    const [entry, setEntry] = useState<EntryDialog | null>(null)
    const [removing, setRemoving] = useState<MealPlanWithFood | null>(null)
    const [mealsOpen, setMealsOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dragging, setDragging] = useState<DragData | null>(null)
    // The item just dropped in, whose amount field takes the focus once it shows up
    const [focusId, setFocusId] = useState<string | null>(null)
    const sensors = useSensors(
        // A few pixels of movement before a drag starts, so clicks still work
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor)
    )

    const dayItems = plan.filter((p) => p.day === day)
    const dayTotals = sumNutrients(dayItems.map((p) => foodNutrients(p.foods, p.quantity)))

    async function saveEntry({ mealId, foodId, quantity }: FoodEntry) {
        const item = entry?.item
        // A new item goes last in its meal
        const ok = item
            ? await updatePlanItem(item.id, { mealId, foodId, quantity })
            : !!(await createPlanItem({ day, mealId, foodId, quantity, order: dayItems.filter((p) => p.mealId === mealId).length }))
        if (!ok) return 'Failed to save'
        setEntry(null)
        onChange()
        return null
    }

    async function handleRemove() {
        if (!removing) return
        setBusy(true)
        const ok = await deletePlanItem(removing.id)
        setBusy(false)
        if (!ok) return setError('Failed to remove')
        setRemoving(null)
        onChange()
    }

    async function handleDragEnd({ active, over }: DragEndEvent) {
        setDragging(null)
        const mealId = over?.data.current?.mealId as string | undefined
        const data = active.data.current as DragData | undefined
        if (!mealId || !data) return

        // Either way it goes last in the meal it is dropped on
        const order = dayItems.filter((p) => p.mealId === mealId).length
        setError(null)
        if (data.kind === 'food') {
            const id = await createPlanItem({ day, mealId, foodId: data.food.id, quantity: defaultQuantity(data.food.unit), order })
            if (!id) return setError(`Failed to add ${data.food.name}`)
            setFocusId(id)
        } else {
            if (data.item.mealId === mealId) return
            const ok = await updatePlanItem(data.item.id, { mealId, order })
            if (!ok) return setError(`Failed to move ${data.item.foods.name}`)
        }
        onChange()
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={({ active }: DragStartEvent) => setDragging((active.data.current as DragData | undefined) ?? null)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <WithFoodSidebar foods={foods}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button startIcon={<MealsIcon />} onClick={() => setMealsOpen(true)}>Meals</Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEntry({})}>Add food</Button>
                </Box>

                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    color="primary"
                    value={day}
                    onChange={(_, value: number | null) => {
                        if (value !== null) setDay(value)
                    }}
                    aria-label="Day of the week"
                    sx={{ mt: 2 }}
                >
                    {DAY_ORDER.map((d) => (
                        <ToggleButton key={d} value={d} aria-label={DAY_NAMES[d]}>
                            {DAY_SHORT_NAMES[d]}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>{DAY_NAMES[day]}</Typography>
                <NutrientTotals totals={dayTotals} goals={goals} />
                {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}

                <Stack spacing={2} sx={{ mt: 2 }}>
                    {meals.map((meal) => {
                        const items = dayItems.filter((p) => p.mealId === meal.id)
                        const totals = sumNutrients(items.map((p) => foodNutrients(p.foods, p.quantity)))
                        return (
                            <MealDropZone key={meal.id} mealId={meal.id} dragging={!!dragging}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 500, flexGrow: 1 }}>{meal.name}</Typography>
                                    {items.length > 0 && (
                                        <Typography variant="body2" color="text.secondary">
                                            {formatNutrient(totals.kcal, 'kcal')} kcal · P {formatNutrient(totals.protein, 'protein')} g
                                        </Typography>
                                    )}
                                </Box>
                                {items.map((item) => (
                                    <PlanItemRow
                                        // Keyed on the amount too, so a change from the edit dialog resets the field
                                        key={`${item.id}:${item.quantity}`}
                                        item={item}
                                        autoFocus={item.id === focusId}
                                        onBlurred={() => setFocusId(null)}
                                        onSaved={onChange}
                                        onEdit={() => setEntry({ item })}
                                        onRemove={() => { setError(null); setRemoving(item) }}
                                    />
                                ))}
                                {items.length === 0 && (
                                    // Only where the food list is shown
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 1, display: { xs: 'none', md: 'block' } }}>
                                        Drag foods here
                                    </Typography>
                                )}
                                <Button size="small" startIcon={<AddIcon />} onClick={() => setEntry({ mealId: meal.id })} sx={{ mt: 0.5 }}>
                                    Add to {meal.name}
                                </Button>
                            </MealDropZone>
                        )
                    })}
                    {meals.length === 0 && (
                        <Typography>No meals yet. Add your meals (breakfast, lunch, …) with the Meals button.</Typography>
                    )}
                </Stack>
            </WithFoodSidebar>

            <DragOverlay dropAnimation={null}>
                {dragging && <DragPreview name={dragging.kind === 'food' ? dragging.food.name : dragging.item.foods.name} />}
            </DragOverlay>

            {entry && (
                <FoodEntryDialog
                    title={entry.item ? 'Edit planned food' : `Add to ${DAY_NAMES[day]}`}
                    submitLabel={entry.item ? 'Save' : 'Add'}
                    meals={meals}
                    foods={foods}
                    initial={entry.item
                        ? { mealId: entry.item.mealId, foodId: entry.item.foodId, quantity: entry.item.quantity }
                        : { mealId: entry.mealId }}
                    onClose={() => setEntry(null)}
                    onSubmit={saveEntry}
                />
            )}

            <Dialog open={!!removing} onClose={() => setRemoving(null)}>
                <DialogTitle>Remove from plan</DialogTitle>
                <DialogContent>
                    <Typography>Remove "{removing?.foods.name}" from {DAY_NAMES[day]}?</Typography>
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRemoving(null)} disabled={busy}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={handleRemove} disabled={busy}>
                        {busy ? 'Removing…' : 'Remove'}
                    </Button>
                </DialogActions>
            </Dialog>

            {mealsOpen && <MealsDialog meals={meals} onClose={() => setMealsOpen(false)} onChange={onChange} />}
        </DndContext>
    )
}

// A planned food with its amount editable in place; the handle drags it to another meal
function PlanItemRow({
    item,
    autoFocus,
    onBlurred,
    onSaved,
    onEdit,
    onRemove,
}: {
    item: MealPlanWithFood
    autoFocus: boolean
    onBlurred: () => void
    onSaved: () => void
    onEdit: () => void
    onRemove: () => void
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `plan:${item.id}`,
        data: { kind: 'plan', item } satisfies DragData,
    })
    const [quantity, setQuantity] = useState(String(item.quantity))
    const [saving, setSaving] = useState(false)
    const [failed, setFailed] = useState(false)

    const amount = Number(quantity)
    // The values follow what is typed, before it is saved
    const shownQuantity = amount > 0 ? amount : item.quantity

    async function save() {
        onBlurred()
        if (!(amount > 0)) return setQuantity(String(item.quantity))
        if (amount === item.quantity) return
        setSaving(true)
        const ok = await updatePlanItem(item.id, { quantity: amount })
        setSaving(false)
        setFailed(!ok)
        if (ok) onSaved()
    }

    return (
        <Box ref={setNodeRef} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, opacity: isDragging ? 0.4 : 1 }}>
            <Box
                {...attributes}
                {...listeners}
                aria-label={`Drag ${item.foods.name} to another meal`}
                sx={{ display: 'flex', color: 'text.secondary', cursor: 'grab', touchAction: 'none' }}
            >
                <DragIndicatorIcon fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap>{item.foods.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                    {describeNutrients(foodNutrients(item.foods, shownQuantity))}
                </Typography>
            </Box>
            <QuantityInput
                value={quantity}
                unit={item.foods.unit}
                label={`Amount of ${item.foods.name}`}
                autoFocus={autoFocus}
                disabled={saving}
                error={failed}
                onChange={setQuantity}
                onCommit={save}
                onCancel={() => setQuantity(String(item.quantity))}
            />
            <IconButton size="small" aria-label={`Edit ${item.foods.name}`} onClick={onEdit}>
                <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label={`Remove ${item.foods.name}`} onClick={onRemove}>
                <DeleteIcon fontSize="small" />
            </IconButton>
        </Box>
    )
}

// Rename, reorder, add and remove the meals of the day
function MealsDialog({ meals, onClose, onChange }: { meals: MealRow[]; onClose: () => void; onChange: () => void }) {
    const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(meals.map((m) => [m.id, m.name])))
    const [newName, setNewName] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function run(action: () => Promise<boolean>, message: string) {
        setBusy(true)
        setError(null)
        const ok = await action()
        setBusy(false)
        if (!ok) setError(message)
        else onChange()
    }

    function rename(meal: MealRow) {
        const name = names[meal.id]?.trim()
        if (!name || name === meal.name) return
        run(async () => !!(await updateMeal(meal.id, { name })), 'Failed to rename meal')
    }

    function move(index: number, by: number) {
        const ids = meals.map((m) => m.id)
        const [moved] = ids.splice(index, 1)
        ids.splice(index + by, 0, moved)
        run(() => reorderMeals(ids), 'Failed to reorder meals')
    }

    function add(e: React.FormEvent) {
        e.preventDefault()
        const name = newName.trim()
        if (!name) return
        run(async () => {
            const meal = await createMeal({ name, order: meals.length })
            if (meal) setNewName('')
            return !!meal
        }, 'Failed to add meal')
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Meals</DialogTitle>
            <DialogContent>
                <Stack spacing={1} sx={{ mt: 1 }}>
                    {meals.map((meal, i) => (
                        <Box key={meal.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TextField
                                size="small"
                                value={names[meal.id] ?? meal.name}
                                onChange={(e) => setNames((prev) => ({ ...prev, [meal.id]: e.target.value }))}
                                onBlur={() => rename(meal)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                inputProps={{ 'aria-label': 'Meal name' }}
                                sx={{ flex: 1 }}
                            />
                            <IconButton size="small" aria-label={`Move ${meal.name} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}>
                                <ArrowUpIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label={`Move ${meal.name} down`} disabled={busy || i === meals.length - 1} onClick={() => move(i, 1)}>
                                <ArrowDownIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                aria-label={`Delete ${meal.name}`}
                                disabled={busy}
                                onClick={() => {
                                    if (window.confirm(`Delete "${meal.name}"? Its foods are taken out of the plan on every day.`)) {
                                        run(async () => !!(await deleteMeal(meal.id)), 'Failed to delete meal')
                                    }
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}
                </Stack>
                <Box component="form" onSubmit={add} sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <TextField
                        size="small"
                        label="New meal"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        sx={{ flex: 1 }}
                    />
                    <Button type="submit" startIcon={<AddIcon />} disabled={busy || !newName.trim()}>Add</Button>
                </Box>
                {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Done</Button>
            </DialogActions>
        </Dialog>
    )
}
