"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { User, MessageCircle, TrendingUp, TrendingDown, Minus, Hash, Mic, Loader2 } from "lucide-react"

interface TranscriptionResultsProps {
  results: any
  loading?: boolean
}

export default function TranscriptionResults({ results, loading = false }: TranscriptionResultsProps) {
  if (loading) {
    return (
      <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <MessageCircle className="h-5 w-5 text-white animate-pulse" />
            </div>
            Processing Audio...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-sm text-slate-600">Analyzing your audio with AI...</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!results) {
    return (
      <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-r from-slate-400 to-slate-500 rounded-lg">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            Transcription Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto">
                <Mic className="h-8 w-8 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Ready to Transcribe</h3>
                <p className="text-slate-600 max-w-sm mx-auto">
                  Start recording or upload an audio file to see AI-powered transcription results with speaker
                  detection, sentiment analysis, and topic extraction.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "negative":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-100 text-green-800 border-green-200"
      case "negative":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            Transcription Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {results.confidence && (
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                <div className="text-2xl font-bold text-blue-600">{Math.round(results.confidence * 100)}%</div>
                <div className="text-xs text-blue-700 font-medium">Confidence</div>
              </div>
            )}
            {results.speakers && results.speakers.length > 0 && (
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                <div className="text-2xl font-bold text-purple-600">{results.speakers.length}</div>
                <div className="text-xs text-purple-700 font-medium">Speakers</div>
              </div>
            )}
            {results.topics && (
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                <div className="text-2xl font-bold text-green-600">{results.topics.length}</div>
                <div className="text-xs text-green-700 font-medium">Topics</div>
              </div>
            )}
            {results.language && (
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl">
                <div className="text-lg font-bold text-orange-600">{results.language.toUpperCase()}</div>
                <div className="text-xs text-orange-700 font-medium">Language</div>
              </div>
            )}
          </div>

          {/* Overall Sentiment */}
          {results.sentiment?.overall && (
            <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                {getSentimentIcon(results.sentiment.overall.sentiment)}
                <span className="font-medium text-slate-900">Overall Sentiment:</span>
                <Badge className={getSentimentColor(results.sentiment.overall.sentiment)}>
                  {results.sentiment.overall.sentiment}
                </Badge>
                <span className="text-sm text-slate-500">
                  ({Math.round(results.sentiment.overall.confidence * 100)}% confidence)
                </span>
              </div>
              {results.sentiment.overall.distribution && (
                <div className="space-y-2">
                  {Object.entries(results.sentiment.overall.distribution).map(([sentiment, count]) => (
                    <div key={sentiment} className="flex items-center gap-3 text-sm">
                      <span className="w-16 capitalize font-medium text-slate-700">{sentiment}:</span>
                      <Progress
                        value={((count as number) / results.sentiment.segments.length) * 100}
                        className="flex-1 h-2"
                      />
                      <span className="w-8 text-right text-slate-600 font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg">
              <Hash className="h-5 w-5 text-white" />
            </div>
            Detailed Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transcript" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 h-12">
              <TabsTrigger value="transcript" className="text-xs md:text-sm">
                Transcript
              </TabsTrigger>
              <TabsTrigger value="speakers" className="text-xs md:text-sm">
                Speakers
              </TabsTrigger>
              <TabsTrigger value="topics" className="text-xs md:text-sm">
                Topics
              </TabsTrigger>
              <TabsTrigger value="sentiment" className="text-xs md:text-sm hidden md:block">
                Sentiment
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs md:text-sm hidden md:block">
                Raw JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transcript" className="space-y-4 mt-6">
              <div>
                <h4 className="font-medium mb-3 text-slate-900">Full Transcript</h4>
                <Textarea
                  value={results.text || "No transcript available"}
                  readOnly
                  className="min-h-[200px] font-mono text-sm bg-slate-50 border-slate-200"
                />
              </div>

              {results.paragraphs && results.paragraphs.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 text-slate-900">Speaker Timeline</h4>
                  <ScrollArea className="h-64 border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="space-y-4">
                      {results.paragraphs.map((paragraph: any, index: number) => (
                        <div
                          key={index}
                          className="border-l-4 border-blue-400 pl-4 bg-white p-3 rounded-r-lg shadow-sm"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm text-slate-900">
                              Speaker {paragraph.speaker !== undefined ? paragraph.speaker : "Unknown"}
                            </span>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                              {paragraph.start?.toFixed(1)}s - {paragraph.end?.toFixed(1)}s
                            </span>
                            {paragraph.sentiment && (
                              <Badge className={getSentimentColor(paragraph.sentiment)} size="sm">
                                {paragraph.sentiment}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{paragraph.text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            <TabsContent value="speakers" className="space-y-4">
              {results.speakers && results.speakers.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-2">Detected Speakers ({results.speakers.length})</h4>
                  <div className="grid gap-4">
                    {results.speakers.map((speakerId: number) => {
                      const speakerSegments = results.paragraphs?.filter((p: any) => p.speaker === speakerId) || []
                      const totalDuration = speakerSegments.reduce(
                        (acc: number, seg: any) => acc + (seg.end - seg.start),
                        0,
                      )

                      return (
                        <Card key={speakerId}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <User className="h-5 w-5" />
                              Speaker {speakerId}
                              <Badge variant="outline">{speakerSegments.length} segments</Badge>
                              <Badge variant="outline">{totalDuration.toFixed(1)}s total</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-32">
                              <div className="space-y-2">
                                {speakerSegments.slice(0, 3).map((segment: any, index: number) => (
                                  <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                                    <div className="text-xs text-gray-500 mb-1">
                                      {segment.start?.toFixed(1)}s - {segment.end?.toFixed(1)}s
                                    </div>
                                    <p>{segment.text.substring(0, 100)}...</p>
                                  </div>
                                ))}
                                {speakerSegments.length > 3 && (
                                  <div className="text-xs text-gray-500 text-center">
                                    ... and {speakerSegments.length - 3} more segments
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">
                  No speaker information available. Enable speaker diarization to see speaker details.
                </p>
              )}
            </TabsContent>

            <TabsContent value="topics" className="space-y-4">
              {results.topics && results.topics.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-2">Detected Topics ({results.topics.length})</h4>
                  <div className="grid gap-2">
                    {results.topics
                      .sort((a: any, b: any) => b.confidence - a.confidence)
                      .map((topic: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{topic.topic}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={topic.confidence * 100} className="w-20 h-2" />
                            <span className="text-sm text-gray-500 w-12">{Math.round(topic.confidence * 100)}%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No topics detected. Enable topic detection to see topic analysis.</p>
              )}
            </TabsContent>

            <TabsContent value="sentiment" className="space-y-4">
              {results.sentiment?.segments && results.sentiment.segments.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-2">Sentiment Timeline</h4>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {results.sentiment.segments.map((segment: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            {getSentimentIcon(segment.sentiment)}
                            <span className="text-sm">
                              {segment.start?.toFixed(1)}s - {segment.end?.toFixed(1)}s
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getSentimentColor(segment.sentiment)}>{segment.sentiment}</Badge>
                            <span className="text-sm text-gray-500">{Math.round(segment.confidence * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <p className="text-gray-500">
                  No sentiment analysis available. Enable sentiment analysis to see emotional tone analysis.
                </p>
              )}
            </TabsContent>

            <TabsContent value="raw">
              <div>
                <h4 className="font-medium mb-2">Raw API Response</h4>
                <Textarea
                  value={JSON.stringify(results.raw || results, null, 2)}
                  readOnly
                  className="min-h-[300px] font-mono text-xs"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
