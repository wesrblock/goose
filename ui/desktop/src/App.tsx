import React, { useCallback, useState, useEffect, useRef } from 'react'
import { ForceGraph2D } from 'react-force-graph'
import Input from './components/Input'

// Define systems and their colors
const systems = {
  'AI': 'hsl(var(--primary))',
  'Version Control': 'hsl(var(--secondary))',
  'Package Management': 'hsl(var(--accent))',
  'Containerization': 'hsl(var(--destructive))',
  'IDE': 'hsl(var(--muted))',
  'Action': 'hsl(var(--popover))'
}

// Initial sample data
const initialData = {
  nodes: [
    { id: 'Goose', group: 1, system: 'Developer' },
    { id: 'Git', group: 2, system: 'Process' },
    { id: 'NPM', group: 2, system: 'Process' },
    { id: 'Docker', group: 2, system: 'Deploy' },
    { id: 'VSCode', group: 2, system: 'Editor' },
  ],
  links: [
    { source: 'Goose', target: 'Git', value: 1 },
    { source: 'Goose', target: 'NPM', value: 1 },
    { source: 'Goose', target: 'Docker', value: 1 },
    { source: 'Goose', target: 'VSCode', value: 1 },
  ]
}

export default function AIAgentForceGraph() {
  const [graphData, setGraphData] = useState(initialData)
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())
  const [hoverNode, setHoverNode] = useState(null)
  const [prompt, setPrompt] = useState('')
  const fgRef = useRef()

  const updateHighlight = () => {
    setHighlightNodes(new Set(hoverNode ? [hoverNode] : []))
    setHighlightLinks(new Set(hoverNode ? graphData.links.filter(link => link.source === hoverNode || link.target === hoverNode) : []))
  }

  const handleNodeHover = (node) => {
    setHoverNode(node || null)
    updateHighlight()
  }

  const handleLinkHover = (link) => {
    setHighlightNodes(new Set(link ? [link.source, link.target] : []))
    setHighlightLinks(new Set(link ? [link] : []))
  }

  const paintRing = useCallback((node, ctx) => {
    ctx.beginPath()
    ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false)
    ctx.fillStyle = systems[node.system]
    ctx.fill()
  }, [])

  const handlePromptSubmit = () => {
    console.log("Yes");
    if (prompt.trim() === '') return

    // Simulate AI processing and generate new nodes and links
    const newNodes = [
      { id: prompt, group: 3, system: 'Action' },
      { id: `Result_${Date.now()}`, group: 3, system: 'Action' }
    ]
    const newLinks = [
      { source: 'Goose', target: prompt, value: 1 },
      { source: prompt, target: `Result_${Date.now()}`, value: 1 }
    ]

    // Update graph data
    setGraphData(prevData => ({
      nodes: [...prevData.nodes, ...newNodes],
      links: [...prevData.links, ...newLinks]
    }))

    // Clear the prompt input
    setPrompt('')
  }

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-100)
      fgRef.current.d3Force('link').distance(50)
    }
  }, [])

  return (
    <div className="relative w-screen h-screen bg-gray-100 rounded-lg shadow-lg overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeRelSize={6}
        nodeAutoColorBy="system"
        linkWidth={link => highlightLinks.has(link) ? 2 : 1}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={link => highlightLinks.has(link) ? 2 : 0}
        nodeCanvasObject={paintRing}
        onNodeHover={handleNodeHover}
        onLinkHover={handleLinkHover}
        nodeLabel={node => `${node.id} (${node.system})`}
        linkLabel={link => `${link.source.id} > ${link.target.id}`}
        cooldownTicks={100}
        onEngineStop={() => fgRef.current.zoomToFit(400)}
      />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 bg-white p-4 rounded-lg shadow-md">
        <Input
          type="text"
          placeholder="Enter a prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mb-2"
          aria-label="Enter a prompt"
        />
        <button onClick={handlePromptSubmit} className="w-full">
          Submit
        </button>
      </div>
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded-lg shadow-md">
        <div className="flex flex-wrap justify-center">
          {Object.entries(systems).map(([system, color]) => (
            <div key={system} className="flex items-center mr-4 mb-2">
              <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color }}></div>
              <span className="text-sm">{system}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}