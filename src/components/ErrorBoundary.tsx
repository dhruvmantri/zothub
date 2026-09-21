import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

/** Vite splits every route into its own file and fingerprints the name, so a
 *  deploy replaces the whole set. Anyone holding a page open across a deploy is
 *  still running the old index: the next route they click asks for a file that
 *  no longer exists, and the server answers the SPA's index.html instead — a
 *  200 with the wrong content type, which the browser rejects as a module.
 *
 *  This fires on every deploy, for every visitor mid-session, and the generic
 *  recovery below cannot fix it: "Try Again" only clears React state, so the
 *  same lazy component re-requests the same missing file and fails identically.
 *  A full document load is the only cure, because only that re-fetches index. */
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

/** One automatic reload, and only one. The flag is scoped to the path and the
 *  tab: if reloading did not help — the file is genuinely gone, or the network
 *  is down — the second failure says so instead of reloading forever. */
const RELOAD_FLAG = "zothub:chunk-reloaded";

function isChunkLoadError(error: Error): boolean {
  return CHUNK_ERROR.test(error?.message ?? "") || CHUNK_ERROR.test(String(error?.name ?? ""));
}

/** sessionStorage throws outright in some privacy modes, so every access is
 *  guarded. Losing the flag costs one extra reload, which is survivable; an
 *  uncaught throw inside an error boundary is not. */
function readReloadFlag(): string | null {
  try {
    return window.sessionStorage.getItem(RELOAD_FLAG);
  } catch {
    return null;
  }
}

function writeReloadFlag(value: string): void {
  try {
    window.sessionStorage.setItem(RELOAD_FLAG, value);
  } catch {
    /* ignore — see above */
  }
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** True when the failure is a missing build file rather than a bug in the
   *  page — a different problem, so it gets different words and a real remedy. */
  isStale: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isStale: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isStale: isChunkLoadError(error) };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // You can log to an error reporting service here
    // Example: logErrorToService(error, errorInfo);

    // Reload rather than render anything: the visitor was mid-navigation, so
    // there is no work to lose, and the page they asked for is one fetch away.
    if (isChunkLoadError(error)) {
      const here = window.location.pathname;
      if (readReloadFlag() !== here) {
        writeReloadFlag(here);
        window.location.reload();
      }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, isStale: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-bad-wash rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-bad" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-ink">
                {this.state.isStale ? "ZotHub just updated" : "Something went wrong"}
              </h1>
              <p className="text-ink-2">
                {this.state.isStale
                  ? "A newer version of the site went live while this page was open. Reloading picks it up."
                  : "We're sorry, but something unexpected happened. Please try again."}
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 p-4 bg-surface-3 rounded-lg text-left">
                <p className="text-sm font-mono text-bad break-words">
                  {this.state.error.toString()}
                </p>
                {this.state.error.stack && (
                  <pre className="mt-2 text-xs text-ink-2 overflow-auto max-h-40">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {/* "Try again" is deliberately absent when the build is stale: it
                  re-renders the same lazy route, which re-requests the same
                  missing file. Offering it would be offering a button that
                  cannot work. */}
              {this.state.isStale ? (
                <Button onClick={this.handleReload} variant="default" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Reload
                </Button>
              ) : (
                <Button onClick={this.handleReset} variant="default">
                  Try Again
                </Button>
              )}
              <Button
                onClick={() => (window.location.href = "/")}
                variant="outline"
              >
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
