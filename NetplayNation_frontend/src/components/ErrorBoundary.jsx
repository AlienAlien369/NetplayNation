import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container page empty">
        <h1>Something went wrong</h1>
        <p className="muted">Please reload the page. If it keeps happening, email us and we will sort it out.</p>
        <button className="btn btn-primary" onClick={() => window.location.assign('/')}>Back to home</button>
      </div>
    );
  }
}
