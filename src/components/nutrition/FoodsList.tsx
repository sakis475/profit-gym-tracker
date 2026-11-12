import { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Add as AddIcon,
    Close as CloseIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    PlaylistAdd as AddIntoIcon,
    Search as SearchIcon,
} from '@mui/icons-material'
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import {
    createFood,
    createFoodContent,
    deleteFood,
    deleteFoodContent,
    updateFood,
    updateFoodContent,
} from '../../services/nutrition'
import {
    FOOD_UNITS,
    NUTRIENTS,
    contentsNutrients,
    defaultQuantity,
    describeFood,
    describeNutrients,
    foodNutrients,
    unitPer,
    type FoodContent,
    type NutrientKey,
} from '../../lib/nutrition'
import { normalizeSearch } from '../../lib/workoutStats'
import type { FoodRow } from '../../types/entityTypes'
import FoodEntryDialog from './FoodEntryDialog'
import {
    ContentsList,
    MadeOfNames,
    MadeOfToggle,
    QuantityInput,
    WithFoodSidebar,
    type DropTarget,
    type FoodDragData,
    type MadeOf,
} from './FoodDnd'
import { dropCollision } from './dropCollision'
import { useOpenContents } from './useOpenContents'
import { DragPreview } from '../DragSidebar'

type Props = {
    foods: FoodRow[]
    // What goes in each food, by its id
    contents: Map<string, FoodContent[]>
    onChange: () => void
}

type FoodForm = { name: string; unit: string; notes: string } & Record<NutrientKey, string>

const EMPTY_FORM: FoodForm = { name: '', unit: 'g', notes: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '' }

function toForm(food: FoodRow): FoodForm {
    return {
        name: food.name,
        unit: food.unit,
        notes: food.notes ?? '',
        kcal: String(food.kcal),
        protein: String(food.protein),
        carbs: String(food.carbs),
        fat: String(food.fat),
        fiber: String(food.fiber),
    }
}

