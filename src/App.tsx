import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lastPage, rememberPage } from './lib/lastPlace'
import Login from './pages/Login'
import Training from './pages/Training'
import Nutrition from './pages/Nutrition'
import Profile from './pages/Profile'
import Header from './components/Header'
import { CssBaseline, Container, ThemeProvider, createTheme } from '@mui/material'
import { useLanguage } from './i18n'

// Keeps track of the page being shown, so the app opens there next time
function RememberPage() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    rememberPage(pathname, search)
  }, [pathname, search])
  return null
}

function App() {
  const [user, setUser] = useState<any | null>(null)
  // A change of language re-renders the app from here down, in place: nothing is remounted, so
  // what is on screen (an open dialog, a typed value, the day shown) stays as it is
  const language = useLanguage()
  // MUI's own texts (e.g. "No options") in the same language
  const theme = useMemo(() => createTheme({}, language.mui), [language])

  useEffect(() => {
    let mounted = true

    async function fetchUser() {
      const { data } = await supabase.auth.getUser()
      if (mounted) setUser(data?.user ?? null)
    }

    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <RememberPage />
        <Header user={user} onSignOut={handleSignOut} />
        <Container maxWidth="lg" sx={{ mt: 3 }}>
          <Routes>
            <Route
              path="/"
              // Signed in, the app opens where it was left, or on training the first time
              element={user ? <Navigate to={lastPage() ?? '/training'} replace /> : <Login onSuccess={setUser} />}
            />
            <Route
              path="/training"
              element={user ? <Training /> : <Navigate to="/" replace />}
            />
            {/* The training pages before they became tabs, so old links and bookmarks still work */}
            <Route path="/workout" element={<Navigate to="/training" replace />} />
            <Route path="/schedule" element={<Navigate to="/training?tab=plan" replace />} />
            <Route path="/history" element={<Navigate to="/training?tab=history" replace />} />
            <Route
              path="/nutrition"
              element={user ? <Nutrition /> : <Navigate to="/" replace />}
            />
            <Route
              path="/profile"
              element={user ? <Profile /> : <Navigate to="/" replace />}
            />
          </Routes>
        </Container>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
