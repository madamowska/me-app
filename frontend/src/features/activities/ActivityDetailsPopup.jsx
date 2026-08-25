// src/features/activities/ActivityDetailsPopup.jsx
import PopupShell from '../../components/popups/PopupShell'
import { formatDistanceKm, formatSpeed, formatDate, formatDuration } from './activityFormat'

export default function ActivityDetailsPopup({ isOpen, onClose, activity }) {
  if (!isOpen || !activity) return null

  const rows = [
    ['Name', activity.activity_name || activity.activity_type || 'Activity'],
    ['Type', activity.activity_type || '--'],
    ['Date', formatDate(activity.start_time)],
    ['Duration', formatDuration(activity.duration_seconds)],
    ['Distance', formatDistanceKm(activity.distance_m)],
    ['Speed', formatSpeed(activity.activity_type, activity.avg_speed_mps)],
    ['Calories', activity.calories != null ? Math.round(activity.calories) : '--'],
    ['Avg heart rate', activity.avg_heart_rate != null ? `${activity.avg_heart_rate} bpm` : '--'],
    ['Max heart rate', activity.max_heart_rate != null ? `${activity.max_heart_rate} bpm` : '--'],
  ]

  return (
    <PopupShell title="activity details" onClose={onClose}>
      {rows.map(([label, value]) => (
        <div className="detail-field" key={label}>
          <div className="detail-label">{label}</div>
          <div className="detail-value">{value}</div>
        </div>
      ))}
    </PopupShell>
  )
}