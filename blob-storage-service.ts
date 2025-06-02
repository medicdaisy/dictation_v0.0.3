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
    console.log("Saving recording:", { filename, size: audioBlob.size, type: audioBlob.type })

    const formData = new FormData()
    formData.append("file", audioBlob, filename)
    formData.append("filename", filename)

    const response = await fetch("/api/recordings", {
      method: "POST",
      body: formData,
    })

    console.log("API response status:", response.status, response.statusText)
    console.log("API response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const contentType = response.headers.get("content-type")
      console.error("API response not ok:", {
        status: response.status,
        statusText: response.statusText,
        contentType: contentType,
      })

      let errorMessage = `API error: ${response.status} ${response.statusText}`

      try {
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } else {
          // If it's not JSON, get the text response
          const errorText = await response.text()
          console.error("Non-JSON error response:", errorText.substring(0, 500))
          errorMessage = `Server returned HTML instead of JSON. This might be a routing or configuration issue.`
        }
      } catch (parseError) {
        console.error("Error parsing response:", parseError)
        errorMessage = `Failed to parse API response: ${response.status} ${response.statusText}`
      }

      throw new Error(errorMessage)
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text()
      console.error("Expected JSON but got:", contentType, responseText.substring(0, 200))
      throw new Error("Server returned non-JSON response when JSON was expected")
    }

    const result = await response.json()
    console.log("Recording saved successfully:", result)

    return {
      ...result,
      uploadedAt: new Date(result.uploadedAt),
    }
  } catch (error: any) {
    console.error("Error in saveRecording:", error)

    // Provide more helpful error messages
    if (error.message.includes("Failed to fetch")) {
      throw new Error("Network error: Unable to connect to the server. Please check your internet connection.")
    } else if (error.message.includes("HTML instead of JSON")) {
      throw new Error(
        "Server configuration error: The API is returning HTML instead of JSON. Please check the server logs.",
      )
    } else {
      throw new Error(`Failed to save recording: ${error.message}`)
    }
  }
}

// List all stored recordings via API
export async function listRecordings(): Promise<StoredRecording[]> {
  try {
    console.log("Fetching recordings list...")

    const response = await fetch("/api/recordings")

    console.log("List API response status:", response.status, response.statusText)

    if (!response.ok) {
      const contentType = response.headers.get("content-type")
      console.error("List API response not ok:", {
        status: response.status,
        statusText: response.statusText,
        contentType: contentType,
      })

      let errorMessage = `API error: ${response.status} ${response.statusText}`

      try {
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } else {
          const errorText = await response.text()
          console.error("Non-JSON error response:", errorText.substring(0, 500))
          errorMessage = "Server returned HTML instead of JSON"
        }
      } catch (parseError) {
        console.error("Error parsing response:", parseError)
        errorMessage = `Failed to parse API response: ${response.status} ${response.statusText}`
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    console.log("Successfully fetched recordings:", data.recordings?.length || 0)

    return data.recordings.map((recording: any) => ({
      ...recording,
      uploadedAt: new Date(recording.uploadedAt),
    }))
  } catch (error: any) {
    console.error("Error in listRecordings:", error)

    // Return empty array as fallback instead of throwing
    console.warn("Returning empty recordings list due to error")
    return []
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
    // Handle data URLs (for in-memory storage)
    if (url.startsWith("data:")) {
      const response = await fetch(url)
      return await response.blob()
    }

    // Handle regular URLs
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
