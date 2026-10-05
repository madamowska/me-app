import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

const ACCENT_COLOR = '579AC4'

function formatDate(date) {
  if (typeof date !== 'string') return ''
  const parsedDate = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsedDate.getTime())) return date

  return parsedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function asText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function addTextList(paragraphs, heading, items) {
  const entries = Array.isArray(items)
    ? items.map(asText).filter((item) => item.trim())
    : []

  if (entries.length === 0) return

  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: heading, bold: true, color: ACCENT_COLOR })],
    spacing: { before: 120, after: 40 },
  }))

  entries.forEach((entry) => {
    paragraphs.push(new Paragraph({
      text: entry,
      bullet: { level: 0 },
      spacing: { after: 40 },
    }))
  })
}

export async function createWorkoutPlanDocx(plan) {
  const paragraphs = [
    new Paragraph({
      children: [new TextRun({ text: 'Weekly Workout Plan', color: ACCENT_COLOR, bold: true })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new Paragraph({
      text: `${formatDate(plan.weekStart)} – ${formatDate(plan.weekEnd)}`,
      spacing: { after: 240 },
    }),
  ]

  if (typeof plan.summary === 'string' && plan.summary.trim()) {
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: 'Plan overview: ', bold: true }),
        new TextRun(plan.summary),
      ],
      spacing: { after: 240 },
    }))
  }

  plan.days.forEach((day) => {
    const dayTitle = [day.day, formatDate(day.date)].filter(Boolean).join(' — ')
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: dayTitle, color: ACCENT_COLOR, bold: true })],
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: false,
      spacing: { before: 240, after: 80 },
    }))
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: asText(day.title), color: ACCENT_COLOR, bold: true })],
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }))

    const details = [
      ['Workout', day.type],
      ['Duration', Number.isFinite(day.durationMinutes) ? `${day.durationMinutes} minutes` : ''],
      ['Intensity', day.intensity],
    ].filter(([, value]) => asText(value).trim())

    details.forEach(([label, value]) => {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, color: ACCENT_COLOR }),
          new TextRun(asText(value)),
        ],
        spacing: { after: 60 },
      }))
    })

    addTextList(paragraphs, 'Warm-up', day.warmup)
    addTextList(paragraphs, 'Workout details', day.exercises)
    addTextList(paragraphs, 'Cool-down', day.cooldown)

    if (typeof day.notes === 'string' && day.notes.trim()) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: 'Notes: ', bold: true }),
          new TextRun(day.notes),
        ],
        spacing: { before: 100, after: 120 },
      }))
    }
  })

  addTextList(paragraphs, 'Recovery notes', plan.recoveryNotes)
  paragraphs.push(new Paragraph({
    text: 'Adjust the plan to how you feel. Stop if you experience pain or unusual symptoms.',
    spacing: { before: 240 },
  }))

  const document = new Document({
    sections: [{ children: paragraphs }],
  })

  return Packer.toBuffer(document)
}
