import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Zap, Target, Flame } from 'lucide-react';

const ThemeDock = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    let currentTheme = 'blue';
    if (currentPath.includes('/tiger')) {
        currentTheme = 'green';
    } else if (currentPath.includes('/exam')) {
        currentTheme = 'orange';
    }

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const themes = [
        {
            id: 'tarqa',
            label: 'محاكي الطرقعة',
            subtitle: 'المحاكي الشامل',
            badgeBg: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300',
            url: '/simulation/?admin=true',
            selected: currentTheme === 'blue',
            icon: Zap
        },
        {
            id: 'exam',
            label: 'تحديد المستوى',
            subtitle: 'تشخيص القدرات',
            badgeBg: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
            url: '/exam/?admin=true',
            selected: currentTheme === 'orange',
            icon: Target
        },
        {
            id: 'tiger',
            label: 'محاكي نمر',
            subtitle: 'نماذج وتجميعات',
            badgeBg: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300',
            url: '/tiger/?admin=true',
            selected: currentTheme === 'green',
            icon: Flame
        },
    ];

    return (
        <div className="relative font-cairo z-40" dir="rtl" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-md transition-all cursor-pointer text-xs sm:text-sm font-bold"
                title="التنقل بين المحاكيات الثلاثة"
            >
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="hidden sm:inline">التنقل بين المحاكيات</span>
                <span className="sm:hidden">المحاكيات</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div 
                    className="absolute top-full right-0 mt-2 min-w-[210px] bg-slate-950/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150"
                >
                    {themes.map((t) => {
                        const IconComponent = t.icon;
                        return (
                            <a
                                key={t.id}
                                href={t.url}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer border ${
                                    t.selected
                                        ? 'bg-cyan-500/20 border-cyan-400/60 shadow-lg'
                                        : 'border-transparent hover:bg-white/5 hover:border-slate-700'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${t.badgeBg}`}>
                                    <IconComponent className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-right leading-none">
                                    <span className={`text-xs font-black ${t.selected ? 'text-white' : 'text-slate-200'}`}>
                                        {t.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-1">
                                        {t.subtitle}
                                    </span>
                                </div>
                                {t.selected && (
                                    <span className="mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                                        نشط
                                    </span>
                                )}
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ThemeDock;
