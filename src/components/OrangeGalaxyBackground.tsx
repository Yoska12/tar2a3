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
  // توليد نجوم المجرة الكونية المتنوعة للوضعين الليلي والنهاري
  const stars = useMemo<Star[]>(() => {
    const starList: Star[] = [];
    
    // ألوان النجوم في الوضع الليلي (نارية وبرتقالية وذهبية)
    const colorsDark = [
      '#ffffff', // أبيض ساطع
      '#fef3c7', // amber-100
      '#fde68a', // amber-200
      '#f59e0b', // amber-500
      '#fb923c', // orange-400
      '#ea580c', // orange-600
      '#fed7aa', // orange-200
      '#fef08a', // yellow-200
    ];

    // ألوان النجوم في الوضع النهاري (سماوي، بيبي بلو، أزور، وشذرات ذهبية مشمسة)
    const colorsLight = [
      '#0284c7', // sky-600 (deep baby blue)
      '#0ea5e9', // sky-500 (radiant celestial blue)
      '#38bdf8', // sky-400 (light baby blue)
      '#60a5fa', // blue-400 (soft azure)
      '#818cf8', // indigo-400 (celestial violet-blue)
      '#06b6d4', // cyan-500 (crystal cyan)
      '#f59e0b', // amber-500 (golden solar sparkle)
      '#2563eb', // blue-600 (sapphire)
    ];

    const speeds: ('fast' | 'medium' | 'slow')[] = ['fast', 'medium', 'slow'];

    // 135 نجمة متلألئة في أرجاء المجرة
    for (let i = 0; i < 135; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const x = ((seed / 233280) * 100);
      const y = (((seed * 11) % 233280) / 233280 * 100);
      const size = 0.9 + (i % 5) * 0.42; // 0.9px to 2.6px
      const opacityDark = 0.35 + (i % 6) * 0.12; // 0.35 to 0.95
      const opacityLight = 0.45 + (i % 6) * 0.10; // 0.45 to 0.95 (وضوح ونعومة على خلفية النهار)
      const colorDark = colorsDark[i % colorsDark.length];
      const colorLight = colorsLight[i % colorsLight.length];
      const speed = speeds[i % speeds.length];
      const delay = (i * 0.19) % 5.5;

      starList.push({ id: i, x, y, size, opacityDark, opacityLight, colorDark, colorLight, speed, delay });
    }
    return starList;
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 1. عمق الفضاء الأساسي (سماء بيبي بلو سماوية نهاراً / فضاء أوبسيديان ليلاً) */}
      <div className="absolute inset-0 bg-[#f0f7ff] dark:bg-[#030509] transition-colors duration-500" />

      {/* ========================================================================= */}
      {/* 2. مجرة الفضاء النهاري: سماء بيبي بلو كونية ناعمة وفائقة الجمال (Light Mode Cosmos) */}
      {/* ========================================================================= */}
      <div className="block dark:hidden absolute inset-0">
        
        {/* أ) قلب المجرة السماوية الدوار بنعومة وهدوء (Daylight Celestial Spiral Core) */}
        <div
          className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[1400px] h-[1400px] rounded-full opacity-70 animate-galaxy-spin-slow pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(56, 189, 248, 0.28), rgba(14, 165, 233, 0.18) 60deg, transparent 130deg, rgba(125, 211, 252, 0.26) 190deg, rgba(251, 191, 36, 0.12) 260deg, transparent 330deg, rgba(56, 189, 248, 0.28))',
            filter: 'blur(95px)',
          }}
        />

        {/* ب) السديم السماوي المركزي خلف الهيرو والبار العلوي (Luminous Baby Blue Nebula) */}
        <div
          className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[1150px] h-[800px] rounded-full opacity-80 animate-nebula-float blur-[105px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(186, 230, 253, 0.65) 0%, rgba(125, 211, 252, 0.35) 40%, rgba(56, 189, 248, 0.12) 70%, transparent 88%)',
          }}
        />

        {/* ج) سديم علوي يمين بلون بيبي بلو وسماء صافية (Upper Right Celestial Flare) */}
        <div
          className="absolute -top-[10%] right-[5%] w-[850px] h-[650px] rounded-full opacity-70 blur-[115px]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(56, 189, 248, 0.28) 0%, rgba(186, 230, 253, 0.18) 45%, transparent 75%)',
          }}
        />

        {/* د) سديم علوي يسار مشمس ناعم خلف الشعار والنافبار (Upper Left Sunlit & Sky Flare) */}
        <div
          className="absolute -top-[10%] left-[5%] w-[800px] h-[650px] rounded-full opacity-65 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(125, 211, 252, 0.25) 0%, rgba(251, 191, 36, 0.12) 48%, transparent 75%)',
          }}
        />

        {/* هـ) سديم منتصف الشاشة بيبي بلو ضبابي هادئ (Mid-Space Baby Blue Glow) */}
        <div
          className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[1250px] h-[700px] rounded-full opacity-60 blur-[125px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(186, 230, 253, 0.45) 0%, rgba(56, 189, 248, 0.14) 50%, transparent 80%)',
          }}
        />

        {/* و) سديم أسفل الشاشة في العمق (Deep Sky Bottom Aurora) */}
        <div
          className="absolute -bottom-[20%] left-1/4 w-[1100px] h-[750px] rounded-full opacity-50 blur-[130px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(125, 211, 252, 0.30) 0%, rgba(186, 230, 253, 0.12) 55%, transparent 80%)',
          }}
        />

        {/* شهب كونية بيبي بلو مشعة متدفقة في النهار */}
        <div className="absolute top-[12%] right-[15%] pointer-events-none animate-shooting-star-1">
          <div
            className="w-48 h-[2px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(56, 189, 248, 0) 0%, rgba(14, 165, 233, 0.8) 45%, #ffffff 100%)',
              boxShadow: '0 0 12px 2px rgba(56, 189, 248, 0.85), 0 0 20px 4px rgba(186, 230, 253, 0.7)',
            }}
          />
        </div>

        <div className="absolute top-[38%] right-[25%] pointer-events-none animate-shooting-star-2">
          <div
            className="w-56 h-[2.5px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(125, 211, 252, 0) 0%, rgba(56, 189, 248, 0.85) 50%, #ffffff 100%)',
              boxShadow: '0 0 14px 2px rgba(56, 189, 248, 0.9), 0 0 22px 5px rgba(14, 165, 233, 0.5)',
            }}
          />
        </div>

        <div className="absolute top-[6%] left-[45%] pointer-events-none animate-shooting-star-3">
          <div
            className="w-40 h-[1.8px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(14, 165, 233, 0) 0%, rgba(2, 132, 199, 0.75) 45%, #ffffff 100%)',
              boxShadow: '0 0 10px 2px rgba(14, 165, 233, 0.85)',
            }}
          />
        </div>

        {/* حقل النجوم النهاري (135 نجمة بيبي بلو وسماوية متلألئة) */}
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
                backgroundColor: star.colorLight,
                opacity: star.opacityLight,
                animationDelay: `${star.delay}s`,
                boxShadow:
                  star.size > 1.4
                    ? `0 0 ${star.size * 3.5}px rgba(14, 165, 233, 0.65)`
                    : undefined,
              }}
            />
          );
        })}

        {/* نجوم سوبرنوفا سماوية بصلبان ضوئية رقيقة وساحرة */}
        <div
          className="absolute top-[14%] left-[20%] w-2 h-2 rounded-full bg-sky-400 animate-galaxy-twinkle-fast"
          style={{
            boxShadow:
              '0 0 14px 2px rgba(14, 165, 233, 0.85), 0 0 30px 6px rgba(56, 189, 248, 0.5)',
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-[1px] bg-gradient-to-r from-transparent via-sky-400 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-8 bg-gradient-to-b from-transparent via-sky-400 to-transparent" />
        </div>

        <div
          className="absolute top-[28%] right-[16%] w-2 h-2 rounded-full bg-blue-400 animate-galaxy-twinkle-medium"
          style={{
            animationDelay: '1.2s',
            boxShadow:
              '0 0 16px 2px rgba(37, 99, 235, 0.75), 0 0 32px 6px rgba(56, 189, 248, 0.45)',
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-9 bg-gradient-to-b from-transparent via-blue-400 to-transparent" />
        </div>

        {/* شبكة غبار كوني خفيفة للمجرة في النهار */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(14, 165, 233, 0.7) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. مجرة طرقع الكونية البرتقالية العملاقة (Dark Mode Cosmos) */}
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

        {/* شهب ونيازك برتقالية مضيئة ومتحركة (Animated Orange Meteors) */}
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

        {/* حقل نجوم المجرة الليلي (Galaxy Starfield) */}
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
                backgroundColor: star.colorDark,
                opacity: star.opacityDark,
                animationDelay: `${star.delay}s`,
                boxShadow:
                  star.size > 1.6
                    ? `0 0 ${star.size * 3.5}px ${star.colorDark}`
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

        {/* شبكة غبار كوني خفيفة للمجرة (Stardust Depth Pattern) */}
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(245, 158, 11, 0.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>
    </div>
  );
};

