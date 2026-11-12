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
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Add as AddIcon,
    ArrowDownward as ArrowDownIcon,
    ArrowUpward as ArrowUpIcon,
    Delete as DeleteIcon,
    DragIndicator as DragIndicatorIcon,
    Edit as EditIcon,
    PlaylistAdd as AddIntoIcon,
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
    createPlanItems,
    deleteMeal,
    deletePlanItem,
    reorderMeals,
    updateMeal,
    updatePlanContents,
    updatePlanItem,
} from '../../services/nutrition'
import {
    defaultQuantity,
    describeNutrients,
    foodNutrients,
    formatNutrient,
    sumNutrients,
    type FoodContent,
} from '../../lib/nutrition'
import type { FoodRow, MealPlanWithFood, MealRow, NutritionGoalsRow } from '../../types/entityTypes'
import NutrientTotals from './NutrientTotals'
import FoodEntryDialog, { type FoodEntry } from './FoodEntryDialog'
import {
    ContentsList,
    IntoDropZone,
    MadeOfNames,
    MadeOfToggle,
    MealDropZone,
    QuantityInput,
    WithFoodSidebar,
    type DropTarget,
    type FoodDragData,
    type MadeOf,
} from './FoodDnd'
import { dropCollision } from './dropCollision'
import { useOpenContents } from './useOpenContents'
import { DragPreview } from '../DragSidebar'

// Stored day is the day of the week, 0 (Sunday) to 6 (Saturday), same as Date.getDay()
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Displayed Monday first
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type Props = {
    plan: MealPlanWithFood[]
    meals: MealRow[]
    foods: FoodRow[]
    // What goes in each food, by its id
    contents: Map<string, FoodContent[]>
    goals: NutritionGoalsRow | null
    onChange: () => void
}

// Add a food to a meal or put it in another food (`into`), or change a planned food
type EntryDialog = { item?: MealPlanWithFood; mealId?: string; into?: MealPlanWithFood }

// What is being dragged: a food from the list, or a planned food moving to another meal or food
type DragData = FoodDragData | { kind: 'plan'; item: MealPlanWithFood }

function itemsNutrients(items: MealPlanWithFood[]) {
    return sumNutrients(items.map((p) => foodNutrients(p.foods, p.quantity)))
}

