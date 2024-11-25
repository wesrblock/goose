import React from 'react'
import LinkPreview from './LinkPreview'
import { extractUrls } from '../utils/urlUtils'

export default function UserMessage({ message, messages }) {
  // Extract URLs from current message
  const urls = extractUrls(message.content, []);  // No previous URLs to check against
  
  console.log('User message URLs:', urls);
  
  return (
    <div className="mb-4">
      <div className="flex flex-col items-end">
        <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-[80%]">
          {message.content}
        </div>
        
        {urls.length > 0 && (
          <div className="mt-2 space-y-2 max-w-[80%]">
            {urls.map((url, index) => (
              <LinkPreview key={index} url={url} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
