import './Dashboard.css'
import { useState } from 'react'
import LastActivityCard from '../../features/activities/LastActivityCard'
import SyncButton from '../../features/activities/SyncButton'
import '../../features/activities/activities.css'

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)

  function handleSyncSuccess() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <main className="dashboard-page">
      <div
        className="dashboard-shell"
        style={{ position: 'relative' }}
      >
        <div>
          <LastActivityCard refreshKey={refreshKey} />
          <SyncButton onSuccess={handleSyncSuccess} />
        </div>

        {/* Placeholder positioned to the right without affecting the size of the last activity card */}
        <aside
          className="last-activity-card"
          style={{
            position: 'absolute',
            left: 'calc(100% + 20px)',
            top: 0,
            width: 550,
            minHeight: 120,
            background: 'transparent',
            boxShadow: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Weekly distance chart placeholder"
        >
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <h4 style={{ margin: 0, color: 'inherit' }}>Weekly distance</h4>
            <p style={{ margin: '8px 0 0' }}>
              Placeholder — chart will appear here when available.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
