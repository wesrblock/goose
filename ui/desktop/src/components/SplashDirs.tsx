import React, { useEffect, useState } from "react"

function DirectoryPill({ path, append }) {
  return (
    <div
      className="px-16 py-4 text-14 text-center text-splash-pills-text whitespace-nowrap cursor-pointer bg-splash-pills hover:bg-splash-pills/90 hover:scale-[1.02] rounded-lg inline-block transition-all duration-150 truncate max-w-full"
      onClick={async () => {
        const message = {
          content: `cd ${path}`,
          role: "user",
        };
        await append(message);
      }}
      title={path}
    >
      {path}
    </div>
  )
}

export default function SplashDirs({ append }) {
  const [recentDirs, setRecentDirs] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const maxDisplayedDirs = 3;

  useEffect(() => {
    const loadRecentDirs = async () => {
      try {
        const dirs = await window.electron.listRecent();
        setRecentDirs(dirs);
      } catch (error) {
        console.error('Failed to load recent directories:', error);
      }
    };

    loadRecentDirs();
  }, []);

  if (recentDirs.length === 0) {
    return null;
  }

  const displayedDirs = isExpanded ? recentDirs : recentDirs.slice(0, maxDisplayedDirs);
  const hasMore = recentDirs.length > maxDisplayedDirs;

  return (
    <div className="flex flex-col gap-2 mb-[8px] w-full max-w-[600px]">
      <div className="flex justify-between items-center px-2">
        <div className="text-14 text-splash-pills-text opacity-50">
          Recent Directories ({recentDirs.length})
        </div>
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-14 text-splash-pills-text opacity-50 hover:opacity-100 transition-opacity"
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
      <div 
        className={`grid grid-cols-1 gap-2 overflow-y-auto transition-all duration-300 ${
          isExpanded ? 'max-h-[300px]' : 'max-h-[156px]'
        }`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent'
        }}
      >
        {displayedDirs.map((dir, index) => (
          <DirectoryPill key={index} path={dir} append={append} />
        ))}
      </div>
    </div>
  )
}