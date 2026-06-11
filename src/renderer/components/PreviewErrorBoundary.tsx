import { Component, type ErrorInfo, type ReactNode } from "react";

type PreviewErrorBoundaryProps = {
  children: ReactNode;
};

type PreviewErrorBoundaryState = {
  error: string | null;
};

export default class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { error: error.message || "Preview panel error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[PreviewErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="video-preview simple-preview-panel">
          <div className="workspace-header">
            <h2 className="workspace-header-title">Preview</h2>
          </div>
          <div className="simple-preview-error-boundary">
            <p>Preview encountered an error and was contained.</p>
            <p className="simple-preview-error-detail">{this.state.error}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => this.setState({ error: null })}
            >
              Retry preview
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
