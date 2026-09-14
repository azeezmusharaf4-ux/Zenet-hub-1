import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  isRoot?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error safely without crashing the console
    console.warn('[ZENET ErrorBoundary caught]', error?.message || error, errorInfo?.componentStack || '');
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch {}
    }
  };

  handleReload = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {}
  };

  handleHome = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch {}
  };

  render() {
    if (this.state.hasError) {
      const { isRoot, fallbackTitle, fallbackMessage } = this.props;

      if (isRoot) {
        return (
          <div className="min-h-screen w-full bg-[#FFFFFF] text-[#0F172A] flex flex-col items-center justify-center p-6 select-none font-sans">
            <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-lg text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] mb-4 shadow-sm">
                <AlertCircle className="w-7 h-7 shrink-0 text-[#2563EB]" />
              </div>
              <span className="text-[10px] font-black tracking-widest text-[#2563EB] uppercase block mb-1">
                ZENET HUB RECOVERY
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight mb-2">
                {fallbackTitle || 'Something interrupted this view'}
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed mb-6">
                {fallbackMessage || 'The page encountered a temporary display issue. Your account data, orders, and wallet balance are safe.'}
              </p>
              
              <div className="w-full flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3 px-4 rounded-xl shadow-sm transition active:scale-[0.99] text-xs sm:text-sm cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reload ZENET Hub</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center gap-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] font-bold py-3 px-4 rounded-xl transition active:scale-[0.99] text-xs sm:text-sm cursor-pointer"
                >
                  <span>Try Again</span>
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Section or Sub-view Error Fallback
      return (
        <div className="w-full p-6 flex flex-col items-center justify-center text-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl my-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] mb-3">
            <AlertCircle className="w-5 h-5 text-[#2563EB]" />
          </div>
          <h3 className="text-base font-bold text-[#0F172A] mb-1">
            {fallbackTitle || 'Service Temporarily Unavailable'}
          </h3>
          <p className="text-xs text-[#475569] max-w-sm mb-4 leading-relaxed">
            {fallbackMessage || 'This section could not load right now. You can return to the marketplace or try refreshing.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 bg-[#2563EB] text-white font-bold text-xs py-2 px-3.5 rounded-lg hover:bg-[#1D4ED8] transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Section</span>
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="inline-flex items-center gap-1.5 bg-[#FFFFFF] text-[#0F172A] border border-[#CBD5E1] font-bold text-xs py-2 px-3.5 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Marketplace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
