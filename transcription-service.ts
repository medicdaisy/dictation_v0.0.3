// Service for handling transcription with OpenAI Whisper API

// Interface for transcription options
interface TranscriptionOptions {
  model: string
  language?: string
  prompt?: string
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt"
  temperature?: number
  timestampGranularities?: ("segment" | "word")[]
}

// Interface for transcription result
export interface TranscriptionResult {
  text: string
  segments?: {
    id: number
    start: number
    end: number
    text: string
  }[]
  language?: string
}

// Transcribe audio using OpenAI Whisper API
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  options: TranscriptionOptions,
): Promise<TranscriptionResult> {
  const formData = new FormData()

  // Add audio file
  formData.append("file", audioBlob, "audio.webm")

  // Add options
  formData.append("model", options.model)

  if (options.language) {
    formData.append("language", options.language)
  }

  if (options.prompt) {
    formData.append("prompt", options.prompt)
  }

  formData.append("response_format", options.responseFormat || "verbose_json")

  if (options.temperature !== undefined) {
    formData.append("temperature", options.temperature.toString())
  }

  if (options.timestampGranularities && options.timestampGranularities.length > 0) {
    options.timestampGranularities.forEach((granularity) => {
      formData.append("timestamp_granularities[]", granularity)
    })
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `API Error: ${response.status} ${response.statusText}`

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error && errorJson.error.message) {
          errorMessage = errorJson.error.message
        }
      } catch (e) {
        // If parsing fails, use the raw error text
        errorMessage += ` - ${errorText}`
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data
  } catch (error: any) {
    console.error("Transcription API error:", error)
    throw new Error(`Transcription failed: ${error.message}`)
  }
}

// Combine multiple transcription results into one
export function combineTranscriptionResults(results: TranscriptionResult[]): TranscriptionResult {
  if (results.length === 0) {
    return { text: "" }
  }

  if (results.length === 1) {
    return results[0]
  }

  // Combine text
  const text = results.map((r) => r.text).join(" ")

  // Combine segments
  let allSegments: any[] = []
  let lastEndTime = 0

  results.forEach((result, index) => {
    if (result.segments && Array.isArray(result.segments)) {
      // Adjust segment times for chunks after the first one
      const adjustedSegments = result.segments.map((segment) => {
        if (index === 0) {
          return segment
        }

        // Adjust start and end times based on the last end time
        return {
          ...segment,
          start: segment.start + lastEndTime,
          end: segment.end + lastEndTime,
        }
      })

      allSegments = [...allSegments, ...adjustedSegments]

      // Update last end time for the next chunk
      if (result.segments.length > 0) {
        const lastSegment = result.segments[result.segments.length - 1]
        lastEndTime += lastSegment.end
      }
    }
  })

  // Sort segments by start time (just in case)
  allSegments.sort((a, b) => a.start - b.start)

  return {
    text,
    segments: allSegments,
    language: results[0].language,
  }
}

// Transcribe multiple audio chunks and combine results
export async function transcribeAudioChunks(
  chunks: Blob[],
  apiKey: string,
  options: TranscriptionOptions,
): Promise<TranscriptionResult> {
  if (chunks.length === 0) {
    throw new Error("No audio chunks to transcribe")
  }

  if (chunks.length === 1) {
    return transcribeAudio(chunks[0], apiKey, options)
  }

  // Transcribe each chunk
  const transcriptionPromises = chunks.map((chunk) => transcribeAudio(chunk, apiKey, options))

  const results = await Promise.all(transcriptionPromises)

  // Combine results
  return combineTranscriptionResults(results)
}
