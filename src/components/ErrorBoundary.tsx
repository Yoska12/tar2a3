import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReset = () => {
    try {
      // Clear app state while preserving essential tokens if any
      sessionStorage.clear();
      localStorage.removeItem('tarqa_current_user');
      localStorage.removeItem('tarqa_session');
    } catch {
      // Ignore storage errors
    }
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo"
        >
          <div className="max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center backdrop-blur-xl relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Warning Icon */}
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-amber-400 shadow-lg shadow-amber-500/5">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              عذراً، حدث خطأ غير متوقع
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mb-6 leading-relaxed">
              تم حماية بياناتك وجلستك بنجاح. يمكنك إعادة تحميل الصفحة أو إعادة ضبط الذاكرة المؤقتة لمتابعة استخدام المنصة بأمان.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/20 active:scale-95 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل الصفحة</span>
              </button>

              <button
                onClick={this.handleClearCacheAndReset}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-3 rounded-xl border border-slate-700 transition-all duration-200 active:scale-95 text-sm"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>مسح المؤقت والبدء من جديد</span>
              </button>
            </div>

            {/* Dev Details Accordion */}
            {this.state.error && (
              <div className="border-t border-slate-800/80 pt-4 text-right">
                <button
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
                >
                  <span>تفاصيل الخطأ التقني (للمطورين)</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="mt-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-left font-mono text-xs text-rose-300 max-h-48 overflow-auto leading-relaxed select-text" dir="ltr">
                    <p className="font-bold text-rose-400 mb-1">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
