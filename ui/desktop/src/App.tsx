import React, { useState, useRef, useEffect } from 'react'
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Card, CardContent } from "./components/ui/card"
import { ArrowRight } from 'lucide-react'

type Item = {
  id: number
  type: 'tool-call' | 'tool-result'
  content: string
}

export default function Agent() {
  const [prompt, setPrompt] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim() && !isGenerating) {
      setIsGenerating(true)
      generateItems()
    }
  }

  const generateItems = () => {
    let id = items.length
    const toolCalls = [
      'Analyzing prompt',
      'Searching knowledge base',
      'Generating response',
      'Verifying information'
    ]
    const toolResults = [
      'Prompt analysis complete',
      'Relevant information found',
      'Initial response drafted',
      'Information verified'
    ]

    const addItem = (type: 'tool-call' | 'tool-result', content: string) => {
      setItems(prev => [...prev, { id: id++, type, content }])
    }

    toolCalls.forEach((call, index) => {
      setTimeout(() => {
        addItem('tool-call', call)
        setTimeout(() => {
          addItem('tool-result', toolResults[index])
          if (index === toolCalls.length - 1) {
            setIsGenerating(false)
          }
        }, 1000)
      }, index * 2000)
    })
  }

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth
    }
  }, [items])

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      <div className="w-full max-w-4xl p-8 space-y-6 bg-blue-950 bg-opacity-50 rounded-xl shadow-2xl backdrop-blur-sm">
        <h1 className="text-4xl font-bold text-center text-blue-200 mb-8 font-mono tracking-wider">Goose 🪿 AI</h1>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <Input
            type="text"
            placeholder="Enter your prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-grow bg-blue-800 border-blue-600 text-blue-100 placeholder-blue-400"
          />
          <Button 
            type="submit" 
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-500 text-blue-100 font-mono"
          >
            Submit
          </Button>
        </form>
        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto space-x-4 p-4 bg-blue-900 bg-opacity-50 rounded-lg max-w-full"
          style={{ scrollBehavior: 'smooth' }}
        >
          {items.map((item) => (
            <Card key={item.id} className="flex-shrink-0 w-64 bg-blue-800 border-blue-600">
              <CardContent className="p-4">
                <p className="font-semibold mb-2 text-blue-200 font-mono">
                  {item.type === 'tool-call' ? 'Tool Call' : 'Tool Result'}
                </p>
                <div className="flex items-center space-x-2 text-blue-100">
                  <ArrowRight className="h-4 w-4 text-blue-400" />
                  <p className="font-mono">{item.content}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}