"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

export default function DeepgramTest() {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testResult, setTestResult] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState("")

  const runTest = async () => {
    setTestStatus("testing")
    setTestResult(null)
    setErrorMessage("")

    try {
      // Create a simple test audio blob (silence)
      const audioContext = new AudioContext()
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate) // 2 seconds of silence

      // Convert to blob
      const offlineContext = new OfflineAudioContext(1, audioContext.sampleRate * 2, audioContext.sampleRate)
      const source = offlineContext.createBufferSource()
      source.buffer = buffer
      source.connect(offlineContext.destination)
      source.start()

      const renderedBuffer = await offlineContext.startRendering()

      // Convert AudioBuffer to WAV blob
      const wavBlob = audioBufferToWav(renderedBuffer)

      // Test the API
      const formData = new FormData()
      formData.append("file", wavBlob, "test.wav")
      formData.append(
        "options",
        JSON.stringify({
          model: "nova-2",
          diarize: true,
          sentiment: true,
          topics: true,
          detectLanguage: true,
          customTopicMode: "extended",
          customTopics: ["test"],
        }),
      )

      const response = await fetch("/api/transcribe/deepgram", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "API test failed")
      }

      const result = await response.json()
      setTestResult(result)
      setTestStatus("success")
    } catch (error: any) {
      console.error("Test failed:", error)
      setErrorMessage(error.message)
      setTestStatus("error")
    }
  }

  // Simple AudioBuffer to WAV conversion
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length
    const arrayBuffer = new ArrayBuffer(44 + length * 2)
    const view = new DataView(arrayBuffer)
    const channels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, "RIFF")
    view.setUint32(4, 36 + length * 2, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, "data")
    view.setUint32(40, length * 2, true)

    // Convert audio data
    const channelData = buffer.getChannelData(0)
    let offset = 44
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }

    return new Blob([arrayBuffer], { type: "audio/wav" })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Deepgram API Test
          {testStatus === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
          {testStatus === "error" && <XCircle className="h-5 w-5 text-red-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={testStatus === "success" ? "default" : testStatus === "error" ? "destructive" : "secondary"}>
            {testStatus === "idle" && "Ready to test"}
            {testStatus === "testing" && "Testing..."}
            {testStatus === "success" && "API Working"}
            {testStatus === "error" && "API Error"}
          </Badge>
        </div>

        <Button onClick={runTest} disabled={testStatus === "testing"} className="w-full">
          {testStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Deepgram API
        </Button>

        {testStatus === "error" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        {testStatus === "success" && testResult && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600 font-medium">✅ API is working correctly!</p>
            <div className="mt-2 text-xs text-gray-600">
              <p>Confidence: {testResult.confidence ? Math.round(testResult.confidence * 100) + "%" : "N/A"}</p>
              <p>Language: {testResult.language || "Not detected"}</p>
              <p>
                Features:{" "}
                {[
                  testResult.speakers?.length > 0 && "Speakers",
                  testResult.topics?.length > 0 && "Topics",
                  testResult.sentiment && "Sentiment",
                ]
                  .filter(Boolean)
                  .join(", ") || "Basic transcription"}
              </p>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>This test sends a short silent audio file to verify the API connection and configuration.</p>
        </div>
      </CardContent>
    </Card>
  )
}
