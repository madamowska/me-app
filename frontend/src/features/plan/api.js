async function readResponse(response, fallback) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.error || `${fallback} (${response.status})`)
    error.status = response.status
    throw error
  }
  return result
}

export async function getWorkoutPlans() {
  const response = await fetch('/api/workout-plans')
  const result = await readResponse(response, 'Could not load workout plans')
  if (!Array.isArray(result.plans)) throw new Error('The server returned an invalid workout plan list.')
  return result.plans
}

export async function getCurrentWorkoutPlan() {
  const response = await fetch('/api/workout-plans/current')
  const result = await readResponse(response, 'Could not load the current workout plan')
  return result.plan ?? null
}

export async function generateWorkoutPlan({ weekStart }) {
  const response = await fetch('/api/workout-plans/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekStart }),
  })
  const result = await readResponse(response, 'Could not generate a workout plan')
  return result.plan
}

export async function saveWorkoutPlan({ title, weekStart, planData }) {
  const response = await fetch('/api/workout-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, weekStart, planData }),
  })
  const result = await readResponse(response, 'Could not save workout plan')
  return result.plan
}

export async function setCurrentWorkoutPlan(planId) {
  const response = await fetch(`/api/workout-plans/${planId}/current`, { method: 'PUT' })
  const result = await readResponse(response, 'Could not set the current workout plan')
  return result.plan
}

export async function updateWorkoutPlan(planId, updates) {
  const response = await fetch(`/api/workout-plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const result = await readResponse(response, 'Could not update workout plan')
  return result.plan
}

export async function getWorkoutActivities(planId) {
  const response = await fetch(`/api/workout-plans/${planId}/activities`)
  const result = await readResponse(response, 'Could not load workout activities')
  if (!Array.isArray(result.activities)) {
    throw new Error('The server returned an invalid workout activity list.')
  }
  return result.activities
}

export async function saveWorkoutActivity(planId, date, activities) {
  const response = await fetch(`/api/workout-plans/${planId}/activities/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activities }),
  })
  const result = await readResponse(response, 'Could not save workout activity')
  return result.activity
}

export async function deleteWorkoutPlan(planId) {
  const response = await fetch(`/api/workout-plans/${planId}`, { method: 'DELETE' })
  return readResponse(response, 'Could not delete workout plan')
}
