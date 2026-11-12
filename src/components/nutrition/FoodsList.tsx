import { useMemo, useRef, useState } from 'react'
import {
    Autocomplete,
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
    Tab,
    Tabs,
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
    NO_NUTRIENTS,
    NUTRIENTS,
    contentsNutrients,
    defaultQuantity,
    describeFood,
    describeNutrients,
    foodNutrients,
    quantityUnitLabel,
    sumNutrients,
    unitPer,
    type FoodContent,
    type NutrientKey,
} from '../../lib/nutrition'
import { normalizeSearch } from '../../lib/workoutStats'
import { lastTab, rememberTab } from '../../lib/lastPlace'
import { libraryNote, type PublicFood } from '../../services/foodLibrary'
import type { FoodRow } from '../../types/entityTypes'
import FoodEntryDialog from './FoodEntryDialog'
import PublicLibrary from './PublicLibrary'
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
import { useT } from '../../i18n'

type Props = {
    foods: FoodRow[]
    // What goes in each food, by its id
    contents: Map<string, FoodContent[]>
    onChange: () => void
}

type FoodForm = { name: string; unit: string; notes: string } & Record<NutrientKey, string>

type FoodsTab = 'mine' | 'library'
// Where the open tab is remembered, beside the pages' own
const TAB_KEY = '/nutrition#foods'

// A food in the dialog's "Made of" list: already saved (`id`) or added in the dialog, its amount as typed
type DraftContent = { key: string; id?: string; food: FoodRow; quantity: string }

