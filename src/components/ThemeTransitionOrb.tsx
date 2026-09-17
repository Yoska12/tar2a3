import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

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

  // تخزين الـ callbacks في refs لضمان استقرار الاستدعاء
  const onMidpointRef = useRef(onMidpoint);
  const onCompleteRef = useRef(onComplete);
  onMidpointRef.current = onMidpoint;
  onCompleteRef.current = onComplete;

  // لون الدائرة يطابق خلفية الثيم المستهدف بدقة (أبيض ناصع أو كحلي عميق)
  const orbColor = targetIsDark ? '#0b101b' : '#ffffff';

  // حجم الدائرة المتوسط متجاوب بدقة بين اللابتوب والجوال
  const [size, setSize] = useState<number>(130);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLaptopOrDesktop = window.innerWidth >= 768;
      setSize(isLaptopOrDesktop ? 140 : 115);
    }

    // 1. بدء صعود الدائرة من أسفل الشاشة فوراً
    const tRise = setTimeout(() => {
      setPhase('rising');
    }, 20);

    // 2. وصول الدائرة لمنتصف الشاشة وبدء التمدد فوراً لملء الشاشة بلونها (420ms)
    const tExpand = setTimeout(() => {
      setPhase('expanding');
    }, 420);

    // 3. تطبيق الثيم فور تغطية الدائرة للشاشة دون أي وقفة أو انتظار (570ms)
    const tMidpoint = setTimeout(() => {
      onMidpointRef.current();
    }, 570);

    // 4. تلاشي الغطاء بنعومة فور اكتمال التمدد مباشرة لمنع أي شعور بالريفرش أو الجمود (660ms)
    const tFade = setTimeout(() => {
      setPhase('fading');
    }, 660);

    // 5. إنهاء الأنيميشن بالكامل وإزالة الدائرة من الشاشة (880ms)
    const tComplete = setTimeout(() => {
      onCompleteRef.current();
    }, 880);

    return () => {
      clearTimeout(tRise);
      clearTimeout(tExpand);
      clearTimeout(tMidpoint);
      clearTimeout(tFade);
      clearTimeout(tComplete);
    };
  }, []);

  // حساب التحول (Transform) لكل مرحلة عبر الـ GPU بسرعة 60-120fps
  let transform = 'translate3d(-50%, -50%, 0) translateY(75vh) scale(0.85)';
  let transition = 'none';

  if (phase === 'rising') {
    transform = 'translate3d(-50%, -50%, 0) translateY(0) scale(1)';
    transition = 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)';
  } else if (phase === 'expanding' || phase === 'fading') {
    transform = 'translate3d(-50%, -50%, 0) translateY(0) scale(55)';
    transition = 'transform 360ms cubic-bezier(0.2, 1, 0.3, 1)';
  }

  const isExpandingOrFading = phase === 'expanding' || phase === 'fading';

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{
        zIndex: 99999,
        opacity: phase === 'fading' ? 0 : 1,
        transition: phase === 'fading' ? 'opacity 220ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
      }}
      aria-hidden="true"
    >
      {/* الدائرة الرئيسية الصاعدة من الأسفل والمتمددة لملء الشاشة بالألوان */}
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
            ? '0 0 50px 6px rgba(245, 158, 11, 0.35), 0 20px 45px -10px rgba(0, 0, 0, 0.8), inset 0 0 25px rgba(245, 158, 11, 0.2)'
            : '0 0 50px 8px rgba(245, 158, 11, 0.4), 0 20px 45px -10px rgba(0, 0, 0, 0.15), inset 0 0 25px rgba(251, 191, 36, 0.25)',
          border: isExpandingOrFading
            ? 'none'
            : targetIsDark
            ? '2.5px solid rgba(245, 158, 11, 0.55)'
            : '2.5px solid rgba(245, 158, 11, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* الأيقونة والتوهج الداخلي مع حركة دوران للشمس وهالة للقمر */}
        <div
          style={{
            opacity: isExpandingOrFading ? 0 : 1,
            transform: `scale(${phase === 'rising' ? 1 : isExpandingOrFading ? 1.3 : 0.85})`,
            transition: 'opacity 180ms ease-out, transform 280ms ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {targetIsDark ? (
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/25 blur-lg" />
              <Moon
                className="w-10 h-10 md:w-12 md:h-12 text-amber-300 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)] fill-amber-300/40 relative z-10"
                strokeWidth={2.2}
              />
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-lg" />
              <Sun
                className="w-10 h-10 md:w-12 md:h-12 text-amber-500 animate-spin-slow drop-shadow-[0_0_18px_rgba(245,158,11,0.9)] relative z-10"
                strokeWidth={2.2}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
