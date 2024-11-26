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
    <div className="flex bg-goose-bubble text-white rounded-2xl p-4 pb-0 mb-[16px]">
      <div key={toolInvocation.toolCallId} className="w-full h-full flex flex-col text-tool">
        <ToolCall call={toolInvocation} />
        {toolInvocation.state === 'result' && <ToolResult result={toolInvocation} />}
      </div>
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
    <Card className="bg-tool-card dark:bg-tool-card-dark p-4 mb-[16px]">
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
  priority?: number; // Priority value between 0 and 1
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
  // State to track expanded items
  const [expandedItems, setExpandedItems] = React.useState<number[]>([]);

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

  const toggleExpand = (index: number) => {
    setExpandedItems(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const shouldShowExpanded = (item: ResultItem, index: number) => {
    return (item.priority === undefined || item.priority >= 0.5) || expandedItems.includes(index);
  };

  return (
    <Card className="bg-tool-card dark:bg-tool-card-dark p-4 mb-[16px]">
      <div className="flex items-center">
        <BoxIcon size={14} />
        <span className="ml-[8px]">Tool Result: {result.toolName.substring(result.toolName.lastIndexOf("__") + 2)}</span>
      </div>
      <div>
        {filteredResults.map((item: ResultItem, index: number) => {
          const isExpanded = shouldShowExpanded(item, index);
          const shouldMinimize = item.priority !== undefined && item.priority < 0.5;

          return (
            <div key={index} className="relative">
              {shouldMinimize && (
                <button
                  onClick={() => toggleExpand(index)}
                  className="mb-2 p-4 flex items-center"
                >
                  {isExpanded ? '▼ Collapse' : '▶ Expand'} {/* Unicode triangles as expand/collapse indicators */}
                </button>
              )}
              {(isExpanded || !shouldMinimize) && (
                <>
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
                </>
              )}
              {!isExpanded && shouldMinimize && (
                <div className="text-gray-500 italic ml-2">
                  Click to show content
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}




// Utils

const convertArgsToMarkdown = (args: Record<string, any>): string => {
  const lines: string[] = [];
  
  Object.entries(args).forEach(([key, value]) => {
    if (typeof value === 'string') {
      lines.push('```');
      lines.push(`${key}: ${value}`);
      lines.push('```');
    } else if (Array.isArray(value)) {
      lines.push(`### ${key}`);
      lines.push('');
      value.forEach((item, index) => {
        lines.push(`${index + 1}. ${JSON.stringify(item)}`);
      });
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`### ${key}`);
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(value, null, 2));
      lines.push('```');
    } else {
      lines.push(`### ${key}`);
      lines.push('');
      lines.push('```');
      lines.push(String(value));
      lines.push('```');
    }
    lines.push('');
  });

  return lines.join('\n');
};
