import { useState } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { AppBar, Toolbar, Button, Box, IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import { AccountCircle as ProfileIcon, Check as CheckIcon, Logout as LogoutIcon, Translate as LanguageIcon } from '@mui/icons-material'
import type { User } from '@supabase/supabase-js'
import { LANGUAGES, setLanguage, useLanguage } from '../i18n'

type Props = {
    user: User | null
    onSignOut: () => void
}

export default function Header({ user, onSignOut }: Props) {
    const { pathname } = useLocation()
    const language = useLanguage()
    const m = language.messages

    const navLinks = [
        { label: m.header.training, to: '/training' },
        { label: m.header.nutrition, to: '/nutrition' },
    ]

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

                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                    {/* Also before signing in, so the sign-in page can be read */}
                    <LanguageMenu />
                    {user && (
                        <>
                            <Tooltip title={m.header.profile}>
                                <IconButton
                                    color="inherit"
                                    component={RouterLink}
                                    to="/profile"
                                    aria-label={m.header.profile}
                                    aria-current={pathname === '/profile' ? 'page' : undefined}
                                >
                                    <ProfileIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={m.header.signOut}>
                                <IconButton color="inherit" onClick={onSignOut} aria-label={m.header.signOut}>
                                    <LogoutIcon />
                                </IconButton>
                            </Tooltip>
                        </>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    )
}

// The language button and its menu of the app's languages, each in its own language
function LanguageMenu() {
    const language = useLanguage()
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)

    return (
        <>
            <Tooltip title={language.messages.header.language}>
                <IconButton
                    color="inherit"
                    onClick={(e) => setAnchor(e.currentTarget)}
                    aria-label={language.messages.header.language}
                    aria-haspopup="menu"
                    aria-expanded={!!anchor}
                >
                    <LanguageIcon />
                </IconButton>
            </Tooltip>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
                {LANGUAGES.map((l) => (
                    <MenuItem
                        key={l.code}
                        lang={l.code}
                        selected={l.code === language.code}
                        onClick={() => {
                            setAnchor(null)
                            setLanguage(l.code)
                        }}
                    >
                        <Box component="span" sx={{ width: 24, display: 'inline-flex' }}>
                            {l.code === language.code && <CheckIcon fontSize="small" />}
                        </Box>
                        {l.name}
                    </MenuItem>
                ))}
            </Menu>
        </>
    )
}
