import './Dashboard.css'
import { useEffect, useRef, useState } from 'react'
import LastActivityCard from '../../features/activities/LastActivityCard'
import '../../features/activities/activities.css'
import WeeklyDistanceChart from '../../features/chart/WeeklyDistanceChart'
import DailyFeedback from '../../features/feedback/DailyFeedback'
import WeekSection from '../../features/week/WeekSection'

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const activityCardRef = useRef(null)
  const [activityCardHeight, setActivityCardHeight] = useState(null)

  useEffect(() => {
    const activityCard = activityCardRef.current
    if (!activityCard) return undefined

    const updateHeight = () => setActivityCardHeight(activityCard.getBoundingClientRect().height)
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(activityCard)
    updateHeight()

    return () => resizeObserver.disconnect()
  }, [])

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
          <LastActivityCard
            refreshKey={refreshKey}
            cardRef={activityCardRef}
            onSyncSuccess={handleSyncSuccess}
          />
        </div>

        <WeeklyDistanceChart
          weeks={10}
          style={activityCardHeight ? { '--weekly-distance-height': `${activityCardHeight}px` } : undefined}
        />

        <WeekSection />

        <DailyFeedback />

      </div>
    </main>
  )
}
