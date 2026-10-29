import React from 'react';
export default class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeContent: 'center',
          gap: 20,
          padding: 28,
          background: '#0a0e15',
          color: '#eef6ff',
          fontFamily: 'system-ui',
        }}
      >
        <h1>Let’s get you back in the game.</h1>
        <p>Something went wrong. Reload to start a fresh game. Your saved results are kept.</p>
        <button
          onClick={() => location.reload()}
          style={{
            padding: 14,
            border: 0,
            borderRadius: 8,
            background: '#83f3c6',
            color: '#081c19',
            cursor: 'pointer',
          }}
        >
          Reload game
        </button>
      </main>
    );
  }
}
