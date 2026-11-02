/**
 * أدوات موحدة لمعالجة واستخراج روابط الفيديو لليوتيوب وفيميو
 */
export const isYouTubeUrl = (url: string = '', provider: string = ''): boolean => {
  if (provider === 'youtube') return true;
  return url.includes('youtube.com') || url.includes('youtu.be');
};

export const isVimeoUrl = (url: string = '', provider: string = ''): boolean => {
  if (provider === 'vimeo') return true;
  return url.includes('vimeo.com');
};

export const getYouTubeEmbedUrl = (url: string): string => {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
  const videoId = match ? match[1] : '';
  return `https://www.youtube-nocookie.com/embed/${videoId || 'dQw4w9WgXcQ'}?autoplay=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
};

export const getVimeoEmbedUrl = (url: string): string => {
  if (!url) return '';
  const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  const videoId = match ? match[1] : '';
  return `https://player.vimeo.com/video/${videoId || ''}?badge=0&autopause=0&player_id=0`;
};
