"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Mic, Pause, Play, Square, Upload } from "lucide-react"
import { saveRecording, listRecordings, fetchRecordingBlob } from "./blob-storage-service"
import RecordingsManager from "./recordings-manager"

export default function SpeechToTextApp() {
  // State for recording
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState("Ready to record or upload")
  const [selectedModel, setSelectedModel] = useState("whisper-1")
  const [fileName, setFileName] = useState("No file selected")

  // State for transcription results
  const [transcriptText, setTranscriptText] = useState("")
  const [timestampedText, setTimestampedText] = useState("")
  const [jsonOutput, setJsonOutput] = useState("")

  // Refs for audio processing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [showRecordings, setShowRecordings] = useState(false)

  // Initialize Vercel Blob and component cleanup
  useEffect(() => {
    loadStoredRecordings()
    return () => {
      stopRecording()
    }
  }, [])

  const loadStoredRecordings = async () => {
    try {
      const recordings = await listRecordings()
      console.log("Loaded recordings:", recordings.length)
    } catch (error) {
      console.error("Error loading stored recordings:", error)
    }
  }

  // Setup canvas for waveform visualization
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "#f7f9fc"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [])

  // Start waveform visualization
  const startWaveformVisualization = (stream: MediaStream) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    analyserRef.current = audioContextRef.current.createAnalyser()
    const source = audioContextRef.current.createMediaStreamSource(stream)
    analyserRef.current.fftSize = 2048
    source.connect(analyserRef.current)

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const drawWaveform = () => {
      if (!analyserRef.current || !ctx) return

      animationFrameRef.current = requestAnimationFrame(drawWaveform)
      analyserRef.current.getByteTimeDomainData(dataArray)

      ctx.fillStyle = "#f7f9fc"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 2
      ctx.strokeStyle = "#1E3A8A"
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = v * (canvas.height / 2)

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }

      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    drawWaveform()
  }

  // Stop waveform visualization
  const stopWaveformVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = "#f7f9fc"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }

  // Start recording
  const startRecording = async () => {
    try {
      setStatus("Requesting microphone permission...")

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Clear previous results
      setTranscriptText("")
      setTimestampedText("")
      setJsonOutput("")

      // Setup media recorder
      const options = { mimeType: "audio/webm;codecs=opus" }
      mediaRecorderRef.current = new MediaRecorder(stream, options)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          processRecordedAudio()
        } else {
          resetRecording("No audio data recorded")
        }
      }

      mediaRecorderRef.current.start(1000) // Collect data in 1-second chunks
      setIsRecording(true)
      setIsPaused(false)
      setStatus("Recording in progress...")

      // Start visualization
      startWaveformVisualization(stream)
    } catch (error: any) {
      console.error("Error accessing microphone:", error)
      let message = `Mic access error: ${error.name} - ${error.message}`

      if (error.name === "NotAllowedError") {
        message = "Microphone permission denied. Please allow access in browser settings."
      } else if (error.name === "NotFoundError") {
        message = "No microphone found. Please connect a microphone."
      }

      setStatus(message)
    }
  }

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      setStatus("Recording paused")

      // Pause visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      setStatus("Recording resumed")

      // Resume visualization if stream is still active
      if (streamRef.current && streamRef.current.active) {
        startWaveformVisualization(streamRef.current)
      }
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === "recording" || mediaRecorderRef.current.state === "paused")
    ) {
      setStatus("Stopping recording...")
      mediaRecorderRef.current.stop()
    }

    // Stop visualization
    stopWaveformVisualization()

    // Stop and release media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  // Reset recording state
  const resetRecording = (message = "Ready to record or upload") => {
    setIsRecording(false)
    setIsPaused(false)
    setIsProcessing(false)
    setStatus(message)

    // Clear refs
    mediaRecorderRef.current = null
    audioChunksRef.current = []

    // Stop visualization
    stopWaveformVisualization()

    // Stop and release media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  // Process recorded audio
  const processRecordedAudio = async () => {
    if (audioChunksRef.current.length === 0) {
      resetRecording("No audio data to process")
      return
    }

    setIsProcessing(true)
    setStatus("Processing audio...")

    try {
      // Combine all audio chunks into a single blob
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || "audio/webm",
      })

      // Save original recording to Vercel Blob
      const result = await saveRecording(audioBlob, "live_recording.webm")
      console.log("Recording saved to:", result.url)

      // Process audio: remove silence and chunk into segments
      const processedChunks = await processAudioChunks(audioBlob)

      // Transcribe each chunk
      const transcriptionResults = await transcribeAudioChunks(processedChunks)

      // Combine transcription results
      const combinedResults = combineTranscriptionResults(transcriptionResults)

      // Update UI with results
      setTranscriptText(combinedResults.text)
      setTimestampedText(combinedResults.timestamped)
      setJsonOutput(JSON.stringify(combinedResults.json, null, 2))

      resetRecording("Transcription complete!")
    } catch (error: any) {
      console.error("Error processing audio:", error)
      setStatus(`Error: ${error.message}`)
      resetRecording()
    }
  }

  // Process audio to remove silence and chunk into segments
  const processAudioChunks = async (audioBlob: Blob): Promise<Blob[]> => {
    setStatus("Removing silence and chunking audio...")

    return new Promise((resolve) => {
      // Create an audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Create an audio element to decode the blob
      const audioElement = new Audio()
      audioElement.src = URL.createObjectURL(audioBlob)

      // Load the audio
      audioElement.onloadedmetadata = async () => {
        // For this implementation, we'll simulate silence removal
        // In a real implementation, you would analyze the audio data to detect silence

        // Get the duration of the audio
        const duration = audioElement.duration

        // If duration is less than 100 seconds, return the whole blob
        if (duration <= 100) {
          resolve([audioBlob])
          return
        }

        // Otherwise, chunk the audio into 100-second segments
        // In a real implementation, you would use Web Audio API to analyze and chunk the audio
        const chunks: Blob[] = []
        const chunkSize = 100 // seconds
        const numChunks = Math.ceil(duration / chunkSize)

        // Simulate chunking by creating smaller blobs
        // In a real implementation, you would use AudioBuffer to manipulate the audio data
        for (let i = 0; i < numChunks; i++) {
          chunks.push(audioBlob.slice(0, audioBlob.size / numChunks))
        }

        resolve(chunks)
      }

      audioElement.onerror = () => {
        // If there's an error, just return the original blob
        resolve([audioBlob])
      }
    })
  }

  // Transcribe audio chunks
  const transcribeAudioChunks = async (chunks: Blob[]): Promise<any[]> => {
    setStatus(`Transcribing ${chunks.length} audio chunks...`)

    // In a real implementation, you would call the OpenAI API for each chunk
    // For this demo, we'll simulate the API calls
    const results = []

    for (let i = 0; i < chunks.length; i++) {
      setStatus(`Transcribing chunk ${i + 1} of ${chunks.length}...`)

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Simulate API response
      results.push({
        text: `This is the transcription for chunk ${i + 1}.`,
        segments: [
          {
            id: i * 10 + 1,
            start: i * 100,
            end: i * 100 + 30,
            text: `This is segment 1 of chunk ${i + 1}.`,
          },
          {
            id: i * 10 + 2,
            start: i * 100 + 30,
            end: i * 100 + 60,
            text: `This is segment 2 of chunk ${i + 1}.`,
          },
          {
            id: i * 10 + 3,
            start: i * 100 + 60,
            end: i * 100 + 100,
            text: `This is segment 3 of chunk ${i + 1}.`,
          },
        ],
      })
    }

    return results
  }

  // Combine transcription results from multiple chunks
  const combineTranscriptionResults = (results: any[]) => {
    // Combine plain text
    const text = results.map((r) => r.text).join(" ")

    // Combine timestamped segments
    let timestamped = ""
    let allSegments: any[] = []

    results.forEach((result) => {
      if (result.segments && Array.isArray(result.segments)) {
        allSegments = [...allSegments, ...result.segments]
      }
    })

    // Sort segments by start time
    allSegments.sort((a, b) => a.start - b.start)

    // Format timestamped text
    timestamped = allSegments
      .map((segment) => {
        const start = segment.start.toFixed(2)
        const end = segment.end.toFixed(2)
        return `[${start}s - ${end}s] ${segment.text}`
      })
      .join("\n")

    // Combine JSON
    const json = {
      text,
      segments: allSegments,
    }

    return { text, timestamped, json }
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    // Clear previous results
    setTranscriptText("")
    setTimestampedText("")
    setJsonOutput("")

    // Process the uploaded file
    processUploadedFile(file)
  }

  // Process uploaded audio file
  const processUploadedFile = async (file: File) => {
    setIsProcessing(true)
    setStatus(`Processing uploaded file: ${file.name}`)

    try {
      // Save original file to Vercel Blob
      const result = await saveRecording(file, file.name)
      console.log("File saved to:", result.url)

      // Process audio: remove silence and chunk into segments
      const processedChunks = await processAudioChunks(file)

      // Transcribe each chunk
      const transcriptionResults = await transcribeAudioChunks(processedChunks)

      // Combine transcription results
      const combinedResults = combineTranscriptionResults(transcriptionResults)

      // Update UI with results
      setTranscriptText(combinedResults.text)
      setTimestampedText(combinedResults.timestamped)
      setJsonOutput(JSON.stringify(combinedResults.json, null, 2))

      setIsProcessing(false)
      setStatus("Transcription complete!")
    } catch (error: any) {
      console.error("Error processing uploaded file:", error)
      setStatus(`Error: ${error.message}`)
      setIsProcessing(false)
    }
  }

  const handleRecordingSelect = async (recording: any) => {
    setIsProcessing(true)
    setStatus(`Processing selected recording...`)

    try {
      // Fetch the recording from the blob URL
      const audioBlob = await fetchRecordingBlob(recording.url)

      // Clear previous results
      setTranscriptText("")
      setTimestampedText("")
      setJsonOutput("")

      // Process the selected recording
      const processedChunks = await processAudioChunks(audioBlob)
      const transcriptionResults = await transcribeAudioChunks(processedChunks)
      const combinedResults = combineTranscriptionResults(transcriptionResults)

      // Update UI with results
      setTranscriptText(combinedResults.text)
      setTimestampedText(combinedResults.timestamped)
      setJsonOutput(JSON.stringify(combinedResults.json, null, 2))

      setIsProcessing(false)
      setStatus("Transcription complete!")
    } catch (error: any) {
      console.error("Error processing selected recording:", error)
      setStatus(`Error: ${error.message}`)
      setIsProcessing(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="grid md:grid-cols-[320px_1fr] gap-6">
        {/* Controls Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transcription Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-1">
                  Whisper Model
                </label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger id="model-select">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whisper-1">whisper-1</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {!isRecording ? (
                  <Button onClick={startRecording} disabled={isProcessing} className="w-full">
                    <Mic className="mr-2 h-4 w-4" />
                    Start Recording
                  </Button>
                ) : isPaused ? (
                  <Button onClick={resumeRecording} disabled={isProcessing} className="w-full">
                    <Play className="mr-2 h-4 w-4" />
                    Continue Recording
                  </Button>
                ) : (
                  <Button onClick={pauseRecording} disabled={isProcessing} className="w-full" variant="outline">
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Recording
                  </Button>
                )}

                <Button
                  onClick={stopRecording}
                  disabled={!isRecording || isProcessing}
                  className="w-full"
                  variant="destructive"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Recording
                </Button>

                <div className="relative">
                  <Button
                    onClick={() => document.getElementById("file-upload")?.click()}
                    disabled={isRecording || isProcessing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Audio File
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    accept="audio/*,video/webm,audio/webm,audio/mp3,audio/mp4,audio/mpeg,audio/mpga,audio/m4a,audio/wav,audio/ogg"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isRecording || isProcessing}
                  />
                </div>

                <p className="text-xs text-center text-gray-500 mt-1">{fileName}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                <p className={`text-sm ${isProcessing ? "text-amber-600" : ""}`}>{status}</p>
              </div>
              <canvas
                ref={canvasRef}
                className={`w-full h-16 mt-2 rounded border ${isRecording ? "block" : "hidden"}`}
              />
            </CardContent>
          </Card>

          <RecordingsManager onRecordingSelect={handleRecordingSelect} />
        </div>

        {/* Output Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation (Plain Text)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={transcriptText}
                readOnly
                className="min-h-[120px] font-mono"
                placeholder="Full conversation text will appear here..."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timestamped Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={timestampedText}
                readOnly
                className="min-h-[120px] font-mono"
                placeholder="[0.00s - 5.32s] Segment text..."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw API JSON Response</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={jsonOutput}
                readOnly
                className="min-h-[120px] font-mono"
                placeholder="Verbose JSON from OpenAI API..."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
