import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const MODEL_NAME = "gemini-2.0-flash-exp"

// Gemini transcription API route
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("file") as File
    const options = JSON.parse((formData.get("options") as string) || "{}")

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Gemini API configuration
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured. Please set GEMINI_API_KEY environment variable." },
        { status: 500 },
      )
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: MODEL_NAME })

    // Convert audio file to base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")

    // Prepare the content for Gemini
    const mimeType = audioFile.type || "audio/webm"

    // Build prompt based on options
    let prompt = "Generate a complete, detailed transcript of this audio."

    if (options.includeTimestamps) {
      prompt += " Include approximate timestamps where possible."
    }

    if (options.speakerLabels) {
      prompt += " Identify and label different speakers if multiple people are speaking."
    }

    if (options.punctuation) {
      prompt += " Include proper punctuation and formatting."
    }

    if (options.language && options.language !== "auto") {
      prompt += ` The audio is in ${options.language}.`
    }

    const contents = [
      { text: prompt },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Audio,
        },
      },
    ]

    // Make request to Gemini API
    const response = await model.generateContent(contents)
    const transcriptionText = response.response.text()

    if (!transcriptionText) {
      return NextResponse.json({ error: "Transcription failed or returned empty" }, { status: 500 })
    }

    // Process and format the response
    const processedResult = processGeminiResponse(transcriptionText, options)

    return NextResponse.json(processedResult)
  } catch (error: any) {
    console.error("Gemini transcription error:", error)

    let errorMessage = "Transcription failed"
    if (error.message) {
      errorMessage = error.message
    }

    // Handle specific Gemini API errors
    if (error.message?.includes("API key")) {
      errorMessage = "Invalid Gemini API key"
    } else if (error.message?.includes("quota")) {
      errorMessage = "Gemini API quota exceeded"
    } else if (error.message?.includes("safety")) {
      errorMessage = "Content blocked by Gemini safety filters"
    }

    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 })
  }
}

// Process Gemini response to extract useful information
function processGeminiResponse(transcriptionText: string, options: any) {
  // Basic processing - Gemini returns plain text
  const lines = transcriptionText.split("\n").filter((line) => line.trim())

  // Try to extract speaker information if present
  const speakers = new Set<string>()
  const segments: any[] = []

  lines.forEach((line, index) => {
    // Look for speaker patterns like "Speaker 1:", "Person A:", etc.
    const speakerMatch = line.match(/^(Speaker \d+|Person [A-Z]|[A-Z][a-z]+ \d*):(.+)/)

    if (speakerMatch) {
      const speaker = speakerMatch[1].trim()
      const text = speakerMatch[2].trim()
      speakers.add(speaker)

      segments.push({
        id: index,
        speaker: speaker,
        text: text,
        start: null, // Gemini doesn't provide precise timestamps
        end: null,
      })
    } else {
      // Regular text without speaker identification
      segments.push({
        id: index,
        speaker: null,
        text: line.trim(),
        start: null,
        end: null,
      })
    }
  })

  // Try to extract timestamps if present
  const timestampPattern = /\[(\d+:\d+(?:\.\d+)?)\]/g
  const timestamps: any[] = []
  let match

  while ((match = timestampPattern.exec(transcriptionText)) !== null) {
    timestamps.push({
      time: match[1],
      position: match.index,
    })
  }

  // Basic sentiment analysis based on keywords
  const sentiment = analyzeSentiment(transcriptionText)

  // Extract potential topics based on capitalized words and phrases
  const topics = extractTopics(transcriptionText)

  return {
    text: transcriptionText,
    confidence: 0.85, // Gemini doesn't provide confidence scores, so we estimate
    language: detectLanguage(transcriptionText),
    speakers: Array.from(speakers),
    segments: segments,
    paragraphs: segments.filter((s) => s.text.length > 0),
    topics: topics,
    sentiment: sentiment,
    timestamps: timestamps,
    provider: "gemini",
    model: MODEL_NAME,
    raw: {
      text: transcriptionText,
      segments: segments,
      speakers: Array.from(speakers),
    },
  }
}

// Simple sentiment analysis
function analyzeSentiment(text: string) {
  const positiveWords = [
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "love",
    "like",
    "happy",
    "pleased",
  ]
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "hate",
    "dislike",
    "angry",
    "frustrated",
    "disappointed",
    "sad",
    "upset",
  ]

  const words = text.toLowerCase().split(/\s+/)
  let positiveCount = 0
  let negativeCount = 0

  words.forEach((word) => {
    if (positiveWords.some((pw) => word.includes(pw))) positiveCount++
    if (negativeWords.some((nw) => word.includes(nw))) negativeCount++
  })

  let overallSentiment = "neutral"
  if (positiveCount > negativeCount) overallSentiment = "positive"
  else if (negativeCount > positiveCount) overallSentiment = "negative"

  return {
    overall: {
      sentiment: overallSentiment,
      confidence: Math.min(0.9, (Math.abs(positiveCount - negativeCount) / words.length) * 10),
      distribution: {
        positive: positiveCount,
        negative: negativeCount,
        neutral: words.length - positiveCount - negativeCount,
      },
    },
    segments: [], // Gemini doesn't provide segment-level sentiment
  }
}

// Extract potential topics
function extractTopics(text: string) {
  // Look for capitalized words and phrases that might be topics
  const topicPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g
  const matches = text.match(topicPattern) || []

  // Filter out common words and short matches
  const commonWords = [
    "The",
    "This",
    "That",
    "And",
    "But",
    "Or",
    "So",
    "If",
    "When",
    "Where",
    "How",
    "What",
    "Who",
    "Why",
  ]
  const topics = matches
    .filter((match) => match.length > 2 && !commonWords.includes(match))
    .reduce((acc: any[], topic) => {
      const existing = acc.find((t) => t.topic === topic)
      if (existing) {
        existing.confidence += 0.1
      } else {
        acc.push({
          topic: topic,
          confidence: 0.6 + Math.random() * 0.3, // Estimated confidence
        })
      }
      return acc
    }, [])
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10) // Top 10 topics

  return topics
}

// Simple language detection
function detectLanguage(text: string): string {
  // Very basic language detection based on common words
  const englishWords = [
    "the",
    "and",
    "is",
    "in",
    "to",
    "of",
    "a",
    "that",
    "it",
    "with",
    "for",
    "as",
    "was",
    "on",
    "are",
  ]
  const spanishWords = ["el", "la", "de", "que", "y", "en", "un", "es", "se", "no", "te", "lo", "le", "da", "su"]
  const frenchWords = [
    "le",
    "de",
    "et",
    "à",
    "un",
    "il",
    "être",
    "et",
    "en",
    "avoir",
    "que",
    "pour",
    "dans",
    "ce",
    "son",
  ]

  const words = text.toLowerCase().split(/\s+/)

  let englishCount = 0
  let spanishCount = 0
  let frenchCount = 0

  words.forEach((word) => {
    if (englishWords.includes(word)) englishCount++
    if (spanishWords.includes(word)) spanishCount++
    if (frenchWords.includes(word)) frenchCount++
  })

  if (englishCount > spanishCount && englishCount > frenchCount) return "en"
  if (spanishCount > englishCount && spanishCount > frenchCount) return "es"
  if (frenchCount > englishCount && frenchCount > spanishCount) return "fr"

  return "en" // Default to English
}
