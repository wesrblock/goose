import React from 'react';
import { Card } from './ui/card';
import { BoxIcon } from './ui/icons'
import ReactMarkdown from 'react-markdown'

export default function ToolInvocation({ toolInvocation }) {
  return (
    <div key={toolInvocation.toolCallId} className="w-full h-full text-tool space-y-4 transition-all duration-300">
      <ToolCall call={toolInvocation} />
      {toolInvocation.state === 'result' && <ToolResult result={toolInvocation} />}
    </div>
  )
}




interface ToolCallProps {
  call: {
    state: 'call' | 'result'
    toolCallId: string
    toolName: string
    args: Record<string, any>
  }
}

function ToolCall({ call }: ToolCallProps) {
  const argsMarkdownContent = convertArgsToMarkdown(call.args);

  return (
    <Card className="bg-tool-card p-4 mt-2">
      <div className="flex items-center space-x-2">
        <BoxIcon size={14} />
        <span>Tool Called: {call.toolName.substring(call.toolName.lastIndexOf("__") + 2)}</span>
      </div>

      {call.args && (
        <ReactMarkdown className="p4">
          {argsMarkdownContent}
        </ReactMarkdown>
      )}
    </Card>
  )
}




interface ResultItem {
  text?: string
  type: 'text' | 'image'
  mimeType?: string
  data?: string // Base64 encoded image data
}

interface ToolResultProps {
  result: {
    message?: string
    result?: ResultItem[] | string
    state?: string
    toolCallId?: string
    toolName?: string
    args?: any
    input_todo?: any
  }
}

function ToolResult({ result }: ToolResultProps) {
  if (!result || !result.result) return null

  return (    
    <Card className="bg-tool-card mt-2 p-4">
      <div className="rounded-b-md rounded-tr-md p-3">
        <div className="flex items-center space-x-2">
          <BoxIcon size={14} />
          <span>Tool Result: {result.toolName.substring(result.toolName.lastIndexOf("__") + 2)}</span>
        </div>
        {Array.isArray(result.result) ? (
          <div className="mt-2">
            {result.result.map((item: ResultItem, index: number) => (
              <div key={index} className="mb-2">
                {item.type === 'text' && item.text && (
                  <ReactMarkdown
                    className="text-tool-result-green whitespace-pre-wrap">
                    {item.text}
                  </ReactMarkdown>
                )}
                {item.type === 'image' && item.data && item.mimeType && (
                  <img 
                    src={`data:${item.mimeType};base64,${item.data}`}
                    alt="Tool result" 
                    className="max-w-full h-auto rounded-md"
                    onError={(e) => {
                      console.error('Failed to load image: Invalid MIME-type encoded image data');
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <ReactMarkdown
            className="mt-2 text-tool-result-green whitespace-pre-wrap"
            components={{
              code({ node, className, children, ...props }) {
                return (
                  <code className={className} {...props}>
                    {typeof children === 'string' ? children : "Unrenderable tool result - check logs"}
                  </code>
                )
              },
              pre({ children }) {
                return <div className="overflow-x-auto">
                  {typeof children === 'string' ? children : "Unrenderable tool result - check logs"}
                </div>
              },
              p({ children }) {
                return <div>
                  {typeof children === 'string' ? children : "Unrenderable tool result - check logs"}
                </div>
              }
            }}
          >
            {result.result}
          </ReactMarkdown>
        )}
      </div>
    </Card>
  )
}

// Utils

const convertArgsToMarkdown = (args: Record<string, any>): string => {
  const lines: string[] = [];
  
  Object.entries(args).forEach(([key, value]) => {
    // Add the parameter name as a heading
    lines.push(`### ${key}`);
    lines.push('');
    
    // Handle different value types
    if (typeof value === 'string') {
      lines.push('```');
      lines.push(value);
      lines.push('```');
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        lines.push(`${index + 1}. ${JSON.stringify(item)}`);
      });
    } else if (typeof value === 'object' && value !== null) {
      lines.push('```json');
      lines.push(JSON.stringify(value, null, 2));
      lines.push('```');
    } else {
      lines.push('```');
      lines.push(String(value));
      lines.push('```');
    }
    lines.push('');
  });

  return lines.join('\n');
};