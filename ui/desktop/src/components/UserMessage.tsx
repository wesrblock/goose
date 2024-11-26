import React from 'react'
import ReactMarkdown from 'react-markdown'
import LinkPreview from './LinkPreview'
import { extractUrls } from '../utils/urlUtils'

export default function UserMessage({ message }) {
  // Extract URLs which explicitly contain the http:// or https:// protocol
  const urls = extractUrls(message.content, []);

  return (
    <div className="flex justify-end mb-[16px]">
      <div className="flex-col">
        <div className="flex bg-user-bubble dark:bg-user-bubble-dark text-goose-text-light dark:text-goose-text-light-dark rounded-2xl p-4">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {urls.length > 0 && (
          <div className="flex mt-2">
            {urls.map((url, index) => (
              <LinkPreview key={index} url={url} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
