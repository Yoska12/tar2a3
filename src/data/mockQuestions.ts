import { Category, Question } from '../types';

export const mockCategories: Category[] = [
  {
    id: 'all',
    title: 'جميع الأقسام (محاكي قياس)',
    slug: 'all',
    description: 'اختبار تجريبي متكامل يجمع كل موضوعات القسم الكمي بنفس توزيع قياس',
    icon: 'Layers',
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    questionsCount: 40,
  },
  {
    id: 'geometry',
    title: 'الهندسة والقياس',
    slug: 'geometry',
    description: 'المثلثات، الدوائر، المربعات والمستطيلات، الزوايا والمساحات المظللة',
    icon: 'Shapes',
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    questionsCount: 15,
  },
  {
    id: 'algebra',
    title: 'الجبر والمعادلات',
    slug: 'algebra',
    description: 'الأسس، الجذور، المتطابقات، المتتابعات، وحل المعادلات من الدرجة الأولى والثانية',
    icon: 'Variable',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    questionsCount: 18,
  },
  {
    id: 'arithmetic',
    title: 'الحساب والأعداد',
    slug: 'arithmetic',
    description: 'النسب المئوية، التدرج المنتظم، الكسور، قابلية القسمة، والعمليات الذهنية',
    icon: 'Calculator',
    badgeColor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    questionsCount: 22,
  },
  {
    id: 'comparisons',
    title: 'المقارنات',
    slug: 'comparisons',
    description: 'المقارنة بين قيمتين (الأولى أكبر، الثانية أكبر، متساويتان، المعطيات غير كافية)',
    icon: 'Scale',
    badgeColor: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    questionsCount: 12,
  },
  {
    id: 'statistics',
    title: 'الإحصاء والاحتمالات',
    slug: 'statistics',
    description: 'المتوسط الحسابي، الوسيط، المنوال، الرسوم البيانية، ومبدأ العد',
    icon: 'BarChart3',
    badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    questionsCount: 10,
  },
  {
    id: 'word-problems',
    title: 'المسائل اللفظية',
    slug: 'word-problems',
    description: 'مسائل السرعة والمسافة والزمن، الأعمار، والعمل المشترك والصنابير',
    icon: 'Clock',
    badgeColor: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    questionsCount: 14,
  }
];

