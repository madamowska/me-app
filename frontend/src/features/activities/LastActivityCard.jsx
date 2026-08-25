// src/features/activities/LastActivityCard.jsx
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import ActivityDetailsPopup from './ActivityDetailsPopup'
import { getLastActivity } from './api'
import { formatDistanceKm, formatSpeed, formatDate } from './activityFormat'
import './activities.css'

export default function LastActivityCard() {
  const [activity, setActivity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await getLastActivity()
        if (!cancelled) setActivity(data)
      } catch (err) {
        console.error('Failed to load last activity:', err)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div className="last-activity-card">Loading...</div>
  }

  if (error || !activity) {
    return (
      <div className="last-activity-card">
        <p className="last-activity-empty">
          {error ? 'Could not load your last activity.' : 'Your last workout will appear here.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="last-activity-card">
        <table className="last-activity-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Distance</th>
              <th>Speed</th>
              <th>Date</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{activity.activity_name || activity.activity_type || 'Activity'}</td>
              <td>{formatDistanceKm(activity.distance_m)}</td>
              <td>{formatSpeed(activity.activity_type, activity.avg_speed_mps)}</td>
              <td>{formatDate(activity.start_time)}</td>
              <td>
                <Button variant="accent" onClick={() => setDetailsOpen(true)}>
                  Details
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ActivityDetailsPopup
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        activity={activity}
      />
    </>
  )
}