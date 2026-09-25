import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Shown instead of the children after a render error (e.g. WebGL unavailable for a 3D view). */
  fallback: ReactNode;
}

/** Keeps a crash in one panel from taking down the whole page. */
export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
