import React from 'react';

export default function Spacer({ className }) {
  return (
    <div className={`${className} w-[198px] h-[17px] py-2 flex-col justify-center items-start inline-flex`}>
      <div className="self-stretch h-px bg-black/5 dark:bg-white/10 rounded-sm" />
    </div>
  )
}
