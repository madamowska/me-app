import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import './styles.css'

import Home from './pages/Home/Home'
import Dashboard from './pages/Dashboard/Dashboard'
import AthleteProfile from './pages/AthleteProfile/AthleteProfile'
import InjuryHistory from './pages/InjuryHistory/InjuryHistory'
import Plan from './pages/Plan/Plan'
import CreateWorkoutPlan from './pages/Plan/CreateWorkoutPlan'
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
      onPlanClick={() => navigate('/plan')}
      onHomeClick={() => navigate('/')}
      onCreateNewClick={() => navigate('/dashboard')}
    />

    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/athlete-profile" element={<AthleteProfile />} />
      <Route path="/injury-history" element={<InjuryHistory />} />
      <Route path="/plan" element={<Plan />} />
      <Route path="/plan/create" element={<CreateWorkoutPlan />} />
    </Routes>

    {settingsOpen && (
      <SettingsPopup
        onClose={closeSettings}
      />
    )}
  </>
)
}