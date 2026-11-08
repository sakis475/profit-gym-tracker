import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Training from './pages/Training'
import Nutrition from './pages/Nutrition'
import Profile from './pages/Profile'
import Header from './components/Header'
import { CssBaseline, Container } from '@mui/material'

function App() {
  const [user, setUser] = useState<any | null>(null)

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
    <>
      <CssBaseline />
      <BrowserRouter>
        <Header user={user} onSignOut={handleSignOut} />
        <Container maxWidth="lg" sx={{ mt: 3 }}>
          <Routes>
            <Route
              path="/"
              element={user ? <Navigate to="/training" replace /> : <Login onSuccess={setUser} />}
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
    </>
  )
}

export default App
