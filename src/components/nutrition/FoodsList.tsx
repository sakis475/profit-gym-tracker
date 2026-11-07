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
    List,
    ListItem,
    ListItemText,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material'
import { createFood, deleteFood, updateFood } from '../../services/nutrition'
import { FOOD_UNITS, NUTRIENTS, describeFood, unitPer, type NutrientKey } from '../../lib/nutrition'
import { normalizeSearch } from '../../lib/workoutStats'
import type { FoodRow } from '../../types/entityTypes'

type Props = {
    foods: FoodRow[]
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

export default function FoodsList({ foods, onChange }: Props) {
    const [search, setSearch] = useState('')
    const [form, setForm] = useState<FoodForm | null>(null)
    const [editing, setEditing] = useState<FoodRow | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<FoodRow | null>(null)

    const shown = useMemo(() => {
        const q = normalizeSearch(search.trim())
        return q ? foods.filter((f) => normalizeSearch(`${f.name} ${f.notes ?? ''}`).includes(q)) : foods
    }, [foods, search])

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

    return (
        <>
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

            <List>
                {shown.length > 0 ? (
                    shown.map((food) => (
                        <ListItem
                            key={food.id}
                            secondaryAction={
                                <>
                                    <IconButton aria-label={`Edit ${food.name}`} onClick={() => openForm(food)}>
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton aria-label={`Delete ${food.name}`} onClick={() => { setError(null); setDeleting(food) }}>
                                        <DeleteIcon />
                                    </IconButton>
                                </>
                            }
                            sx={{ pr: 12 }}
                        >
                            <ListItemText
                                primary={food.name}
                                secondary={
                                    <>
                                        {describeFood(food)}
                                        {food.notes && (
                                            <Typography component="span" variant="caption" sx={{ display: 'block', fontStyle: 'italic' }}>
                                                {food.notes}
                                            </Typography>
                                        )}
                                    </>
                                }
                            />
                        </ListItem>
                    ))
                ) : (
                    <Typography sx={{ mt: 2 }}>{foods.length === 0 ? 'No foods yet.' : 'No foods match your search.'}</Typography>
                )}
            </List>

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
                                helperText={`The values below are per ${unitPer(form.unit)}`}
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
                                        required={key === 'kcal'}
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
                        Delete "{deleting?.name}"? It is also taken out of your meal plan. Days you already logged keep it.
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
        </>
    )
}
