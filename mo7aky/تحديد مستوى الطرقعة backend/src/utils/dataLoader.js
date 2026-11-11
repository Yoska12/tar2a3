
export async function getSharedQuestions() {
  try {
    const res = await fetch('/api/shared-questions', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        try { localStorage.setItem('tarqa_simulator_shared_questions', JSON.stringify(data)); } catch (e) {}
        return data;
      }
    }
  } catch (err) {}

  try {
    const local = localStorage.getItem('tarqa_simulator_shared_questions');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}

  return [];
}

// Fetches question data from an online source and generates exams.
// Data is fetched asynchronously and cached.

const APP_CACHE_BUSTER = typeof window !== 'undefined' && window.__APP_CACHE_BUSTER ? window.__APP_CACHE_BUSTER : (typeof window !== 'undefined' ? (window.__APP_CACHE_BUSTER = Date.now()) : Date.now());

// --- Helper Functions ---

const stringHash = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(36);
};

const normalizeQuestion = (question, type, sourceIndex, bank) => {
  const content = (question.question || '') + '|' +
    (question.image || question.image_url || question.question_image || question.image_path || '') + '|' +
    JSON.stringify(question.choices || '') + '|' +
    (question.answer !== undefined ? question.answer : '') + '|' +
    (question.passage || '');

  const contentHash = stringHash(content);
  // Guarantee 100% unique ID per question using sourceIndex and contentHash
  const uniqueId = `${bank}-${type}-${sourceIndex}-${contentHash}`;

  const folderName = (bank || question.bank || type || 'search').replace(/\.json$/, '');

  let imageUrl = question.image_url || question.image || question.question_image || question.image_path || null;
  if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:')) {
    let cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
    if (cleanPath.startsWith('Data/')) cleanPath = cleanPath.slice(5);

    let imgParam = cleanPath;
    if (cleanPath.startsWith(`${folderName}/`)) {
      imgParam = cleanPath;
    } else if (cleanPath.includes('/') && !cleanPath.startsWith('images/')) {
      imgParam = cleanPath;
    } else {
      imgParam = `${folderName}/${cleanPath}`;
    }
    imageUrl = `/get_image.php?img=${encodeURIComponent(imgParam)}`;
  } else if (imageUrl && imageUrl.includes('/Data/')) {
    let clean = imageUrl.replace(/^https?:\/\/[^\/]+\/Data\//i, '').split('?')[0];
    imageUrl = `/get_image.php?img=${encodeURIComponent(clean)}`;
  }

  if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.includes('_v=') && !imageUrl.includes('_=')) {
    const sep = imageUrl.includes('?') ? '&' : '?';
    imageUrl = `${imageUrl}${sep}_v=${APP_CACHE_BUSTER}`;
  }

  let choices = question.choices;
  if (!choices || !Array.isArray(choices) || choices.length === 0) {
    if (imageUrl) {
      choices = ['أ', 'ب', 'ج', 'د'];
    } else {
      choices = [];
    }
  }

  return {
    id: uniqueId,
    question_number: question.question_number || sourceIndex + 1,
    question: question.question || '',
    type: type,
    choices: choices,
    answer: question.answer,
    passage: question.passage || null,
    category: question.category || type,
    exam: question.exam || '',
    bank: bank,
    image_url: imageUrl,
    image: imageUrl,
    passage_id: question.passage ? btoa(unescape(encodeURIComponent(question.passage))).substring(0, 12) : null
  };
};

