import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { logError } from '@/shared/lib/errorLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  compact?: boolean;      // small inline fallback for chart/widget slots
  label?: string;         // e.g. "Revenue chart" for the error message
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError('ErrorBoundary', { error: error.message, componentStack: errorInfo.componentStack });

    // Handle production deployment chunk mismatches (Vercel new deployments)
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /Loading chunk .* failed/i.test(error?.message || '') ||
      /Failed to fetch dynamically imported module/i.test(error?.message || '');

    if (isChunkError) {
      const chunkReloadKey = 'calqulus_chunk_reload_timestamp';
      const lastReload = sessionStorage.getItem(chunkReloadKey);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(chunkReloadKey, now.toString());
        window.location.reload();
      }
    }
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;

      if (this.props.compact) {
        return (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-4 h-full min-h-[80px]">
            <AlertTriangle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              {this.props.label ? `${this.props.label} failed to load` : 'Failed to load'}
            </span>
            <button onClick={this.handleReset}
              className="ml-1 text-xs text-muted-foreground underline hover:text-foreground transition-colors">
              retry
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-6 bg-background text-foreground">
          <div className="text-center space-y-3 max-w-sm">
            <div className="h-10 w-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">
                {this.props.label ? `${this.props.label} failed to load` : 'Something went wrong'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">An unexpected error occurred in this section.</p>
            </div>
            <Button onClick={this.handleReset} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
