import React from 'react';
import { Card } from './ui/card';
import { BoxIcon } from './ui/icons'
import ReactMarkdown from 'react-markdown'


export default function ToolInvocations({ toolInvocations }) {
  return (
    <div className="flex flex-col">
      {toolInvocations.map((toolInvocation) => (
        <ToolInvocation
          key={toolInvocation.toolCallId}
          toolInvocation={toolInvocation}
        />
      ))}
    </div>
  )
}




function ToolInvocation({ toolInvocation }) {
  return (
    <div key={toolInvocation.toolCallId} className="w-full h-full flex flex-col text-tool">
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
    <Card className="bg-tool-card p-4 mb-[16px]">
      <div className="flex items-center">
        <BoxIcon size={14} />
        <span className="ml-[8px]">Tool Called: {call.toolName.substring(call.toolName.lastIndexOf("__") + 2)}</span>
      </div>

      {call.args && (
        <ReactMarkdown className="p-2">
          {argsMarkdownContent}
        </ReactMarkdown>
      )}
    </Card>
  )
}




interface ResultItem {
  text?: string;
  type: 'text' | 'image';
  mimeType?: string;
  data?: string; // Base64 encoded image data
  audience?: string[]; // Array of audience types
}

interface ToolResultProps {
  result: {
    message?: string
    result?: ResultItem[]
    state?: string
    toolCallId?: string
    toolName?: string
    args?: any
    input_todo?: any
  }
}

function ToolResult({ result }: ToolResultProps) {
  // If no result info, don't show anything
  if (!result || !result.result) return null;

  // Normalize to an array
  const results = Array.isArray(result.result)
    ? result.result
    : [result.result];

  // Find results where either audience is not set, or it's set to a list that contains user
  const filteredResults = results
    .filter((item: ResultItem) => !item.audience || item.audience?.includes('user'))

  if (filteredResults.length === 0) return null;

  return (
    <Card className="bg-tool-card p-4 mb-[16px]">
      <div className="flex items-center">
        <BoxIcon size={14} />
        <span className="ml-[8px]">Tool Result: {result.toolName.substring(result.toolName.lastIndexOf("__") + 2)}</span>
      </div>
      <div>
        {filteredResults.map((item: ResultItem, index: number) => (
          <div key={index}>
            {item.type === 'text' && item.text && (
              <ReactMarkdown className="text-tool-result-green whitespace-pre-wrap p-2">
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
    </Card>
  );
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