export default function FoodsList({ foods, contents, onChange }: Props) {
    const [search, setSearch] = useState('')
    const [form, setForm] = useState<FoodForm | null>(null)
    const [editing, setEditing] = useState<FoodRow | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<FoodRow | null>(null)
    // The food a food is being put in through the dialog
    const [puttingIn, setPuttingIn] = useState<FoodRow | null>(null)
    const [listError, setListError] = useState<string | null>(null)
    const [dragging, setDragging] = useState<FoodDragData | null>(null)
    // The content just dropped in, whose amount field takes the focus once it shows up
    const [focusId, setFocusId] = useState<string | null>(null)
    // Foods whose list of what goes in them is open, by food id
    const openContents = useOpenContents()
    const sensors = useSensors(
        // A few pixels of movement before a drag starts, so clicks still work
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor)
    )

    const shown = useMemo(() => {
        const q = normalizeSearch(search.trim())
        return q ? foods.filter((f) => normalizeSearch(`${f.name} ${f.notes ?? ''}`).includes(q)) : foods
    }, [foods, search])

    // The food each food goes in, for the one-level rule
    const parentOf = useMemo(() => {
        const map = new Map<string, FoodRow>()
        for (const [foodId, list] of contents) {
            const parent = foods.find((f) => f.id === foodId)
            if (parent) for (const c of list) map.set(c.food.id, parent)
        }
        return map
    }, [contents, foods])

    function openForm(food?: FoodRow) {
        setEditing(food ?? null)
        setForm(food ? toForm(food) : EMPTY_FORM)
        setError(null)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form) return
        setError(null)
        if (!form.name.trim()) return setError('Name is required')

        const values = {} as Record<NutrientKey, number>
        for (const { key, label } of NUTRIENTS) {
            // Left empty, it is 0
            const value = form[key] === '' ? 0 : Number(form[key])
            if (!(value >= 0)) return setError(`${label} must be 0 or more`)
            values[key] = value
        }

        const payload = { name: form.name.trim(), unit: form.unit, notes: form.notes.trim() || null, ...values }
        setSaving(true)
        const res = editing ? await updateFood(editing.id, payload) : await createFood(payload)
        setSaving(false)
        if (!res) return setError(editing ? 'Failed to save food' : 'Failed to create food')
        setForm(null)
        onChange()
    }

    async function handleDelete() {
        if (!deleting) return
        setSaving(true)
        const res = await deleteFood(deleting.id)
        setSaving(false)
        if (!res) return setError('Failed to delete food')
        setDeleting(null)
        onChange()
    }

    // Why `food` can't go in `into`, or null when it can. One level only: a food with contents
    // goes in no other, and a food that goes in another gets no contents.
    function cannotPutIn(food: FoodRow, into: FoodRow) {
        if (food.id === into.id) return `${food.name} can't go in itself`
        if ((contents.get(food.id) ?? []).length > 0) return `${food.name} has foods in it, so it can't go in another food`
        const parent = parentOf.get(into.id)
        if (parent) return `${into.name} goes in ${parent.name}, so nothing can go in it`
        return null
    }

    // Returns the new content's id, or an error message
    async function putIn(food: FoodRow, into: FoodRow, quantity: number): Promise<{ id: string } | { error: string }> {
        const reason = cannotPutIn(food, into)
        if (reason) return { error: reason }
        const id = await createFoodContent({
            foodId: into.id,
            contentId: food.id,
            quantity,
            order: (contents.get(into.id) ?? []).length,
        })
        if (!id) return { error: `Failed to put ${food.name} in ${into.name}` }
        // What was put in shows
        openContents.show(into.id)
        onChange()
        return { id }
    }

    async function handleDragEnd({ active, over }: DragEndEvent) {
        setDragging(null)
        const intoId = (over?.data.current as DropTarget | undefined)?.intoKey
        const data = active.data.current as FoodDragData | undefined
        const into = foods.find((f) => f.id === intoId)
        if (!into || data?.kind !== 'food') return

        setListError(null)
        const res = await putIn(data.food, into, defaultQuantity(data.food.unit))
        if ('error' in res) setListError(res.error)
        else setFocusId(res.id)
    }

    async function run(action: () => Promise<boolean>, message: string) {
        setListError(null)
        const ok = await action()
        if (!ok) setListError(message)
        onChange()
        return ok
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={dropCollision}
            onDragStart={({ active }: DragStartEvent) => setDragging((active.data.current as FoodDragData | undefined) ?? null)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <WithFoodSidebar foods={foods} contents={contents} title="Foods: drag onto a food to put it in">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                    <TextField
                        size="small"
                        placeholder="Search foods"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        sx={{ flex: '1 1 220px' }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm()}>
                        Add food
                    </Button>
                </Box>
                {listError && <Typography color="error" sx={{ mt: 2 }}>{listError}</Typography>}

                <Stack spacing={1} sx={{ mt: 2 }}>
                    {shown.map((food) => {
                        const inside = contents.get(food.id) ?? []
                        return (
                            <FoodCard
                                key={food.id}
                                food={food}
                                madeOf={inside.length > 0 ? {
                                    nutrients: contentsNutrients(inside),
                                    names: inside.map((c) => c.food.name),
                                    open: openContents.isOpen(food.id),
                                    onToggle: () => openContents.toggle(food.id),
                                } : undefined}
                                // A food that goes in another takes nothing in
                                canTakeIn={!parentOf.has(food.id)}
                                onPutIn={() => { setListError(null); setPuttingIn(food) }}
                                onEdit={() => openForm(food)}
                                onDelete={() => { setError(null); setDeleting(food) }}
                            >
                                {inside.length > 0 && (
                                    <ContentsList open={openContents.isOpen(food.id)}>
                                        {inside.map((c) => (
                                            <ContentRow
                                                // Keyed on the amount too, so a saved change resets the field
                                                key={`${c.id}:${c.quantity}`}
                                                content={c}
                                                autoFocus={c.id === focusId}
                                                onBlurred={() => setFocusId(null)}
                                                onCommit={(quantity) => run(() => updateFoodContent(c.id, { quantity }), 'Failed to save')}
                                                onRemove={() => run(() => deleteFoodContent(c.id), `Failed to take ${c.food.name} out`)}
                                            />
                                        ))}
                                    </ContentsList>
                                )}
                            </FoodCard>
                        )
                    })}
                    {shown.length === 0 && (
                        <Typography sx={{ mt: 2 }}>{foods.length === 0 ? 'No foods yet.' : 'No foods match your search.'}</Typography>
                    )}
                </Stack>
            </WithFoodSidebar>

            <DragOverlay dropAnimation={null}>
                {dragging && <DragPreview name={dragging.food.name} />}
            </DragOverlay>

            {puttingIn && (
                <FoodEntryDialog
                    title={`Put a food in ${puttingIn.name}`}
                    submitLabel="Add"
                    meals={[]}
                    hideMeal
                    // Only foods that can go in it
                    foods={foods.filter((f) => !cannotPutIn(f, puttingIn))}
                    initial={{}}
                    onClose={() => setPuttingIn(null)}
                    onSubmit={async ({ quantity }, food) => {
                        const res = await putIn(food, puttingIn, quantity)
                        if ('error' in res) return res.error
                        setPuttingIn(null)
                        return null
                    }}
                />
            )}

            <Dialog open={!!form} onClose={() => setForm(null)} fullWidth maxWidth="sm">
                <DialogTitle>{editing ? 'Edit food' : 'Add food'}</DialogTitle>
                {form && (
                    <form onSubmit={handleSubmit}>
                        <DialogContent>
                            <TextField
                                label="Name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                fullWidth
                                required
                                sx={{ mt: 1, mb: 2 }}
                            />
                            <TextField
                                select
                                label="Measured in"
                                value={form.unit}
                                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                fullWidth
                                helperText={`The values below are per ${unitPer(form.unit)}. Leave them empty for a food made of other foods, like an omelette.`}
                                sx={{ mb: 2 }}
                            >
                                {FOOD_UNITS.map((u) => (
                                    <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
                                ))}
                            </TextField>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1.5 }}>
                                {NUTRIENTS.map(({ key, label, unit }) => (
                                    <TextField
                                        key={key}
                                        label={label}
                                        type="number"
                                        value={form[key]}
                                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                        // Left empty, it is saved as 0
                                        placeholder="0"
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }}
                                        InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                                    />
                                ))}
                            </Box>
                            <TextField
                                label="Notes"
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                fullWidth
                                multiline
                                sx={{ mt: 2 }}
                            />
                            {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
                            <Button type="submit" variant="contained" disabled={saving}>
                                {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
                            </Button>
                        </DialogActions>
                    </form>
                )}
            </Dialog>

            <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
                <DialogTitle>Delete food</DialogTitle>
                <DialogContent>
                    <Typography>
                        Delete "{deleting?.name}"? It is also taken out of your meal plan and out of the foods it goes in.
                        Days you already logged keep it.
                    </Typography>
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)} disabled={saving}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={handleDelete} disabled={saving}>
                        {saving ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </DndContext>
    )
}

