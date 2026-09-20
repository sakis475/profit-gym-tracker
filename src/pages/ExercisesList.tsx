import { useEffect, useState } from 'react'
import { getExercises, createExercise } from '../services/exercises'
import type { ExerciseInsert, ExerciseRow } from '../types/entityTypes'
import {
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
} from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'

export default function ExercisesList() {
    const [items, setItems] = useState<ExerciseRow[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [name, setName] = useState('')
    const [error, setError] = useState<string | null>(null)

    async function load() {
        setLoading(true)
        const data = await getExercises()
        setItems(data)
        setLoading(false)
    }

    useEffect(() => {
        load()
    }, [])

    async function handleCreate(e?: React.FormEvent) {
        e?.preventDefault()
        setError(null)
        if (!name.trim()) {
            setError('Name is required')
            return
        }
        setCreating(true)
        const payload: Partial<ExerciseInsert> = { name: name.trim() }
        const res = await createExercise(payload as ExerciseInsert)
        setCreating(false)
        if (!res) {
            setError('Failed to create exercise')
            return
        }
        setName('')
        setModalOpen(false)
        load()
    }

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>Exercises</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
                    Add exercise
                </Button>
            </Box>

            <Box>
                {loading ? (
                    <Typography>Loading...</Typography>
                ) : (
                    <List>
                        {items && items.length > 0 ? (
                            items.map((it) => (
                                <ListItem key={(it as any).id ?? (it as any).exerciseId ?? JSON.stringify(it)}>
                                    <ListItemText primary={(it as any).name ?? (it as any).title ?? JSON.stringify(it)} />
                                </ListItem>
                            ))
                        ) : (
                            <Typography>No exercises found.</Typography>
                        )}
                    </List>
                )}

                <Box sx={{ mt: 2 }}>
                    <Button variant="outlined" onClick={load}>Refresh</Button>
                </Box>
            </Box>

            <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
                <DialogTitle>Create exercise</DialogTitle>
                <form onSubmit={handleCreate}>
                    <DialogContent>
                        <TextField
                            label="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            fullWidth
                            required
                        />
                        {error && <Typography color="error">{error}</Typography>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setModalOpen(false)} disabled={creating}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
                    </DialogActions>
                </form>
            </Dialog>
        </>
    )
}
