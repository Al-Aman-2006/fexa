import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./ForgotPassword.css";

function ForgotPassword() {

  const navigate = useNavigate();

  const [email, setEmail] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);


  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!email) {
      setMessage(
        "Please enter your email address."
      );

      return;
    }

    setLoading(true);

    setMessage("");

    try {

      const response = await fetch(
        "http://localhost:5000/api/auth/forgot-password",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email,
          }),
        }
      );

      const data =
        await response.json();

      setMessage(
        data.message ||
          "If an account exists for this email, a password reset link has been sent."
      );

    } catch (error) {

      console.error(
        "Forgot password error:",
        error
      );

      setMessage(
        "Unable to connect to the server."
      );

    } finally {

      setLoading(false);

    }
  };


  return (
    <main className="forgot-page">

      <section className="forgot-card">

        <div className="forgot-brand">
          FEXA
        </div>

        <span className="forgot-label">
          PASSWORD RECOVERY
        </span>

        <h1>
          Forgot Your
          <br />
          Password?
        </h1>

        <p>
          Enter your email address and
          we'll send you a secure link
          to reset your password.
        </p>

        <form
          onSubmit={handleSubmit}
        >

          <label>
            Email Address
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Enter your email"
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "SENDING..."
              : "SEND RESET LINK"}
          </button>

        </form>

        {message && (
          <div className="forgot-message">
            {message}
          </div>
        )}

        <button
          type="button"
          className="back-login"
          onClick={() =>
            navigate("/login")
          }
        >
          ← Back to Login
        </button>

      </section>

    </main>
  );
}

export default ForgotPassword;