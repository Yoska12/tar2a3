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
  // توليد نجوم المجرة الكونية المتنوعة
  const stars = useMemo<Star[]>(() => {
    const starList: Star[] = [];
    const colors = [
      '#ffffff', // أبيض ساطع
      '#fef3c7', // amber-100
      '#fde68a', // amber-200
      '#f59e0b', // amber-500
      '#fb923c', // orange-400
      '#ea580c', // orange-600
      '#fed7aa', // orange-200
      '#fef08a', // yellow-200
    ];
    const speeds: ('fast' | 'medium' | 'slow')[] = ['fast', 'medium', 'slow'];

    // 135 نجمة متلألئة في أرجاء المجرة
    for (let i = 0; i < 135; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const x = ((seed / 233280) * 100);
      const y = (((seed * 11) % 233280) / 233280 * 100);
      const size = 0.9 + (i % 5) * 0.42; // 0.9px to 2.6px
      const opacity = 0.35 + (i % 6) * 0.12; // 0.35 to 0.95
      const color = colors[i % colors.length];
      const speed = speeds[i % speeds.length];
      const delay = (i * 0.19) % 5.5;

      starList.push({ id: i, x, y, size, opacity, color, speed, delay });
    }
    return starList;
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 1. عمق الفضاء الكوني الأسود المطعم بزرقة الفضاء العميق (Obsidian Cosmic Void) */}
      <div className="absolute inset-0 bg-[#f8fafc] dark:bg-[#030509] transition-colors duration-500" />

      {/* ========================================================================= */}
      {/* 2. مجرة طرقع الكونية البرتقالية العملاقة (The Giant Orange Galaxy) */}
      {/* ========================================================================= */}
      <div className="hidden dark:block absolute inset-0">
        
        {/* أ) قلب المجرة الدوار ببطء (Rotating Galactic Spiral Core) */}
        <div
          className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[1400px] h-[1400px] rounded-full opacity-60 animate-galaxy-spin-slow pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(245, 158, 11, 0.35), rgba(234, 88, 12, 0.22) 60deg, transparent 130deg, rgba(251, 146, 60, 0.30) 190deg, rgba(217, 119, 6, 0.15) 260deg, transparent 330deg, rgba(245, 158, 11, 0.35))',
            filter: 'blur(95px)',
          }}
        />

        {/* ب) السديم البرتقالي الناري المركزي خلف الهيرو والبار العلوي */}
        <div
          className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[1100px] h-[750px] rounded-full opacity-85 animate-nebula-float blur-[105px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.38) 0%, rgba(234, 88, 12, 0.24) 40%, rgba(180, 83, 9, 0.08) 70%, transparent 88%)',
          }}
        />

        {/* ج) سديم علوي يمين يشع تحت البار العلوي (Upper Right Cosmic Flare) */}
        <div
          className="absolute -top-[10%] right-[5%] w-[850px] h-[650px] rounded-full opacity-75 blur-[115px]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(249, 115, 22, 0.32) 0%, rgba(245, 158, 11, 0.18) 45%, transparent 75%)',
          }}
        />

        {/* د) سديم علوي يسار يشع خلف الشعار والنافبار (Upper Left Cosmic Flare) */}
        <div
          className="absolute -top-[10%] left-[5%] w-[800px] h-[650px] rounded-full opacity-70 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(251, 146, 60, 0.28) 0%, rgba(217, 119, 6, 0.12) 48%, transparent 75%)',
          }}
        />

        {/* هـ) سديم منتصف الشاشة (Mid-Space Amber Dust) */}
        <div
          className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[1250px] h-[700px] rounded-full opacity-65 blur-[125px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.24) 0%, rgba(234, 88, 12, 0.12) 50%, transparent 80%)',
          }}
        />

        {/* و) سديم أسفل الشاشة في العمق (Deep Cosmic Glow) */}
        <div
          className="absolute -bottom-[20%] left-1/4 w-[1100px] h-[750px] rounded-full opacity-55 blur-[130px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(249, 115, 22, 0.26) 0%, rgba(180, 83, 9, 0.08) 55%, transparent 80%)',
          }}
        />

        {/* ========================================================================= */}
        {/* 3. شهب ونيازك برتقالية مضيئة ومتحركة (Animated Orange Meteors) */}
        {/* ========================================================================= */}
        {/* شهاب 1: أعلى اليمين يعبر فوق الهيرو */}
        <div className="absolute top-[12%] right-[15%] pointer-events-none animate-shooting-star-1">
          <div
            className="w-48 h-[2px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(245, 158, 11, 0) 0%, rgba(249, 115, 22, 0.8) 45%, #ffffff 100%)',
              boxShadow: '0 0 12px 2px rgba(245, 158, 11, 0.9), 0 0 20px 4px rgba(249, 115, 22, 0.6)',
            }}
          />
        </div>

        {/* شهاب 2: يعبر في المنتصف باتجاه اليسار */}
        <div className="absolute top-[38%] right-[25%] pointer-events-none animate-shooting-star-2">
          <div
            className="w-56 h-[2.5px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(251, 146, 60, 0) 0%, rgba(245, 158, 11, 0.85) 50%, #fffbeb 100%)',
              boxShadow: '0 0 14px 2px rgba(251, 146, 60, 0.95), 0 0 22px 5px rgba(245, 158, 11, 0.5)',
            }}
          />
        </div>

        {/* شهاب 3: أعلى اليسار خلف البار العلوي */}
        <div className="absolute top-[6%] left-[45%] pointer-events-none animate-shooting-star-3">
          <div
            className="w-40 h-[1.8px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(245, 158, 11, 0) 0%, rgba(234, 88, 12, 0.75) 45%, #ffffff 100%)',
              boxShadow: '0 0 10px 2px rgba(245, 158, 11, 0.85)',
            }}
          />
        </div>

        {/* ========================================================================= */}
        {/* 4. حقل نجوم المجرة (Galaxy Starfield) */}
        {/* ========================================================================= */}
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
                  star.size > 1.6
                    ? `0 0 ${star.size * 3.5}px ${star.color}`
                    : undefined,
              }}
            />
          );
        })}

        {/* نجوم سوبرنوفا برتقالية فائقة التوهج بصلبان ضوئية سينمائية */}
        <div
          className="absolute top-[14%] left-[20%] w-2 h-2 rounded-full bg-amber-100 animate-galaxy-twinkle-fast"
          style={{
            boxShadow:
              '0 0 16px 3px rgba(245, 158, 11, 0.95), 0 0 35px 8px rgba(249, 115, 22, 0.65), 0 0 50px 15px rgba(234, 88, 12, 0.35)',
          }}
        >
          {/* شعاع ضوئي أفقي وعمودي */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-[1px] bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-8 bg-gradient-to-b from-transparent via-amber-300 to-transparent" />
        </div>

        <div
          className="absolute top-[28%] right-[16%] w-2 h-2 rounded-full bg-orange-100 animate-galaxy-twinkle-medium"
          style={{
            animationDelay: '1.2s',
            boxShadow:
              '0 0 18px 3px rgba(251, 146, 60, 0.95), 0 0 40px 10px rgba(245, 158, 11, 0.6)',
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-[1px] bg-gradient-to-r from-transparent via-orange-300 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-9 bg-gradient-to-b from-transparent via-orange-300 to-transparent" />
        </div>

        <div
          className="absolute top-[70%] left-[12%] w-2 h-2 rounded-full bg-amber-200 animate-galaxy-twinkle-slow"
          style={{
            animationDelay: '2.5s',
            boxShadow: '0 0 14px 3px rgba(245, 158, 11, 0.9)',
          }}
        />

        <div
          className="absolute top-[82%] right-[24%] w-2 h-2 rounded-full bg-amber-300 animate-galaxy-twinkle-fast"
          style={{
            animationDelay: '0.7s',
            boxShadow: '0 0 15px 3px rgba(245, 158, 11, 0.9)',
          }}
        />
      </div>

      {/* هالة دافئة لطيفة في الوضع النهاري */}
      <div className="block dark:hidden absolute inset-0 opacity-45">
        <div
          className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[1100px] h-[650px] rounded-full blur-[110px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.20) 0%, rgba(245, 158, 11, 0.08) 50%, transparent 80%)',
          }}
        />
      </div>

      {/* 5. شبكة غبار كوني خفيفة للمجرة (Stardust Depth Pattern) */}
      <div
        className="hidden dark:block absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(245, 158, 11, 0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
};
