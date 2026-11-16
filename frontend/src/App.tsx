import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initMitra } from './lib/mitra-auth'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import PraticasPage from './pages/PraticasPage'
import VideosPage from './pages/VideosPage'
import CanaisPage from './pages/CanaisPage'
import ChatPage from './pages/ChatPage'
import MentoresPage from './pages/MentoresPage'
import ConfiguracoesPage from './pages/ConfiguracoesPage'
import LivroPage from './pages/LivroPage'

function App() {
  const [configured, setConfigured] = useState(initMitra)

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={() => setConfigured(true)} />} />
      <Route element={configured ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat" element={<Navigate to="/" replace />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/praticas" element={<PraticasPage />} />
        <Route path="/livro" element={<LivroPage />} />
        <Route path="/mentores" element={<MentoresPage />} />
        <Route path="/canais" element={<CanaisPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
