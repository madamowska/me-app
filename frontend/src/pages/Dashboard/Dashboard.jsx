import { useEffect, useState } from 'react'
import './Dashboard.css'
import SyncButton from '../../features/activities/SyncButton'
import '../../features/activities/activities.css'

export default function Dashboard() {
  const [lastActivity, setLastActivity] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLastActivity() {
      try {
        const response = await fetch('/api/last-activity')
        const data = await response.json()
        setLastActivity(data)
      } catch (error) {
        console.error('Failed to load last activity:', error)
        setLastActivity({
          type: 'Workout',
          date: 'Unavailable',
          duration: '--',
          message: 'Your last workout will appear here.',
        })
      } finally {
        setLoading(false)
      }
    }

    loadLastActivity()
  }, [])

  const summary = lastActivity ? (
    lastActivity.message ||
    `${lastActivity.type || 'Workout'} • ${lastActivity.duration || '--'} • ${lastActivity.date || ''}`
  ) : 'Your last workout will appear here.'

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <div className="activity-card">
          <div className="activity-label">Last activity</div>
          <div className="activity-value">
            {loading ? 'Loading...' : summary}
          </div>
        </div>
        <SyncButton />
      </div>
    </main>
  )
}
