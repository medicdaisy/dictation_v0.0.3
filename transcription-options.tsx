"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X, Plus } from "lucide-react"

export interface TranscriptionOptions {
  provider: "openai" | "deepgram" | "gemini"
  model: string
  language: string
  diarize: boolean
  sentiment: boolean
  topics: boolean
  detectLanguage: boolean
  customTopicMode: "strict" | "extended" | "default"
  customTopics: string[]
  // Gemini-specific options
  includeTimestamps?: boolean
  speakerLabels?: boolean
  punctuation?: boolean
}

interface TranscriptionOptionsProps {
  options: TranscriptionOptions
  onChange: (options: TranscriptionOptions) => void
  disabled?: boolean
}

export default function TranscriptionOptionsComponent({
  options,
  onChange,
  disabled = false,
}: TranscriptionOptionsProps) {
  const [newTopic, setNewTopic] = useState("")

  const handleProviderChange = (newProviderValue: string) => {
    const newProvider = newProviderValue as "openai" | "deepgram" | "gemini";
    let newModel = "";

    switch (newProvider) {
      case "openai": // Corresponds to "Whisper"
        newModel = "whisper-1";
        break;
      case "gemini": // Corresponds to "Emilio LLM STT V4.0"
        newModel = "gemini-2.5-flash-preview-04-17";
        break;
      case "deepgram": // Corresponds to "Emilio LLM STT V4.2"
        newModel = "nova-3";
        break;
      default:
        console.warn("Unknown provider selected:", newProvider);
        // Fallback: update only provider, model might become inconsistent
        onChange({ ...options, provider: newProvider });
        return;
    }
    onChange({ ...options, provider: newProvider, model: newModel });
  };

  const updateOption = (key: keyof TranscriptionOptions, value: any) => {
    // For direct updates other than provider
    onChange({ ...options, [key]: value })
  }

  const addCustomTopic = () => {
    if (newTopic.trim() && !options.customTopics.includes(newTopic.trim())) {
      updateOption("customTopics", [...options.customTopics, newTopic.trim()])
      setNewTopic("")
    }
  }

  const removeCustomTopic = (topic: string) => {
    updateOption(
      "customTopics",
      options.customTopics.filter((t) => t !== topic),
    )
  }

  const addPresetTopics = (preset: string) => {
    const presets: { [key: string]: string[] } = {
      medical: ["medicine", "doctor", "surgeon", "nurse", "patient", "diagnosis", "treatment", "symptoms"],
      business: ["meeting", "project", "deadline", "budget", "strategy", "client", "revenue", "marketing"],
      education: ["student", "teacher", "lesson", "homework", "exam", "grade", "curriculum", "learning"],
      legal: ["law", "court", "judge", "lawyer", "case", "evidence", "contract", "litigation"],
      technology: ["software", "development", "programming", "database", "security", "cloud", "AI", "API"],
    }

    const topicsToAdd = presets[preset] || []
    const newTopics = [...new Set([...options.customTopics, ...topicsToAdd])]
    updateOption("customTopics", newTopics)
  }

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div className="space-y-2">
        <Label htmlFor="provider-select" className="text-sm font-medium text-slate-700">
          Provider
        </Label>
        <Select
          value={options.provider}
          onValueChange={(value) => handleProviderChange(value)}
          disabled={disabled}
        >
          <SelectTrigger id="provider-select" className="h-11">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">Whisper</SelectItem>
            <SelectItem value="gemini">Emilio LLM STT V4.0</SelectItem>
            <SelectItem value="deepgram">Emilio LLM STT V4.2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Model Selection - REMOVED and handled internally */}

      {/* Language Selection */}
      <div className="space-y-2">
        <Label htmlFor="language-select" className="text-sm font-medium text-slate-700">
          Language
        </Label>
        <Select value={options.language} onValueChange={(value) => updateOption("language", value)} disabled={disabled}>
          <SelectTrigger id="language-select" className="h-11">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
            <SelectItem value="de">German</SelectItem>
            <SelectItem value="it">Italian</SelectItem>
            <SelectItem value="pt">Portuguese</SelectItem>
            <SelectItem value="zh">Chinese</SelectItem>
            <SelectItem value="ja">Japanese</SelectItem>
            <SelectItem value="ko">Korean</SelectItem>
            <SelectItem value="auto">Auto-detect</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Features (Deepgram only) */}
      {options.provider === "deepgram" && (
        <div className="space-y-4 pt-2">
          <div className="border-t border-slate-200 pt-4">
            <Label className="text-sm font-medium text-slate-700 mb-3 block">AI Features</Label>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Switch
                  id="diarize"
                  checked={options.diarize}
                  onCheckedChange={(checked) => updateOption("diarize", checked)}
                  disabled={disabled}
                />
                <Label htmlFor="diarize" className="text-xs font-medium text-slate-700">
                  Speakers
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Switch
                  id="sentiment"
                  checked={options.sentiment}
                  onCheckedChange={(checked) => updateOption("sentiment", checked)}
                  disabled={disabled}
                />
                <Label htmlFor="sentiment" className="text-xs font-medium text-slate-700">
                  Sentiment
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Switch
                  id="topics"
                  checked={options.topics}
                  onCheckedChange={(checked) => updateOption("topics", checked)}
                  disabled={disabled}
                />
                <Label htmlFor="topics" className="text-xs font-medium text-slate-700">
                  Topics
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Switch
                  id="detect-language"
                  checked={options.detectLanguage}
                  onCheckedChange={(checked) => updateOption("detectLanguage", checked)}
                  disabled={disabled}
                />
                <Label htmlFor="detect-language" className="text-xs font-medium text-slate-700">
                  Auto-Lang
                </Label>
              </div>
            </div>
          </div>

          {/* Custom Topics - Collapsible */}
          {options.topics && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <Label className="text-sm font-medium text-slate-700">Custom Topics</Label>

              <Select
                value={options.customTopicMode}
                onValueChange={(value) => updateOption("customTopicMode", value)}
                disabled={disabled}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Topic mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="strict">Strict</SelectItem>
                  <SelectItem value="extended">Extended</SelectItem>
                </SelectContent>
              </Select>

              {/* Preset Topic Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {["medical", "business", "education", "legal", "tech"].map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    onClick={() => addPresetTopics(preset === "tech" ? "technology" : preset)}
                    disabled={disabled}
                    className="text-xs h-8 capitalize"
                  >
                    {preset}
                  </Button>
                ))}
              </div>

              {/* Add Custom Topic */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add topic..."
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addCustomTopic()}
                  disabled={disabled}
                  className="text-sm h-10"
                />
                <Button
                  onClick={addCustomTopic}
                  disabled={disabled || !newTopic.trim()}
                  size="sm"
                  className="h-10 px-3"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Display Custom Topics */}
              {options.customTopics.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">Topics ({options.customTopics.length}):</Label>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {options.customTopics.map((topic) => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomTopic(topic)}
                          disabled={disabled}
                          className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* m Features */}
      {options.provider === "gemini" && (
        <div className="space-y-4 pt-2">
          <div className="border-t border-slate-200 pt-4">
            <Label className="text-sm font-medium text-slate-700 mb-3 block">Gemini Features</Label>

            <div className="grid grid-cols-1 gap-3"> {/* Changed to grid-cols-1 for better layout with 3 items */}
              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Switch
                  id="include-timestamps"
                  checked={options.includeTimestamps || false}
                  onCheckedChange={(checked) => updateOption("includeTimestamps", checked)}
                  disabled={disabled}
                />
                <Label htmlFor="include-timestamps" className="text-xs font-medium text-slate-700">
                  Include Timestamps
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Switch
                  id="speaker-labels"
                  checked={options.speakerLabels || false}
                  onCheckedChange={(checked) => updateOption("speakerLabels", checked)}
                  disabled={disabled}
                />
                <Label htmlFor="speaker-labels" className="text-xs font-medium text-slate-700">
                  Speaker Labels
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Switch
                  id="punctuation"
                  checked={options.punctuation !== false} // Defaults to true if undefined
                  onCheckedChange={(checked) => updateOption("punctuation", checked)}
                  disabled={disabled}
                />
                <Label htmlFor="punctuation" className="text-xs font-medium text-slate-700">
                  Smart Punctuation
                </Label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}