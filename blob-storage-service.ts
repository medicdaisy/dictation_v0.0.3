// Service for managing audio recordings via API routes

export interface StoredRecording {
  url: string
  pathname: string
  size: number
  uploadedAt: Date
  contentType?: string
}

// Save an audio recording via API
export async function saveRecording(audioBlob: Blob, filename: string): Promise<StoredRecording> {
  try {
    const formData = new FormData()
    formData.append("file", audioBlob, filename)
    formData.append("filename", filename)

    const response = await fetch("/api/recordings", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to save recording")
    }

    const result = await response.json()
    return {
      ...result,
      uploadedAt: new Date(result.uploadedAt),
    }
  } catch (error: any) {
    console.error("Error saving recording:", error)
    throw new Error(`Failed to save recording: ${error.message}`)
  }
}

// List all stored recordings via API
export async function listRecordings(): Promise<StoredRecording[]> {
  try {
    const response = await fetch("/api/recordings")

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to list recordings")
    }

    const data = await response.json()
    return data.recordings.map((recording: any) => ({
      ...recording,
      uploadedAt: new Date(recording.uploadedAt),
    }))
  } catch (error: any) {
    console.error("Error listing recordings:", error)
    throw new Error(`Failed to list recordings: ${error.message}`)
  }
}

// Delete a recording via API
export async function deleteRecording(pathname: string): Promise<void> {
  try {
    const response = await fetch(`/api/recordings?pathname=${encodeURIComponent(pathname)}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to delete recording")
    }
  } catch (error: any) {
    console.error("Error deleting recording:", error)
    throw new Error(`Failed to delete recording: ${error.message}`)
  }
}

// Get recording metadata
export function getRecordingMetadata(recording: StoredRecording) {
  const filename = recording.pathname.split("/").pop() || "unknown"
  const isUpload = filename.includes("upload_") || filename.includes("file_")
  const isRecording = filename.includes("recording_") || filename.includes("live_")

  return {
    filename,
    displayName: filename.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, ""),
    type: isUpload ? "upload" : isRecording ? "recording" : "unknown",
    size: formatFileSize(recording.size),
    date: formatDate(recording.uploadedAt),
  }
}

// Utility function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Utility function to format date
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

// Download a recording
export function downloadRecording(recording: StoredRecording): void {
  const metadata = getRecordingMetadata(recording)
  const link = document.createElement("a")
  link.href = recording.url
  link.download = metadata.displayName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Fetch recording blob from URL
export async function fetchRecordingBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.blob()
  } catch (error: any) {
    console.error("Error fetching recording blob:", error)
    throw new Error(`Failed to fetch recording: ${error.message}`)
  }
}
