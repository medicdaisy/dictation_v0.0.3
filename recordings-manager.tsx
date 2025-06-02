"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { listRecordings, deleteRecording, getRecordingMetadata, type StoredRecording } from "./blob-storage-service"
import { Download, Play, Trash2, FileAudio, Calendar, Clock, RefreshCw, Loader2 } from "lucide-react"

interface RecordingsManagerProps {
  onRecordingSelect?: (recording: StoredRecording) => void
}

export default function RecordingsManager({ onRecordingSelect }: RecordingsManagerProps) {
  const [recordings, setRecordings] = useState<StoredRecording[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRecording, setSelectedRecording] = useState<StoredRecording | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRecordings()
  }, [])

  const loadRecordings = async () => {
    setLoading(true)
    setError(null)
    try {
      const recordingsList = await listRecordings()
      setRecordings(recordingsList)
    } catch (error: any) {
      console.error("Error loading recordings:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRecording = async (pathname: string) => {
    try {
      await deleteRecording(pathname)
      setRecordings((prev) => prev.filter((r) => r.pathname !== pathname))
      if (selectedRecording?.pathname === pathname) {
        setSelectedRecording(null)
      }
    } catch (error: any) {
      console.error("Error deleting recording:", error)
      setError(error.message)
    }
  }

  const playRecording = async (recording: StoredRecording) => {
    if (isPlaying) {
      // Stop current playback
      const audioElements = document.querySelectorAll("audio")
      audioElements.forEach((audio) => {
        audio.pause()
        audio.currentTime = 0
      })
      setIsPlaying(false)
      return
    }

    try {
      const audio = new Audio(recording.url)
      audio.onplay = () => setIsPlaying(true)
      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => setIsPlaying(false)

      await audio.play()
      setSelectedRecording(recording)
    } catch (error) {
      console.error("Error playing recording:", error)
      setIsPlaying(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date))
  }

  const getRecordingName = (pathname: string) => {
    const parts = pathname.split("/")
    return parts[parts.length - 1]
  }

  const downloadRecording = (recording: StoredRecording) => {
    const link = document.createElement("a")
    link.href = recording.url
    link.download = getRecordingName(recording.pathname)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileAudio className="h-5 w-5" />
          Stored Recordings ({recordings.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Loading recordings...</p>
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileAudio className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">No recordings found</p>
            <p className="text-xs text-slate-400 mt-1">Start recording to see them here</p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {recordings.map((recording) => {
                const metadata = getRecordingMetadata(recording)
                return (
                  <div
                    key={recording.pathname}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium truncate text-slate-900">{metadata.displayName}</h4>
                        {selectedRecording?.pathname === recording.pathname && isPlaying && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            Playing
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {metadata.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {metadata.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {metadata.size}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => playRecording(recording)}
                        className="h-8 w-8 p-0 hover:bg-blue-100"
                      >
                        <Play className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadRecording(recording)}
                        className="h-8 w-8 p-0 hover:bg-green-100"
                      >
                        <Download className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordingSelect?.(recording)}
                        className="h-8 w-8 p-0 hover:bg-purple-100"
                        title="Transcribe this recording"
                      >
                        <FileAudio className="h-4 w-4 text-purple-600" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-100">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Delete Recording</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <p className="text-sm">Are you sure you want to delete this recording?</p>
                            <p className="text-sm text-slate-500 mt-1 truncate">{metadata.displayName}</p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Cancel
                              </Button>
                            </DialogTrigger>
                            <DialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteRecording(recording.pathname)}
                              >
                                Delete
                              </Button>
                            </DialogTrigger>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
        <Button onClick={loadRecordings} variant="outline" className="w-full mt-4 h-11" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Recordings
        </Button>
      </CardContent>
    </Card>
  )
}
