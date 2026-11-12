import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Box, Button, TextField, Typography, Alert, CircularProgress, Paper } from '@mui/material'
import { useT } from '../i18n'

type Props = {
    onSuccess?: (user: any | null) => void
}

export default function Login({ onSuccess }: Props) {
    const m = useT()
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
                    <Typography variant="h6" gutterBottom>{m.login.title}</Typography>
                    {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}
                    <TextField
                        label={m.login.email}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        fullWidth
                        required
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label={m.login.password}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                        required
                        sx={{ mb: 2 }}
                    />
                    <Button type="submit" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : null}>
                        {m.login.submit}
                    </Button>
                </form>
            </Paper>
        </Box>
    )
}
