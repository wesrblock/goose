import React from 'react';
import GooseSplashLogo from './GooseSplashLogo';
import SplashPills from './SplashPills';
import Spacer from './ui/spacer';

export default function Splash({ append }) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="flex flex-1" />
      <div className="flex items-center">
        <GooseSplashLogo />
        <span className="ask-goose-type ml-[8px]">ask<br />goose</span>
      </div>
      <Spacer className="mt-[10px]"></Spacer>
      <div className="flex flex-1" />
      <div className="flex items-center">
        <SplashPills append={append} />
      </div>
    </div>
  )
}

