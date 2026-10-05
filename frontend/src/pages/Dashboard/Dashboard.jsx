import './Dashboard.css'
import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import LastActivityCard from '../../features/activities/LastActivityCard'
import SyncButton from '../../features/activities/SyncButton'
import '../../features/activities/activities.css'
import WeeklyDistanceChart from '../../features/chart/WeeklyDistanceChart'
import DailyFeedback from '../../features/feedback/DailyFeedback'
import useTransientMessage from '../../hooks/useTransientMessage'

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planMessage, setPlanMessage, showTransientPlanMessage] = useTransientMessage()
  const [planError, setPlanError] = useState(false)
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

  async function handleGenerateWorkoutPlan() {
    setGeneratingPlan(true)
    setPlanMessage('')
    setPlanError(false)

    try {
      const response = await fetch('/api/workout-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: {} }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || `Plan generation failed (${response.status}).`)
      }

      const contentType = response.headers.get('Content-Type') || ''
      if (!contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        throw new Error('The server did not return a DOCX file. Restart the backend and try again.')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      const filename = disposition?.match(/filename="([^"]+)"/i)?.[1]
        || 'weekly-workout-plan.docx'
      const docxFilename = filename.toLowerCase().endsWith('.docx')
        ? filename
        : `${filename}.docx`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = docxFilename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)

      showTransientPlanMessage('Your workout plan has been downloaded.')
    } catch (error) {
      setPlanError(true)
      showTransientPlanMessage(error.message || 'Could not generate the workout plan.')
    } finally {
      setGeneratingPlan(false)
    }
  }

  return (
    <main className="dashboard-page">
      <div
        className="dashboard-shell"
        style={{ position: 'relative' }}
      >
        <div>
          <LastActivityCard refreshKey={refreshKey} cardRef={activityCardRef} />
          <SyncButton onSuccess={handleSyncSuccess} />
        </div>

        <WeeklyDistanceChart
          weeks={10}
          style={activityCardHeight ? { '--weekly-distance-height': `${activityCardHeight}px` } : undefined}
        />

        <DailyFeedback />

        <div className="workout-plan-button-wrap">
          <Button
            variant="accent"
            onClick={handleGenerateWorkoutPlan}
            disabled={generatingPlan}
          >
            {generatingPlan ? 'Generating plan…' : 'Generate workout plan'}
          </Button>
          {planMessage && (
            <p
              className={`workout-plan-message${planError ? ' workout-plan-message--error' : ''}`}
              role={planError ? 'alert' : 'status'}
            >
              {planMessage}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
