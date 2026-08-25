// src/features/activities/api.js

export async function triggerSync() {
  const response = await fetch('/api/sync-activities', { method: 'POST' })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Sync failed (${response.status})`)
  }

  return response.json() // { success, fetched, upserted }
}