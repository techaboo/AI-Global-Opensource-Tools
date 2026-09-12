import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Atlas interface error', error, info.componentStack);
  }

  private recover = () => {
    localStorage.removeItem('atlas_compare_ids');
    window.history.replaceState(null, '', window.location.pathname);
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <section className="max-w-lg rounded-xl border bg-card p-6 text-center shadow-sm" role="alert">
          <h1 className="text-xl font-semibold">The catalog could not be displayed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your favorites and GitHub settings are safe. Reload the catalog with its navigation state reset.
          </p>
          <button
            type="button"
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={this.recover}
          >
            Reload catalog
          </button>
        </section>
      </main>
    );
  }
}
