import React, { useEffect, useRef, useState } from 'react';

interface ThemeTransitionOrbProps {
  targetIsDark: boolean;
  onMidpoint: () => void;
  onComplete: () => void;
}

type Phase = 'idle' | 'rising' | 'expanding' | 'fading';

export const ThemeTransitionOrb: React.FC<ThemeTransitionOrbProps> = ({
  targetIsDark,
  onMidpoint,
  onComplete,
}) => {
  const [phase, setPhase] = useState<Phase>('idle');

  const onMidpointRef = useRef(onMidpoint);
  const onCompleteRef = useRef(onComplete);
  onMidpointRef.current = onMidpoint;
  onCompleteRef.current = onComplete;

  // لون الدائرة يطابق خلفية الثيم المستهدف بدقة (أبيض ناصع أو كحلي عميق)
  const orbColor = targetIsDark ? '#0b101b' : '#ffffff';

  // حجم الدائرة المتوسط عند الوصول للمنتصف
  const [size, setSize] = useState<number>(130);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLaptopOrDesktop = window.innerWidth >= 768;
      setSize(isLaptopOrDesktop ? 150 : 120);
    }

    // 1. بدء صعود الدائرة من الأسفل للمنتصف فوراً
    const tRise = setTimeout(() => {
      setPhase('rising');
    }, 20);

    // 2. عند وصول الدائرة إلى منتصف الشاشة (280ms): تبدأ بالتوسع لملء الشاشة بلونها
    const tExpand = setTimeout(() => {
      setPhase('expanding');
    }, 280);

    // 3. تطبيق الثيم أثناء ملء اللون للشاشة (380ms)
    const tMidpoint = setTimeout(() => {
      onMidpointRef.current();
    }, 380);

    // 4. تلاشي الغطاء بنعومة بعد التوسع (550ms)
    const tFade = setTimeout(() => {
      setPhase('fading');
    }, 550);

    // 5. الانتهاء الكامل (720ms)
    const tComplete = setTimeout(() => {
      onCompleteRef.current();
    }, 720);

    return () => {
      clearTimeout(tRise);
      clearTimeout(tExpand);
      clearTimeout(tMidpoint);
      clearTimeout(tFade);
      clearTimeout(tComplete);
    };
  }, []);

  let transform = 'translate3d(-50%, -50%, 0) translateY(70vh) scale(0.7)';
  let transition = 'none';

  if (phase === 'rising') {
    transform = 'translate3d(-50%, -50%, 0) translateY(0) scale(1)';
    transition = 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)';
  } else if (phase === 'expanding' || phase === 'fading') {
    transform = 'translate3d(-50%, -50%, 0) translateY(0) scale(45)';
    transition = 'transform 320ms cubic-bezier(0.2, 1, 0.3, 1)';
  }

  const isExpandingOrFading = phase === 'expanding' || phase === 'fading';

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{
        zIndex: 99999,
        opacity: phase === 'fading' ? 0 : 1,
        transition: phase === 'fading' ? 'opacity 180ms ease-out' : 'none',
      }}
      aria-hidden="true"
    >
      {/* دائرة اللون الصاعدة من الأسفل والمتمددة لملء الشاشة بدون أي علامة شمس أو قمر */}
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: orbColor,
          transform,
          transition,
          willChange: 'transform',
          boxShadow: isExpandingOrFading
            ? 'none'
            : targetIsDark
            ? '0 10px 45px rgba(0, 0, 0, 0.7), 0 0 25px rgba(245, 158, 11, 0.25)'
            : '0 10px 45px rgba(0, 0, 0, 0.12), 0 0 25px rgba(245, 158, 11, 0.35)',
        }}
      />
    </div>
  );
};
