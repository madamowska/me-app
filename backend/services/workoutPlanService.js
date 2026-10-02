import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { generateChatCompletion } from '../lib/aiClient.js'

const ACTIVITY_FIELDS = [
  'activity_name',
  'activity_type',
  'start_time',
  'duration_seconds',
  'distance_m',
  'avg_heart_rate',
  'max_heart_rate',
].join(', ')

function upcomingWeek() {
  const today = new Date()
  const monday = new Date(today)
  const day = monday.getDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  monday.setDate(monday.getDate() + daysUntilMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

function cleanModelJson(content) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function validatePlan(plan, week) {
  if (!plan || !Array.isArray(plan.days) || plan.days.length !== 7) {
    throw new Error('The AI response must contain exactly seven workout days.')
  }

  plan.days.forEach((day, index) => {
    if (!day || typeof day !== 'object' || !day.day || !day.title || !day.type) {
      throw new Error(`The AI response is missing required fields for day ${index + 1}.`)
    }
  })

  return { ...plan, weekStart: week.start, weekEnd: week.end }
}

function buildPrompt({ week, activities, preferences }) {
  return `Create a safe, personalised workout plan for the upcoming week.

The week must cover Monday ${week.start} through Sunday ${week.end}, with exactly
one entry for each day in that order. Base the plan on the supplied activities,
goals, and preferences. Avoid overtraining and include rest or recovery where
appropriate. Do not diagnose medical conditions.

Return only valid JSON. Do not use Markdown or add commentary outside the JSON.
Use this exact shape:
{
  "summary": "brief explanation",
  "days": [
    {
      "day": "Monday",
      "date": "YYYY-MM-DD",
      "type": "rest|running|cycling|strength|mobility|other",
      "title": "short title",
      "durationMinutes": 30,
      "intensity": "easy|moderate|hard",
      "warmup": ["step"],
      "exercises": ["step"],
      "cooldown": ["step"],
      "notes": "optional guidance"
    }
  ],
  "recoveryNotes": ["guidance"]
}

User preferences and goals:
${JSON.stringify(preferences || {}, null, 2)}

Recent activities:
${JSON.stringify(activities, null, 2)}`
}

export async function generateWorkoutPlan({ profileId, preferences = {} } = {}) {
  const configuredProfileId = profileId || process.env.GARMIN_PROFILE_ID
  if (!configuredProfileId) throw new Error('A profile id is required to generate a workout plan.')

  const { start, end } = upcomingWeek()
  const { data: activities, error } = await getSupabaseAdmin()
    .from('activities')
    .select(ACTIVITY_FIELDS)
    .eq('athlete_profile_id', configuredProfileId)
    .order('start_time', { ascending: false })
    .limit(20)

  if (error) throw error

  const rawPlan = await generateChatCompletion(buildPrompt({
    week: { start, end },
    activities: activities || [],
    preferences,
  }))

  let parsedPlan
  try {
    parsedPlan = JSON.parse(cleanModelJson(rawPlan))
  } catch {
    throw new Error('LM Studio returned invalid JSON for the workout plan.')
  }

  return validatePlan(parsedPlan, { start, end })
}
