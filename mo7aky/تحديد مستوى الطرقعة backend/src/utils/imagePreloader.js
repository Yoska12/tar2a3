/**
 * High-Speed Intelligent Image Preloading System
 * Ensures zero-latency rendering of question images during exam navigation.
 */

// Global in-memory cache to prevent redundant fetches within the application lifecycle
const preloadedImagesCache = new Set();

/**
 * Preload an individual image URL using the native browser Image constructor.
 * Resolves safely on either onload or onerror to prevent hanging promises.
 * 
 * @param {string} url - Target image URL
 * @returns {Promise<string|null>}
 */
export const preloadSingleImage = (url) => {
  if (!url || typeof url !== 'string') {
    return Promise.resolve(null);
  }

  // Already cached or in-flight
  if (preloadedImagesCache.has(url)) {
    return Promise.resolve(url);
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      // Enable asynchronous decoding so main-thread parsing isn't blocked
      img.decoding = 'async';

      const handleDone = (success) => {
        img.onload = null;
        img.onerror = null;
        if (success) {
          preloadedImagesCache.add(url);
          resolve(url);
        } else {
          // Gracefully resolve null so failures don't halt the flow
          resolve(null);
        }
      };

      img.onload = () => handleDone(true);
      img.onerror = () => handleDone(false);

      img.src = url;

      // In case browser already has it cached and decoded synchronously
      if (img.complete && img.naturalWidth > 0) {
        handleDone(true);
      }
    } catch (e) {
      resolve(null);
    }
  });
};

/**
 * Preload an array of image URLs concurrently with Promise.allSettled.
 * 
 * @param {string[]} urls
 * @returns {Promise<PromiseSettledResult<string|null>[]>}
 */
export const preloadBatch = async (urls = []) => {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const validUrls = Array.from(
    new Set(urls.filter((u) => Boolean(u) && typeof u === 'string' && !preloadedImagesCache.has(u)))
  );

  if (validUrls.length === 0) {
    return [];
  }

  return Promise.allSettled(validUrls.map(preloadSingleImage));
};

/**
 * High-Priority Batch: Preload images for the initial section (first 5 to 11 questions).
 * Features an internal safety timeout to guarantee the UI never hangs indefinitely.
 * 
 * @param {string[]} urls - URLs for Section 1 questions
 * @param {number} timeoutMs - Max wait time before starting exam anyway (default 2500ms)
 * @returns {Promise<void>}
 */
export const preloadInitialBatch = async (urls = [], timeoutMs = 2500) => {
  if (!Array.isArray(urls) || urls.length === 0) return;

  const preloaderPromise = preloadBatch(urls);

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve('TIMEOUT_SAFE_START');
    }, timeoutMs);
  });

  // Start exam as soon as images are ready or after the safety timeout
  await Promise.race([preloaderPromise, timeoutPromise]);
};

/**
 * Background Batch: Preload remaining images in chunks during browser idle time
 * using requestIdleCallback or chunked setTimeouts to avoid network congestion.
 * 
 * @param {string[]} urls - URLs for remaining questions
 * @param {number} chunkSize - Number of images to fetch per idle chunk (default 3)
 * @param {number} delayMs - Fallback inter-chunk delay in ms
 */
export const preloadBackgroundBatch = (urls = [], chunkSize = 3, delayMs = 120) => {
  if (!Array.isArray(urls) || urls.length === 0) return;

  const pending = urls.filter((u) => Boolean(u) && typeof u === 'string' && !preloadedImagesCache.has(u));
  if (pending.length === 0) return;

  const scheduleNext = (callback) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(callback, { timeout: 1000 });
    } else {
      setTimeout(callback, delayMs);
    }
  };

  let index = 0;

  const processChunk = () => {
    if (index >= pending.length) return;

    const chunk = pending.slice(index, index + chunkSize);
    index += chunkSize;

    // Fire current chunk in non-blocking manner
    preloadBatch(chunk).finally(() => {
      if (index < pending.length) {
        scheduleNext(processChunk);
      }
    });
  };

  scheduleNext(processChunk);
};

/**
 * Sliding Window: Warm up upcoming questions (N+1, N+2, etc.) in cache when navigating.
 * 
 * @param {Array} questions - Array of exam question objects
 * @param {number} currentIndex - Current active question index
 * @param {number} windowSize - Number of ahead questions to keep warm (default 2)
 */
export const preloadSlidingWindow = (questions = [], currentIndex = 0, windowSize = 2) => {
  if (!Array.isArray(questions) || questions.length === 0) return;

  const aheadUrls = [];
  for (let i = 1; i <= windowSize; i++) {
    const targetIndex = currentIndex + i;
    if (targetIndex < questions.length) {
      const q = questions[targetIndex];
      const url = q?.image_url || q?.image;
      if (url && typeof url === 'string' && !preloadedImagesCache.has(url)) {
        aheadUrls.push(url);
      }
    }
  }

  if (aheadUrls.length > 0) {
    preloadBatch(aheadUrls);
  }
};

/**
 * Helper to safely extract image URLs from an array of questions.
 * 
 * @param {Array} questions
 * @returns {string[]}
 */
export const extractImageUrls = (questions = []) => {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q) => q?.image_url || q?.image)
    .filter((url) => Boolean(url) && typeof url === 'string');
};

