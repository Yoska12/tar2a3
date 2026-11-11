import React, { useEffect } from 'react';

const Background = () => {
  useEffect(() => {
    const handleMouseMove = (e) => {
      const cards = document.querySelectorAll('.card, .aurora-card');
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
      <div className="aurora-container" aria-hidden="true">
        <div className="aurora-blob blob-1"></div>
        <div className="aurora-blob blob-2"></div>
        <div className="noise-overlay"></div>
      </div>
    </>
  );
};

export default Background;
