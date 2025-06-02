// Audio processing utilities

// Detect silence in audio data
export function detectSilence(
  audioBuffer: AudioBuffer,
  silenceThreshold = 0.01,
  minSilenceDuration = 0.5,
): { start: number; end: number }[] {
  const channelData = audioBuffer.getChannelData(0) // Get data from first channel
  const sampleRate = audioBuffer.sampleRate
  const silenceFrames = Math.round(minSilenceDuration * sampleRate)

  const silenceRanges: { start: number; end: number }[] = []
  let isSilence = false
  let silenceStart = 0
  let consecutiveSilenceFrames = 0

  // Analyze audio data to find silence
  for (let i = 0; i < channelData.length; i++) {
    const amplitude = Math.abs(channelData[i])

    if (amplitude < silenceThreshold) {
      // Current frame is silence
      if (!isSilence) {
        // Transition from sound to silence
        isSilence = true
        silenceStart = i
      }
      consecutiveSilenceFrames++
    } else {
      // Current frame is sound
      if (isSilence && consecutiveSilenceFrames >= silenceFrames) {
        // We had enough consecutive silence frames to count as silence
        silenceRanges.push({
          start: silenceStart / sampleRate,
          end: i / sampleRate,
        })
      }
      isSilence = false
      consecutiveSilenceFrames = 0
    }
  }

  // Check if we ended in silence
  if (isSilence && consecutiveSilenceFrames >= silenceFrames) {
    silenceRanges.push({
      start: silenceStart / sampleRate,
      end: channelData.length / sampleRate,
    })
  }

  return silenceRanges
}

// Remove silence from audio buffer
export async function removeSilence(
  audioBuffer: AudioBuffer,
  silenceRanges: { start: number; end: number }[],
): Promise<AudioBuffer> {
  const sampleRate = audioBuffer.sampleRate
  const numChannels = audioBuffer.numberOfChannels

  // Calculate total duration without silence
  let totalDuration = audioBuffer.duration
  for (const range of silenceRanges) {
    totalDuration -= range.end - range.start
  }

  // Create a new buffer for the audio without silence
  const newBuffer = new AudioContext().createBuffer(numChannels, Math.ceil(totalDuration * sampleRate), sampleRate)

  // Copy audio data, skipping silence
  for (let channel = 0; channel < numChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel)
    const outputData = newBuffer.getChannelData(channel)

    let outputPosition = 0
    let lastEnd = 0

    for (const range of silenceRanges) {
      const silenceStart = Math.floor(range.start * sampleRate)
      const silenceEnd = Math.ceil(range.end * sampleRate)

      // Copy audio before silence
      for (let i = lastEnd; i < silenceStart; i++) {
        outputData[outputPosition++] = inputData[i]
      }

      lastEnd = silenceEnd
    }

    // Copy remaining audio after last silence
    for (let i = lastEnd; i < inputData.length; i++) {
      outputData[outputPosition++] = inputData[i]
    }
  }

  return newBuffer
}

// Chunk audio into segments of specified duration
export function chunkAudio(
  audioBuffer: AudioBuffer,
  maxChunkDuration = 100, // seconds
): AudioBuffer[] {
  const sampleRate = audioBuffer.sampleRate
  const numChannels = audioBuffer.numberOfChannels
  const maxChunkSamples = maxChunkDuration * sampleRate

  const chunks: AudioBuffer[] = []
  const numChunks = Math.ceil(audioBuffer.length / maxChunkSamples)

  for (let i = 0; i < numChunks; i++) {
    const startSample = i * maxChunkSamples
    const endSample = Math.min(startSample + maxChunkSamples, audioBuffer.length)
    const chunkLength = endSample - startSample

    const chunkBuffer = new AudioContext().createBuffer(numChannels, chunkLength, sampleRate)

    for (let channel = 0; channel < numChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel)
      const outputData = chunkBuffer.getChannelData(channel)

      for (let j = 0; j < chunkLength; j++) {
        outputData[j] = inputData[startSample + j]
      }
    }

    chunks.push(chunkBuffer)
  }

  return chunks
}

// Convert AudioBuffer to Blob
export function audioBufferToBlob(audioBuffer: AudioBuffer, mimeType = "audio/webm"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const audioContext = new AudioContext()
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer

    const destination = audioContext.createMediaStreamDestination()
    source.connect(destination)

    const mediaRecorder = new MediaRecorder(destination.stream, { mimeType })
    const chunks: Blob[] = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      resolve(blob)
    }

    mediaRecorder.onerror = (event) => {
      reject(new Error("MediaRecorder error: " + event))
    }

    mediaRecorder.start()
    source.start()

    // Stop recording when the buffer has played
    setTimeout(() => {
      mediaRecorder.stop()
      source.stop()
    }, audioBuffer.duration * 1000)
  })
}

// Convert Blob to AudioBuffer
export function blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader()

    fileReader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer
        const audioContext = new AudioContext()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        resolve(audioBuffer)
      } catch (error) {
        reject(error)
      }
    }

    fileReader.onerror = (error) => {
      reject(error)
    }

    fileReader.readAsArrayBuffer(blob)
  })
}

// Process audio: remove silence and chunk into segments
export async function processAudio(
  audioBlob: Blob,
  maxChunkDuration = 100, // seconds
  silenceThreshold = 0.01,
  minSilenceDuration = 0.5,
): Promise<Blob[]> {
  try {
    // Convert blob to AudioBuffer
    const audioBuffer = await blobToAudioBuffer(audioBlob)

    // Detect silence
    const silenceRanges = detectSilence(audioBuffer, silenceThreshold, minSilenceDuration)

    // Remove silence
    const audioWithoutSilence = await removeSilence(audioBuffer, silenceRanges)

    // Chunk audio
    const audioChunks = chunkAudio(audioWithoutSilence, maxChunkDuration)

    // Convert chunks back to blobs
    const blobPromises = audioChunks.map((chunk) => audioBufferToBlob(chunk, audioBlob.type))
    return Promise.all(blobPromises)
  } catch (error) {
    console.error("Error processing audio:", error)
    // If processing fails, return the original blob as a single chunk
    return [audioBlob]
  }
}
