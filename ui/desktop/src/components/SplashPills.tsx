import React from "react"

function SplashPill({ content, append }) {
  return (
    <div
      className="px-16 py-8 text-14 text-center text-splash-buttons-text cursor-pointer bg-splash-buttons rounded-full inline-block"
      onClick={async () => {
        const message = {
          content,
          role: "user",
        };
        await append(message);
      }}
    >
      {content}
    </div>
  )
}

export default function SplashPills({ append }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <SplashPill content="Migrate code to react" append={append} />
      <SplashPill content="Scaffold an API for data retention" append={append} />
      <SplashPill content="Summarize files in my CWD" append={append} />
      <SplashPill content="Find all markdown files" append={append} />
    </div>
  )
}