export const mockQuestions: Question[] = [
  {
    id: 'q1',
    categoryId: 'algebra',
    categoryTitle: 'الجبر والمعادلات',
    topicTitle: 'الأسس والمعادلات الأسية',
    questionText: 'إذا كان $2^{x+1} = 8$ ، فما هي قيمة $x$ ؟',
    options: [
      { id: 'A', text: '$1$' },
      { id: 'B', text: '$2$' },
      { id: 'C', text: '$3$' },
      { id: 'D', text: '$4$' },
    ],
    correctOption: 'B',
    difficulty: 'Easy',
    source: 'تجميعات النماذج الحديثة',
    explanation: `🎯 **طريقة طرقع السريعة:**
وحّد الأساسات فوراً! الـ $8 = 2^3$.
إذن:
$$2^{x+1} = 2^3 \\implies x + 1 = 3 \\implies x = 2$$
💡 **طرقعها في ثانية:** بمجرد النظر، ما هو الأس الذي يجعل $2$ تساوي $8$؟ إنه $3$. إذن $x+1 = 3$ وعليه $x=2$.`,
  },
  {
    id: 'q2',
    categoryId: 'arithmetic',
    categoryTitle: 'الحساب والأعداد',
    topicTitle: 'النسب المئوية والتدرج المنتظم',
    questionText: 'اشترى أحمد ساعة بمبلغ $60$ ريالاً بعد خصم بنسبة $25\\%$ ، فكم كان سعرها الأصلي قبل الخصم؟',
    options: [
      { id: 'A', text: '$75$ ريالاً' },
      { id: 'B', text: '$80$ ريالاً' },
      { id: 'C', text: '$85$ ريالاً' },
      { id: 'D', text: '$90$ ريالاً' },
    ],
    correctOption: 'B',
    difficulty: 'Medium',
    source: 'تجميعات القدرات 1445',
    explanation: `⚡ **طريقة طرقع (التدرج المنتظم السريع):**
بعد خصم $25\\%$، تبقى من السعر الأصلي $75\\%$ والتي تمثل $\\frac{3}{4}$ من السعر.
- الـ $3$ أجزاء تعادل $60$ ريالاً.
- إذن الجزء الواحد (الربع) = $60 \\div 3 = 20$ ريالاً.
- السعر الأصلي الكامل ($4$ أجزاء) = $20 \\times 4 = 80$ ريالاً.
🎉 انتهت المسألة بدون معادلات طويلة!`,
  },
  {
    id: 'q3',
    categoryId: 'geometry',
    categoryTitle: 'الهندسة والقياس',
    topicTitle: 'المثلث القائم ونظرية فيثاغورس',
    questionText: 'مثلث قائم الزاوية، طولا ضلعي القائمة هما $6\\text{ سم}$ و $8\\text{ سم}$، ما هو طول الوتر وما هي مساحة المثلث؟',
    options: [
      { id: 'A', text: 'الوتر $= 10\\text{ سم}$ ، والمساحة $= 24\\text{ سم}^2$' },
      { id: 'B', text: 'الوتر $= 10\\text{ سم}$ ، والمساحة $= 48\\text{ سم}^2$' },
      { id: 'C', text: 'الوتر $= 12\\text{ سم}$ ، والمساحة $= 24\\text{ سم}^2$' },
      { id: 'D', text: 'الوتر $= 14\\text{ سم}$ ، والمساحة $= 48\\text{ سم}^2$' },
    ],
    correctOption: 'A',
    difficulty: 'Easy',
    source: 'أساسيات قياس',
    svgDiagram: `<svg viewBox="0 0 200 160" class="w-48 h-36 mx-auto">
      <polygon points="30,130 170,130 30,30" fill="rgba(245, 158, 11, 0.12)" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round"/>
      <rect x="30" y="115" width="15" height="15" fill="none" stroke="#f59e0b" stroke-width="2"/>
      <text x="15" y="85" fill="#f59e0b" font-size="14" font-weight="bold">6</text>
      <text x="95" y="148" fill="#f59e0b" font-size="14" font-weight="bold">8</text>
      <text x="110" y="70" fill="#10b981" font-size="14" font-weight="bold">الوتر = ؟</text>
    </svg>`,
    explanation: `📐 **طريقة طرقع (ثلاثيات فيثاغورس الذهبية):**
تذكر أشهر ثلاثي فيثاغورث: $(3, 4, 5)$.
بضرب أضلاعه في $2$:
$$3 \\times 2 = 6 \\quad , \\quad 4 \\times 2 = 8 \\quad \\implies \\quad 5 \\times 2 = 10$$
إذن الوتر فوراً هو **$10$**.
أما المساحة = نصف القاعدة $\\times$ الارتفاع:
$$\\text{المساحة} = \\frac{6 \\times 8}{2} = \\frac{48}{2} = 24\\text{ سم}^2$$`,
  },
  {
    id: 'q4',
    categoryId: 'comparisons',
    categoryTitle: 'المقارنات',
    topicTitle: 'مقارنات الجذور',
    questionText: 'قارن بين القيمتين التاليتين:\n\n**القيمة الأولى:** $\\sqrt{49} + \\sqrt{36}$\n\n**القيمة الثانية:** $\\sqrt{49 + 36}$',
    options: [
      { id: 'A', text: 'القيمة الأولى أكبر' },
      { id: 'B', text: 'القيمة الثانية أكبر' },
      { id: 'C', text: 'القيمتان متساويتان' },
      { id: 'D', text: 'المعطيات غير كافية' },
    ],
    correctOption: 'A',
    difficulty: 'Easy',
    source: 'أسئلة المقارنات الشائعة',
    explanation: `💡 **قاعدة طرقع الذهبية في الجذور:**
توزيع الجذور على الجمع **أكبر دائماً** من جمع المقدار داخل جذر واحد!
$$\\sqrt{a} + \\sqrt{b} > \\sqrt{a+b} \\quad (a, b > 0)$$
- القيمة الأولى: $\\sqrt{49} + \\sqrt{36} = 7 + 6 = 13$
- القيمة الثانية: $\\sqrt{49 + 36} = \\sqrt{85}$ (وهي أقل من $\\sqrt{100} = 10$)
وبما أن $13 > 9.2$ تقريباً، فالقيمة الأولى أكبر قطعاً. بمجرد النظر تختار (أ)!`,
  },
  {
    id: 'q5',
    categoryId: 'algebra',
    categoryTitle: 'الجبر والمعادلات',
    topicTitle: 'الفرق بين مربعين',
    questionText: 'ما هي القيمة العددية للكسر: $$\\frac{100^2 - 99^2}{199}$$ ؟',
    options: [
      { id: 'A', text: '$0$' },
      { id: 'B', text: '$1$' },
      { id: 'C', text: '$2$' },
      { id: 'D', text: '$199$' },
    ],
    correctOption: 'B',
    difficulty: 'Medium',
    source: 'تجميع الـ 120 نموذج',
    explanation: `🚀 **طريقة طرقع (حيلة الفرق بين مربعين):**
إياك وتربيع الأعداد الكبيرة في القدرات!
تذكر قانون الفرق بين مربعين: $a^2 - b^2 = (a-b)(a+b)$
البسط:
$$(100 - 99)(100 + 99) = (1) \\times (199) = 199$$
إذن الكسر يصبح:
$$\\frac{199}{199} = 1$$
الجواب فوراً هو **$1$** بخطوة ذهنية واحدة!`,
  },
  {
    id: 'q6',
    categoryId: 'statistics',
    categoryTitle: 'الإحصاء والاحتمالات',
    topicTitle: 'المتوسط الحسابي والمجموع',
    questionText: 'متوسط درجات $5$ طلاب في اختبار هو $80$ درجة. إذا انضم إليهم طالب سادس فأصبح متوسط درجات الجميع $82$ درجة، فكم درجة هذا الطالب السادس؟',
    options: [
      { id: 'A', text: '$88$ درجة' },
      { id: 'B', text: '$90$ درجة' },
      { id: 'C', text: '$92$ درجة' },
      { id: 'D', text: '$94$ درجة' },
    ],
    correctOption: 'C',
    difficulty: 'Medium',
    source: 'تجميعات القدرات 1445',
    explanation: `📊 **طريقة طرقع (حساب الفروق السريعة):**
الطالب الجديد رفع متوسط كل طالب من الـ $5$ بمقدار درجاتين ($+2$)، وأخذ لنفسه المتوسط الجديد $82$:
- الزيادة التي قدمها للطلاب السابقين = $5 \\times 2 = 10$ درجات.
- إذن درجته = المتوسط الجديد + الزيادة = $82 + 10 = 92$ درجة!
🎯 **الطريقة الكلاسيكية للتحقق:**
مجموع الـ 5 طلاب = $5 \\times 80 = 400$.
مجموع الـ 6 طلاب = $6 \\times 82 = 492$.
درجة الطالب الجديد = $492 - 400 = 92$.`,
  },
  {
    id: 'q7',
    categoryId: 'word-problems',
    categoryTitle: 'المسائل اللفظية',
    topicTitle: 'مسائل السرعة والمسافة والزمن',
    questionText: 'يسير قطار بسرعة منتظمة قدرها $120\\text{ كم/ساعة}$. ما هي المسافة التي يقطعها في زمن قدره $20$ دقيقة؟',
    options: [
      { id: 'A', text: '$30\\text{ كم}$' },
      { id: 'B', text: '$40\\text{ كم}$' },
      { id: 'C', text: '$50\\text{ كم}$' },
      { id: 'D', text: '$60\\text{ كم}$' },
    ],
    correctOption: 'B',
    difficulty: 'Easy',
    source: 'أسئلة الحركة والسرعة',
    explanation: `⏱️ **طريقة طرقع (تحويل الدقائق إلى كسور):**
الساعة فيها $60$ دقيقة.
الـ $20$ دقيقة تمثل: $\\frac{20}{60} = \\frac{1}{3}$ من الساعة (ثلث ساعة).
إذن المسافة المقطوعة = ثلث السرعة:
$$\\text{المسافة} = \\frac{120}{3} = 40\\text{ كم}$$
طرقعها في ثانية بدون قوانين معقدة!`,
  },
  {
    id: 'q8',
    categoryId: 'arithmetic',
    categoryTitle: 'الحساب والأعداد',
    topicTitle: 'المتتابعات والأنماط',
    questionText: 'أوجد الحد التالي في المتتابعة التالية: $$3 \\; , \\; 7 \\; , \\; 15 \\; , \\; 31 \\; , \\; \\dots$$',
    options: [
      { id: 'A', text: '$47$' },
      { id: 'B', text: '$55$' },
      { id: 'C', text: '$63$' },
      { id: 'D', text: '$64$' },
    ],
    correctOption: 'C',
    difficulty: 'Easy',
    source: 'الأنماط والمتتابعات',
    explanation: `🔍 **طريقة طرقع (اكتشاف النمط المضاعف):**
لاحظ الفروق بين الحدود:
- من $3$ إلى $7$: زيادة $+4$ ($2^2$)
- من $7$ إلى $15$: زيادة $+8$ ($2^3$)
- من $15$ إلى $31$: زيادة $+16$ ($2^4$)
إذن الزيادة التالية ستكون ضعف الـ $16$ أي $+32$:
$$31 + 32 = 63$$
💡 **أو بطريقة أخرى:** اضرب في $2$ واجمع $1$:
$$31 \\times 2 + 1 = 62 + 1 = 63$$`,
  },
  {
    id: 'q9',
    categoryId: 'comparisons',
    categoryTitle: 'المقارنات',
    topicTitle: 'الأسس مع الأعداد السالبة',
    questionText: 'إذا كان $x < 0$ (أي أن $x$ عدد سالب)، فقارن بين:\n\n**القيمة الأولى:** $(-x)^3$\n\n**القيمة الثانية:** $-x^3$',
    options: [
      { id: 'A', text: 'القيمة الأولى أكبر' },
      { id: 'B', text: 'القيمة الثانية أكبر' },
      { id: 'C', text: 'القيمتان متساويتان' },
      { id: 'D', text: 'المعطيات غير كافية' },
    ],
    correctOption: 'C',
    difficulty: 'Medium',
    source: 'فخاخ المقارنات',
    explanation: `🧠 **طريقة طرقع (فك الأقواس وإشارات الأسس):**
بما أن الأس فردي ($3$)، فإن:
$$(-x)^3 = (-1)^3 \\times x^3 = -1 \\times x^3 = -x^3$$
لاحظ أن الطرفين متطابقان جبرياً لأي قيمة حقيقية لـ $x$!
- جرب تعويض عدد: افترض $x = -2$.
- القيمة الأولى: $(-(-2))^3 = (2)^3 = 8$.
- القيمة الثانية: $-(-2)^3 = -(-8) = 8$.
القيمتان متساويتان دائماً، الجواب (ج)!`,
  },
  {
    id: 'q10',
    categoryId: 'geometry',
    categoryTitle: 'الهندسة والقياس',
    topicTitle: 'المساحات المظللة والدائرة',
    questionText: 'مربع طول ضلعه $14\\text{ سم}$، رسمت بداخله دائرة تمس أضلاعه الأربعة. ما هي مساحة الجزء المتبقي (المظلل) خارج الدائرة؟ (اعتبر $\\pi = \\frac{22}{7}$)',
    options: [
      { id: 'A', text: '$42\\text{ سم}^2$' },
      { id: 'B', text: '$44\\text{ سم}^2$' },
      { id: 'C', text: '$48\\text{ سم}^2$' },
      { id: 'D', text: '$52\\text{ سم}^2$' },
    ],
    correctOption: 'A',
    difficulty: 'Hard',
    source: 'أشهر أسئلة المظلل',
    svgDiagram: `<svg viewBox="0 0 200 200" class="w-44 h-44 mx-auto">
      <!-- Square -->
      <rect x="20" y="20" width="160" height="160" fill="#fef3c7" stroke="#f59e0b" stroke-width="3" rx="4"/>
      <!-- Circle -->
      <circle cx="100" cy="100" r="80" fill="#ffffff" stroke="#1e293b" stroke-width="2.5"/>
      <!-- Dimension -->
      <line x1="20" y1="190" x2="180" y2="190" stroke="#f59e0b" stroke-width="2"/>
      <text x="85" y="185" fill="#f59e0b" font-size="13" font-weight="bold">14 سم</text>
    </svg>`,
    explanation: `🌟 **قانون طرقع المباشر للمربع والدائرة المماسة:**
مساحة المنطقة المحصورة بين المربع والدائرة الداخلية المماسة = $\\frac{3}{14} \\times \\text{مساحة المربع}$ دائماً (عند $\\pi = \\frac{22}{7}$)!
- مساحة المربع = $14 \\times 14 = 196$.
- المساحة المظللة = $\\frac{3}{14} \\times (14 \\times 14) = 3 \\times 14 = 42\\text{ سم}^2$!
💡 **أو بالحساب المعتاد:**
مساحة المربع = $196$
نصف قطر الدائرة = $\\frac{14}{2} = 7$
مساحة الدائرة = $\\pi r^2 = \\frac{22}{7} \\times 49 = 154$
المظلل = $196 - 154 = 42\\text{ سم}^2$. قانون طرقع وفر عليك دقيقة كاملة!`,
  }
];
