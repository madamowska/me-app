import './Dashboard.css'
import { useState } from 'react'
import Button from '../../components/ui/Button'
import LastActivityCard from '../../features/activities/LastActivityCard'
import SyncButton from '../../features/activities/SyncButton'
import '../../features/activities/activities.css'
import WeeklyDistanceChart from '../../features/chart/WeeklyDistanceChart'

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

        {/* Weekly distance chart (RPC) — absolutely positioned so it doesn't affect LastActivityCard size */}
        <WeeklyDistanceChart weeks={10} />

        <div className="workout-plan-button-wrap">
          <Button variant="accent">
            Generate workout plan
          </Button>
        </div>
      </div>
    </main>
  )
}
