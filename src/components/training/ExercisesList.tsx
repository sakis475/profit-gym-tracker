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

type SortBy = 'category' | 'name'

export default function ExercisesList() {
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
            setError('Name is required')
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
            setError(editing ? 'Failed to update exercise' : 'Failed to create exercise')
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
            setError('Failed to delete exercise')
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
                    Add exercise
                </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="filter-category-label">Filter by category</InputLabel>
                    <Select
                        labelId="filter-category-label"
                        label="Filter by category"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <MenuItem value="">All categories</MenuItem>
                        {availableCategories.map((cat) => (
                            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="sort-by-label">Sort by</InputLabel>
                    <Select
                        labelId="sort-by-label"
                        label="Sort by"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                    >
                        <MenuItem value="category">Category</MenuItem>
                        <MenuItem value="name">Name</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box sx={{ minHeight: '60vh' }}>
                {loading && !items ? (
                    <Typography>Loading...</Typography>
                ) : (
                    <List>
                        {displayedItems.length > 0 ? (
                            displayedItems.map((it) => (
                                <ListItem
                                    key={it.id}
                                    secondaryAction={
                                        <>
                                            <IconButton aria-label="Edit exercise" onClick={() => openModal(it)}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton aria-label="Delete exercise" onClick={() => { setError(null); setDeleting(it) }}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </>
                                    }
                                >
                                    <ListItemText primary={it.name} secondary={it.category} />
                                </ListItem>
                            ))
                        ) : (
                            <Typography>No exercises found.</Typography>
                        )}
                    </List>
                )}
            </Box>

            <Dialog open={modalOpen} onClose={closeModal}>
                <DialogTitle>{editing ? 'Edit exercise' : 'Create exercise'}</DialogTitle>
                <form onSubmit={handleSubmit}>
                    <DialogContent>
                        <TextField
                            label="Name"
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
                            renderInput={(params) => <TextField {...params} label="Category" />}
                        />
                        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeModal} disabled={creating}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={creating}>
                            {editing ? (creating ? 'Saving…' : 'Save') : (creating ? 'Creating…' : 'Create')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
                <DialogTitle>Delete exercise</DialogTitle>
                <DialogContent>
                    <Typography>Delete "{deleting?.name}"?</Typography>
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteBusy}>
                        {deleteBusy ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
