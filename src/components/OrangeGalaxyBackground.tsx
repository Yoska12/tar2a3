import React, { useMemo } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacityDark: number;
  opacityLight: number;
  colorDark: string;
  colorLight: string;
  speed: 'fast' | 'medium' | 'slow';
  delay: number;
}

export const OrangeGalaxyBackground: React.FC = () => {
  // ألوان النجوم في الوضع الليلي (نارية وبرتقالية وذهبية)
  const colorsDark = [
    '#ffffff',
    '#fef3c7',
    '#fde68a',
    '#f59e0b',
    '#fb923c',
    '#ea580c',
    '#fed7aa',
  ];

  // ألوان النجوم في الوضع النهاري (سماوي، بيبي بلو، أزور، وذهبي مشمس)
  const colorsLight = [
    '#0284c7',
    '#0ea5e9',
    '#38bdf8',
    '#60a5fa',
    '#818cf8',
    '#06b6d4',
    '#f59e0b',
  ];

  const speeds: ('fast' | 'medium' | 'slow')[] = ['fast', 'medium', 'slow'];

  // 1. نجوم سطح المكتب والشاشات الكبيرة (55 نجمة خفيفة وساحرة)
  const desktopStars = useMemo<Star[]>(() => {
    const list: Star[] = [];
    for (let i = 0; i < 55; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const x = (seed / 233280) * 100;
      const y = (((seed * 11) % 233280) / 233280) * 100;
      const size = 1.0 + (i % 4) * 0.45;
      const opacityDark = 0.35 + (i % 5) * 0.12;
      const opacityLight = 0.45 + (i % 5) * 0.10;
      const colorDark = colorsDark[i % colorsDark.length];
      const colorLight = colorsLight[i % colorsLight.length];
      const speed = speeds[i % speeds.length];
      const delay = (i * 0.22) % 5.0;

      list.push({ id: i, x, y, size, opacityDark, opacityLight, colorDark, colorLight, speed, delay });
    }
    return list;
  }, []);

  // 2. نجوم الهواتف الذكية (20 نجمة فائقة الخفة وبدون أي ضغط على المعالج الرسومي)
  const mobileStars = useMemo<Star[]>(() => {
    const list: Star[] = [];
    for (let i = 0; i < 20; i++) {
      const seed = (i * 12345 + 67891) % 233280;
      const x = (seed / 233280) * 100;
      const y = (((seed * 7) % 233280) / 233280) * 100;
      const size = 1.2 + (i % 3) * 0.4;
      const opacityDark = 0.4 + (i % 3) * 0.15;
      const opacityLight = 0.45 + (i % 3) * 0.12;
      const colorDark = colorsDark[i % colorsDark.length];
      const colorLight = colorsLight[i % colorsLight.length];
      const speed = 'slow';
      const delay = (i * 0.35) % 4.0;

      list.push({ id: i, x, y, size, opacityDark, opacityLight, colorDark, colorLight, speed, delay });
    }
    return list;
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
      style={{ willChange: 'transform', transform: 'translate3d(0,0,0)' }}
    >
      {/* 1. عمق الفضاء الأساسي لجميع الشاشات */}
      <div className="absolute inset-0 bg-[#f0f7ff] dark:bg-[#030509] transition-colors duration-500" />

      {/* ========================================================================= */}
      {/* أولاً: وضع الموبايل الخفيف والسريع 60 FPS (Mobile Optimized Cosmos) */}
      {/* تدرجات نقية مدمجة دون فلاتر ثقيلة لمنع تعليق شاشات الهواتف */}
      {/* ========================================================================= */}
      <div className="block md:hidden absolute inset-0">
        {/* أ) في الوضع النهاري (Light Mode) على الموبايل */}
        <div
          className="block dark:hidden absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 12%, rgba(186, 230, 253, 0.75) 0%, rgba(125, 211, 252, 0.4) 35%, rgba(56, 189, 248, 0.15) 65%, transparent 85%), radial-gradient(circle at 85% 45%, rgba(125, 211, 252, 0.25) 0%, transparent 55%), radial-gradient(circle at 15% 75%, rgba(186, 230, 253, 0.3) 0%, transparent 60%)',
          }}
        />

        {/* ب) في الوضع الليلي (Dark Mode) على الموبايل */}
        <div
          className="hidden dark:block absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 12%, rgba(245, 158, 11, 0.32) 0%, rgba(234, 88, 12, 0.18) 35%, rgba(180, 83, 9, 0.08) 65%, transparent 85%), radial-gradient(circle at 85% 45%, rgba(249, 115, 22, 0.16) 0%, transparent 55%), radial-gradient(circle at 15% 75%, rgba(251, 146, 60, 0.14) 0%, transparent 60%)',
          }}
        />

        {/* نجوم الموبايل (خفيفة جداً وثابتة لضمان سلاسة التمرير 100%) */}
        {mobileStars.map((star) => (
          <div
            key={`m-star-${star.id}`}
            className="absolute rounded-full"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: 'currentColor',
            }}
          >
            <span
              className="block w-full h-full rounded-full bg-sky-500/60 dark:bg-amber-400/70"
            />
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* ثانياً: وضع سطح المكتب والأجهزة الكبيرة (Desktop Full Cinematic Galaxy) */}
      {/* ========================================================================= */}
      <div className="hidden md:block absolute inset-0">
        {/* 1. الفضاء النهاري المكتبي */}
        <div className="block dark:hidden absolute inset-0">
          {/* قلب المجرة الدوار */}
          <div
            className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] rounded-full opacity-60 animate-galaxy-spin-slow pointer-events-none"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.16) 60deg, transparent 130deg, rgba(125, 211, 252, 0.22) 190deg, rgba(251, 191, 36, 0.10) 260deg, transparent 330deg, rgba(56, 189, 248, 0.25))',
              filter: 'blur(75px)',
              transform: 'translate3d(-50%, 0, 0)',
            }}
          />

          {/* سديم الهيرو النهاري */}
          <div
            className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[1050px] h-[700px] rounded-full opacity-75 blur-[80px]"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(186, 230, 253, 0.60) 0%, rgba(125, 211, 252, 0.30) 40%, rgba(56, 189, 248, 0.10) 70%, transparent 88%)',
            }}
          />

          {/* سديم جانبي يمين */}
          <div
            className="absolute -top-[10%] right-[5%] w-[700px] h-[500px] rounded-full opacity-65 blur-[85px]"
            style={{
              background:
                'radial-gradient(circle at center, rgba(56, 189, 248, 0.24) 0%, rgba(186, 230, 253, 0.15) 45%, transparent 75%)',
            }}
          />

          {/* سديم جانبي يسار */}
          <div
            className="absolute -top-[10%] left-[5%] w-[700px] h-[500px] rounded-full opacity-60 blur-[85px]"
            style={{
              background:
                'radial-gradient(circle at center, rgba(125, 211, 252, 0.22) 0%, rgba(251, 191, 36, 0.10) 48%, transparent 75%)',
            }}
          />

          {/* شهب نهارية */}
          <div className="absolute top-[12%] right-[15%] pointer-events-none animate-shooting-star-1">
            <div
              className="w-40 h-[2px] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(56, 189, 248, 0) 0%, rgba(14, 165, 233, 0.8) 45%, #ffffff 100%)',
                boxShadow: '0 0 10px 2px rgba(56, 189, 248, 0.75)',
              }}
            />
          </div>

          <div className="absolute top-[38%] right-[25%] pointer-events-none animate-shooting-star-2">
            <div
              className="w-48 h-[2px] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(125, 211, 252, 0) 0%, rgba(56, 189, 248, 0.8) 50%, #ffffff 100%)',
                boxShadow: '0 0 12px 2px rgba(56, 189, 248, 0.8)',
              }}
            />
          </div>

          {/* نجوم النهار لسطح المكتب */}
          {desktopStars.map((star) => {
            const animClass =
              star.speed === 'fast'
                ? 'animate-galaxy-twinkle-fast'
                : star.speed === 'medium'
                ? 'animate-galaxy-twinkle-medium'
                : 'animate-galaxy-twinkle-slow';

            return (
              <div
                key={`d-light-${star.id}`}
                className={`absolute rounded-full ${animClass}`}
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  backgroundColor: star.colorLight,
                  opacity: star.opacityLight,
                  animationDelay: `${star.delay}s`,
                }}
              />
            );
          })}
        </div>

        {/* 2. الفضاء الليلي المكتبي (Obsidian Galaxy) */}
        <div className="hidden dark:block absolute inset-0">
          {/* قلب المجرة الدوار ببطء */}
          <div
            className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] rounded-full opacity-55 animate-galaxy-spin-slow pointer-events-none"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(245, 158, 11, 0.32), rgba(234, 88, 12, 0.20) 60deg, transparent 130deg, rgba(251, 146, 60, 0.26) 190deg, rgba(217, 119, 6, 0.12) 260deg, transparent 330deg, rgba(245, 158, 11, 0.32))',
              filter: 'blur(75px)',
              transform: 'translate3d(-50%, 0, 0)',
            }}
          />

          {/* السديم البرتقالي الناري المركزي */}
          <div
            className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[1000px] h-[650px] rounded-full opacity-80 blur-[80px]"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.34) 0%, rgba(234, 88, 12, 0.20) 40%, rgba(180, 83, 9, 0.06) 70%, transparent 88%)',
            }}
          />

          {/* سديم يمين */}
          <div
            className="absolute -top-[10%] right-[5%] w-[700px] h-[500px] rounded-full opacity-70 blur-[85px]"
            style={{
              background:
                'radial-gradient(circle at center, rgba(249, 115, 22, 0.28) 0%, rgba(245, 158, 11, 0.15) 45%, transparent 75%)',
            }}
          />

          {/* سديم يسار */}
          <div
            className="absolute -top-[10%] left-[5%] w-[700px] h-[500px] rounded-full opacity-65 blur-[85px]"
            style={{
              background:
                'radial-gradient(circle at center, rgba(251, 146, 60, 0.24) 0%, rgba(217, 119, 6, 0.10) 48%, transparent 75%)',
            }}
          />

          {/* نيازك برتقالية لسطح المكتب */}
          <div className="absolute top-[12%] right-[15%] pointer-events-none animate-shooting-star-1">
            <div
              className="w-40 h-[2px] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(245, 158, 11, 0) 0%, rgba(249, 115, 22, 0.8) 45%, #ffffff 100%)',
                boxShadow: '0 0 10px 2px rgba(245, 158, 11, 0.85)',
              }}
            />
          </div>

          <div className="absolute top-[38%] right-[25%] pointer-events-none animate-shooting-star-2">
            <div
              className="w-48 h-[2px] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(251, 146, 60, 0) 0%, rgba(245, 158, 11, 0.8) 50%, #fffbeb 100%)',
                boxShadow: '0 0 12px 2px rgba(251, 146, 60, 0.9)',
              }}
            />
          </div>

          {/* نجوم الليل لسطح المكتب */}
          {desktopStars.map((star) => {
            const animClass =
              star.speed === 'fast'
                ? 'animate-galaxy-twinkle-fast'
                : star.speed === 'medium'
                ? 'animate-galaxy-twinkle-medium'
                : 'animate-galaxy-twinkle-slow';

            return (
              <div
                key={`d-dark-${star.id}`}
                className={`absolute rounded-full ${animClass}`}
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  backgroundColor: star.colorDark,
                  opacity: star.opacityDark,
                  animationDelay: `${star.delay}s`,
                }}
              />
            );
          })}

          {/* سوبرنوفا براقة رقيقة لسطح المكتب */}
          <div
            className="absolute top-[14%] left-[20%] w-2 h-2 rounded-full bg-amber-100 animate-galaxy-twinkle-fast"
            style={{
              boxShadow: '0 0 12px 2px rgba(245, 158, 11, 0.85)',
            }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-[1px] bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-6 bg-gradient-to-b from-transparent via-amber-300 to-transparent" />
          </div>

          <div
            className="absolute top-[28%] right-[16%] w-2 h-2 rounded-full bg-orange-100 animate-galaxy-twinkle-medium"
            style={{
              animationDelay: '1.2s',
              boxShadow: '0 0 14px 2px rgba(251, 146, 60, 0.85)',
            }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-[1px] bg-gradient-to-r from-transparent via-orange-300 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-7 bg-gradient-to-b from-transparent via-orange-300 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
};
