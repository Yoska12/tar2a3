import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeTransitionOrbProps {
  targetIsDark: boolean;
  onMidpoint: () => void;
  onComplete: () => void;
}

type Phase = 'idle' | 'rising' | 'pulsing' | 'fading';

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

  // لون الدائرة يطابق ثيم الوجهة (أبيض ناصع أو كحلي عميق)
  const orbColor = targetIsDark ? '#0b101b' : '#ffffff';

  // حجم الدائرة المتجاوب مع اللابتوب والجوال
  const [size, setSize] = useState<number>(130);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLaptopOrDesktop = window.innerWidth >= 768;
      setSize(isLaptopOrDesktop ? 140 : 115);
    }

    // 1. بدء صعود الدائرة من أسفل الشاشة للأعلى
    const tRise = setTimeout(() => {
      setPhase('rising');
    }, 20);

    // 2. وصول الدائرة إلى منتصف الشاشة والبدء في تغيير لون الموقع من الخلف بنعومة فائقة (400ms)
    const tMidpoint = setTimeout(() => {
      setPhase('pulsing');
      onMidpointRef.current();
    }, 400);

    // 3. تلاشي الدائرة بنعومة في منتصف الشاشة بينما اللون الجديد مستقر في الخلفية (660ms)
    const tFade = setTimeout(() => {
      setPhase('fading');
    }, 660);

    // 4. انتهاء الحركة وإزالة الكومبوننت بالكامل (880ms)
    const tComplete = setTimeout(() => {
      onCompleteRef.current();
    }, 880);

    return () => {
      clearTimeout(tRise);
      clearTimeout(tMidpoint);
      clearTimeout(tFade);
      clearTimeout(tComplete);
    };
  }, []);

  // حساب التحول الفيزيائي للدائرة (صعود -> نبض خفيف في المنتصف -> تلاشي)
  let transform = 'translate3d(-50%, -50%, 0) translateY(75vh) scale(0.85)';
  let transition = 'none';

  if (phase === 'rising') {
    transform = 'translate3d(-50%, -50%, 0) translateY(0) scale(1)';
    transition = 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)';
  } else if (phase === 'pulsing') {
    transform = 'translate3d(-50%, -50%, 0) translateY(0) scale(1.1)';
    transition = 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)';
  } else if (phase === 'fading') {
    transform = 'translate3d(-50%, -50%, 0) translateY(0) scale(1.22)';
    transition = 'transform 220ms ease-out, opacity 220ms ease-out';
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 99999 }}
      aria-hidden="true"
    >
      {/* الدائرة الأصلية الصاعدة من الأسفل حتى منتصف الشاشة دون أي تغطية للشاشة أو إخفاء للعناصر */}
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
          opacity: phase === 'fading' ? 0 : 1,
          willChange: 'transform, opacity',
          boxShadow: targetIsDark
            ? '0 0 55px 8px rgba(245, 158, 11, 0.45), 0 20px 45px -10px rgba(0, 0, 0, 0.8), inset 0 0 25px rgba(245, 158, 11, 0.25)'
            : '0 0 55px 10px rgba(245, 158, 11, 0.45), 0 20px 45px -10px rgba(0, 0, 0, 0.15), inset 0 0 25px rgba(251, 191, 36, 0.3)',
          border: targetIsDark
            ? '2.5px solid rgba(245, 158, 11, 0.65)'
            : '2.5px solid rgba(245, 158, 11, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* الشارة الأصلية (شمس دوارة للنهاري، وقمر مضيء لليلي) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {targetIsDark ? (
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/30 blur-lg" />
              <Moon
                className="w-10 h-10 md:w-12 md:h-12 text-amber-300 drop-shadow-[0_0_15px_rgba(245,158,11,0.85)] fill-amber-300/40 relative z-10"
                strokeWidth={2.2}
              />
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-400/35 blur-lg" />
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
