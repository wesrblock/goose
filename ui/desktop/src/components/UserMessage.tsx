import React from 'react'
import ReactMarkdown from 'react-markdown'
import LinkPreview from './LinkPreview'
import { extractUrls } from '../utils/urlUtils'

export default function UserMessage({ message }) {
  // Extract URLs from current message
  const urls = extractUrls(message.content, []);  // No previous URLs to check against
  console.log('User message URLs:', urls);

  return (
    <div className="flex justify-end mb-[16px]">
      <div className="flex flex-col">
        <div className="bg-user-bubble text-white rounded-2xl p-4">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {urls.length > 0 && (
          <div className="mt-2">
            {urls.map((url, index) => (
              <LinkPreview key={index} url={url} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
