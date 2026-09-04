// src/features/activities/api.js

export async function getLastActivity() {
  const response = await fetch('/api/last-activity')

  if (!response.ok) {
    throw new Error(`Failed to fetch last activity (${response.status})`)
  }

  const data = await response.json()
  return data.activity ?? null
}

export async function getLastActivities() {
  const response = await fetch('/api/last-activities')

  if (!response.ok) {
    throw new Error(`Failed to fetch last activities (${response.status})`)
  }

  const data = await response.json()
  return data.activities ?? []
}

export async function triggerSync() {
  const response = await fetch('/api/sync-activities', { method: 'POST' })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Sync failed (${response.status})`)
  }

  return response.json() // { success, fetched, upserted }
}