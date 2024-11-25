// Helper to normalize URLs for comparison
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.toLowerCase());
    // Remove trailing slashes and normalize protocol
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}${parsed.search}${parsed.hash}`;
  } catch {
    // If URL parsing fails, just lowercase it
    return url.toLowerCase();
  }
}

export function extractUrls(content: string, previousUrls: string[] = []): string[] {
  // Modified regex to only match markdown links with http:// or https://
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const markdownMatches = Array.from(content.matchAll(markdownLinkRegex));
  const markdownUrls = markdownMatches.map(match => match[2]);

  // Modified regex for standalone URLs with http:// or https://
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const urlMatches = Array.from(content.matchAll(urlRegex));
  const standardUrls = urlMatches.map(match => match[1]);

  // Combine markdown URLs with standard URLs
  const currentUrls = [...new Set([...markdownUrls, ...standardUrls])];
  
  // Normalize all URLs for comparison
  const normalizedPreviousUrls = previousUrls.map(normalizeUrl);
  const normalizedCurrentUrls = currentUrls.map(url => {
    const normalized = normalizeUrl(url);
    console.log('Normalizing URL:', { original: url, normalized });
    return normalized;
  });
  
  // Filter out duplicates
  const uniqueUrls = currentUrls.filter((url, index) => {
    const normalized = normalizedCurrentUrls[index];
    const isDuplicate = normalizedPreviousUrls.some(prevUrl => 
      normalizeUrl(prevUrl) === normalized
    );
    console.log('URL comparison:', { 
      url, 
      normalized,
      previousUrls: normalizedPreviousUrls,
      isDuplicate 
    });
    return !isDuplicate;
  });
  
  console.log('Content:', content);
  console.log('Found URLs:', uniqueUrls);
  console.log('Previous URLs:', previousUrls);
  
  return uniqueUrls;
}