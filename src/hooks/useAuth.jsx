import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const signingInRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (signingInRef.current) return
      setSession(session ?? null)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setProfileLoaded(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (signingInRef.current) return
      setSession(session ?? null)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setProfileLoaded(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    console.log('[fetchProfile]', { data, error })
    setProfile(data ?? null)
    setProfileLoaded(true)
  }

  async function signIn(email, password) {
    signingInRef.current = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error }

      // Forzar la sesión en el cliente antes de cualquier query (soluciona timing de RLS)
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })

      const { data: userProfile } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', data.user.id)
        .single()

      if (userProfile && userProfile.is_active === false) {
        await supabase.auth.signOut()
        return { error: { message: 'user_inactive' } }
      }

      setSession(data.session)
      await fetchProfile(data.user.id) // awaited: el perfil está listo antes de navegar
      return { data }
    } finally {
      signingInRef.current = false
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setProfileLoaded(false)
  }

  const isAdmin = profile?.role === 'general_admin' || profile?.role === 'sport_admin'
  // loading es true hasta que session Y perfil estén resueltos
  const loading = session === undefined || (session !== null && !profileLoaded)

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
