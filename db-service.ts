import { openDB, type IDBPDatabase } from "idb"

// Database schema
interface Recording {
  id?: number
  timestamp: string
  blob: Blob
  duration: number
  name: string
  transcription?: string
}

// Database name and version
const DB_NAME = "audioRecordingsDB"
const DB_VERSION = 1

// Initialize the database
export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create a store for audio recordings if it doesn't exist
      if (!db.objectStoreNames.contains("recordings")) {
        db.createObjectStore("recordings", { keyPath: "id", autoIncrement: true })
      }
    },
  })
}

// Save a recording to the database
export async function saveRecording(recording: Recording): Promise<number> {
  const db = await initDB()
  return db.add("recordings", recording)
}

// Get all recordings from the database
export async function getAllRecordings(): Promise<Recording[]> {
  const db = await initDB()
  return db.getAll("recordings")
}

// Get a recording by ID
export async function getRecording(id: number): Promise<Recording | undefined> {
  const db = await initDB()
  return db.get("recordings", id)
}

// Update a recording
export async function updateRecording(recording: Recording): Promise<number> {
  const db = await initDB()
  return db.put("recordings", recording)
}

// Delete a recording
export async function deleteRecording(id: number): Promise<void> {
  const db = await initDB()
  return db.delete("recordings", id)
}

// Clear all recordings
export async function clearRecordings(): Promise<void> {
  const db = await initDB()
  return db.clear("recordings")
}
