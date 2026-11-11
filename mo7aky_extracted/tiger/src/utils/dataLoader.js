
export async function getSharedQuestions() {
  const endpoints = [
    '/api_banks.php?action=get_bank_questions&bank=search',
    '/api/shared-questions.php',
    '/api/shared-questions',
    '../api_banks.php?action=get_bank_questions&bank=search'
  ];

  for (const url of endpoints) {
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          try { localStorage.setItem('tarqa_simulator_shared_questions', JSON.stringify(data)); } catch (e) {}
          return data;
        }
      }
    } catch (err) {}
  }

  // Fallback to local cache only if server network call failed
  try {
    const local = localStorage.getItem('tarqa_simulator_shared_questions');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}

  return [];
}

// Dynamic On-Demand DataLoader:
// - StartScreen only fetches lightweight bank metadata (names, question counts, exam counts).
// - Full question JSONs are fetched ON-DEMAND only when an exam is started.

const defaultCategoryMapping = {
  "قدرات - كمي": "search"
};

const defaultBankMapping = {
  'search': 'بنك الأسئلة (القسم الكمي)'
};

export const bankMapping = { ...defaultBankMapping };
export const categoryMapping = { ...defaultCategoryMapping };

// Lightweight metadata cache
let loadedBanksList = [];
let bankExamsMap = {};
let bankQuestionCountMap = {};

// On-demand question pools cache (categoryKey -> questions array)
const questionPools = {};

const APP_CACHE_BUSTER = typeof window !== 'undefined' && window.__APP_CACHE_BUSTER ? window.__APP_CACHE_BUSTER : (typeof window !== 'undefined' ? (window.__APP_CACHE_BUSTER = Date.now()) : Date.now());

const stringHash = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(36);
};

/**
 * Normalizes question data structure
 */
const normalizeQuestion = (question, type = 'search', sourceIndex = 0, bankName = null) => {
  const content = (question.question || '') + '|' +
    (question.image || question.image_url || question.question_image || question.image_path || '') + '|' +
    JSON.stringify(question.choices || '') + '|' +
    (question.answer !== undefined ? question.answer : '') + '|' +
    (question.passage || '') + '|' +
    (question.exam || '');

  const contentHash = stringHash(content);
  const examPrefix = (question.exam || bankName || 'exam').replace(/[\s\/]+/g, '_');
  const uniqueId = `${type}-${examPrefix}-${question.question_number || sourceIndex}-${contentHash}`;

  let category = question.category || type || 'search';
  const folderName = (bankName || question.bank || type || 'search').replace(/\.json$/, '');

  // Resolve image URL dynamically (/get_image.php?img={folder}/{image})
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

  // Standardize choices
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
    image_url: imageUrl,
    image: imageUrl,
    type: type,
    choices: choices,
    answer: question.answer,
    passage: question.passage || null,
    category: category,
    bank: folderName,
    exam: question.exam || 'القسم الكمي',
    visible: question.visible !== undefined ? question.visible : true,
    passage_id: question.passage ? btoa(unescape(encodeURIComponent(question.passage))).substring(0, 12) : null
  };
};

/**
 * Lightweight initialization: ONLY fetches bank names, question counts, and available exams.
 * Does NOT download any heavy question JSON files!
 */
