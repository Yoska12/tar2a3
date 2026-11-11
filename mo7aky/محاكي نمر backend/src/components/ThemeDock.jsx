import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ThemeDock = () => {
    const [isOpen, setIsOpen] = useState(false);

    const currentPort = typeof window !== 'undefined' ? window.location.port : '';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    // Determine active simulator
    let currentTheme = 'blue'; // default: محاكي الطرقعة (الأزرق)
    if (currentPort === '5174' || currentPath.includes('/tiger')) {
        currentTheme = 'green'; // محاكي نمر (الأخضر)
    } else if (currentPort === '5175' || currentPath.includes('/exam')) {
        currentTheme = 'orange'; // تحديد المستوى (البرتقالي)
    }

    const getSimulatorUrl = (targetTheme) => {
        if (typeof window === 'undefined') return '/';
        const host = window.location.hostname || 'localhost';
        const port = window.location.port;
        const protocol = window.location.protocol || 'http:';

        // Check if we are running locally (localhost, 127.0.0.1, LAN IP, or dev ports)
        const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host) || 
                        host.startsWith('192.168.') || 
                        host.startsWith('10.') || 
                        ['5173', '5174', '5175'].includes(port);

        if (isLocal) {
            if (targetTheme === 'blue') return `${protocol}//${host}:5173/`;
            if (targetTheme === 'green') return `${protocol}//${host}:5174/`;
            if (targetTheme === 'orange') return `${protocol}//${host}:5175/`;
        }

        // In production on Tarqa platform:
        if (targetTheme === 'blue') return '/simulation/';
        if (targetTheme === 'green') return '/tiger/';
        if (targetTheme === 'orange') return '/exam/';
        return '/';
    };

    const themes = [
        {
            id: 'محاكي الطرقعة',
            title: 'محاكي الطرقعة (الأزرق)',
            image: '/blue.png',
            glowColor: 'blue',
            url: getSimulatorUrl('blue'),
            selected: currentTheme === 'blue',
        },
        {
            id: 'محاكي نمر',
            title: 'محاكي نمر (الأخضر)',
            image: '/green.png',
            glowColor: 'green',
            url: getSimulatorUrl('green'),
            selected: currentTheme === 'green',
        },
        {
            id: 'تحديد المستوى',
            title: 'تحديد المستوى (البرتقالي)',
            image: '/orange.png',
            glowColor: 'orange',
            url: getSimulatorUrl('orange'),
            selected: currentTheme === 'orange',
        },
    ];

    const getSelectedStyle = (theme) => {
        if (!theme.selected) return {};
        const colors = {
            orange: {
                glow: 'rgba(245, 158, 11, 0.9)',
                glowOuter: 'rgba(217, 119, 6, 0.6)',
            },
            green: {
                glow: 'rgba(34, 197, 94, 0.9)',
                glowOuter: 'rgba(22, 163, 74, 0.6)',
            },
            blue: {
                glow: 'rgba(56, 189, 248, 0.9)',
                glowOuter: 'rgba(37, 99, 235, 0.6)',
            },
        };
        const c = colors[theme.glowColor] || colors.blue;
        return {
            filter: `drop-shadow(0 0 8px ${c.glow}) drop-shadow(0 0 16px ${c.glowOuter})`,
        };
    };

    return (
        <>
            <style>{`
                @keyframes selectedGlow {
                    0%, 100% {
                        transform: scale(1.15);
                        filter: brightness(1.1);
                    }
                    50% {
                        transform: scale(1.25);
                        filter: brightness(1.25);
                    }
                }
                .selected-theme-btn {
                    animation: selectedGlow 2s ease-in-out infinite;
                }
            `}</style>

            {/* Mobile Version - Vertical */}
            <div className="md:hidden relative flex flex-col items-center">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-white/10 backdrop-blur-md border border-white/30 shadow-xl px-2.5 py-2.5 cursor-pointer select-none transition-all duration-300 hover:bg-white/25 rounded-full"
                    title="التنقل بين المحاكيات"
                >
                    <ChevronDown
                        className={`h-5 w-5 text-cyan-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>

                <div
                    className={`flex flex-col items-center gap-4 mt-3 transition-all duration-300 ease-in-out overflow-visible ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none h-0'}`}
                    style={{ clipPath: isOpen ? 'inset(-100px -100px -100px -100px)' : 'inset(0 0 100% 0)' }}
                >
                    {themes.map((theme) => (
                        <a
                            key={theme.id}
                            href={theme.url}
                            style={getSelectedStyle(theme)}
                            className={`
                                relative transition-all duration-300 ease-out transform cursor-pointer flex items-center justify-center
                                ${theme.selected
                                    ? 'w-11 h-11 selected-theme-btn z-10'
                                    : 'w-10 h-10 opacity-70 hover:opacity-100 hover:scale-110'
                                }
                            `}
                            title={theme.title}
                        >
                            <img
                                src={theme.image}
                                alt={theme.title}
                                className="w-full h-full object-contain transition-transform duration-300 hover:rotate-[5deg]"
                            />
                            {theme.selected && (
                                <span
                                    className="absolute inset-[-4px] rounded-full border-2 border-white/60 animate-ping pointer-events-none"
                                    style={{ animationDuration: '2s' }}
                                />
                            )}
                        </a>
                    ))}
                </div>
            </div>

            {/* Desktop Version - Horizontal, with text */}
            <div className="hidden md:block bg-slate-900/80 backdrop-blur-md border border-white/20 shadow-2xl w-auto transition-all duration-300 hover:bg-slate-900/95 overflow-visible rounded-xl">
                {/* Header - Always visible */}
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer select-none hover:text-white"
                >
                    <span className="text-slate-100 font-bold text-sm whitespace-nowrap">التنقل بين المحاكيات</span>
                    <ChevronDown
                        className={`h-4 w-4 text-cyan-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>

                {/* Expandable content - Horizontal */}
                <div
                    className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-40 opacity-100 py-4' : 'max-h-0 opacity-0 py-0 pointer-events-none'}`}
                    style={{ clipPath: isOpen ? 'inset(-100px -100px -100px -100px)' : 'inset(0 0 100% 0)' }}
                >
                    <div className="flex flex-row-reverse items-center justify-center gap-6 px-4 overflow-visible">
                        {themes.map((theme) => (
                            <a
                                key={theme.id}
                                href={theme.url}
                                style={getSelectedStyle(theme)}
                                className={`
                                    relative transition-all duration-300 ease-out transform cursor-pointer flex flex-col items-center gap-2 group
                                    ${theme.selected
                                        ? 'selected-theme-btn z-10'
                                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                                    }
                                `}
                                title={theme.title}
                            >
                                <div className="relative w-12 h-12 flex items-center justify-center">
                                    <img
                                        src={theme.image}
                                        alt={theme.title}
                                        className="w-full h-full object-contain transition-transform duration-300 group-hover:rotate-[5deg]"
                                    />
                                    {theme.selected && (
                                        <span
                                            className="absolute inset-[-4px] rounded-full border-2 border-white/60 animate-ping pointer-events-none"
                                            style={{ animationDuration: '2s' }}
                                        />
                                    )}
                                </div>
                                <span className={`text-xs font-semibold whitespace-nowrap ${theme.selected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                    {theme.id}
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ThemeDock;