export default function MealPlan({ plan, meals, foods, contents, goals, onChange }: Props) {
    const [day, setDay] = useState(() => new Date().getDay())
    const [entry, setEntry] = useState<EntryDialog | null>(null)
    const [removing, setRemoving] = useState<MealPlanWithFood | null>(null)
    const [mealsOpen, setMealsOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dragging, setDragging] = useState<DragData | null>(null)
    // The item just dropped in, whose amount field takes the focus once it shows up
    const [focusId, setFocusId] = useState<string | null>(null)
    // Planned foods made of foods whose list of what is in them is open, by item id
    const openContents = useOpenContents()
    const sensors = useSensors(
        // A few pixels of movement before a drag starts, so clicks still work
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor)
    )

    const dayItems = plan.filter((p) => p.day === day)
    const dayById = new Map(dayItems.map((p) => [p.id, p]))
    // A food on its own in its meal, not put in another
    const isTop = (p: MealPlanWithFood) => !p.parentId || !dayById.has(p.parentId)
    const contentsOf = (id: string) => dayItems.filter((p) => p.parentId === id)
    // A food with foods in it comes to what is in it, so only the foods without any count
    const counts = (p: MealPlanWithFood) => !dayItems.some((c) => c.parentId === p.id)
    const counted = dayItems.filter(counts)
    const dayTotals = itemsNutrients(counted)

    // Adds a food to a meal, or puts it in another. A food on its own starts with a copy of what
    // goes in it (set in Foods), which can then be changed for this one alone. Returns the new item's id.
    async function addFood(food: FoodRow, quantity: number, mealId: string, into: MealPlanWithFood | null) {
        const order = into ? contentsOf(into.id).length : dayItems.filter((p) => p.mealId === mealId && isTop(p)).length
        const id = await createPlanItem({ day, mealId, parentId: into?.id ?? null, foodId: food.id, quantity, order })
        if (!id) return null

        // One level only, so a food put in another comes without its contents
        const kept = into ? [] : contents.get(food.id) ?? []
        if (kept.length > 0) {
            const ids = await createPlanItems(kept.map((c, i) => ({
                day,
                mealId,
                parentId: id,
                foodId: c.food.id,
                quantity: c.quantity,
                order: i,
            })))
            if (!ids) setError(`Added ${food.name}, but not the foods that go in it`)
        }
        return id
    }

    async function saveEntry({ mealId, foodId, quantity }: FoodEntry, food: FoodRow) {
        const item = entry?.item
        if (item) {
            const moved = mealId !== item.mealId
            // Moved to another meal, it comes out of the food it was in, and what is in it goes along
            const ok = await updatePlanItem(item.id, { mealId, foodId, quantity, ...(moved && { parentId: null }) })
                && (!moved || await updatePlanContents(item.id, { mealId }))
            if (!ok) return 'Failed to save'
        } else {
            const into = entry?.into ?? null
            if (!(await addFood(food, quantity, into?.mealId ?? mealId, into))) return 'Failed to save'
            if (into) openContents.show(into.id)
        }
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
        const target = over?.data.current as DropTarget | undefined
        const data = active.data.current as DragData | undefined
        if (!target || !data) return

        const { mealId } = target
        const into = target.intoKey ? dayById.get(target.intoKey) ?? null : null
        setError(null)
        if (data.kind === 'food') {
            // One level only
            if (into && contents.has(data.food.id)) {
                return setError(`${data.food.name} has foods in it, so it can't go in another food`)
            }
            const id = await addFood(data.food, defaultQuantity(data.food.unit), mealId, into)
            if (!id) return setError(`Failed to add ${data.food.name}`)
            setFocusId(id)
        } else {
            const { item } = data
            let ok: boolean
            if (into) {
                if (into.id === item.id || into.id === item.parentId) return
                // One level only
                if (contentsOf(item.id).length > 0) {
                    return setError(`${item.foods.name} has foods in it, so it can't go in another food`)
                }
                ok = await updatePlanItem(item.id, { mealId, parentId: into.id, order: contentsOf(into.id).length })
            } else {
                if (item.mealId === mealId && isTop(item)) return
                const order = dayItems.filter((p) => p.mealId === mealId && isTop(p)).length
                ok = await updatePlanItem(item.id, { mealId, parentId: null, order })
                    && await updatePlanContents(item.id, { mealId })
            }
            if (!ok) return setError(`Failed to move ${item.foods.name}`)
        }
        // What was put in shows
        if (into) openContents.show(into.id)
        onChange()
    }

    // A food on its own comes with what is in it (`inside`); a food inside another without
    function renderItem(item: MealPlanWithFood, inside?: MealPlanWithFood[]) {
        return (
            <PlanItemRow
                // Keyed on the amount too, so a change from the edit dialog resets the field
                key={`${item.id}:${item.quantity}`}
                item={item}
                dense={!inside}
                madeOf={inside && inside.length > 0 ? {
                    nutrients: itemsNutrients(inside),
                    names: inside.map((c) => c.foods.name),
                    open: openContents.isOpen(item.id),
                    onToggle: () => openContents.toggle(item.id),
                } : undefined}
                autoFocus={item.id === focusId}
                onBlurred={() => setFocusId(null)}
                onSaved={onChange}
                onAddInto={inside ? () => setEntry({ into: item }) : undefined}
                onEdit={() => setEntry({ item })}
                onRemove={() => { setError(null); setRemoving(item) }}
            />
        )
    }

    const removingContents = removing ? contentsOf(removing.id).length : 0

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={dropCollision}
            onDragStart={({ active }: DragStartEvent) => setDragging((active.data.current as DragData | undefined) ?? null)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <WithFoodSidebar foods={foods} contents={contents}>
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
                <NutrientTotals
                    totals={dayTotals}
                    goals={goals}
                    sources={counted.map((p) => ({
                        key: p.foodId,
                        name: p.foods.name,
                        nutrients: foodNutrients(p.foods, p.quantity),
                    }))}
                />
                {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}

                <Stack spacing={2} sx={{ mt: 2 }}>
                    {meals.map((meal) => {
                        const items = dayItems.filter((p) => p.mealId === meal.id)
                        const totals = itemsNutrients(items.filter(counts))
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
                                {items.filter(isTop).map((item) => {
                                    const inside = contentsOf(item.id)
                                    return (
                                        <IntoDropZone key={item.id} mealId={meal.id} intoKey={item.id}>
                                            {renderItem(item, inside)}
                                            {inside.length > 0 && (
                                                <ContentsList open={openContents.isOpen(item.id)}>
                                                    {inside.map((c) => renderItem(c))}
                                                </ContentsList>
                                            )}
                                        </IntoDropZone>
                                    )
                                })}
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
                    title={entry.item ? 'Edit planned food' : entry.into ? `Add to ${entry.into.foods.name}` : `Add to ${DAY_NAMES[day]}`}
                    submitLabel={entry.item ? 'Save' : 'Add'}
                    meals={meals}
                    // A food with foods in it goes in no other
                    foods={entry.into ? foods.filter((f) => !contents.has(f.id)) : foods}
                    contents={contents}
                    hideMeal={!!entry.into}
                    initial={entry.item
                        ? { mealId: entry.item.mealId, foodId: entry.item.foodId, quantity: entry.item.quantity }
                        : { mealId: entry.into?.mealId ?? entry.mealId }}
                    onClose={() => setEntry(null)}
                    onSubmit={saveEntry}
                />
            )}

            <Dialog open={!!removing} onClose={() => setRemoving(null)}>
                <DialogTitle>Remove from plan</DialogTitle>
                <DialogContent>
                    <Typography>
                        Remove "{removing?.foods.name}"
                        {removingContents > 0 && ` and the ${removingContents === 1 ? 'food' : `${removingContents} foods`} in it`}
                        {' '}from {DAY_NAMES[day]}?
                    </Typography>
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

// A planned food with its amount editable in place; the handle drags it to another meal, or into
// another food. Made of foods (`madeOf`), it shows their sum and names instead and has no amount
// of its own. `dense` is for a food inside another.
function PlanItemRow({
    item,
    madeOf,
    dense,
    autoFocus,
    onBlurred,
    onSaved,
    onAddInto,
    onEdit,
    onRemove,
}: {
    item: MealPlanWithFood
    madeOf?: MadeOf
    dense?: boolean
    autoFocus: boolean
    onBlurred: () => void
    onSaved: () => void
    // For a food on its own, which other foods can be put in
    onAddInto?: () => void
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
        <Box
            ref={setNodeRef}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, py: dense ? 0.25 : 0.75, opacity: isDragging ? 0.4 : 1 }}
        >
            <Box
                {...attributes}
                {...listeners}
                aria-label={`Drag ${item.foods.name} to another meal or food`}
                sx={{ display: 'flex', color: 'text.secondary', cursor: 'grab', touchAction: 'none' }}
            >
                <DragIndicatorIcon fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap variant={dense ? 'body2' : 'body1'}>{item.foods.name}</Typography>
                {madeOf && <MadeOfNames names={madeOf.names} />}
                <Typography variant={dense ? 'caption' : 'body2'} color="text.secondary" component="div">
                    {/* Made of foods, it comes to what is in it; its own amount and values don't apply */}
                    {describeNutrients(madeOf?.nutrients ?? foodNutrients(item.foods, shownQuantity))}
                </Typography>
            </Box>
            {madeOf ? (
                <MadeOfToggle name={item.foods.name} madeOf={madeOf} />
            ) : (
                <QuantityInput
                    value={quantity}
                    unit={item.foods.unit}
                    label={`Amount of ${item.foods.name}`}
                    autoFocus={autoFocus}
                    disabled={saving}
                    error={failed}
                    dense={dense}
                    onChange={setQuantity}
                    onCommit={save}
                    onCancel={() => setQuantity(String(item.quantity))}
                />
            )}
            {onAddInto ? (
                <Tooltip title={`Put a food in ${item.foods.name}`}>
                    <IconButton size="small" aria-label={`Put a food in ${item.foods.name}`} onClick={onAddInto}>
                        <AddIntoIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ) : (
                // Keeps the amounts lined up with the rows that have this button
                <Box sx={{ width: 34, flexShrink: 0 }} />
            )}
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
