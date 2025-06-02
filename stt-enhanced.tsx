"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Mic, Pause, Play, Square, Upload, Settings, FileAudio, AlertCircle } from "lucide-react"
import { saveRecording, listRecordings, fetchRecordingBlob } from "./blob-storage-service"
import RecordingsManager from "./recordings-manager"
import TranscriptionOptionsComponent, { type TranscriptionOptions } from "./transcription-options"
import TranscriptionResults from "./transcription-results"
import DeepgramTest from "./deepgram-test"
import GeminiTest from "./gemini-test"

export default function SpeechToTextApp() {
  // State for recording
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState("Ready to record or upload")
  const [selectedModel, setSelectedModel] = useState("whisper-1")
  const [fileName, setFileName] = useState("No file selected")
  const [error, setError] = useState<string | null>(null)

  // State for transcription results
  const [transcriptText, setTranscriptText] = useState("")
  const [timestampedText, setTimestampedText] = useState("")
  const [jsonOutput, setJsonOutput] = useState("")

  const [transcriptionOptions, setTranscriptionOptions] = useState<TranscriptionOptions>({
    provider: "gemini",
    model: "gemini-2.0-flash-exp",
    language: "en",
    diarize: true,
    sentiment: true,
    topics: true,
    detectLanguage: true,
    customTopicMode: "extended",
    customTopics: ["medicine", "doctor", "patient"],
    includeTimestamps: true,
    speakerLabels: true,
    punctuation: true,
  })

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
      setError(null) // Clear any previous errors
    } catch (error: any) {
      console.error("Error loading stored recordings:", error)
      setError(`Failed to load recordings: ${error.message}`)
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
      setError(null)
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
      setError(message)
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
    setError(null)
    setStatus("Processing audio...")

    try {
      // Combine all audio chunks into a single blob
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || "audio/webm",
      })

      console.log("Processing recorded audio:", {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: audioChunksRef.current.length,
      })

      // Save original recording to storage
      setStatus("Saving recording...")
      const result = await saveRecording(audioBlob, "live_recording.webm")
      console.log("Recording saved to:", result.url)
      setStatus("Recording saved successfully. Processing audio...")

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
      const errorMessage = `Error: ${error.message}`
      setStatus(errorMessage)
      setError(errorMessage)
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

  // Transcribe audio chunks using selected provider
  const transcribeAudioChunks = async (chunks: Blob[]): Promise<any> => {
    if (transcriptionOptions.provider === "deepgram") {
      return transcribeWithDeepgram(chunks[0]) // Deepgram handles full audio, no chunking needed
    } else if (transcriptionOptions.provider === "gemini") {
      return transcribeWithGemini(chunks[0]) // Gemini handles full audio, no chunking needed
    } else {
      return transcribeWithOpenAI(chunks)
    }
  }

  // Transcribe with Deepgram
  const transcribeWithDeepgram = async (audioBlob: Blob): Promise<any> => {
    setStatus("Transcribing with Deepgram...")

    const formData = new FormData()
    formData.append("file", audioBlob)
    formData.append("options", JSON.stringify(transcriptionOptions))

    const response = await fetch("/api/transcribe/deepgram", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Transcription failed")
    }

    return await response.json()
  }

  // Transcribe with Gemini
  const transcribeWithGemini = async (audioBlob: Blob): Promise<any> => {
    setStatus("Transcribing with Google Gemini...")

    const formData = new FormData()
    formData.append("file", audioBlob)
    formData.append("options", JSON.stringify(transcriptionOptions))

    const response = await fetch("/api/transcribe/gemini", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Gemini transcription failed")
    }

    return await response.json()
  }

  // Transcribe with OpenAI (existing simulation)
  const transcribeWithOpenAI = async (chunks: Blob[]): Promise<any> => {
    setStatus(`Transcribing ${chunks.length} audio chunks with OpenAI...`)

    // Simulate OpenAI API calls
    const results = []
    for (let i = 0; i < chunks.length; i++) {
      setStatus(`Transcribing chunk ${i + 1} of ${chunks.length}...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      results.push({
        text: `This is the transcription for chunk ${i + 1}.`,
        segments: [
          {
            id: i * 10 + 1,
            start: i * 100,
            end: i * 100 + 30,
            text: `This is segment 1 of chunk ${i + 1}.`,
          },
        ],
      })
    }

    return combineTranscriptionResults(results)
  }

  // Combine transcription results from multiple chunks (OpenAI) or return single result (Deepgram)
  const combineTranscriptionResults = (results: any): any => {
    if (Array.isArray(results)) {
      // OpenAI results (array of chunks)
      const text = results.map((r) => r.text).join(" ")
      let allSegments: any[] = []

      results.forEach((result) => {
        if (result.segments && Array.isArray(result.segments)) {
          allSegments = [...allSegments, ...result.segments]
        }
      })

      allSegments.sort((a, b) => a.start - b.start)

      const timestamped = allSegments
        .map((segment) => {
          const start = segment.start.toFixed(2)
          const end = segment.end.toFixed(2)
          return `[${start}s - ${end}s] ${segment.text}`
        })
        .join("\n")

      return { text, timestamped, json: { text, segments: allSegments } }
    } else {
      // Deepgram result (single object)
      const timestamped =
        results.paragraphs
          ?.map((paragraph: any) => {
            const start = paragraph.start?.toFixed(2) || "0.00"
            const end = paragraph.end?.toFixed(2) || "0.00"
            const speaker = paragraph.speaker !== undefined ? ` [Speaker ${paragraph.speaker}]` : ""
            return `[${start}s - ${end}s]${speaker} ${paragraph.text}`
          })
          .join("\n") || ""

      return {
        text: results.text,
        timestamped,
        json: results,
        fullResults: results, // Store full results for the new component
      }
    }
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
    setError(null)
    setStatus(`Processing uploaded file: ${file.name}`)

    try {
      console.log("Processing uploaded file:", {
        name: file.name,
        size: file.size,
        type: file.type,
      })

      // Save original file to storage
      setStatus("Saving file...")
      const result = await saveRecording(file, file.name)
      console.log("File saved to:", result.url)
      setStatus("File saved successfully. Processing audio...")

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
      const errorMessage = `Error: ${error.message}`
      setStatus(errorMessage)
      setError(errorMessage)
      setIsProcessing(false)
    }
  }

  const handleRecordingSelect = async (recording: any) => {
    setIsProcessing(true)
    setError(null)
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
      const errorMessage = `Error: ${error.message}`
      setStatus(errorMessage)
      setError(errorMessage)
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Voice Transcription</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRecordings(!showRecordings)}
            className="text-slate-600"
          >
            <FileAudio className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-7xl">
        {/* Desktop Header */}
        <div className="hidden md:block mb-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Voice Transcription Studio</h1>
            <p className="text-slate-600 text-lg">Advanced speech-to-text with AI-powered analysis</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </Button>
          </div>
        )}

        {/* Mobile-first Layout */}
        <div className="space-y-6 md:grid md:grid-cols-[380px_1fr] md:gap-8 md:space-y-0">
          {/* Controls Panel - Mobile First */}
          <div className={`space-y-4 ${showRecordings ? "block" : "hidden md:block"}`}>
            {/* Recording Controls Card */}
            <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                    <Mic className="h-5 w-5 text-white" />
                  </div>
                  Recording Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status Display */}
                <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-3">
                    {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                    {isRecording && !isPaused && (
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-red-600">RECORDING</span>
                      </div>
                    )}
                    {isPaused && (
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-sm font-medium text-yellow-600">PAUSED</span>
                      </div>
                    )}
                    <p
                      className={`text-sm flex-1 ${isProcessing ? "text-amber-600" : error ? "text-red-600" : "text-slate-600"}`}
                    >
                      {status}
                    </p>
                  </div>

                  {/* Waveform Visualization */}
                  <canvas
                    ref={canvasRef}
                    className={`w-full h-16 mt-3 rounded-lg border border-slate-200 ${isRecording ? "block" : "hidden"}`}
                  />
                </div>

                {/* Recording Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      disabled={isProcessing}
                      className="col-span-2 h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium shadow-lg"
                    >
                      <Mic className="mr-2 h-5 w-5" />
                      Start Recording
                    </Button>
                  ) : (
                    <>
                      {isPaused ? (
                        <Button
                          onClick={resumeRecording}
                          disabled={isProcessing}
                          className="h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Resume
                        </Button>
                      ) : (
                        <Button
                          onClick={pauseRecording}
                          disabled={isProcessing}
                          className="h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                      )}
                      <Button
                        onClick={stopRecording}
                        disabled={isProcessing}
                        className="h-12 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white"
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    </>
                  )}
                </div>

                {/* Upload Button */}
                <div className="relative">
                  <Button
                    onClick={() => document.getElementById("file-upload")?.click()}
                    disabled={isRecording || isProcessing}
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium shadow-lg"
                  >
                    <Upload className="mr-2 h-5 w-5" />
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

                {fileName !== "No file selected" && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm text-emerald-700 font-medium truncate">{fileName}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transcription Options - Collapsible on Mobile */}
            <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  AI Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TranscriptionOptionsComponent
                  options={transcriptionOptions}
                  onChange={setTranscriptionOptions}
                  disabled={isRecording || isProcessing}
                />
              </CardContent>
            </Card>

            {/* Deepgram Test - Hidden on Mobile */}
            <div className="hidden md:block">
              <DeepgramTest />
            </div>

            {/* Gemini Test - Hidden on Mobile */}
            <div className="hidden md:block">
              <GeminiTest />
            </div>

            {/* Recordings Manager - Collapsible */}
            <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
              <RecordingsManager onRecordingSelect={handleRecordingSelect} />
            </Card>
          </div>

          {/* Results Panel */}
          <div className={`space-y-6 ${showRecordings ? "hidden md:block" : "block"}`}>
            <TranscriptionResults
              results={
                transcriptText
                  ? {
                      text: transcriptText,
                      timestamped: timestampedText,
                      raw: jsonOutput ? JSON.parse(jsonOutput) : null,
                      ...(JSON.parse(jsonOutput || "{}").fullResults || {}),
                    }
                  : null
              }
              loading={isProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
