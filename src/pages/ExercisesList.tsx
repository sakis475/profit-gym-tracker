import { useEffect, useState } from 'react'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { getExercises, getExerciseCategories, createExercise, updateExercise, deleteExercise } from '../services/exercises'
import type { ExerciseInsert, ExerciseRow } from '../types/entityTypes'
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
    CircularProgress,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material'

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
    const theme = useTheme()
    // Swipe-to-refresh on small screens only; bigger screens use the Refresh button
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'))

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

    const spinner = (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
        </Box>
    )

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>Exercises</Typography>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={load}
                    disabled={loading}
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                >
                    Refresh
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal()}>
                    Add exercise
                </Button>
            </Box>

            <PullToRefresh
                onRefresh={load}
                isPullable={isSmallScreen}
                pullingContent={spinner}
                refreshingContent={spinner}
            >
                <Box sx={{ minHeight: '60vh' }}>
                    {loading && !items ? (
                        <Typography>Loading...</Typography>
                    ) : (
                        <List>
                            {items && items.length > 0 ? (
                                items.map((it) => (
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
            </PullToRefresh>

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
