// src/pages/Home.jsx
import { useNavigate } from 'react-router-dom'
import Hero from './Hero'

export default function Home() {
  const navigate = useNavigate()

  return <Hero onDashboardClick={() => navigate('/dashboard')} />
}