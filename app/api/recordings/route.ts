import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory storage as fallback
let recordings: any[] = []

// GET - List all recordings
export async function GET() {
  try {
    console.log("GET /api/recordings - Starting request processing")

    // Check if Vercel Blob is available
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { list } = await import("@vercel/blob")
        const { blobs } = await list({ prefix: "recordings/" })

        const blobRecordings = blobs.map((blob) => ({
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
          contentType: blob.contentType,
        }))

        console.log("Successfully listed recordings from Vercel Blob:", blobRecordings.length)
        return NextResponse.json({ recordings: blobRecordings })
      } catch (blobError) {
        console.warn("Vercel Blob error, falling back to memory storage:", blobError)
      }
    }

    // Fallback to in-memory storage
    console.log("Using in-memory storage, recordings count:", recordings.length)
    return NextResponse.json({ recordings })
  } catch (error: any) {
    console.error("Error listing recordings:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })

    return NextResponse.json(
      {
        error: "Failed to list recordings",
        details: error.message,
        type: error.name,
      },
      { status: 500 },
    )
  }
}

// POST - Save a new recording
export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/recordings - Starting request processing")

    const formData = await request.formData()
    const file = formData.get("file") as File
    const filename = formData.get("filename") as string

    console.log("File received:", {
      name: file?.name,
      size: file?.size,
      type: file?.type,
      filename: filename,
    })

    if (!file) {
      console.error("No file provided in request")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const sanitizedFilename = (filename || file.name).replace(/[^a-zA-Z0-9.-]/g, "_")
    const pathname = `recordings/${timestamp}_${sanitizedFilename}`

    // Try Vercel Blob first
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        console.log("Attempting to save to Vercel Blob:", pathname)
        const { put } = await import("@vercel/blob")

        const result = await put(pathname, file, {
          access: "public",
          contentType: file.type || "audio/webm",
          addRandomSuffix: false,
        })

        console.log("Vercel Blob save successful:", result)

        const response = {
          url: result.url,
          pathname: result.pathname,
          size: file.size,
          uploadedAt: new Date(),
          contentType: file.type,
        }

        return NextResponse.json(response)
      } catch (blobError) {
        console.warn("Vercel Blob error, falling back to memory storage:", blobError)
      }
    }

    // Fallback to in-memory storage with data URL
    console.log("Using in-memory storage fallback")

    // Convert file to data URL for in-memory storage
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    const dataUrl = `data:${file.type || "audio/webm"};base64,${base64}`

    const recording = {
      url: dataUrl,
      pathname: pathname,
      size: file.size,
      uploadedAt: new Date(),
      contentType: file.type,
    }

    recordings.push(recording)
    console.log("Recording saved to memory storage, total recordings:", recordings.length)

    return NextResponse.json(recording)
  } catch (error: any) {
    console.error("Error saving recording:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })

    return NextResponse.json(
      {
        error: "Failed to save recording",
        details: error.message,
        type: error.name,
      },
      { status: 500 },
    )
  }
}

// DELETE - Delete a recording
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pathname = searchParams.get("pathname")

    if (!pathname) {
      return NextResponse.json({ error: "No pathname provided" }, { status: 400 })
    }

    // Try Vercel Blob first
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { del } = await import("@vercel/blob")
        await del(pathname)
        return NextResponse.json({ success: true })
      } catch (blobError) {
        console.warn("Vercel Blob delete error, trying memory storage:", blobError)
      }
    }

    // Fallback to in-memory storage
    const initialLength = recordings.length
    recordings = recordings.filter((r) => r.pathname !== pathname)
    const deleted = recordings.length < initialLength

    return NextResponse.json({ success: deleted })
  } catch (error: any) {
    console.error("Error deleting recording:", error)
    return NextResponse.json({ error: "Failed to delete recording", details: error.message }, { status: 500 })
  }
}
