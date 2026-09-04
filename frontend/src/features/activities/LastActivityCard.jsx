// src/features/activities/LastActivityCard.jsx
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import ActivityDetailsPopup from './ActivityDetailsPopup'
import { getLastActivities } from './api'
import { formatDistanceKm, formatSpeed, formatDate } from './activityFormat'
import './activities.css'

export default function LastActivityCard({ refreshKey }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (!cancelled) {
          setLoading(true)
          setError(null)
        }

        const data = await getLastActivities()
        if (!cancelled) setActivities(data)
      } catch (err) {
        console.error('Failed to load last activities:', err)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [refreshKey])

  if (loading) {
    return <div className="last-activity-card">Loading...</div>
  }

  if (error || activities.length === 0) {
    return (
      <div className="last-activity-card">
        <p className="last-activity-empty">
          {error ? 'Could not load your activities.' : 'Your last workouts will appear here.'}
        </p>
      </div>
    )
  }

  const isRunning = typeof activities[0]?.activity_type === 'string' && activities[0].activity_type.toLowerCase().includes('running')

  const handleDetailsClick = (activity) => {
    setSelectedActivity(activity)
    setDetailsOpen(true)
  }

  return (
    <>
      <div className="last-activity-card">
        <h3 className="last-activity-title">Last Activities</h3>
        <table className="last-activity-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Distance</th>
              <th>{isRunning ? 'Pace' : 'Speed'}</th>
              <th>Date</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {activities.map((activity, index) => (
              <tr key={index}>
                <td>{activity.activity_name || activity.activity_type || 'Activity'}</td>
                <td>{formatDistanceKm(activity.distance_m)}</td>
                <td>{formatSpeed(activity.activity_type, activity.avg_speed_mps)}</td>
                <td>{formatDate(activity.start_time)}</td>
                <td>
                  <Button variant="accent" onClick={() => handleDetailsClick(activity)}>
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActivityDetailsPopup
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        activity={selectedActivity}
      />
    </>
  )
}