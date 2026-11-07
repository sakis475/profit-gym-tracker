import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Box, Button, TextField, Typography, Alert, CircularProgress, Paper, Divider } from '@mui/material'
import { Google as GoogleIcon } from '@mui/icons-material'

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

    async function handleSignUp(e: FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)
        const { data, error } = await supabase.auth.signUp({ email, password })
        setLoading(false)
        if (error) {
            setError(error.message)
            return
        }
        const signedUser = data?.user ?? data?.session?.user ?? null
        if (signedUser) {
            onSuccess?.(signedUser)
            return
        }
        setError('Sign-up successful — please confirm your email before signing in.')
    }

    async function handleGoogleSignIn() {
        setError(null)
        setLoading(true)
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        })
        // On success the browser is redirected to Google, so this only runs on failure.
        if (error) {
            setError(error.message)
            setLoading(false)
        }
    }

    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <Paper sx={{ p: 3, width: 420 }}>
                <form onSubmit={handleSignIn}>
                    <Typography variant="h6" gutterBottom>Sign in / Sign up</Typography>
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
                    <Box display="flex" gap={1}>
                        <Button type="submit" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : null}>
                            Sign in
                        </Button>
                        <Button type="button" variant="outlined" onClick={handleSignUp} disabled={loading}>
                            Sign up
                        </Button>
                    </Box>
                </form>
                <Divider sx={{ my: 2 }}>or</Divider>
                <Button
                    type="button"
                    variant="outlined"
                    fullWidth
                    startIcon={<GoogleIcon />}
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                >
                    Continue with Google
                </Button>
            </Paper>
        </Box>
    )
}