// Shuffle array function (seeded for deterministic behavior)
export const shuffleArray = (array, seed = 'default-seed') => {
  const createRand = (str) => {
    let h = 1779033703, i = 0, len = str.length;
    for (; i < len; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    return () => {
      h = Math.imul(h ^ h >>> 16, 2246822507);
      h = Math.imul(h ^ h >>> 13, 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  };

  const rand = createRand(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rand() % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};


// --- Data Loading and Caching ---

let questionPoolsCache = null;

let loadedBankMetadata = null;

export const resetDataLoader = () => {
  questionPoolsCache = null;
  loadedBankMetadata = null;
};

const categoryNameMapping = {
  "قدرات - كمي": "search",
};
export const categoryMapping = categoryNameMapping;

export const bankMapping = {
  'search': 'بنك الأسئلة (القسم الكمي)'
};

export const getAvailableExams = () => {
  if (Array.isArray(loadedBankMetadata) && loadedBankMetadata.length > 0) {
    return loadedBankMetadata.map(b => ({ name: b.key, displayName: b.name || bankMapping[b.key] || b.key }));
  }
  return [{ name: 'search', displayName: 'بنك الأسئلة (القسم الكمي)' }];
};

/**
 * Lightweight initialization: ONLY fetches bank names and metadata on startscreen.
 */
export async function initializeQuestionData(options = {}) {
  const { forceLoadQuestions = false, selectedBanks = [], examName = null } = options;

  if (loadedBankMetadata && !forceLoadQuestions && !questionPoolsCache) {
    return loadedBankMetadata;
  }

  if (questionPoolsCache && !forceLoadQuestions) {
    return questionPoolsCache;
  }

  try {
    let bankFiles = [];

    let banksData = null;
    const apiUrls = ['/api_banks.php'];
    for (const url of apiUrls) {
      try {
        const fetchOptions = {
          cache: 'no-store',
          ...((url.startsWith('http') && !url.includes(window.location.host)) ? {} : { credentials: 'include' })
        };
        const sep = url.includes('?') ? '&' : '?';
        const banksRes = await fetch(`${url}${sep}_t=${Date.now()}`, fetchOptions);
        if (banksRes && banksRes.ok) {
          banksData = await banksRes.json();
          if (banksData && banksData.success && Array.isArray(banksData.banks) && banksData.banks.length > 0) {
            if (banksData.bank_mapping) {
              Object.assign(bankMapping, banksData.bank_mapping);
            }
            const dynamicFiles = banksData.banks.map(b => b.file ? b.file.replace(/\.json$/, '') : b.key);
            bankFiles = Array.from(new Set(dynamicFiles));
            loadedBankMetadata = banksData.banks;
            break;
          }
        }
      } catch (e) {
        // try next
      }
    }

    // If we only need lightweight metadata for StartScreen, stop here!
    if (!forceLoadQuestions) {
      console.log('Bank metadata loaded (search StartScreen Mode)');
      return loadedBankMetadata || [];
    }

    if (!bankFiles || bankFiles.length === 0) {
      return {};
    }

    // Filter banks if user selected specific ones
    if (selectedBanks && Array.isArray(selectedBanks) && selectedBanks.length > 0) {
      const filtered = bankFiles.filter(f => selectedBanks.includes(f));
      if (filtered.length > 0) bankFiles = filtered;
    }

    const pools = {
      search: []
    };

    console.log('Fetching question files on demand for exam:', bankFiles, `[exam: ${examName || 'all'}]`);
    const examParam = examName ? `&exam=${encodeURIComponent(examName)}` : '';
    const fetchPromises = bankFiles.map(async (file) => {
      const fileName = file.endsWith('.json') ? file : `${file}.json`;
      const bankKey = fileName.replace(/\.json$/i, '').replace(/^search\//i, '') || 'search';
      const fetchUrls = [
        `/api_banks.php?action=get_bank_questions&bank=${encodeURIComponent(bankKey)}${examParam}`,
        `/api_banks.php?action=get_bank_questions&bank=${encodeURIComponent(bankKey)}${examParam}`,
        `/api_banks.php?action=get_bank_questions&bank=${encodeURIComponent(fileName)}${examParam}`,
        `/api_banks.php?action=get_bank_questions&bank=${encodeURIComponent(fileName)}${examParam}`
      ];

      let response = null;
      for (const u of fetchUrls) {
        try {
          const sep = u.includes('?') ? '&' : '?';
          const res = await fetch(`${u}${sep}_t=${Date.now()}`, {
            cache: 'no-store',
            credentials: 'include'
          });
          if (res.ok) {
            response = res;
            break;
          }
        } catch (e) {}
      }

      if (!response) {
        console.error(`Failed to fetch ${fileName} through secure api_banks gateway`);
        return;
      }
      const data = await response.json();

      if (data && Array.isArray(data)) {
        const bankName = file;
        data.forEach((q, index) => {
          if (q && (q.question !== undefined || q.choices || q.image || q.image_url || q.image_path)) {
            const rawCat = q.category || 'قدرات - كمي';
            const questionType = categoryNameMapping[rawCat] || 'search';
            if (!pools[questionType]) {
              pools[questionType] = [];
            }
            pools[questionType].push(normalizeQuestion(q, questionType, index, bankName));
          }
        });
      }
    });

    await Promise.all(fetchPromises);

    console.log('Question pools loaded on demand from banks:', Object.fromEntries(
      Object.entries(pools).map(([k, v]) => [k, v ? v.length : 0])
    ));

    questionPoolsCache = pools;
    return pools;

  } catch (error) {
    console.error('Error loading question data from banks:', error);
    return questionPoolsCache || {};
  }
}

export async function getAllQuestions() {
  const pools = await initializeQuestionData({ forceLoadQuestions: true });
  if (!pools || typeof pools !== 'object') return [];

  const allQuestions = Array.isArray(pools) ? pools : Object.values(pools).flat();
  return allQuestions.filter(q => q && (q.question !== undefined || q.image || q.image_url || q.choices || q.id));
}


// --- Exam Generation Logic ---

// Generate exam with exactly 55 questions (5 sections × 11 questions each)
export const generateExam = async (config = {}) => {
  console.log('generateExam called with config:', config);

  const {
    shuffleQuestions = false,
    shuffleChoices = false,
    excludeQuestionIds = [],
    selectedBanks = [],
  } = config;

  const initialQuestionPools = await initializeQuestionData({ forceLoadQuestions: true, selectedBanks });
  const sharedQs = await getSharedQuestions();
  const seed = config.seed || new Date().toISOString() + Math.random();

  // Strict ID Matching to exclude already answered questions
  const excludedIdsSet = new Set(excludeQuestionIds.map(String));

  // Flatten all questions
  const normalizedShared = Array.isArray(sharedQs) ? sharedQs.map((q, i) => normalizeQuestion(q, q.type || 'search', 20000 + i, 'search')) : [];
  const allPoolQuestions = [...(Array.isArray(initialQuestionPools) ? initialQuestionPools : Object.values(initialQuestionPools || {}).flat()), ...normalizedShared];
  const _ignorePrevAllPool = Array.isArray(initialQuestionPools)
    ? initialQuestionPools
    : Object.values(initialQuestionPools || {}).flat();

  // Filter out excluded questions AND respect selected banks
  let availableQuestions = allPoolQuestions.filter((q) => {
    if (!q || (q.question === undefined && !q.image && !q.image_url && !q.choices)) return false;
    const isExcluded = excludedIdsSet.has(String(q.id));
    const isBankSelected = !selectedBanks || selectedBanks.length === 0 || selectedBanks.includes(q.bank) || selectedBanks.includes('search') || q.bank === 'search';
    return !isExcluded && isBankSelected;
  });

  // If all questions were seen, recycle all questions
  if (availableQuestions.length === 0) {
    availableQuestions = allPoolQuestions.filter((q) => {
      if (!q || (q.question === undefined && !q.image && !q.image_url && !q.choices)) return false;
      return !selectedBanks || selectedBanks.length === 0 || selectedBanks.includes(q.bank) || selectedBanks.includes('search') || q.bank === 'search';
    });
  }

  // No demo questions - keep clean\n  if (availableQuestions.length === 0) { availableQuestions = []; }

  // Shuffle available questions
  let selectedQuestions = shuffleArray(availableQuestions, seed);

  // Take up to 55 questions (5 sections of 11)
  const targetTotal = 55;
  selectedQuestions = selectedQuestions.slice(0, targetTotal);

  if (shuffleQuestions) {
    selectedQuestions = shuffleArray(selectedQuestions, `${seed}-final`);
  }

  // Process questions, choices, answers, and assign section + sequential question numbers
  const examQuestions = selectedQuestions.map((q, idx) => {
    const processedQuestion = {
      ...q,
      question_number: idx + 1,
      section: Math.floor(idx / 11) + 1,
      original_type: q.type || 'search'
    };

    if (typeof processedQuestion.answer === 'string' && processedQuestion.choices) {
      const i = processedQuestion.choices.findIndex(c => c === processedQuestion.answer);
      processedQuestion.answer = i >= 0 ? i : 0;
    }

    if (shuffleChoices && processedQuestion.choices && processedQuestion.choices.length > 0) {
      const originalChoices = [...processedQuestion.choices];
      const originalAnswer = processedQuestion.answer;
      const originalCorrect = typeof originalAnswer === 'number' ? originalChoices[originalAnswer] : originalAnswer;
      const shuffledChoices = shuffleArray(originalChoices, `${seed}-final-${processedQuestion.id}`);
      const newAnswerIndex = shuffledChoices.findIndex(c => c === originalCorrect);
      processedQuestion.choices = shuffledChoices;
      processedQuestion.answer = newAnswerIndex >= 0 ? newAnswerIndex : 0;
    }

    return processedQuestion;
  });

  const totalQ = examQuestions.length;
  const totalSections = Math.ceil(totalQ / 11) || 1;

  console.log(`Generated ${totalQ} questions across ${totalSections} sections`);

  return {
    questions: examQuestions,
    totalQuestions: totalQ,
    totalSections: totalSections,
    questionsPerSection: totalQ ? 11 : 0,
    structure: { search: totalQ }
  };
};

// --- Helper Utilities for ResultsHistory ---

export const getQuestionsByIds = async (ids) => {
  const allQuestions = await getAllQuestions();
  const idsSet = new Set(ids.map(String));
  return allQuestions.filter(q => idsSet.has(String(q.id)));
};

export const processQuestions = (questions, config = {}) => {
  const { shuffleChoices = false, seed = 'default-seed' } = config;

  return questions.map((q, index) => {
    // Clone question to avoid mutating original source if strictly needed
    const question = { ...q };

    // Ensure answer is converted to index if it's stored as text
    if (typeof question.answer === 'string' && question.choices) {
      const answerIndex = question.choices.findIndex(choice => choice === question.answer);
      question.answer = answerIndex >= 0 ? answerIndex : 0;
    }

    // Shuffle choices if requested
    if (shuffleChoices && question.choices && question.choices.length > 0) {
      const originalChoices = [...question.choices];
      const originalAnswer = question.answer;
      let originalCorrectChoice;

      if (typeof originalAnswer === 'number') {
        originalCorrectChoice = originalChoices[originalAnswer];
      } else {
        originalCorrectChoice = originalAnswer;
      }

      const shuffledChoices = shuffleArray(originalChoices, `${seed}-${question.id || index}`);
      const newAnswerIndex = shuffledChoices.findIndex(choice => choice === originalCorrectChoice);

      question.choices = shuffledChoices;
      question.answer = newAnswerIndex >= 0 ? newAnswerIndex : 0;
    }

    return question;
  });
};

const dataLoader = {
  initializeQuestionData,
  generateExam,
  getAllQuestions,
  getAvailableExams,
  resetDataLoader,
  getSharedQuestions,
  bankMapping,
  categoryMapping,
  getQuestionsByIds,
  processQuestions
};

export default dataLoader;