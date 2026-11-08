import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ExercisesList from './pages/ExercisesList'
import Workout from './pages/Workout'
import Schedule from './pages/Schedule'
import History from './pages/History'
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
              element={user ? <ExercisesList /> : <Login onSuccess={setUser} />}
            />
            <Route
              path="/workout"
              element={user ? <Workout /> : <Navigate to="/" replace />}
            />
            <Route
              path="/schedule"
              element={user ? <Schedule /> : <Navigate to="/" replace />}
            />
            <Route
              path="/history"
              element={user ? <History /> : <Navigate to="/" replace />}
            />
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
