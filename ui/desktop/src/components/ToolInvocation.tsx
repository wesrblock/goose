import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import ToolCall from './ToolCall';
import ToolResult from './ToolResult';
import { FileText, Check } from 'lucide-react';

export default function ToolInvocation({ toolInvocation, handleSubmit, handleInputChange }) {
  const isCompleted = toolInvocation.state === 'result';

  return (  
    <div key={toolInvocation.toolCallId} className="space-y-4 transition-all duration-300">
      {/* Always show the tool call */}
      <Card className={`p-4 space-y-2 ${isCompleted ? 'bg-gray-50/80' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileText className="h-4 w-4" />
          <span>Tool Call</span>
          {isCompleted && (
            <span className="flex items-center text-green-600 text-xs">
              <Check className="h-3 w-3 mr-1" />
              Completed
            </span>
          )}
        </div>
        <div className="font-mono text-sm whitespace-pre-wrap">
          <ToolCall call={toolInvocation} />
        </div>
      </Card>

      {/* Show result if available */}
      {isCompleted && (
        <div className="space-y-2 animate-fadeIn">
          <Card className="p-4 bg-white/90 border-green-100">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>Result</span>
            </div>
            <div className="rounded-lg">
              <ToolResult 
                result={toolInvocation}
                onSubmitInput={(input) => {
                  handleInputChange({ target: { value: input } })
                  handleSubmit({ preventDefault: () => {} })
                }}
              />
            </div>
          </Card>
          <Button
            variant="secondary"
            className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            Take flight with this direction
          </Button>
        </div>
      )}
    </div>
  )
}
