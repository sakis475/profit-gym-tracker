import { Link as RouterLink, useLocation } from 'react-router-dom'
import { AppBar, Toolbar, Button, Box, IconButton, Tooltip } from '@mui/material'
import { AccountCircle as ProfileIcon, Logout as LogoutIcon } from '@mui/icons-material'
import type { User } from '@supabase/supabase-js'

type Props = {
    user: User | null
    onSignOut: () => void
}

const navLinks = [
    { label: 'Exercises', to: '/' },
    { label: 'Workout', to: '/workout' },
    { label: 'Schedule', to: '/schedule' },
    { label: 'History', to: '/history' },
    { label: 'Nutrition', to: '/nutrition' },
]

export default function Header({ user, onSignOut }: Props) {
    const { pathname } = useLocation()

    return (
        <AppBar position="sticky">
            <Toolbar>
                <Box sx={{ flexGrow: 1, display: 'flex', gap: 1, overflowX: 'auto', minWidth: 0 }}>
                    {user && navLinks.map((link) => (
                        <Button
                            key={link.to}
                            color="inherit"
                            component={RouterLink}
                            to={link.to}
                            sx={{ fontWeight: pathname === link.to ? 700 : 400, flexShrink: 0 }}
                        >
                            {link.label}
                        </Button>
                    ))}
                </Box>

                {user && (
                    <Box sx={{ display: 'flex', flexShrink: 0 }}>
                        <Tooltip title="Profile">
                            <IconButton
                                color="inherit"
                                component={RouterLink}
                                to="/profile"
                                aria-label="Profile"
                                aria-current={pathname === '/profile' ? 'page' : undefined}
                            >
                                <ProfileIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Sign out">
                            <IconButton color="inherit" onClick={onSignOut} aria-label="Sign out">
                                <LogoutIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Toolbar>
        </AppBar>
    )
}
