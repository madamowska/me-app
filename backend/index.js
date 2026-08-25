// backend/index.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import activitiesRouter from './routes/activities.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// .env lives at the project root, same convention as the Python side
dotenv.config({ path: join(__dirname, '..', '.env') })

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api', activitiesRouter)

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})