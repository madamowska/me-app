import process from 'node:process'

function getRequiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured on the server.`)
  return value
}

function hasErrorCode(error, code) {
  let current = error
  while (current) {
    if (current.code === code) return true
    current = current.cause
  }
  return false
}

async function readCompletionStream(body) {
  if (!body) throw new Error('LM Studio returned an empty response stream.')

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let finishReason = 'unknown'

  function readEventLine(line) {
    if (!line.startsWith('data:')) return false

    const payload = line.slice(5).trim()
    if (payload === '[DONE]') return true
    if (!payload) return false

    let event
    try {
      event = JSON.parse(payload)
    } catch {
      throw new Error('LM Studio returned an invalid streaming response.')
    }

    const choice = event.choices?.[0]
    const deltaContent = choice?.delta?.content
    if (typeof deltaContent === 'string') content += deltaContent
    if (choice?.finish_reason) finishReason = choice.finish_reason
    return false
  }

  try {
    let done = false
    while (!done) {
      const result = await reader.read()
      buffer += decoder.decode(result.value, { stream: !result.done })

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '')
        buffer = buffer.slice(newlineIndex + 1)
        if (readEventLine(line)) {
          done = true
          break
        }
        newlineIndex = buffer.indexOf('\n')
      }

      if (result.done) {
        if (buffer.trim()) readEventLine(buffer.trim())
        done = true
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!content.trim()) {
    throw new Error(
      `LM Studio returned no final message content (finish reason: ${finishReason}). ` +
      'It may have returned reasoning only; check the LM Studio model template thinking setting.'
    )
  }

  return content
}

export async function generateChatCompletion(prompt) {
  const baseUrl = getRequiredEnv('LM_STUDIO_BASE_URL').replace(/\/$/, '')
  const model = getRequiredEnv('LM_STUDIO_MODEL')

  let response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 4000,
        stream: true,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: 'system', content: 'You are a careful professional fitness coach.' },
          { role: 'user', content: prompt },
        ],
      }),
    })
  } catch (error) {
    if (hasErrorCode(error, 'ECONNREFUSED')) {
      const connectionError = new Error('LM Studio refused the connection.')
      connectionError.statusCode = 503
      connectionError.publicMessage =
        `Cannot connect to LM Studio at ${baseUrl}. Start the local server in LM Studio, ` +
        'load a model, and verify that LM_STUDIO_BASE_URL points to its server URL.'
      throw connectionError
    }
    throw error
  }

  if (!response.ok) {
    throw new Error(`LM Studio request failed (${response.status}): ${await response.text()}`)
  }

  return readCompletionStream(response.body)
}
