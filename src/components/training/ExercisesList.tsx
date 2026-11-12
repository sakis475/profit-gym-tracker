import { useEffect, useMemo, useState } from 'react'
import { getExercises, getExerciseCategories, createExercise, updateExercise, deleteExercise } from '../../services/exercises'
import type { ExerciseInsert, ExerciseRow } from '../../types/entityTypes'
import {
    Autocomplete,
    Typography,
    Button,
    Box,
    List,
    ListItem,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useT } from '../../i18n'

type SortBy = 'category' | 'name'

export default function ExercisesList() {
    const m = useT()
    const x = m.training.exercises
    const [items, setItems] = useState<ExerciseRow[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [name, setName] = useState('')
    const [category, setCategory] = useState('')
    const [categories, setCategories] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState<ExerciseRow | null>(null)
    const [deleting, setDeleting] = useState<ExerciseRow | null>(null)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [filterCategory, setFilterCategory] = useState('')
    const [sortBy, setSortBy] = useState<SortBy>('category')

    async function load() {
        setLoading(true)
        const data = await getExercises()
        setItems(data)
        setLoading(false)
    }

    useEffect(() => {
        load()
    }, [])

    async function openModal(exercise?: ExerciseRow) {
        setEditing(exercise ?? null)
        setName(exercise?.name ?? '')
        setCategory(exercise?.category ?? '')
        setError(null)
        setModalOpen(true)
        setCategories((await getExerciseCategories()) ?? [])
    }

    function closeModal() {
        setModalOpen(false)
        setEditing(null)
        setName('')
        setCategory('')
    }

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault()
        setError(null)
        if (!name.trim()) {
            setError(x.nameRequired)
            return
        }
        setCreating(true)
        const payload: Partial<ExerciseInsert> = {
            name: name.trim(),
            category: category.trim() || null,
        }
        const res = editing
            ? await updateExercise(editing.id, payload)
            : await createExercise(payload as ExerciseInsert)
        setCreating(false)
        if (!res) {
            setError(editing ? x.failedToUpdate : x.failedToCreate)
            return
        }
        closeModal()
        load()
    }

    async function handleDelete() {
        if (!deleting) return
        setDeleteBusy(true)
        const res = await deleteExercise(deleting.id)
        setDeleteBusy(false)
        if (!res) {
            setError(x.failedToDelete)
            return
        }
        setDeleting(null)
        load()
    }

    const availableCategories = useMemo(() => {
        const set = new Set<string>()
        for (const it of items ?? []) {
            const trimmed = it.category?.trim()
            if (trimmed) set.add(trimmed)
        }
        return [...set].sort((a, b) => a.localeCompare(b))
    }, [items])

    const displayedItems = useMemo(() => {
        const filtered = (items ?? []).filter((it) =>
            filterCategory ? it.category === filterCategory : true
        )
        return [...filtered].sort((a, b) => {
            if (sortBy === 'category') {
                const catCompare = (a.category ?? '').localeCompare(b.category ?? '')
                if (catCompare !== 0) return catCompare
            }
            return a.name.localeCompare(b.name)
        })
    }, [items, filterCategory, sortBy])

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal()}>
                    {x.add}
                </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="filter-category-label">{x.filterByCategory}</InputLabel>
                    <Select
                        labelId="filter-category-label"
                        label={x.filterByCategory}
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <MenuItem value="">{x.allCategories}</MenuItem>
                        {availableCategories.map((cat) => (
                            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="sort-by-label">{x.sortBy}</InputLabel>
                    <Select
                        labelId="sort-by-label"
                        label={x.sortBy}
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                    >
                        <MenuItem value="category">{x.category}</MenuItem>
                        <MenuItem value="name">{x.name}</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box sx={{ minHeight: '60vh' }}>
                {loading && !items ? (
                    <Typography>{m.common.loading}</Typography>
                ) : (
                    <List>
                        {displayedItems.length > 0 ? (
                            displayedItems.map((it) => (
                                <ListItem
                                    key={it.id}
                                    secondaryAction={
                                        <>
                                            <IconButton aria-label={x.editAria} onClick={() => openModal(it)}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton aria-label={x.deleteAria} onClick={() => { setError(null); setDeleting(it) }}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </>
                                    }
                                >
                                    <ListItemText primary={it.name} secondary={it.category} />
                                </ListItem>
                            ))
                        ) : (
                            <Typography>{x.none}</Typography>
                        )}
                    </List>
                )}
            </Box>

            <Dialog open={modalOpen} onClose={closeModal}>
                <DialogTitle>{editing ? x.editTitle : x.createTitle}</DialogTitle>
                <form onSubmit={handleSubmit}>
                    <DialogContent>
                        <TextField
                            label={x.name}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            fullWidth
                            required
                            sx={{ mt: 1, mb: 2 }}
                        />
                        <Autocomplete
                            freeSolo
                            options={categories}
                            inputValue={category}
                            onInputChange={(_, value) => setCategory(value)}
                            renderInput={(params) => <TextField {...params} label={x.category} />}
                        />
                        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeModal} disabled={creating}>{m.common.cancel}</Button>
                        <Button type="submit" variant="contained" disabled={creating}>
                            {editing ? (creating ? m.common.saving : m.common.save) : (creating ? m.common.creating : m.common.create)}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
                <DialogTitle>{x.deleteTitle}</DialogTitle>
                <DialogContent>
                    <Typography>{deleting && x.deleteConfirm(deleting.name)}</Typography>
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)} disabled={deleteBusy}>{m.common.cancel}</Button>
                    <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteBusy}>
                        {deleteBusy ? m.common.deleting : m.common.delete}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
