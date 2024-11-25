import React, { useEffect, useState } from 'react';
import { Card } from './ui/card';

interface Metadata {
  title?: string;
  description?: string;
  favicon?: string;
  image?: string;
  url: string;
}

interface LinkPreviewProps {
  url: string;
}

async function fetchMetadata(url: string): Promise<Metadata> {
  console.log('🔄 Fetching metadata for URL:', url);
  
  try {
    // Fetch the HTML content using the main process
    const html = await window.electron.fetchMetadata(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const baseUrl = new URL(url);

    // Extract title
    const title = 
      doc.querySelector('title')?.textContent ||
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content');

    // Extract description
    const description = 
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content');

    // Extract favicon
    const faviconLink = 
      doc.querySelector('link[rel="icon"]') ||
      doc.querySelector('link[rel="shortcut icon"]') ||
      doc.querySelector('link[rel="apple-touch-icon"]') ||
      doc.querySelector('link[rel="apple-touch-icon-precomposed"]');
    
    let favicon = faviconLink?.getAttribute('href');
    if (favicon) {
      favicon = new URL(favicon, baseUrl).toString();
    } else {
      // Fallback to /favicon.ico
      favicon = new URL('/favicon.ico', baseUrl).toString();
    }

    // Extract OpenGraph image
    let image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (image) {
      image = new URL(image, baseUrl).toString();
    }

    console.log('✨ Extracted metadata:', { title, description, favicon, image });

    return {
      title: title || url,
      description,
      favicon,
      image,
      url
    };
  } catch (error) {
    console.error('❌ Error fetching metadata:', error);
    return {
      title: url,
      description: undefined,
      favicon: undefined,
      image: undefined,
      url
    };
  }
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔄 LinkPreview mounting for URL:', url);
    let mounted = true;

    const fetchData = async () => {
      try {
        const data = await fetchMetadata(url);
        if (mounted) {
          console.log('✨ Received metadata:', data);
          setMetadata(data);
        }
      } catch (error) {
        if (mounted) {
          console.error('❌ Failed to fetch metadata:', error);
          setError(error.message || 'Failed to fetch metadata');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [url]);

  if (loading) {
    return null;
  }
  
  if (error) {
    return null;
  }
  
  if (!metadata || !metadata.title) {
    return null;
  }

  return (
    <Card 
      className="max-w-[300px] truncate flex items-center bg-link-preview p-3 transition-colors cursor-pointer"
      onClick={() => {
        console.log('🔗 Opening URL in Chrome:', url);
        window.electron.openInChrome(url);
      }}
    >
      {metadata.favicon && (
        <img 
          src={metadata.favicon} 
          alt="Site favicon" 
          className="w-4 h-4 mr-2"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate">{metadata.title || url}</h4>
        {metadata.description && (
          <p className="text-xs text-gray-500 truncate">{metadata.description}</p>
        )}
      </div>
      {metadata.image && (
        <img 
          src={metadata.image} 
          alt="Preview" 
          className="w-16 h-16 object-cover rounded ml-3"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </Card>
  );
}