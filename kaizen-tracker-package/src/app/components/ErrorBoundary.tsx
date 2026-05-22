import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Mail } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white/80 backdrop-blur-sm border border-red-100 rounded-3xl shadow-xl max-w-lg mx-auto my-12 space-y-6">
          <div className="p-4 bg-red-50 rounded-2xl text-red-500">
            <AlertCircle className="size-12 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
            <p className="text-gray-600 text-sm max-w-sm mx-auto">
              We encountered an unexpected error while rendering this component.
            </p>
          </div>

          {this.state.error && (
            <div className="w-full bg-red-50/50 border border-red-100 rounded-2xl p-4 text-left max-h-40 overflow-y-auto custom-scrollbar">
              <p className="font-mono text-xs text-red-700 break-words whitespace-pre-wrap">
                {this.state.error.toString()}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              <RefreshCw className="size-4" />
              <span>Reload page</span>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-100 w-full flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Mail className="size-4 text-gray-400" />
              <span>Need assistance? Contact support at</span>
            </div>
            <a href="mailto:support@actioncaddy.com" className="text-blue-600 hover:underline font-medium">
              support@actioncaddy.com
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