export const initializeQuestionData = async (currentUser = null) => {
  if (loadedBanksList.length > 0) {
    return loadedBanksList;
  }

  try {
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
          if (banksData && banksData.success) break;
        }
      } catch (e) {
        // try next endpoint
      }
    }

    let banks = [];
    if (banksData && banksData.success && Array.isArray(banksData.banks) && banksData.banks.length > 0) {
      banks = banksData.banks;
      if (banksData.bank_mapping) {
        Object.assign(bankMapping, banksData.bank_mapping);
      }
      if (banksData.category_mapping) {
        Object.assign(categoryMapping, banksData.category_mapping);
      }
    } else {
      console.warn('Server denied bank metadata or returned 0 accessible banks.');
      banks = [];
    }

    loadedBanksList = banks;
    banks.forEach(b => {
      bankQuestionCountMap[b.key] = b.question_count || 0;
      bankExamsMap[b.key] = Array.isArray(b.exams) ? b.exams.map(e => ({
        name: e.name || 'القسم الكمي',
        questionCount: e.question_count || 0
      })) : [{ name: 'القسم الكمي', questionCount: b.question_count || 0 }];
    });

    
    // Incorporate shared questions metadata so custom models/exams show in dropdown
    try {
      const shared = await getSharedQuestions();
      if (Array.isArray(shared) && shared.length > 0) {
        const examNames = Array.from(new Set(shared.map(sq => sq.exam || 'القسم الكمي')));
        const customExams = examNames.map(eName => ({
          name: eName,
          questionCount: shared.filter(sq => (sq.exam || 'القسم الكمي') === eName).length
        }));

        if (!loadedBanksList.some(b => b.key === 'search')) {
          loadedBanksList.push({
            key: 'search',
            name: 'بنك أسئلة محاكي الطرقعة',
            question_count: shared.length,
            exams: customExams
          });
        }
        if (!bankExamsMap['search']) bankExamsMap['search'] = [];
        customExams.forEach(ce => {
          if (!bankExamsMap['search'].some(existing => existing.name === ce.name)) {
            bankExamsMap['search'].push(ce);
          }
        });
        bankQuestionCountMap['search'] = (bankQuestionCountMap['search'] || 0) + shared.length;
      }
    } catch(err) {}

    console.log('Bank metadata loaded (lightweight):', loadedBanksList.map(b => `${b.key} (${b.question_count}q)`));
    return loadedBanksList;
  } catch (error) {
    console.error('Error initializing bank metadata:', error);
    return [];
  }
};

/**
 * On-demand question loading: Fetches questions ONLY for the requested bank and specific exam!
 */
