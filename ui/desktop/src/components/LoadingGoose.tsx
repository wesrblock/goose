import React, { useState, useEffect } from 'react';
import svg1 from '../images/loading-goose/1.svg';
import svg2 from '../images/loading-goose/2.svg';
import svg3 from '../images/loading-goose/3.svg';
import svg4 from '../images/loading-goose/4.svg';
import svg5 from '../images/loading-goose/5.svg';
import svg6 from '../images/loading-goose/6.svg';
import svg7 from '../images/loading-goose/7.svg';

const Example = () => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const frames = [svg1, svg2, svg3, svg4, svg5, svg6, svg7];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % frames.length);
    }, 200); // 200ms for smoother animation, adjust as needed

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <img src={frames[currentFrame]} alt={`Animation frame ${currentFrame + 1}`} />
    </div>
  );
};

export default Example;