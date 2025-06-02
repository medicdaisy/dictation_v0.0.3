import { type NextRequest, NextResponse } from "next/server"
import { list, put, del } from "@vercel/blob"

// GET - List all recordings
export async function GET() {
  try {
    const { blobs } = await list({ prefix: "recordings/" })

    const recordings = blobs.map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
      contentType: blob.contentType,
    }))

    return NextResponse.json({ recordings })
  } catch (error: any) {
    console.error("Error listing recordings:", error)
    return NextResponse.json({ error: "Failed to list recordings", details: error.message }, { status: 500 })
  }
}

// POST - Save a new recording
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const filename = formData.get("filename") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const sanitizedFilename = (filename || file.name).replace(/[^a-zA-Z0-9.-]/g, "_")
    const pathname = `recordings/${timestamp}_${sanitizedFilename}`

    const result = await put(pathname, file, {
      access: "public",
      contentType: file.type || "audio/webm",
      addRandomSuffix: false,
    })

    return NextResponse.json({
      url: result.url,
      pathname: result.pathname,
      size: file.size,
      uploadedAt: new Date(),
      contentType: file.type,
    })
  } catch (error: any) {
    console.error("Error saving recording:", error)
    return NextResponse.json({ error: "Failed to save recording", details: error.message }, { status: 500 })
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

    await del(pathname)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting recording:", error)
    return NextResponse.json({ error: "Failed to delete recording", details: error.message }, { status: 500 })
  }
}