const EMPTY_FORM: FoodForm ={ name: '', unit: 'g', notes: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '' }

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
    const m = useT()
    // Your foods, or the public library to add from; opens on the one last used
    const [tab, setTab] = useState<FoodsTab>(() => (lastTab(TAB_KEY) === 'library' ? 'library' : 'mine'))
    const [search, setSearch] = useState('')
    const [form, setForm] = useState<FoodForm | null>(null)
    const [editing, setEditing] = useState<FoodRow | null>(null)
    // What the food in the dialog is made of, as edited there; saved with the food
    const [madeOf, setMadeOf] = useState<DraftContent[]>([])
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

    // `prefill` starts a new food from given values, e.g. a product from the public library
    function openForm(food?: FoodRow, prefill?: FoodForm) {
        setEditing(food ?? null)
        setForm(food ? toForm(food) : prefill ?? EMPTY_FORM)
        setMadeOf((food ? contents.get(food.id) ?? [] : []).map((c) => ({
            key: c.id,
            id: c.id,
            food: c.food,
            quantity: String(c.quantity),
        })))
        setError(null)
    }

    // Saves the dialog's "Made of" list for `foodId`: what was taken out, changed or added since it opened
    async function saveMadeOf(foodId: string) {
        const before = editing ? contents.get(editing.id) ?? [] : []
        const kept = new Set(madeOf.flatMap((c) => (c.id ? [c.id] : [])))
        const results = await Promise.all([
            ...before.filter((c) => !kept.has(c.id)).map((c) => deleteFoodContent(c.id)),
            ...madeOf.map(async (c, order) => {
                const quantity = Number(c.quantity)
                if (!c.id) return !!(await createFoodContent({ foodId, contentId: c.food.id, quantity, order }))
                const index = before.findIndex((b) => b.id === c.id)
                const unchanged = index === order && before[index].quantity === quantity
                return unchanged || updateFoodContent(c.id, { quantity, order })
            }),
        ])
        return results.every(Boolean)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form) return
        setError(null)
        if (!form.name.trim()) return setError(m.nutrition.foods.nameRequired)

        const values = {} as Record<NutrientKey, number>
        for (const { key, label } of NUTRIENTS) {
            // Left empty, it is 0
            const value = form[key] === '' ? 0 : Number(form[key])
            if (!(value >= 0)) return setError(m.nutrition.foods.mustBeZeroOrMore(label))
            values[key] = value
        }
        const badAmount = madeOf.find((c) => !(Number(c.quantity) > 0))
        if (badAmount) return setError(m.nutrition.foods.amountPositive(badAmount.food.name))

        const payload = { name: form.name.trim(), unit: form.unit, notes: form.notes.trim() || null, ...values }
        setSaving(true)
        const res = editing ? await updateFood(editing.id, payload) : await createFood(payload)
        const contentsSaved = !!res && await saveMadeOf(res.id)
        setSaving(false)
        if (!res) return setError(editing ? m.nutrition.foods.failedToSaveFood : m.nutrition.foods.failedToCreateFood)
        // Either way the dialog closes: saving it again could add what was already saved twice.
        // Opened again, it shows what was saved.
        setForm(null)
        setListError(contentsSaved ? null : m.nutrition.foods.savedNotContents(res.name))
        onChange()
    }

    async function handleDelete() {
        if (!deleting) return
        setSaving(true)
        const res = await deleteFood(deleting.id)
        setSaving(false)
        if (!res) return setError(m.nutrition.foods.failedToDeleteFood)
        setDeleting(null)
        onChange()
    }

    // Why `food` can't go in `into`, or null when it can. One level only: a food with contents
    // goes in no other, and a food that goes in another gets no contents.
    function cannotPutIn(food: FoodRow, into: FoodRow) {
        if (food.id === into.id) return m.nutrition.foods.cantGoInItself(food.name)
        if ((contents.get(food.id) ?? []).length > 0) return m.nutrition.cantGoIn(food.name)
        const parent = parentOf.get(into.id)
        if (parent) return m.nutrition.foods.goesIn(into.name, parent.name)
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
        if (!id) return { error: m.nutrition.foods.failedToPutIn(food.name, into.name) }
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

    function chooseTab(next: FoodsTab) {
        setTab(next)
        rememberTab(TAB_KEY, next)
    }

    // A product from the library opens the add food form with its values, to check before saving.
    // Values the label lacks are left empty, which saves as 0.
    function addFromLibrary(food: PublicFood) {
        const value = (n: number | null) => (n === null ? '' : String(Math.round(n * 10) / 10))
        openForm(undefined, {
            name: food.name,
            unit: food.unit,
            notes: libraryNote(food),
            kcal: value(food.nutrients.kcal),
            protein: value(food.nutrients.protein),
            carbs: value(food.nutrients.carbs),
            fat: value(food.nutrients.fat),
            fiber: value(food.nutrients.fiber),
        })
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={dropCollision}
            onDragStart={({ active }: DragStartEvent) => setDragging((active.data.current as FoodDragData | undefined) ?? null)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <Tabs value={tab} onChange={(_, value: FoodsTab) => chooseTab(value)} sx={{ mb: 2, minHeight: 40 }}>
                <Tab value="mine" label={m.nutrition.foods.tabs.mine} sx={{ minHeight: 40 }} />
                <Tab value="library" label={m.nutrition.foods.tabs.library} sx={{ minHeight: 40 }} />
            </Tabs>

            {tab === 'library' ? (
                <PublicLibrary myFoods={foods} onAdd={addFromLibrary} />
            ) : (
                <WithFoodSidebar foods={foods} contents={contents} title={m.nutrition.sidebar.titleFoods}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                        <TextField
                            size="small"
                            placeholder={m.nutrition.foods.searchFoods}
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
                            {m.nutrition.addFood}
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
                                                    onCommit={(quantity) => run(() => updateFoodContent(c.id, { quantity }), m.common.failedToSave)}
                                                    onRemove={() => run(() => deleteFoodContent(c.id), m.nutrition.foods.failedToTakeOut(c.food.name))}
                                                />
                                            ))}
                                        </ContentsList>
                                    )}
                                </FoodCard>
                            )
                        })}
                        {shown.length === 0 && (
                            <Typography sx={{ mt: 2 }}>{foods.length === 0 ? m.nutrition.foods.noFoodsYet : m.nutrition.foods.noMatches}</Typography>
                        )}
                    </Stack>
                </WithFoodSidebar>
            )}

            <DragOverlay dropAnimation={null}>
                {dragging && <DragPreview name={dragging.food.name} />}
            </DragOverlay>

            {puttingIn && (
                <FoodEntryDialog
                    title={m.nutrition.putIn(puttingIn.name)}
                    submitLabel={m.common.add}
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
                <DialogTitle>{editing ? m.nutrition.foods.editFood : m.nutrition.addFood}</DialogTitle>
                {form && (
                    <form onSubmit={handleSubmit}>
                        <DialogContent>
                            <TextField
                                label={m.common.name}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                fullWidth
                                required
                                sx={{ mt: 1, mb: 2 }}
                            />
                            {/* Made of foods, it comes to what is in it, so its own unit and values don't apply */}
                            {madeOf.length === 0 && (
                                <>
                                    <TextField
                                        select
                                        label={m.nutrition.foods.measuredIn}
                                        value={form.unit}
                                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                        fullWidth
                                        helperText={m.nutrition.foods.valuesPer(unitPer(form.unit))}
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
                                </>
                            )}
                            <MadeOfEditor
                                items={madeOf}
                                // A food with foods in it goes in no other, and a food goes in no food it is in
                                candidates={foods.filter((f) => f.id !== editing?.id && !contents.has(f.id))}
                                blockedBy={editing ? parentOf.get(editing.id) ?? null : null}
                                onChange={setMadeOf}
                            />
                            <TextField
                                label={m.common.notes}
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                fullWidth
                                multiline
                                sx={{ mt: 2 }}
                            />
                            {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setForm(null)} disabled={saving}>{m.common.cancel}</Button>
                            <Button type="submit" variant="contained" disabled={saving}>
                                {saving ? m.common.saving : editing ? m.common.save : m.common.add}
                            </Button>
                        </DialogActions>
                    </form>
                )}
            </Dialog>

            <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
                <DialogTitle>{m.nutrition.foods.deleteTitle}</DialogTitle>
                <DialogContent>
                    <Typography>{deleting && m.nutrition.foods.deleteConfirm(deleting.name)}</Typography>
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)} disabled={saving}>{m.common.cancel}</Button>
                    <Button color="error" variant="contained" onClick={handleDelete} disabled={saving}>
                        {saving ? m.common.deleting : m.common.delete}
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
    const m = useT()
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
                    <Tooltip title={m.nutrition.putIn(food.name)}>
                        <IconButton aria-label={m.nutrition.putIn(food.name)} onClick={onPutIn}>
                            <AddIntoIcon />
                        </IconButton>
                    </Tooltip>
                )}
                <IconButton aria-label={m.nutrition.edit(food.name)} onClick={onEdit}>
                    <EditIcon />
                </IconButton>
                <IconButton aria-label={m.nutrition.foods.deleteAria(food.name)} onClick={onDelete}>
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
    const m = useT()
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
                label={m.nutrition.amountOf(content.food.name)}
                autoFocus={autoFocus}
                dense
                onChange={setDraft}
                onCommit={commit}
                onCancel={() => setDraft(String(content.quantity))}
            />
            <Tooltip title={m.nutrition.foods.takeOut}>
                <IconButton size="small" aria-label={m.nutrition.foods.takeOutAria(content.food.name)} onClick={onRemove}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    )
}

