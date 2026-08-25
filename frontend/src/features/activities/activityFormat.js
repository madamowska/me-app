// src/features/activities/activityFormat.js

function isRunningType(activityType) {
  return typeof activityType === 'string' && activityType.toLowerCase().includes('running')
}

export function formatDistanceKm(distanceM) {
  if (distanceM == null) return '--'
  return `${(distanceM / 1000).toFixed(2)} km`
}

export function formatSpeed(activityType, avgSpeedMps) {
  if (avgSpeedMps == null || avgSpeedMps <= 0) return '--'

  if (isRunningType(activityType)) {
    const secondsPerKm = 1000 / avgSpeedMps
    const minutes = Math.floor(secondsPerKm / 60)
    const seconds = Math.round(secondsPerKm % 60)
    return `${minutes}:${String(seconds).padStart(2, '0')} min/km`
  }

  const kmh = avgSpeedMps * 3.6
  return `${kmh.toFixed(1)} km/h`
}

export function formatDate(startTime) {
  if (!startTime) return '--'
  return new Date(startTime).toLocaleDateString()
}

export function formatDuration(durationSeconds) {
  if (durationSeconds == null) return '--'
  return `${Math.round(durationSeconds / 60)} min`
}