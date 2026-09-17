import React, { useMemo } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
  speed: 'fast' | 'medium' | 'slow';
  delay: number;
}

export const OrangeGalaxyBackground: React.FC = () => {
  // توليد نجوم المجرة البرتقالية الثابتة والمتلألئة
  const stars = useMemo<Star[]>(() => {
    const starList: Star[] = [];
    const colors = [
      '#ffffff',
      '#fef3c7', // amber-100
      '#fde68a', // amber-200
      '#f59e0b', // amber-500
      '#fb923c', // orange-400
      '#fed7aa', // orange-200
    ];
    const speeds: ('fast' | 'medium' | 'slow')[] = ['fast', 'medium', 'slow'];

    // 85 نجمة موزعة بعناية عبر الفضاء الكوني
    for (let i = 0; i < 85; i++) {
      // استخدام توليد نمطي ثابت (deterministic) لتجنب اختلاف الريندر
      const seed = (i * 9301 + 49297) % 233280;
      const x = ((seed / 233280) * 100);
      const y = (((seed * 7) % 233280) / 233280 * 100);
      const size = 1 + (i % 4) * 0.45; // 1px to 2.35px
      const opacity = 0.35 + (i % 5) * 0.14; // 0.35 to 0.95
      const color = colors[i % colors.length];
      const speed = speeds[i % speeds.length];
      const delay = (i * 0.17) % 4.5;

      starList.push({ id: i, x, y, size, opacity, color, speed, delay });
    }
    return starList;
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 1. السديم البرتقالي الكوني الرئيسي (Dark Mode Core Galaxy) */}
      <div className="absolute inset-0 bg-[#f8fafc] dark:bg-[#06070c] transition-colors duration-500" />

      {/* سدم ضوئية متداخلة بألوان المجرة البرتقالية والكهرمانية (فقط في الوضع الليلي أو بنعومة فائقة) */}
      <div className="hidden dark:block absolute inset-0">
        {/* السديم العلوي المركزي خلف الهيرو والشعار */}
        <div
          className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[1200px] h-[750px] rounded-full opacity-70 animate-nebula-float blur-[110px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.28) 0%, rgba(234, 88, 12, 0.16) 40%, rgba(180, 83, 9, 0.05) 70%, transparent 85%)',
          }}
        />

        {/* سديم طرفي يمين (برتقالي ناري عميق) */}
        <div
          className="absolute top-[15%] -right-[15%] w-[850px] h-[850px] rounded-full opacity-60 blur-[130px]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(249, 115, 22, 0.22) 0%, rgba(217, 119, 6, 0.10) 45%, transparent 75%)',
          }}
        />

        {/* سديم طرفي يسار (كهرماني دافئ) */}
        <div
          className="absolute top-[40%] -left-[20%] w-[900px] h-[900px] rounded-full opacity-55 blur-[140px]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(245, 158, 11, 0.20) 0%, rgba(234, 88, 12, 0.08) 50%, transparent 80%)',
          }}
        />

        {/* سديم سفلي هادئ في قاع الصفحة */}
        <div
          className="absolute -bottom-[20%] left-1/3 w-[1000px] h-[600px] rounded-full opacity-45 blur-[120px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(251, 146, 60, 0.15) 0%, rgba(217, 119, 6, 0.06) 55%, transparent 80%)',
          }}
        />
      </div>

      {/* سديم هادئ جداً في الوضع النهاري (Light mode ambient warm glow) */}
      <div className="block dark:hidden absolute inset-0 opacity-40">
        <div
          className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full blur-[100px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.06) 50%, transparent 80%)',
          }}
        />
      </div>

      {/* 2. حقل نجوم المجرة المتلألئة (Galaxy Starfield) */}
      <div className="hidden dark:block absolute inset-0">
        {stars.map((star) => {
          const animClass =
            star.speed === 'fast'
              ? 'animate-galaxy-twinkle-fast'
              : star.speed === 'medium'
              ? 'animate-galaxy-twinkle-medium'
              : 'animate-galaxy-twinkle-slow';

          return (
            <div
              key={star.id}
              className={`absolute rounded-full ${animClass}`}
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                backgroundColor: star.color,
                opacity: star.opacity,
                animationDelay: `${star.delay}s`,
                boxShadow:
                  star.size > 1.8
                    ? `0 0 ${star.size * 3}px ${star.color}`
                    : undefined,
              }}
            />
          );
        })}

        {/* نجوم لامعة بارزة بلمعان شعاعي (Hero Galaxy Bright Stars) */}
        <div
          className="absolute top-[18%] left-[22%] w-1.5 h-1.5 rounded-full bg-amber-200 animate-galaxy-twinkle-fast"
          style={{
            boxShadow: '0 0 12px 2px rgba(245, 158, 11, 0.9), 0 0 24px 6px rgba(249, 115, 22, 0.5)',
          }}
        />
        <div
          className="absolute top-[32%] right-[18%] w-1.5 h-1.5 rounded-full bg-orange-100 animate-galaxy-twinkle-medium"
          style={{
            animationDelay: '1.2s',
            boxShadow: '0 0 14px 2px rgba(251, 146, 60, 0.85), 0 0 26px 6px rgba(245, 158, 11, 0.45)',
          }}
        />
        <div
          className="absolute top-[68%] left-[14%] w-1.5 h-1.5 rounded-full bg-amber-100 animate-galaxy-twinkle-slow"
          style={{
            animationDelay: '2.4s',
            boxShadow: '0 0 10px 2px rgba(245, 158, 11, 0.8)',
          }}
        />
        <div
          className="absolute top-[75%] right-[28%] w-1.5 h-1.5 rounded-full bg-amber-300 animate-galaxy-twinkle-fast"
          style={{
            animationDelay: '0.8s',
            boxShadow: '0 0 12px 2px rgba(245, 158, 11, 0.85)',
          }}
        />
      </div>

      {/* 3. غبار كوني ناعم جداً لعمق الفضاء (Cosmic Dust Gradient Grid) */}
      <div
        className="hidden dark:block absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(245, 158, 11, 0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
};
