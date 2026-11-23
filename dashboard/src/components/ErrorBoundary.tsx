import { Component, type ReactNode, type ErrorInfo } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    console.error("The workspace could not be displayed. Reload to recover.");
  }
  render() {
    return this.state.failed ? (
      <main className="recovery">
        <h1>The workspace needs a fresh start.</h1>
        <p>Your locally stored data is still on this device.</p>
        <button onClick={() => location.reload()}>Reload workspace</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
