import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ForgotPassword.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ text: "Please enter your email address.", type: "error" });
      return;
    }
    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      const response = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setMessage({
        text: data.message || "If an account exists for this email, a password reset link has been sent.",
        type: "success",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      setMessage({ text: "Unable to connect to the server.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="forgot-page">
      {/* ── Left: Form ── */}
      <section className="forgot-card">
        {/* Brand */}
        <div className="forgot-brand-block">
          <div className="forgot-brand-logo">F</div>
          <div>
            <h1>FEXA</h1>
            <span>HAUTE PARFUMERIE</span>
          </div>
        </div>

        {/* Heading */}
        <div className="forgot-heading">
          <h2>Forgot Your<br />Password?</h2>
          <p>
            Enter your registered email and we'll send you a secure link
            to reset your password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="forgot-form">
          <div className="forgot-input-group">
            <label htmlFor="forgot-email">EMAIL ADDRESS</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
          </div>

          <button type="submit" className="forgot-submit-btn" disabled={loading}>
            {loading ? "SENDING..." : "SEND RESET LINK"}
          </button>
        </form>

        {message.text && (
          <div className={`forgot-message-banner ${message.type}`}>
            {message.text}
          </div>
        )}

        <button
          type="button"
          className="forgot-back-link"
          onClick={() => navigate("/login")}
        >
          ← Back to Login
        </button>
      </section>

      {/* ── Right: Decoration ── */}
      <aside className="forgot-decoration" aria-hidden="true">
        <div className="forgot-deco-circle forgot-deco-circle-1" />
        <div className="forgot-deco-circle forgot-deco-circle-2" />
        <div className="forgot-deco-content">
          <span>PASSWORD SECURITY</span>
          <h3>Secure<br />Recovery.</h3>
          <div className="forgot-deco-line" />
          <p>
            We take the security of your account seriously. Once you request
            a reset link, it will expire within 1 hour for your protection.
          </p>
        </div>
      </aside>
    </main>
  );
}

export default ForgotPassword;
