import React, { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { getApiUrl } from '../config';

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

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔄 LinkPreview mounting for URL:', url);
    let mounted = true;

    const fetchData = async () => {
      try {
        const apiUrl = getApiUrl('/api/metadata') + `?url=${encodeURIComponent(url)}`;
        console.log('📡 Fetching metadata from API:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
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
      className="flex items-center p-3 mt-2 hover:bg-gray-50 transition-colors cursor-pointer"
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