// The "Made of" part of the food dialog: the foods in it with their amounts, to change, take out
// or add to. Nothing is saved until the dialog is. `blockedBy` is the food this one goes in, which
// keeps it from having foods in it (one level only).
function MadeOfEditor({
    items,
    candidates,
    blockedBy,
    onChange,
}: {
    items: DraftContent[]
    candidates: FoodRow[]
    blockedBy: FoodRow | null
    onChange: (items: DraftContent[]) => void
}) {
    const m = useT()
    // The text in the add box, cleared after each pick
    const [search, setSearch] = useState('')
    // Keys for the foods added in the dialog, which have no id yet
    const nextKey = useRef(0)

    const total = sumNutrients(items.map((c) => {
        const amount = Number(c.quantity)
        return amount > 0 ? foodNutrients(c.food, amount) : NO_NUTRIENTS
    }))

    function add(food: FoodRow | null) {
        if (!food) return
        nextKey.current += 1
        onChange([...items, { key: `new:${nextKey.current}`, food, quantity: String(defaultQuantity(food.unit)) }])
        setSearch('')
    }

    return (
        <Box sx={{ mt: items.length > 0 ? 0 : 2 }}>
            {blockedBy ? (
                <Typography variant="body2" color="text.secondary">
                    {m.nutrition.foods.blockedBy(blockedBy.name)}
                </Typography>
            ) : (
                <>
                    {items.length > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {describeNutrients(total)}
                        </Typography>
                    )}
                    {items.map((c, i) => {
                        const amount = Number(c.quantity)
                        return (
                            <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" noWrap>{c.food.name}</Typography>
                                    <Typography variant="caption" color="text.secondary" component="div">
                                        {amount > 0 ? describeNutrients(foodNutrients(c.food, amount)) : m.nutrition.foods.enterAmount}
                                    </Typography>
                                </Box>
                                <TextField
                                    size="small"
                                    type="number"
                                    value={c.quantity}
                                    error={!(amount > 0)}
                                    onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                                    inputProps={{ min: 0, step: 'any', inputMode: 'decimal', 'aria-label': m.nutrition.amountOf(c.food.name) }}
                                    InputProps={{ endAdornment: <InputAdornment position="end">{quantityUnitLabel(c.food.unit)}</InputAdornment> }}
                                    sx={{ width: 120, flexShrink: 0 }}
                                />
                                <Tooltip title={m.nutrition.foods.takeOut}>
                                    <IconButton
                                        size="small"
                                        aria-label={m.nutrition.foods.takeOutAria(c.food.name)}
                                        onClick={() => onChange(items.filter((_, j) => j !== i))}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )
                    })}
                    <Autocomplete
                        options={candidates}
                        value={null}
                        inputValue={search}
                        onInputChange={(_, value, reason) => {
                            // Picking a food clears the box rather than filling it with the name
                            if (reason !== 'reset') setSearch(value)
                        }}
                        onChange={(_, food) => add(food)}
                        getOptionLabel={(f) => f.name}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                size="small"
                                placeholder={items.length > 0 ? m.nutrition.foods.addAnother : m.nutrition.foods.addFirst}
                            />
                        )}
                        sx={{ mt: 1 }}
                    />
                </>
            )}
        </Box>
    )
}
