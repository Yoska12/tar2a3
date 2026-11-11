import React, { useEffect, useState, useMemo } from 'react';
import { useExamStore } from '../store/examStore';
import { initializeQuestionData, loadBankQuestions, getAllQuestions, getAvailableCategories, bankMapping, categoryMapping, getAvailableExams } from '../utils/dataLoader';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
    Settings,
    PieChart,
    Target,
    FileText,
    ChevronDown,
    ChevronUp,
    X,
    AlertTriangle,
    ArrowLeft
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const StatsModal = ({ open, onOpenChange }) => {
    const {
        smartExamProgress,
        updateSmartExamProgress
    } = useExamStore();

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedBank, setExpandedBank] = useState(null);

    // Reset Logic State
    const [resetScope, setResetScope] = useState('all'); // 'all', 'bank', 'category'
    const [resetTarget, setResetTarget] = useState([]);
    const [focusedBank, setFocusedBank] = useState(null);
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);

    useEffect(() => {
        if (open) {
            const loadData = async () => {
                setLoading(true);
                try {
                    await initializeQuestionData();
                    let allQuestions = [];
                    if (typeof getAllQuestions === 'function') {
                        allQuestions = await getAllQuestions();
                    }
                    if (!allQuestions || allQuestions.length === 0) {
                        const categories = typeof getAvailableCategories === 'function' ? getAvailableCategories() : [{ key: 'search' }];
                        for (const cat of categories) {
                            const qs = typeof loadBankQuestions === 'function' ? await loadBankQuestions(cat.key) : [];
                            if (Array.isArray(qs)) allQuestions.push(...qs);
                        }
                    }
                    if (!allQuestions || allQuestions.length === 0) {
                        const searchQs = typeof loadBankQuestions === 'function' ? await loadBankQuestions('search') : [];
                        if (Array.isArray(searchQs)) allQuestions.push(...searchQs);
                    }
                    const validQuestions = (allQuestions || []).filter(q => q && (q.question !== undefined || q.image || q.image_url || q.choices || q.id));
                    setQuestions(validQuestions);
                } catch (err) {
                    console.error('Error loading questions for stats:', err);
                } finally {
                    setLoading(false);
                }
            };
            loadData();
        }
    }, [open]);

    const getExamsForBank = (bankKey) => {
        let exams = [];
        try {
            const res = getAvailableExams(bankKey);
            if (Array.isArray(res) && res.length > 0) {
                exams = res.map(e => (typeof e === 'string' ? { name: e } : { name: e.name || e.displayName || 'القسم الكمي' }));
            }
        } catch (e) { }

        if (exams.length === 0 && questions.length > 0) {
            const bankQuestions = questions.filter(q => (q.bank === bankKey || q.type === bankKey));
            const uniqueExamNames = Array.from(new Set(bankQuestions.map(q => q.exam || 'القسم الكمي')));
            exams = uniqueExamNames.map(name => ({ name }));
        }

        if (exams.length === 0) {
            exams = [{ name: 'القسم الكمي' }];
        }
        return exams;
    };

    const stats = useMemo(() => {
        if (!questions.length) return null;

        const completedExams = new Set((smartExamProgress || []).map(item => {
            if (typeof item === 'object' && item !== null) {
                return `${item.file}|${item.exam}`;
            }
            return String(item);
        }));

        const getCleanBankName = (key) => {
            if (!key) return 'بنك الأسئلة (القسم الكمي)';
            const str = String(key).trim();
            if (bankMapping[str]) return bankMapping[str];
            const cleanKey = str.replace(/\.json$/i, '');
            if (bankMapping[cleanKey]) return bankMapping[cleanKey];
            if (cleanKey.toLowerCase().includes('search') || cleanKey.toLowerCase().includes('math1') || cleanKey === 'الكمي' || cleanKey === 'قدرات - كمي' || cleanKey === 'search/search') {
                return 'بنك الأسئلة (القسم الكمي)';
            }
            return cleanKey;
        };

        const normalizeBankKey = (rawKey) => {
            if (!rawKey) return 'search';
            const clean = String(rawKey).replace(/\.json$/i, '').trim();
            if (clean.toLowerCase().includes('search') || clean.toLowerCase().includes('math1')) return 'search';
            return clean;
        };

        let total = 0;
        let answered = 0;

        // Category Stats
        const categoryStats = {};
        Object.keys(categoryMapping).forEach(arName => {
            const key = categoryMapping[arName];
            categoryStats[key] = { name: getCleanBankName(arName), total: 0, answered: 0, key };
        });

        // File/Bank Stats
        const fileStats = {};

        questions.forEach(q => {
            const rawBank = q.bank || q.type || 'search';
            const bankKey = normalizeBankKey(rawBank);
            total++;

            const examName = q.exam || 'القسم الكمي';
            const compositeKey = `${bankKey}|${examName}`;
            const isAnswered = completedExams.has(compositeKey) || completedExams.has(String(q.id)) || completedExams.has(`${rawBank}|${examName}`);

            if (isAnswered) answered++;

            const rawCategory = q.category || q.type || 'search';
            const categoryKey = categoryMapping[rawCategory] || (rawCategory === 'قدرات - كمي' || rawCategory === 'search' ? 'search' : rawCategory);
            const categoryName = getCleanBankName(rawCategory);

            if (!categoryStats[categoryKey]) {
                categoryStats[categoryKey] = {
                    name: categoryName,
                    total: 0,
                    answered: 0,
                    key: categoryKey
                };
            }

            categoryStats[categoryKey].total++;
            if (isAnswered) {
                categoryStats[categoryKey].answered++;
            }

            if (!fileStats[bankKey]) {
                fileStats[bankKey] = {
                    name: getCleanBankName(bankKey),
                    total: 0,
                    answered: 0,
                    key: bankKey,
                    exams: {}
                };
            }

            fileStats[bankKey].total++;

            if (!fileStats[bankKey].exams[examName]) {
                fileStats[bankKey].exams[examName] = {
                    name: examName,
                    total: 0,
                    answered: 0
                };
            }

            fileStats[bankKey].exams[examName].total++;

            if (isAnswered) {
                fileStats[bankKey].answered++;
                fileStats[bankKey].exams[examName].answered++;
            }
        });

        return {
            total,
            answered,
            progress: total > 0 ? (answered / total) * 100 : 0,
            categories: Object.values(categoryStats).filter(c => c.total > 0),
            files: Object.values(fileStats).filter(f => f.total > 0)
        };

    }, [questions, smartExamProgress]);

    const handleConfirmResetSmartExam = async () => {
        if (!isConfirmingReset) {
            setIsConfirmingReset(true);
            return;
        }

        let newProgress = [...(smartExamProgress || [])];

        if (resetScope === 'all') {
            newProgress = [];
        } else if (resetScope === 'bank') {
            const bankSelections = resetTarget.filter(t => t.startsWith('BANK:'));
            const examSelections = resetTarget.filter(t => t.startsWith('EXAM:'));

            // 1. Remove entire banks
            if (bankSelections.length > 0) {
                const banksToRemove = bankSelections.map(t => t.split(':')[1]);
                newProgress = newProgress.filter(item => {
                    if (typeof item === 'object' && item !== null) {
                        return !banksToRemove.includes(item.file);
                    }
                    const parts = String(item).split('-');
                    const bankKey = parts[0];
                    return !banksToRemove.includes(bankKey);
                });
            }

            // 2. Remove specific exams
            if (examSelections.length > 0) {
                examSelections.forEach(target => {
                    const parts = target.split(':');
                    const bankKey = parts[1];
                    const examName = parts.slice(2).join(':');

                    newProgress = newProgress.filter(item => {
                        if (typeof item === 'object' && item !== null) {
                            return !(item.file === bankKey && item.exam === examName);
                        }
                        return true;
                    });
                });
            }

        } else if (resetScope === 'category') {
            const categoriesToRemove = new Set(resetTarget);
            const questionIdMap = new Map(questions.map(q => [String(q.id), q.category || q.type]));

            newProgress = newProgress.filter(item => {
                if (typeof item === 'object' && item !== null) {
                    return !categoriesToRemove.has(item.file);
                }
                const cat = questionIdMap.get(String(item));
                return !categoriesToRemove.has(cat);
            });
        }

        if (updateSmartExamProgress) {
            updateSmartExamProgress(newProgress);
        }
        toast.success("تم إعادة تعيين التقدم بنجاح");

        // Reset local selection state
        setResetScope('all');
        setResetTarget([]);
        setFocusedBank(null);
        setIsConfirmingReset(false);
    };

    return (
        <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-full max-w-[100vw] h-[90vh] md:h-[95vh] md:w-[60vw] md:max-w-[98vw] flex flex-col p-0 gap-0 bg-[#020817] md:border border-slate-800 text-slate-100 shadow-2xl overflow-hidden rounded-t-2xl md:rounded-xl"
                dir="rtl"
            >
                {/* Header */}
                <DialogHeader className="p-4 md:p-6 border-b border-slate-800 bg-slate-900/50 shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl md:text-3xl font-bold flex items-center gap-3 text-slate-50">
                            <div className="p-1.5 md:p-2 bg-cyan-500/10 rounded-lg">
                                <Settings className="h-6 w-6 md:h-8 md:w-8 text-cyan-400" />
                            </div>
                            <span>لوحة الإحصائيات</span>
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            عرض إحصائيات وتقدم الاختبارات
                        </DialogDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full cursor-pointer h-8 w-8 md:h-10 md:w-10"
                    >
                        <X className="h-5 w-5 md:h-6 md:w-6" />
                    </Button>
                </DialogHeader>

                {/* Tabs & Content */}
                <Tabs defaultValue="stats" className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8" dir="rtl">
                        <TabsContent value="stats" className="mt-0 space-y-6 md:space-y-8 animate-in fade-in-50 duration-300">

                            {/* Overall Progress Card */}
                            <Card className="bg-gradient-to-br from-slate-900 to-slate-900 border-slate-700 shadow-lg">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xl md:text-2xl flex items-center gap-3 text-cyan-400">
                                        <Target className="h-6 w-6 md:h-7 md:w-7" />
                                        <span>التقدم الكلي</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col md:flex-row justify-between items-end mb-4 gap-2">
                                        <div className="text-base md:text-lg text-slate-300 font-medium">
                                            تمت الاجابة على <span className="text-cyan-400 font-bold text-lg md:text-xl mx-1">{stats?.answered || 0}</span>
                                            من أصل <span className="text-slate-100 font-bold text-lg md:text-xl mx-1">{stats?.total || 0}</span> سؤال
                                        </div>
                                        <div className="text-2xl md:text-3xl font-extrabold text-cyan-500 tracking-tight">
                                            {Math.round(stats?.progress || 0)}%
                                        </div>
                                    </div>
                                    <Progress
                                        value={stats?.progress || 0}
                                        className="h-5 md:h-6 bg-slate-800 rounded-full border border-slate-700/50"
                                        indicatorClassName="bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-500"
                                    />
                                </CardContent>
                            </Card>

                            {/* Detailed Stats Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

                                {/* Bank/File Stats */}
                                <Card className="bg-slate-900/50 border-slate-800 shadow-md h-full">
                                    <CardHeader className="pb-4 md:pb-6 border-b border-slate-800/50">
                                        <CardTitle className="text-lg md:text-xl flex items-center gap-3 text-green-400">
                                            <FileText className="h-5 w-5 md:h-6 md:w-6" />
                                            <span>الإحصائيات حسب الملف</span>
                                        </CardTitle>
                                        <CardDescription className="text-slate-400 text-xs md:text-sm">
                                            اضغط على الملف لعرض تفاصيل الاختبارات
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-4 md:pt-6">
                                        {stats?.files.map((file) => (
                                            <div key={file.key} className="space-y-3 bg-slate-950/50 p-3 md:p-4 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-all">
                                                <div
                                                    className="cursor-pointer"
                                                    onClick={() => setExpandedBank(expandedBank === file.key ? null : file.key)}
                                                >
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div className="flex items-center gap-2 md:gap-3">
                                                            <div className={`p-1 rounded-md ${expandedBank === file.key ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                                                                {expandedBank === file.key ? <ChevronUp className="h-3 w-3 md:h-4 md:w-4" /> : <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />}
                                                            </div>
                                                            <span className="font-semibold text-slate-200 text-sm md:text-base">
                                                                {file.name}
                                                                <span className="text-xs text-slate-400 mr-2">({file.answered}/{file.total})</span>
                                                            </span>
                                                        </div>
                                                        <div className="text-xs md:text-sm font-bold text-green-500">
                                                            {file.total > 0 ? Math.round((file.answered / file.total) * 100) : 0}%
                                                        </div>
                                                    </div>
                                                    <Progress
                                                        value={file.total > 0 ? (file.answered / file.total) * 100 : 0}
                                                        className="h-2 md:h-2.5 bg-slate-800"
                                                        indicatorClassName="bg-green-500"
                                                    />
                                                </div>

                                                {/* Drill-down View (Exams) */}
                                                {expandedBank === file.key && (
                                                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-3 animate-in slide-in-from-top-2 duration-200 p-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                        {Object.values(file.exams).map((exam) => (
                                                            <div key={exam.name} className="pr-4 border-r-2 border-slate-800">
                                                                <div className="flex justify-between text-xs md:text-sm mb-1.5 text-slate-400">
                                                                    <span>{exam.name}</span>
                                                                    <span className="font-mono ml-3">{exam.answered}/{exam.total}</span>
                                                                </div>
                                                                <Progress
                                                                    value={exam.total > 0 ? (exam.answered / exam.total) * 100 : 0}
                                                                    className="h-1.5 bg-slate-800"
                                                                    indicatorClassName="bg-cyan-500/70"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                {/* Category Stats */}
                                <Card className="bg-slate-900/50 border-slate-800 shadow-md h-full">
                                    <CardHeader className="pb-4 md:pb-6 border-b border-slate-800/50">
                                        <CardTitle className="text-lg md:text-xl flex items-center gap-3 text-yellow-400">
                                            <PieChart className="h-5 w-5 md:h-6 md:w-6" />
                                            <span>الإحصائيات حسب النوع</span>
                                        </CardTitle>
                                        <CardDescription className="text-slate-400 text-xs md:text-sm">
                                            توزيع تقدمك في كل نوع من الأسئلة
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pt-4 md:pt-6">
                                        {stats?.categories.map((cat) => (
                                            <div key={cat.key} className="group">
                                                <div className="flex justify-between text-sm md:text-base mb-2 font-medium">
                                                    <span className="text-slate-200 group-hover:text-yellow-400 transition-colors">{cat.name}</span>
                                                    <span className="text-white">
                                                        {cat.total > 0 ? Math.round((cat.answered / cat.total) * 100) : 0}%
                                                        <span className="text-xs text-slate-400 mr-2">({cat.answered}/{cat.total})</span>
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={cat.total > 0 ? (cat.answered / cat.total) * 100 : 0}
                                                    className="h-2.5 md:h-3 bg-slate-800"
                                                    indicatorClassName="bg-yellow-500 group-hover:bg-yellow-400 transition-all"
                                                />
                                            </div>
                                        ))}
                                    </CardContent>

                                    {/* Reset smart exam progress */}
                                    <Card className="bg-slate-900/50 border-slate-800 shadow-md mt-6">
                                        <CardHeader className="pb-4 md:pb-6 border-b border-slate-800/50">
                                            <CardTitle className="text-lg md:text-xl flex items-center gap-3 text-red-500">
                                                <AlertTriangle className="h-5 w-5 md:h-6 md:w-6" />
                                                <span>إعادة تعيين التقدم</span>
                                            </CardTitle>
                                            <CardDescription className="text-slate-400 text-xs md:text-sm">
                                                اختر ماذا تريد أن تعيد تعيينه. لا يمكن التراجع عن هذا الإجراء.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-4 md:pt-6">
                                            {/* Scope Selection */}
                                            <div className="space-y-3">
                                                <div className="flex rounded-lg bg-slate-950/50 p-1 border border-slate-800">
                                                    <button
                                                        onClick={() => { setResetScope('all'); setResetTarget([]); }}
                                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${resetScope === 'all' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        الكل
                                                    </button>
                                                    <button
                                                        onClick={() => { setResetScope('bank'); setResetTarget([]); }}
                                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${resetScope === 'bank' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        حسب الملف
                                                    </button>
                                                    <button
                                                        onClick={() => { setResetScope('category'); setResetTarget([]); }}
                                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${resetScope === 'category' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        حسب النوع
                                                    </button>
                                                </div>

                                                {/* Hierarchical Selection for Bank */}
                                                {resetScope === 'bank' && (
                                                    <ScrollArea dir="rtl" className="h-[315px] w-full rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                                                        {!focusedBank ? (
                                                            // Level 1: Bank List
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                {Object.entries(bankMapping).map(([key, name]) => {
                                                                    const isFullSelect = resetTarget.includes(`BANK:${key}`);
                                                                    const partialCount = resetTarget.filter(t => t.startsWith(`EXAM:${key}:`)).length;
                                                                    const isSelected = isFullSelect || partialCount > 0;

                                                                    return (
                                                                        <div
                                                                            key={key}
                                                                            className={`flex items-center justify-between space-x-3 space-x-reverse rounded-xl border p-4 transition-all duration-200 cursor-pointer group
                                                                                ${isSelected ? 'bg-cyan-900/20 border-cyan-500/50' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}
                                                                            `}
                                                                            onClick={() => { setFocusedBank(key); setIsConfirmingReset(false); }}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div>
                                                                                    <div className="font-bold text-slate-200 group-hover:text-white transition-colors">{name}</div>
                                                                                    {isFullSelect && <div className="text-xs text-green-400 font-medium">سيتم حذف الملف كامل</div>}
                                                                                    {!isFullSelect && partialCount > 0 && <div className="text-xs text-yellow-400 font-medium">{partialCount} اختبارات محددة</div>}
                                                                                </div>
                                                                            </div>
                                                                            <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            // Level 2: Bank Details
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                                                                    <Button
                                                                        onClick={() => setFocusedBank(null)}
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                                                                    >
                                                                        <ArrowLeft className="h-5 w-5 rotate-180" />
                                                                    </Button>
                                                                    <span className="font-bold text-lg text-white">{bankMapping[focusedBank]}</span>
                                                                </div>

                                                                {/* Option 1: Delete Whole Bank */}
                                                                <div
                                                                    className={`flex items-center space-x-3 space-x-reverse rounded-xl border p-4 transition-all duration-200 cursor-pointer
                                                                        ${resetTarget.includes(`BANK:${focusedBank}`) ? 'bg-red-500/10 border-red-500/50' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}
                                                                    `}
                                                                    onClick={() => {
                                                                        const bankKey = focusedBank;
                                                                        const fullKey = `BANK:${bankKey}`;
                                                                        setResetTarget(prev => {
                                                                            if (prev.includes(fullKey)) {
                                                                                return prev.filter(t => t !== fullKey);
                                                                            } else {
                                                                                const clean = prev.filter(t => !t.startsWith(`EXAM:${bankKey}:`));
                                                                                return [...clean, fullKey];
                                                                            }
                                                                        });
                                                                        setIsConfirmingReset(false);
                                                                    }}
                                                                >
                                                                    <Checkbox
                                                                        checked={resetTarget.includes(`BANK:${focusedBank}`)}
                                                                        className="h-5 w-5 border-slate-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 pointer-events-none"
                                                                    />
                                                                    <div className="mr-3">
                                                                        <div className="font-bold text-slate-200">حذف الملف بالكامل</div>
                                                                        <div className="text-xs text-slate-400">سيتم إعادة تعيين جميع الاختبارات في هذا الملف</div>
                                                                    </div>
                                                                </div>

                                                                <div className="relative flex py-2 items-center">
                                                                    <div className="flex-grow border-t border-slate-800"></div>
                                                                    <span className="flex-shrink-0 mx-4 text-slate-500 text-xs">أو اختر اختبارات محددة</span>
                                                                    <div className="flex-grow border-t border-slate-800"></div>
                                                                </div>

                                                                {/* Option 2: Specific Exams (fetched dynamically) */}
                                                                <div className={`grid grid-cols-1 gap-2 ${resetTarget.includes(`BANK:${focusedBank}`) ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                                                    {getExamsForBank(focusedBank).map((exam) => {
                                                                        const itemKey = `EXAM:${focusedBank}:${exam.name}`;
                                                                        const isSelected = resetTarget.includes(itemKey);
                                                                        const examName = exam.name;

                                                                        return (
                                                                            <div
                                                                                key={examName}
                                                                                className={`flex items-center space-x-3 space-x-reverse rounded-lg border p-3 transition-all duration-200 cursor-pointer
                                                                                    ${isSelected ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}
                                                                                `}
                                                                                onClick={() => {
                                                                                    setResetTarget(prev => {
                                                                                        if (prev.includes(itemKey)) {
                                                                                            return prev.filter(t => t !== itemKey);
                                                                                        } else {
                                                                                            return [...prev, itemKey];
                                                                                        }
                                                                                    });
                                                                                    setIsConfirmingReset(false);
                                                                                }}
                                                                            >
                                                                                <Checkbox
                                                                                    checked={isSelected}
                                                                                    className="h-4 w-4 border-slate-500 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 pointer-events-none"
                                                                                />
                                                                                <span className="mr-3 font-medium text-slate-300">{examName}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </ScrollArea>
                                                )}

                                                {/* Sub-Selection for Category */}
                                                {resetScope === 'category' && (
                                                    <ScrollArea dir="rtl" className="h-[315px] w-full rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {Object.keys(categoryMapping).map((key) => {
                                                                const value = categoryMapping[key];
                                                                const isSelected = resetTarget.includes(value);
                                                                return (
                                                                    <div
                                                                        key={key}
                                                                        className={`flex items-center space-x-3 space-x-reverse rounded-xl border p-4 transition-all duration-200 cursor-pointer group
                                                                            ${isSelected
                                                                                ? 'bg-yellow-500/10 border-yellow-500/50'
                                                                                : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'
                                                                            }`}
                                                                        onClick={() => {
                                                                            setResetTarget(prev =>
                                                                                prev.includes(value) ? prev.filter(k => k !== value) : [...prev, value]
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Checkbox
                                                                            id={`cat-${value}`}
                                                                            checked={isSelected}
                                                                            className="h-5 w-5 border-slate-500 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500 pointer-events-none"
                                                                        />
                                                                        <Label
                                                                            htmlFor={`cat-${value}`}
                                                                            className="text-base font-medium cursor-pointer flex-1 mr-3 text-slate-200 group-hover:text-white pointer-events-none"
                                                                        >
                                                                            {key}
                                                                        </Label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </ScrollArea>
                                                )}
                                            </div>

                                            <div className="flex flex-col sm:flex-row-reverse gap-3 mt-6">
                                                <Button
                                                    onClick={handleConfirmResetSmartExam}
                                                    disabled={(resetScope !== 'all' && resetTarget.length === 0)}
                                                    className={`flex-1 font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                                                        ${isConfirmingReset ? 'bg-red-800 hover:bg-red-900 text-white animate-pulse' : 'bg-red-600 hover:bg-red-700 text-black hover:text-white'}
                                                    `}
                                                >
                                                    {isConfirmingReset ? 'هل أنت متأكد؟ اضغط للتأكيد' : 'إعادة تعيين'}
                                                </Button>
                                                {isConfirmingReset && (
                                                    <Button
                                                        onClick={() => setIsConfirmingReset(false)}
                                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold backdrop-blur-sm border border-slate-500 rounded-xl shadow-lg cursor-pointer"
                                                    >
                                                        إلغاء
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Card>
                            </div>
                        </TabsContent>
                    </div>

                </Tabs>
            </DialogContent >
        </Dialog >
    );
};

export default StatsModal;