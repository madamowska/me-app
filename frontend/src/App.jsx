import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import './styles.css'

import Home from './pages/Home/Home'
import Dashboard from './pages/Dashboard/Dashboard'
import AthleteProfile from './pages/AthleteProfile/AthleteProfile'
import InjuryHistory from './pages/InjuryHistory/InjuryHistory'
import HamburgerButton from './components/layout/HamburgerButton'
import Sidebar from './components/layout/Sidebar'
import SettingsPopup from './components/popups/SettingsPopup'

export default function App() {
const [sidebarOpen, setSidebarOpen] = useState(false)
const [settingsOpen, setSettingsOpen] = useState(false)
const navigate = useNavigate()

function openSettings() {
  setSettingsOpen(true)
  setSidebarOpen(false)
}

function closeSettings() {
  setSettingsOpen(false)
}

return (
  <>
    <HamburgerButton onClick={() => setSidebarOpen(true)} hidden={sidebarOpen} />

    <Sidebar
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      onSettingsClick={openSettings}
      onAthleteProfileClick={() => navigate('/athlete-profile')}
      onInjuryHistoryClick={() => navigate('/injury-history')}
      onHomeClick={() => navigate('/dashboard')}
    />

    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/athlete-profile" element={<AthleteProfile />} />
      <Route path="/injury-history" element={<InjuryHistory />} />
    </Routes>

    {settingsOpen && (
      <SettingsPopup
        onClose={closeSettings}
      />
    )}
  </>
)
}