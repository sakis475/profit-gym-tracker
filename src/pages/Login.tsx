import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Box, Button, TextField, Typography, Alert, CircularProgress, Paper } from '@mui/material'

type Props = {
    onSuccess?: (user: any | null) => void
}

export default function Login({ onSuccess }: Props) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSignIn(e: FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        setLoading(false)
        if (error) {
            setError(error.message)
            return
        }
        onSuccess?.(data?.user ?? data?.session?.user ?? null)
    }

    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <Paper sx={{ p: 3, width: 420 }}>
                <form onSubmit={handleSignIn}>
                    <Typography variant="h6" gutterBottom>Sign in</Typography>
                    {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}
                    <TextField
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        fullWidth
                        required
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                        required
                        sx={{ mb: 2 }}
                    />
                    <Button type="submit" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : null}>
                        Sign in
                    </Button>
                </form>
            </Paper>
        </Box>
    )
}
