import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import './styles.css'

import Home from './pages/Home/Home'
import Dashboard from './pages/Dashboard/Dashboard'
import HamburgerButton from './components/layout/HamburgerButton'
import Sidebar from './components/layout/Sidebar'
import SettingsPopup from './components/popups/SettingsPopup'

export default function App() {
const [sidebarOpen, setSidebarOpen] = useState(false)
const [settingsOpen, setSettingsOpen] = useState(false)

function openSettings() {
  setSettingsOpen(true)
  setSidebarOpen(false)
}

return (
  <>
    <HamburgerButton onClick={() => setSidebarOpen(true)} hidden={sidebarOpen} />

    <Sidebar
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      onSettingsClick={openSettings}
    />

    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>

    <SettingsPopup
      isOpen={settingsOpen}
      onClose={() => setSettingsOpen(false)}
    />
  </>
)
}