import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initMitra } from './lib/mitra-auth'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import BuscaPage from './pages/BuscaPage'
import VideosPage from './pages/VideosPage'
import CanaisPage from './pages/CanaisPage'

function App() {
  const [configured, setConfigured] = useState(initMitra)

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={() => setConfigured(true)} />} />
      <Route element={configured ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<BuscaPage />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/canais" element={<CanaisPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
