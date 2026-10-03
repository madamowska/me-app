// backend/index.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import process from 'node:process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import activitiesRouter from './routes/activities.js'
import workoutPlanRouter from './routes/workoutPlan.js'
import athleteDataRouter from './routes/athleteData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env') })

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api', activitiesRouter)
app.use('/api', workoutPlanRouter)
app.use('/api', athleteDataRouter)

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})