import { Link as RouterLink, useLocation } from 'react-router-dom'
import { AppBar, Toolbar, Button, Box } from '@mui/material'
import type { User } from '@supabase/supabase-js'

type Props = {
    user: User | null
    onSignOut: () => void
}

const navLinks = [
    { label: 'Exercises', to: '/' },
    { label: 'Workout', to: '/workout' },
]

export default function Header({ user, onSignOut }: Props) {
    const { pathname } = useLocation()

    return (
        <AppBar position="sticky">
            <Toolbar>
                <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
                    {user && navLinks.map((link) => (
                        <Button
                            key={link.to}
                            color="inherit"
                            component={RouterLink}
                            to={link.to}
                            sx={{ fontWeight: pathname === link.to ? 700 : 400 }}
                        >
                            {link.label}
                        </Button>
                    ))}
                </Box>

                {user && <Button color="inherit" onClick={onSignOut}>Sign out</Button>}
            </Toolbar>
        </AppBar>
    )
}
