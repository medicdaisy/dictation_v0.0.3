import { type NextRequest, NextResponse } from "next/server"

// Deepgram transcription API route
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("file") as File
    const options = JSON.parse((formData.get("options") as string) || "{}")

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Deepgram API configuration
    const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY

    if (!DEEPGRAM_API_KEY) {
      return NextResponse.json(
        { error: "Deepgram API key not configured. Please set DEEPGRAM_API_KEY environment variable." },
        { status: 500 },
      )
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
      model: options.model || "nova-2",
      smart_format: "true",
      paragraphs: "true",
      punctuate: "true",
      diarize: options.diarize ? "true" : "false",
      sentiment: options.sentiment ? "true" : "false",
      topics: options.topics ? "true" : "false",
      detect_language: options.detectLanguage ? "true" : "false",
      language: options.language || "en",
      ...(options.customTopicMode && { custom_topic_mode: options.customTopicMode }),
    })

    // Add custom topics if provided
    if (options.customTopics && Array.isArray(options.customTopics)) {
      options.customTopics.forEach((topic: string) => {
        queryParams.append("custom_topic", topic)
      })
    }

    // Convert File to ArrayBuffer for Deepgram
    const audioBuffer = await audioFile.arrayBuffer()

    // Make request to Deepgram API
    const response = await fetch(`https://api.deepgram.com/v1/listen?${queryParams.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": audioFile.type || "audio/wav",
      },
      body: audioBuffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Deepgram API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        headers: Object.fromEntries(response.headers.entries()),
      })

      let errorMessage = `Deepgram API error: ${response.status} ${response.statusText}`

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.err_msg) {
          errorMessage = errorJson.err_msg
        }
      } catch (e) {
        // If parsing fails, use the raw error text
        errorMessage += ` - ${errorText}`
      }

      return NextResponse.json({ error: errorMessage, details: errorText }, { status: response.status })
    }

    const result = await response.json()

    // Process and format the response
    const processedResult = processDeepgramResponse(result)

    return NextResponse.json(processedResult)
  } catch (error: any) {
    console.error("Transcription error:", error)
    return NextResponse.json({ error: "Transcription failed", details: error.message }, { status: 500 })
  }
}

// Process Deepgram response to extract useful information
function processDeepgramResponse(response: any) {
  const results = response.results
  if (!results || !results.channels || results.channels.length === 0) {
    return {
      text: "",
      speakers: [],
      topics: [],
      sentiment: null,
      language: null,
      confidence: 0,
      segments: [],
      raw: response,
    }
  }

  const channel = results.channels[0]
  const alternatives = channel.alternatives[0]

  if (!alternatives) {
    return {
      text: "",
      speakers: [],
      topics: [],
      sentiment: null,
      language: null,
      confidence: 0,
      segments: [],
      raw: response,
    }
  }

  // Extract basic transcription
  const text = alternatives.transcript || ""
  const confidence = alternatives.confidence || 0

  // Extract speakers and segments
  const speakers = new Set<number>()
  const segments =
    alternatives.words?.map((word: any, index: number) => {
      if (word.speaker !== undefined) {
        speakers.add(word.speaker)
      }
      return {
        id: index,
        start: word.start,
        end: word.end,
        text: word.punctuated_word || word.word,
        speaker: word.speaker,
        confidence: word.confidence,
      }
    }) || []

  // Extract paragraphs with speaker information
  const paragraphs =
    alternatives.paragraphs?.paragraphs?.map((paragraph: any) => ({
      start: paragraph.start,
      end: paragraph.end,
      text: paragraph.text,
      speaker: paragraph.speaker,
      sentiment: paragraph.sentiment,
    })) || []

  // Extract topics
  const topics =
    results.topics?.topics?.map((topic: any) => ({
      topic: topic.topic,
      confidence: topic.confidence_score,
    })) || []

  // Extract overall sentiment
  const sentiment =
    results.sentiment?.segments?.length > 0
      ? {
          overall: calculateOverallSentiment(results.sentiment.segments),
          segments: results.sentiment.segments.map((seg: any) => ({
            start: seg.start,
            end: seg.end,
            sentiment: seg.sentiment,
            confidence: seg.sentiment_score,
          })),
        }
      : null

  // Extract language detection
  const language = results.metadata?.detected_language || null

  return {
    text,
    confidence,
    language,
    speakers: Array.from(speakers).sort(),
    segments,
    paragraphs,
    topics,
    sentiment,
    metadata: results.metadata,
    raw: response,
  }
}

// Calculate overall sentiment from segments
function calculateOverallSentiment(segments: any[]) {
  if (!segments || segments.length === 0) return null

  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }
  let totalConfidence = 0

  segments.forEach((seg: any) => {
    if (seg.sentiment && sentimentCounts.hasOwnProperty(seg.sentiment)) {
      sentimentCounts[seg.sentiment as keyof typeof sentimentCounts]++
      totalConfidence += seg.sentiment_score || 0
    }
  })

  const maxSentiment = Object.entries(sentimentCounts).reduce((a, b) =>
    sentimentCounts[a[0] as keyof typeof sentimentCounts] > sentimentCounts[b[0] as keyof typeof sentimentCounts]
      ? a
      : b,
  )[0]

  return {
    sentiment: maxSentiment,
    confidence: totalConfidence / segments.length,
    distribution: sentimentCounts,
  }
}