export const loadBankQuestions = async (categoryKey, examName = null) => {
  const key = categoryKey || 'search';
  const poolKey = examName ? `${key}_${examName}` : key;
  if (questionPools[poolKey] && questionPools[poolKey].length > 0) {
    return questionPools[poolKey];
  }

  const bankInfo = loadedBanksList.find(b => b.key === key);
  const fileName = bankInfo?.file || (key === 'search' ? 'search/search.json' : `${key}.json`);

  try {
    console.log(`Fetching questions on demand for: ${key} (${fileName}) [exam: ${examName || 'all'}]...`);
    let data = null;
    const bankKey = key || fileName.replace(/\.json$/i, '').replace(/^search\//i, '') || 'search';
    const examParam = examName ? `&exam=${encodeURIComponent(examName)}` : '';
    const fetchUrls = [
      `/api_banks.php?action=get_bank_questions&bank=${encodeURIComponent(bankKey)}${examParam}`,
      `/api_banks.php?action=get_bank_questions&bank=${encodeURIComponent(bankKey)}${examParam}`,
      `/api_banks.php?action=get_bank_questions&bank=${encodeURIComponent(fileName)}${examParam}`,
      `/api_banks.php?action=get_bank_questions&bank=${encodeURIComponent(fileName)}${examParam}`
    ];

    for (const url of fetchUrls) {
      try {
        const sep = url.includes('?') ? '&' : '?';
        const fetchOptions = {
          cache: 'no-store',
          credentials: 'include'
        };
        const response = await fetch(`${url}${sep}_t=${Date.now()}`, fetchOptions);
        if (response.ok) {
          const raw = await response.json();
          data = Array.isArray(raw) ? raw : (Array.isArray(raw?.questions) ? raw.questions : []);
          if (Array.isArray(data) && data.length > 0) break;
        } else if (response.status === 401 || response.status === 403) {
          console.warn(`Access denied to bank ${key}: HTTP ${response.status}`);
          break;
        }
      } catch (e) { }
    }

    const pool = [];
    if (Array.isArray(data)) {
      data.forEach((q, i) => {
        pool.push(normalizeQuestion(q, key, i));
      });
    }

    
    // Include shared questions from Question Manager
    const shared = await getSharedQuestions();
    if (Array.isArray(shared) && shared.length > 0) {
      shared.forEach((sq, idx) => {
        const sqType = sq.type || (sq.category?.includes('لفظي') ? 'verbal' : 'search');
        if (sqType === key || key === 'search') {
          if (!examName || sq.exam === examName || !sq.exam) {
            const normalized = normalizeQuestion(sq, sqType, 20000 + idx, sq.bank || key);
            if (!pool.some(existing => existing.id === normalized.id || existing.question === normalized.question)) {
              pool.push(normalized);
            }
          }
        }
      });
    }

    questionPools[poolKey] = pool;
    if (!questionPools[key]) questionPools[key] = [];
    pool.forEach(q => {
      if (!questionPools[key].some(existing => existing.id === q.id)) {
        questionPools[key].push(q);
      }
    });
    return pool;
  } catch (err) {
    console.error(`Error loading questions on demand for ${key}:`, err);
    return [];
  }
};

export const getAllQuestions = async () => {
  await initializeQuestionData();
  const categories = getAvailableCategories();
  const allQuestions = [];
  for (const cat of categories) {
    const qs = await loadBankQuestions(cat.key);
    if (Array.isArray(qs) && qs.length > 0) {
      allQuestions.push(...qs);
    }
  }
  return allQuestions;
};

/**
 * Returns available categories with question counts from the lightweight metadata.
 */
export const getAvailableCategories = () => {
  if (!loadedBanksList || loadedBanksList.length === 0) {
    return [];
  }

  return loadedBanksList.map(bank => ({
    key: bank.key,
    name: bank.name || bankMapping[bank.key] || bank.key,
    questionCount: bank.question_count || bankQuestionCountMap[bank.key] || 0
  }));
};

/**
 * Returns available exams and their question counts from the lightweight metadata.
 */
export const getAvailableExams = (categoryKey) => {
  const key = categoryKey || 'search';

  // If the bank questions are already in memory, compute exact exams
  if (questionPools[key] && questionPools[key].length > 0) {
    const examMap = new Map();
    questionPools[key].forEach(question => {
      if (question.visible === true) {
        const examName = question.exam || 'القسم الكمي';
        if (!examMap.has(examName)) {
          examMap.set(examName, { name: examName, questionCount: 0 });
        }
        examMap.get(examName).questionCount++;
      }
    });
    return Array.from(examMap.values());
  }

  // Otherwise return from lightweight metadata cache
  if (bankExamsMap[key] && bankExamsMap[key].length > 0) {
    return bankExamsMap[key];
  }

  return [
    { name: bankMapping[key] || 'القسم الكمي', questionCount: bankQuestionCountMap[key] || 0 }
  ];
};

export const groupRCQuestionsByPassage = (rcQuestions, maxQuestionsPerPassage) => {
  const passageGroups = new Map();
  rcQuestions.forEach(question => {
    const passageKey = question.passage_id || question.passage || 'no-passage';
    if (!passageGroups.has(passageKey)) {
      passageGroups.set(passageKey, []);
    }
    passageGroups.get(passageKey).push(question);
  });

  const finalPassageGroups = [];
  passageGroups.forEach((questions, passageKey) => {
    questions.sort((a, b) => (a.question_number || 0) - (b.question_number || 0));
    finalPassageGroups.push(questions);
  });
  return finalPassageGroups;
};

export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Generates an exam on-demand by fetching only the required category JSON.
 */
export const generateExam = async (config = {}) => {
  const {
    shuffleChoices = false,
    categoryKey = 'search',
    categoryKeys = null,
    examName = null,
    examNames = null
  } = config;

  // 1. Identify which category files must be loaded
  const keysToLoad = new Set();
  if (categoryKey) keysToLoad.add(categoryKey);
  if (Array.isArray(categoryKeys)) categoryKeys.forEach(k => keysToLoad.add(k));
  if (keysToLoad.size === 0) keysToLoad.add('search');

  // 2. Fetch only the requested bank(s) and specific exam on-demand
  const targetExamParam = (examNames && examNames.length > 0) ? examNames.join(',') : (examName || null);
  await Promise.all(Array.from(keysToLoad).map(k => loadBankQuestions(k, targetExamParam)));

  // 3. Collect questions for the exam
  let pool = [];

  if (categoryKeys && Array.isArray(categoryKeys) && categoryKeys.length > 0) {
    for (const key of categoryKeys) {
      if (questionPools[key]) {
        pool = [...pool, ...questionPools[key].filter(q => q.visible === true)];
      }
    }
  } else if (categoryKey && questionPools[categoryKey]) {
    if (examNames && Array.isArray(examNames) && examNames.length > 0) {
      pool = questionPools[categoryKey].filter(q => examNames.includes(q.exam) && q.visible === true);
    } else if (examName) {
      pool = questionPools[categoryKey].filter(q => q.exam === examName && q.visible === true);
    } else {
      pool = questionPools[categoryKey].filter(q => q.visible === true);
    }
  } else if (questionPools['search']) {
    pool = questionPools['search'].filter(q => q.visible === true);
  }

  if (pool.length === 0) {
    console.warn(`No questions available for category: ${categoryKey}, exam: ${examName}`);
    return { questions: [], totalQuestions: 0, totalSections: 1, questionsPerSection: 0, structure: { [categoryKey || 'search']: 0 } };
  }

  if (examNames && Array.isArray(examNames) && examNames.length > 0) {
    pool.sort((a, b) => {
      const indexA = examNames.indexOf(a.exam);
      const indexB = examNames.indexOf(b.exam);
      if (indexA !== indexB && indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1 && indexB === -1) return -1;
      if (indexA === -1 && indexB !== -1) return 1;
      return (a.question_number || 0) - (b.question_number || 0);
    });
  } else {
    pool.sort((a, b) => {
      const examComparison = (a.exam || '').localeCompare(b.exam || '');
      if (examComparison !== 0) {
        return examComparison;
      }
      return (a.question_number || 0) - (b.question_number || 0);
    });
  }

  const examQuestions = pool.map((q, index) => {
    const processedQuestion = { ...q, question_number: index + 1, section: 1, original_type: q.type };

    if (typeof processedQuestion.answer === 'string' && processedQuestion.choices) {
      const answerIndex = processedQuestion.choices.findIndex(choice => choice === processedQuestion.answer);
      processedQuestion.answer = answerIndex >= 0 ? answerIndex : 0;
    }

    if (shuffleChoices && processedQuestion.choices?.length > 0) {
      const originalChoices = [...processedQuestion.choices];
      const originalCorrectChoice = originalChoices[processedQuestion.answer];
      const shuffledChoices = shuffleArray(originalChoices);
      const newAnswerIndex = shuffledChoices.findIndex(choice => choice === originalCorrectChoice);

      processedQuestion.choices = shuffledChoices;
      processedQuestion.answer = newAnswerIndex >= 0 ? newAnswerIndex : 0;
    }
    return processedQuestion;
  });

  return {
    questions: examQuestions,
    totalQuestions: examQuestions.length,
    totalSections: 1,
    questionsPerSection: examQuestions.length,
    structure: { [categoryKey || 'search']: examQuestions.length }
  };
};

export const getQuestionsByIds = (ids) => {
  const foundQuestions = [];
  const idSet = new Set(ids);

  for (const poolName in questionPools) {
    const pool = questionPools[poolName];
    for (const question of pool) {
      if (idSet.has(question.id)) {
        foundQuestions.push(question);
        idSet.delete(question.id);
        if (idSet.size === 0) {
          break;
        }
      }
    }
    if (idSet.size === 0) {
      break;
    }
  }

  return foundQuestions;
};

export const processQuestions = (questions, config = {}) => {
  const { shuffleChoices = false } = config;

  const examQuestions = questions.map((q, index) => {
    const processedQuestion = { ...q, question_number: index + 1, section: 1, original_type: q.type };

    if (typeof processedQuestion.answer === 'string' && processedQuestion.choices) {
      const answerIndex = processedQuestion.choices.findIndex(choice => choice === processedQuestion.answer);
      processedQuestion.answer = answerIndex >= 0 ? answerIndex : 0;
    }

    if (shuffleChoices && processedQuestion.choices?.length > 0) {
      const originalChoices = [...processedQuestion.choices];
      const originalCorrectChoice = originalChoices[processedQuestion.answer];
      const shuffledChoices = shuffleArray(originalChoices);
      const newAnswerIndex = shuffledChoices.findIndex(choice => choice === originalCorrectChoice);

      processedQuestion.choices = shuffledChoices;
      processedQuestion.answer = newAnswerIndex >= 0 ? newAnswerIndex : 0;
    }
    return processedQuestion;
  });

  return examQuestions;
};

export const resetDataLoader = () => {
  Object.keys(questionPools).forEach(k => delete questionPools[k]);
  loadedBanksList = [];
  bankExamsMap = {};
  bankQuestionCountMap = {};
  console.log('DataLoader cache has been reset.');
};

export default {
  initializeQuestionData,
  loadBankQuestions,
  generateExam,
  getAvailableCategories,
  getAvailableExams,
  groupRCQuestionsByPassage,
  shuffleArray,
  getQuestionsByIds,
  processQuestions,
  resetDataLoader,
  bankMapping,
  categoryMapping
};