// A food, which takes foods dropped on it, with what goes in it (`children`) under it
function FoodCard({
    food,
    madeOf,
    canTakeIn,
    onPutIn,
    onEdit,
    onDelete,
    children,
}: {
    food: FoodRow
    madeOf?: MadeOf
    canTakeIn: boolean
    onPutIn: () => void
    onEdit: () => void
    onDelete: () => void
    children: React.ReactNode
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `food-into:${food.id}`, data: { intoKey: food.id } })

    return (
        <Paper
            ref={setNodeRef}
            variant="outlined"
            sx={{
                px: 2,
                py: 1,
                transition: 'border-color 120ms, background-color 120ms',
                ...(isOver && { borderColor: 'primary.main', bgcolor: 'action.hover' }),
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography>{food.name}</Typography>
                    {madeOf && <MadeOfNames names={madeOf.names} />}
                    <Typography variant="body2" color="text.secondary">
                        {/* Made of foods, it comes to what is in it; its own unit and values don't apply */}
                        {madeOf ? describeNutrients(madeOf.nutrients) : describeFood(food)}
                    </Typography>
                    {food.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                            {food.notes}
                        </Typography>
                    )}
                </Box>
                {madeOf && <MadeOfToggle name={food.name} madeOf={madeOf} />}
                {canTakeIn && (
                    <Tooltip title={`Put a food in ${food.name}`}>
                        <IconButton aria-label={`Put a food in ${food.name}`} onClick={onPutIn}>
                            <AddIntoIcon />
                        </IconButton>
                    </Tooltip>
                )}
                <IconButton aria-label={`Edit ${food.name}`} onClick={onEdit}>
                    <EditIcon />
                </IconButton>
                <IconButton aria-label={`Delete ${food.name}`} onClick={onDelete}>
                    <DeleteIcon />
                </IconButton>
            </Box>
            {children}
        </Paper>
    )
}

// A food that goes in another, its amount editable in place
function ContentRow({
    content,
    autoFocus,
    onBlurred,
    onCommit,
    onRemove,
}: {
    content: FoodContent
    autoFocus: boolean
    onBlurred: () => void
    onCommit: (quantity: number) => Promise<boolean>
    onRemove: () => void
}) {
    const [draft, setDraft] = useState(String(content.quantity))
    const amount = Number(draft)
    // The values follow what is typed, before it is saved
    const shown = foodNutrients(content.food, amount > 0 ? amount : content.quantity)

    async function commit() {
        onBlurred()
        if (!(amount > 0)) return setDraft(String(content.quantity))
        if (amount === content.quantity) return
        if (!(await onCommit(amount))) setDraft(String(content.quantity))
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap variant="body2">{content.food.name}</Typography>
                <Typography variant="caption" color="text.secondary" component="div">{describeNutrients(shown)}</Typography>
            </Box>
            <QuantityInput
                value={draft}
                unit={content.food.unit}
                label={`Amount of ${content.food.name}`}
                autoFocus={autoFocus}
                dense
                onChange={setDraft}
                onCommit={commit}
                onCancel={() => setDraft(String(content.quantity))}
            />
            <Tooltip title="Take it out">
                <IconButton size="small" aria-label={`Take ${content.food.name} out`} onClick={onRemove}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    )
}
