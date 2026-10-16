import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#faf8fc",
            fontFamily: "'DM Sans', sans-serif",
            padding: "2rem",
            color: "#30263b",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "#ffffff",
              padding: "2.5rem",
              borderRadius: "20px",
              boxShadow: "0 10px 40px rgba(118, 84, 147, 0.12)",
              border: "1px solid #ebe4f3",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🌿</div>
            <h2
              style={{
                fontFamily: "'Didot', serif",
                fontSize: "1.75rem",
                color: "#241a30",
                margin: "0 0 0.75rem",
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: "0.95rem",
                color: "#776d80",
                lineHeight: "1.6",
                marginBottom: "2rem",
              }}
            >
              We encountered an unexpected display issue. Please refresh the page to continue exploring the atelier.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                background: "#241a30",
                color: "#ffffff",
                border: "none",
                padding: "0.85rem 2rem",
                borderRadius: "999px",
                fontSize: "0.8rem",
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(36, 26, 48, 0.15)",
              }}
            >
              Reload Atelier
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
