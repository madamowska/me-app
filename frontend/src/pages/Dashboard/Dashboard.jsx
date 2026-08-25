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
      <div className="dashboard-shell">
        <LastActivityCard refreshKey={refreshKey} />
        <SyncButton onSuccess={handleSyncSuccess} />
      </div>
    </main>
  )
}
