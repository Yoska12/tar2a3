import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Lock,
  PictureInPicture,
  Loader2
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import { resolveVideoUrl, resolveVideoDetails } from '../lib/videoUploadService';

interface SecureVideoPlayerProps {
  src: string;
  title: string;
  currentUser?: TarqaUser | null;
  onEnded?: () => void;
  poster?: string;
  autoPlay?: boolean;
}

export const SecureVideoPlayer: React.FC<SecureVideoPlayerProps> = ({
  src,
  title,
  currentUser,
  onEnded,
  poster,
  autoPlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);

  // الرابط الفعلي القابل للتشغيل (يحل IndexedDB إلى ObjectURL حي أو رابط موثوق)
  const [resolvedSrc, setResolvedSrc] = useState<string>(src);
  const [isLocalMissing, setIsLocalMissing] = useState(false);

  // حالة المشغل
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);
    setIsLocalMissing(false);
    if (!src) {
      setResolvedSrc('');
      return;
    }
    if (src.startsWith('indexeddb://')) {
      resolveVideoDetails(src).then((details) => {
        if (isMounted) {
          setResolvedSrc(details.url);
          setIsLocalMissing(details.isLocalMissing);
        }
      });
    } else {
      setResolvedSrc(src);
    }
    return () => {
      isMounted = false;
    };
  }, [src]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [securityViolation, setSecurityViolation] = useState(false);

  // إحداثيات العلامة المائية العشوائية المتحركة
  const [watermarkPos, setWatermarkPos] = useState({ x: 20, y: 25 });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // بيانات المستخدم للعلامة المائية المانعة للتسريب
  const userId = currentUser?.id || 'GUEST-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const userName = currentUser?.fullName || 'طالب منصة طرقع';
  const userEmail = currentUser?.email || 'طالب مصرح';

  // تنسيق الوقت بالدقائق والثواني
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. تحريك العلامة المائية بشكل عشوائي كل 12 ثانية لمنع القص والـ crop
  useEffect(() => {
    const moveWatermark = () => {
      // توليد موقع عشوائي بين 10% إلى 75% من أبعاد الشاشة
      const randomX = Math.floor(Math.random() * 65) + 10;
      const randomY = Math.floor(Math.random() * 65) + 10;
      setWatermarkPos({ x: randomX, y: randomY });
    };

    const interval = setInterval(moveWatermark, 12000);
    return () => clearInterval(interval);
  }, []);

  // 2. نظام المراقبة الأمنية (Anti-Tamper MutationObserver)
  useEffect(() => {
    if (!watermarkRef.current || !containerRef.current) return;

    const targetNode = watermarkRef.current;
    const observer = new MutationObserver(() => {
      // فحص ما إذا تم إخفاء أو تعديل العلامة المائية عبر DevTools
      const style = window.getComputedStyle(targetNode);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity) < 0.1 ||
        !containerRef.current?.contains(targetNode)
      ) {
        setSecurityViolation(true);
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }
    });

    observer.observe(targetNode, {
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });

    return () => observer.disconnect();
  }, []);

  // 3. إدارة إخفاء عناصر التحكم بعد 3 ثوانٍ من عدم تحريك الفأرة
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 3000);
  };

  // التحكم بالتشغيل / الإيقاف
  const togglePlay = useCallback(() => {
    if (securityViolation) return;
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [securityViolation]);

  // القفز 10 ثوانٍ للأمام أو الخلف
  const skipTime = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
  };

  // تغيير سرعة التشغيل
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  // التحكم بمستوى الصوت
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  // كتم / تشغيل الصوت
  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  // ملء الشاشة
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // صورة داخل صورة (PiP)
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP not supported or rejected:', e);
    }
  };

  // شريط التقدم الزمني
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTo = parseFloat(e.target.value);
    setCurrentTime(seekTo);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTo;
    }
  };

  // تحديث وقت الفيديو وكمية التحميل المؤقت (Buffering)
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);

    if (videoRef.current.buffered.length > 0 && duration > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBufferedPercent((bufferedEnd / duration) * 100);
    }
  };

  // اختصارات لوحة المفاتيح
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // تجنب التدخل عند الكتابة في الحقول
      if (['input', 'textarea'].includes((document.activeElement?.tagName || '').toLowerCase())) {
        return;
      }

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skipTime(5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skipTime(-5);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  // التحقق التلقائي إذا كان الرابط يوتيوب أو فيميو
  const isYouTube = resolvedSrc.includes('youtube.com') || resolvedSrc.includes('youtu.be');
  const isVimeo = resolvedSrc.includes('vimeo.com');

  if (isYouTube) {
    const match = resolvedSrc.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
    const videoId = match ? match[1] : '';
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId || ''}?autoplay=0&rel=0&modestbranding=1&playsinline=1`;

    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black select-none group shadow-2xl border border-slate-800/80 font-cairo"
      >
        <iframe
          src={embedUrl}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        {/* العلامة المائية المحمية فوق اليوتيوب */}
        <div className="absolute top-4 left-4 pointer-events-none z-10 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-amber-500/30 text-white text-[10px] font-mono select-none">
          <span className="text-amber-400 font-bold">طالب طرقع: </span>
          <span>#{userId.slice(0, 10)}</span>
        </div>
      </div>
    );
  }

  if (isVimeo) {
    const match = resolvedSrc.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    const videoId = match ? match[1] : '';
    const embedUrl = `https://player.vimeo.com/video/${videoId || ''}?badge=0&autopause=0&player_id=0`;

    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black select-none group shadow-2xl border border-slate-800/80 font-cairo"
      >
        <iframe
          src={embedUrl}
          title={title}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
        <div className="absolute top-4 left-4 pointer-events-none z-10 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-amber-500/30 text-white text-[10px] font-mono select-none">
          <span className="text-amber-400 font-bold">طالب طرقع: </span>
          <span>#{userId.slice(0, 10)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onContextMenu={(e) => e.preventDefault()} // منع القائمة المنسدلة للزر الأيمن
      className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black select-none group shadow-2xl border border-slate-800/80 font-cairo"
    >
      {/* 1. عنصر الفيديو الفعلي (مع دعم تشغيل الموبايل وتعطيل خيارات التنزيل الافتراضية) */}
      <video
        ref={videoRef}
        src={resolvedSrc}
        poster={poster}
        autoPlay={autoPlay}
        playsInline={true}
        preload="metadata"
        controlsList="nodownload nofullscreen noplaybackrate"
        disablePictureInPicture={false}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        onError={() => {
          setIsBuffering(false);
          setHasError(true);
        }}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* شريط تنبيه إذا كان الفيديو محفوظاً في جهاز المشرف المحلي */}
      {isLocalMissing && !hasError && (
        <div className="absolute top-3 inset-x-3 z-30 px-3 py-2 rounded-xl bg-amber-950/85 backdrop-blur-md border border-amber-500/40 text-amber-200 text-[11px] font-medium flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span>هذا الفيديو محفوظ محلياً على جهاز المشرف. يُعرض فيديو اختباري مؤقت. ضع رابط يوتيوب ليعمل للطلاب على هواتفهم.</span>
          </div>
          <button
            onClick={() => setIsLocalMissing(false)}
            className="text-amber-400 hover:text-white px-2 py-0.5 rounded text-[10px] font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* تنبيه في حال تعذر تشغيل الفيديو */}
      {hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 text-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 text-2xl">
            ⚠️
          </div>
          <h3 className="font-bold text-base text-white mb-1">تعذر تشغيل ملف الفيديو على هذا الجهاز</h3>
          <p className="text-xs text-slate-300 max-w-sm mb-4 leading-relaxed">
            قد يكون الفيديو محفوظاً محلياً على كمبيوتر المشرف، أو بصيغة غير مدعومة من هذا الهاتف (.MOV)، أو انقطع الاتصال.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => {
                setHasError(false);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 active:scale-95"
            >
              إعادة المحاولة 🔄
            </button>
            <button
              onClick={() => {
                setHasError(false);
                setResolvedSrc('https://vjs.zencdn.net/v/oceans.mp4');
                setTimeout(() => {
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }, 100);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition active:scale-95"
            >
              تشغيل فيديو اختباري للتأكد ▶️
            </button>
          </div>
        </div>
      )}

      {/* 2. مؤشر التحميل المؤقت (Buffering Spinner) */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-10">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
        </div>
      )}

      {/* 3. زر التشغيل المركزي الضخم عند الإيقاف المؤقت */}
      {!isPlaying && !securityViolation && !hasError && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/30 transition-transform transform hover:scale-110 active:scale-95 z-10 cursor-pointer"
          aria-label="تشغيل الفيديو"
        >
          <Play className="w-9 h-9 fill-current ml-1" />
        </button>
      )}

      {/* ======================================================================= */}
      {/* 4. نظام العلامة المائية المشفرة لمنع التسريب (Anti-Leak Watermark) */}
      {/* ======================================================================= */}

      {/* أ. علامة مائية شبكية متكررة خافتة تغطي كامل إطار الفيديو (Tiled Grid Watermark) */}
      <div
        className="absolute inset-0 pointer-events-none z-10 overflow-hidden flex flex-wrap items-center justify-around opacity-[0.06] select-none"
        aria-hidden="true"
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="transform -rotate-12 text-[10px] font-mono font-black text-white whitespace-nowrap p-4"
          >
            TARQA • ID:#{userId.slice(0, 10)} • {userEmail}
          </div>
        ))}
      </div>

      {/* ب. العلامة المائية الديناميكية المتحركة برقم المعرّف واسم الطالب (Floating Dynamic Badge) */}
      <div
        ref={watermarkRef}
        style={{
          left: `${watermarkPos.x}%`,
          top: `${watermarkPos.y}%`,
          transition: 'all 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="absolute pointer-events-none z-20 select-none p-2.5 rounded-2xl bg-black/55 backdrop-blur-md border border-amber-500/30 text-white shadow-xl shadow-black/50"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <Shield className="w-3 h-3 text-amber-400 animate-pulse" />
          <span className="text-[10px] font-black text-amber-400 font-mono tracking-wider">
            محتوى محمي ومشفر 🔒
          </span>
        </div>
        <div className="text-[11px] font-black text-slate-100 flex items-center gap-1">
          <span>معرّف الطالب:</span>
          <span className="font-mono text-amber-300">#{userId.slice(0, 12)}</span>
        </div>
        <div className="text-[9px] text-slate-300 font-medium truncate max-w-[180px]">
          {userName} • {userEmail}
        </div>
      </div>

      {/* 5. شاشة تنبيه في حال محاولة التلاعب بالعلامة المائية */}
      {securityViolation && (
        <div className="absolute inset-0 bg-red-950/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center text-white">
          <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
          <h3 className="text-xl font-black mb-2 text-rose-400">تنبيه أمني: تم إيقاف المحتوى!</h3>
          <p className="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
            تم رصد محاولة لإخفاء أو التلاعب بالعلامة المائية الأمنية لمعرّف المستخدم. المحتوى محمي بحقوق ملكية ولا يجوز تسجيله.
          </p>
          <button
            onClick={() => {
              setSecurityViolation(false);
              window.location.reload();
            }}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition"
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. شريط التحكم السفلي المخصص (Custom Bottom Controls Bar) */}
      {/* ======================================================================= */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 transition-opacity duration-300 z-20 flex flex-col gap-2 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* أ. شريط التقدم الزمني المتقدم (Progress & Buffer Scrub Bar) */}
        <div className="relative w-full h-2 flex items-center group/track cursor-pointer">
          {/* خلفية مسار الفيديو */}
          <div className="absolute inset-0 bg-white/20 rounded-full overflow-hidden">
            {/* مؤشر التحميل المؤقت (Buffered) */}
            <div
              className="h-full bg-white/30 transition-all duration-300 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
          </div>

          {/* شريط الإنجاز الحالي الملون بالأصفر/الذهبي */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full pointer-events-none"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />

          {/* مدخل السحب (Range Input) غير المرئي بدقة */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            aria-label="تقديم أو تأخير الفيديو"
          />
        </div>

        {/* ب. أزرار التحكم والوقت والسرعة */}
        <div className="flex items-center justify-between gap-3 text-white pt-1">
          {/* الجانب الأيمن: تشغيل، تقديم/تأخير، وقت، صوت */}
          <div className="flex items-center gap-3">
            {/* زر تشغيل / إيقاف */}
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl hover:bg-white/15 text-amber-400 transition"
              title={isPlaying ? 'إيقاف مؤقت (Space)' : 'تشغيل (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* تأخير 10 ثوانٍ */}
            <button
              onClick={() => skipTime(-10)}
              className="p-1.5 rounded-xl hover:bg-white/15 text-slate-300 hover:text-white transition"
              title="تأخير 10 ثوانٍ"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* تقديم 10 ثوانٍ */}
            <button
              onClick={() => skipTime(10)}
              className="p-1.5 rounded-xl hover:bg-white/15 text-slate-300 hover:text-white transition"
              title="تقديم 10 ثوانٍ"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* التحكم بالصوت */}
            <div className="flex items-center gap-2 group/volume">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-xl hover:bg-white/15 text-slate-300 hover:text-white transition"
                title={isMuted ? 'إلغاء كتم الصوت (M)' : 'كتم الصوت (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-amber-400" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-white/30 rounded-full appearance-none accent-amber-500 cursor-pointer"
                aria-label="مستوى الصوت"
              />
            </div>

            {/* عداد الوقت */}
            <div className="text-xs font-mono font-bold text-slate-300 ml-1">
              <span className="text-amber-400">{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* الجانب الأيسر: سرعة الشرح، عنوان المحاضرة، PiP، ملء الشاشة */}
          <div className="flex items-center gap-2">
            {/* عنوان المحاضرة المصغر */}
            <span className="hidden md:inline-block text-xs font-bold text-slate-400 truncate max-w-[200px]">
              {title}
            </span>

            {/* قائمة سرعة الشرح */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold font-mono transition flex items-center gap-1 text-amber-400"
                title="سرعة الشرح"
              >
                <span>{playbackSpeed}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full left-0 mb-2 p-1.5 rounded-2xl bg-[#0a0f1d] border border-slate-700 shadow-2xl flex flex-col gap-1 min-w-[80px] z-30 animate-fadeIn">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-right transition ${
                        playbackSpeed === spd
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {spd}x {spd === 1 && '(طبيعي)'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* زر صورة داخل صورة (PiP) */}
            <button
              onClick={togglePiP}
              className="p-1.5 rounded-xl hover:bg-white/15 text-slate-300 hover:text-white transition"
              title="نافذة عائمة (Picture-in-Picture)"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            {/* زر ملء الشاشة */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-xl hover:bg-white/15 text-slate-300 hover:text-white transition"
              title={isFullscreen ? 'تصغير الشاشة (F)' : 'ملء الشاشة (F)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
