import { Router } from 'express'
import { generateWorkoutPlan } from '../services/workoutPlanService.js'
import { createWorkoutPlanDocx } from '../lib/workoutPlanDocument.js'

const router = Router()

router.post('/workout-plan/generate', async (req, res) => {
  const preferences = req.body?.preferences ?? {}

  if (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences)) {
    return res.status(400).json({ error: 'preferences must be a JSON object.' })
  }

  try {
    const plan = await generateWorkoutPlan({ preferences })
    const document = await createWorkoutPlanDocx(plan)
    const filename = `workout-plan-${plan.weekStart}.docx`

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(document)
  } catch (error) {
    console.error('Failed to generate workout plan:', error)
    return res.status(500).json({ error: 'Failed to generate workout plan.' })
  }
})

export default router