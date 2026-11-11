import React, { useEffect, useState, useMemo } from 'react';
import { useExamStore } from '../store/examStore';
import { initializeQuestionData, bankMapping, categoryMapping } from '../utils/dataLoader';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Settings,
    PieChart,
    Target,
    FileText,
    RefreshCw,
    HelpCircle,
    Filter,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    Check,
    Trash,
    X
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const StatsModal = ({ open, onOpenChange, handleResetSmartExamFromSettings }) => {
    const {
        smartExamProgress,
        isSmartExamEnabled,
        toggleSmartExam,
        selectedBanks,
        toggleBankSelection,
        selectAllBanks,
        deselectAllBanks
    } = useExamStore();

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedBank, setExpandedBank] = useState(null);

    const uniqueBanks = useMemo(() => {
        const seenNames = new Set();
        const entries = [];
        Object.entries(bankMapping || {}).forEach(([key, name]) => {
            const cleanKey = String(key).replace(/\.json$/i, '').trim();
            const cleanName = (typeof name === 'string' && name.trim()) ? name.trim() : 'بنك الأسئلة (القسم الكمي)';
            if (!seenNames.has(cleanName)) {
                seenNames.add(cleanName);
                entries.push([cleanKey, cleanName]);
            }
        });
        return entries.length > 0 ? entries : [['search', 'بنك الأسئلة (القسم الكمي)']];
    }, [bankMapping]);

    useEffect(() => {
        if (open) {
            const loadData = async () => {
                setLoading(true);
                try {
                    const pools = await initializeQuestionData({ forceLoadQuestions: true });
                    const allQuestions = Array.isArray(pools) ? pools : Object.values(pools || {}).flat();
                    const validQuestions = allQuestions.filter(q => q && (q.question !== undefined || q.image || q.image_url || q.choices || q.id));
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

    const stats = useMemo(() => {
        if (!questions.length) return null;

        const answeredIdsSet = new Set((smartExamProgress || []).map(item => {
            if (typeof item === 'object' && item !== null) {
                return String(item.id || item.questionId || item.question_number || '');
            }
            return String(item);
        }).filter(id => id && id.length > 0 && id !== 'undefined' && id !== 'null'));

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

            const isAnswered = answeredIdsSet.has(String(q.id));

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
                    categories: {}
                };
            }

            fileStats[bankKey].total++;
            if (isAnswered) {
                fileStats[bankKey].answered++;
            }

            if (!fileStats[bankKey].categories[categoryKey]) {
                fileStats[bankKey].categories[categoryKey] = {
                    name: categoryName,
                    total: 0,
                    answered: 0,
                    key: categoryKey
                };
            }

            fileStats[bankKey].categories[categoryKey].total++;
            if (isAnswered) {
                fileStats[bankKey].categories[categoryKey].answered++;
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
                            <div className="p-1.5 md:p-2 bg-orange-500/10 rounded-lg">
                                <Settings className="h-6 w-6 md:h-8 md:w-8 text-orange-400" />
                            </div>
                            <span>لوحة التحكم والإحصائيات</span>
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            لوحة التحكم وإحصائيات تقدم الاختبارات
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
                    <div className="px-4 py-3 md:px-6 md:py-4 bg-slate-900/30 border-b border-slate-800 shrink-0">
                        <TabsList className="grid w-full grid-cols-2 h-10 md:h-14 bg-slate-950 p-1">
                            <TabsTrigger
                                value="settings"
                                className="hover:text-white h-full text-sm md:text-lg font-bold text-slate-500 data-[state=active]:bg-orange-600 data-[state=active]:text-white transition-all cursor-pointer"
                            >
                                <Settings className="h-4 w-4 md:h-5 md:w-5 ml-2" />
                                إعدادات الاختبار
                            </TabsTrigger>
                            <TabsTrigger
                                value="stats"
                                className="hover:text-white h-full text-sm md:text-lg font-bold text-slate-500 data-[state=active]:bg-orange-600 data-[state=active]:text-white transition-all cursor-pointer"
                            >
                                <PieChart className="h-4 w-4 md:h-5 md:w-5 ml-2" />
                                الإحصائيات العامة
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8" dir="rtl">
                        <TabsContent value="stats" className="mt-0 space-y-6 md:space-y-8 animate-in fade-in-50 duration-300">

                            {/* Overall Progress Card */}
                            <Card className="bg-gradient-to-br from-slate-900 to-slate-900 border-slate-700 shadow-lg">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xl md:text-2xl flex items-center gap-3 text-orange-400">
                                        <Target className="h-6 w-6 md:h-7 md:w-7" />
                                        <span>التقدم الكلي</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col md:flex-row justify-between items-end mb-4 gap-2">
                                        <div className="text-base md:text-lg text-slate-300 font-medium">
                                            تمت الاجابة على <span className="text-orange-400 font-bold text-lg md:text-xl mx-1">{stats?.answered || 0}</span>
                                            من أصل <span className="text-slate-100 font-bold text-lg md:text-xl mx-1">{stats?.total || 0}</span> سؤال
                                        </div>
                                        <div className="text-2xl md:text-3xl font-extrabold text-orange-500 tracking-tight">
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
                                            اضغط على الملف لعرض التفاصيل الدقيقة
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

                                                {/* Drill-down View */}
                                                {expandedBank === file.key && (
                                                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                        {Object.values(file.categories).filter(c => c.total > 0).map((cat) => (
                                                            <div key={cat.name} className="pr-4 border-r-2 border-slate-800">
                                                                <div className="flex justify-between text-xs md:text-sm mb-1.5 text-slate-400">
                                                                    <span>{cat.name}</span>
                                                                    <span className="font-mono">{cat.answered}/{cat.total}</span>
                                                                </div>
                                                                <Progress
                                                                    value={cat.total > 0 ? (cat.answered / cat.total) * 100 : 0}
                                                                    className="h-1.5 bg-slate-800"
                                                                    indicatorClassName="bg-orange-500/70"
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
                                </Card>

                            </div>
                        </TabsContent>

                        <TabsContent value="settings" className="mt-0 space-y-6 md:space-y-8 animate-in fade-in-50 duration-300">
                            {/* Sources Settings */}
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg md:text-xl flex items-center gap-3 text-yellow-400">
                                        <Filter className="h-5 w-5 md:h-6 md:w-6" />
                                        <span>مصدر الأسئلة</span>
                                    </CardTitle>
                                    <CardDescription className="text-slate-400 text-sm md:text-base">
                                        حدد الملفات التي تريد أن تظهر منها الأسئلة في الإختبار
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-row gap-2 md:gap-3 mb-4 md:mb-6">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={selectAllBanks}
                                            className="flex-1 font-bold bg-orange-600 border border-cyan-600 hover:border-yellow-400/50 hover:bg-slate-800 hover:text-yellow-400 transition-all duration-300 ease-in-out cursor-pointer text-xs md:text-sm h-9 md:h-11"
                                        >
                                            <Check className="w-3 h-3 md:w-4 md:h-4 ml-2" />
                                            تحديد الكل
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={deselectAllBanks}
                                            className="flex-1 font-bold bg-orange-600 border border-cyan-600 hover:border-red-400/50 hover:bg-slate-800 hover:text-red-400 transition-all duration-300 ease-in-out cursor-pointer text-xs md:text-sm h-9 md:h-11"
                                        >
                                            الغاء تحديد الكل
                                        </Button>
                                    </div>

                                    <ScrollArea dir="rtl" className="h-[315px] w-full rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {uniqueBanks.map(([key, name]) => {
                                                const isSelected = selectedBanks?.includes(key) || selectedBanks?.includes('search') || (!selectedBanks || selectedBanks.length === 0);
                                                return (
                                                    <div
                                                        key={key}
                                                        className={`flex items-center space-x-3 space-x-reverse rounded-xl border p-4 transition-all duration-200 cursor-pointer group
                                                                ${isSelected
                                                                ? 'bg-yellow-500/10 border-yellow-500/50'
                                                                : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'
                                                            }`}
                                                        onClick={() => toggleBankSelection(key)}
                                                    >
                                                        <Checkbox
                                                            id={`bank-${key}`}
                                                            checked={isSelected}
                                                            className="h-5 w-5 border-slate-500 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500 pointer-events-none"
                                                        />
                                                        <Label
                                                            htmlFor={`bank-${key}`}
                                                            className="text-base font-medium cursor-pointer flex-1 mr-3 text-slate-200 group-hover:text-white pointer-events-none"
                                                        >
                                                            {name}
                                                        </Label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            {/* Smart Exam Settings */}
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-xl flex items-center gap-3 text-orange-400">
                                        <RefreshCw className="h-6 w-6" />
                                        <span>نظام الاختبار الذكي</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between p-6 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50">
                                        <div className="space-y-1.5">
                                            <Label className="text-lg font-bold text-slate-100">وضع عدم التكرار
                                                {isSmartExamEnabled ? ' (مفعل)' : ' (معطل)'}
                                            </Label>
                                            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                                                عند تفعيل هذا الخيار، سيقوم النظام تلقائياً باستبعاد الأسئلة التي قمت بالإجابة عليها سابقاً، لضمان عرض أسئلة جديدة دائماً.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={toggleSmartExam}
                                            variant=""
                                            className="p-2 h-auto rounded-full transition-all duration-300 transform hover:scale-110 hover:bg-tran bg-trans cursor-pointer"
                                        >
                                            <CheckCircle className={`h-10 w-10 ${isSmartExamEnabled ? 'text-orange-400' : 'text-slate-600'}`} />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* reset Exam Settings */}
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-xl flex items-center gap-3 text-orange-400">
                                        <Trash className="h-6 w-6" />
                                        <span>إعادة تعيين التقدم</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between p-6 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50">
                                        <div className="space-y-1.5">
                                            <Label className="text-lg font-bold text-slate-100">إعادة تعيين التقدم
                                            </Label>
                                            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                                                يتم إعادة تعيين التقدم لجميع الانواع والملفات من هنا
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleResetSmartExamFromSettings}
                                            variant=""
                                            className="p-2 h-auto rounded-full transition-all duration-300 transform hover:scale-110 hover:bg-tran bg-trans cursor-pointer"
                                        >
                                            <Trash className={`text-red-500 h-10 w-10`} />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Info Card */}
                            <Card className="bg-blue-950/20 border-blue-900/30">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg flex items-center gap-2 text-blue-400">
                                        <HelpCircle className="h-5 w-5" />
                                        <span>ملاحظات هامة</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-base text-slate-400">
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-1.5">•</span>
                                        <p>يتم حفظ تقدمك تلقائياً بعد كل اختبار.</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-1.5">•</span>
                                        <p>يمكنك إعادة تعيين تقدمك بالكامل من الشاشة الرئيسية إذا رغبت في البدء من جديد.</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-1.5">•</span>
                                        <p>الإحصائيات المعروضة تشمل جميع الأسئلة المتوفرة في الموقع.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog >
    );
};

export default StatsModal;