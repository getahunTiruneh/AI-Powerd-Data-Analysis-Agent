import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/20 mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-muted p-3 rounded-lg mb-4 overflow-x-auto text-red-500 max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>Refresh Page</Button>
              <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
