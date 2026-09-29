import { useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import "./ResetPassword.css";


function EyeIcon({ visible }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {visible ? (
        <>
          <path
            d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <circle
            cx="12"
            cy="12"
            r="3"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </>
      ) : (
        <>
          <path
            d="M3 3L21 21"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />

          <path
            d="M10.6 5.2C11.05 5.07 11.52 5 12 5C18.5 5 22 12 22 12C22 12 20.75 14.5 18.4 16.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M6.2 6.2C3.55 8.3 2 12 2 12C2 12 5.5 19 12 19C13.3 19 14.5 18.75 15.6 18.3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}


function ResetPassword() {

  const navigate = useNavigate();

  const { token } = useParams();


  // ========================================
  // STATES
  // ========================================

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  const [loading, setLoading] =
    useState(false);


  // ========================================
  // RESET PASSWORD
  // ========================================

  const handleSubmit = async (e) => {

    e.preventDefault();

    setMessage("");


    // ========================================
    // CHECK PASSWORD LENGTH
    // ========================================

    if (password.length < 8) {

      setMessage(
        "Password must be at least 8 characters."
      );

      return;
    }


    // ========================================
    // CHECK PASSWORD MATCH
    // ========================================

    if (
      password !==
      confirmPassword
    ) {

      setMessage(
        "Passwords do not match."
      );

      return;
    }


    // ========================================
    // CHECK TOKEN
    // ========================================

    if (!token) {

      setMessage(
        "Invalid or missing password reset link."
      );

      return;
    }


    setLoading(true);


    try {

      const response = await fetch(
        `http://localhost:5000/api/auth/reset-password/${token}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            password: password,
          }),
        }
      );


      const data =
        await response.json();


      // ========================================
      // RESET FAILED
      // ========================================

      if (!response.ok) {

        setMessage(
          data.message ||
            "Unable to reset password."
        );

        return;
      }


      // ========================================
      // RESET SUCCESS
      // ========================================

      setSuccess(true);

      setMessage(
        "Password reset successfully. Redirecting to login..."
      );


      setTimeout(() => {

        navigate("/login", {
          replace: true,
        });

      }, 2000);


    } catch (error) {

      console.error(
        "Reset password error:",
        error
      );

      setMessage(
        "Unable to connect to the server. Please try again."
      );

    } finally {

      setLoading(false);

    }
  };


  // ========================================
  // PAGE
  // ========================================

  return (
    <main className="reset-page">

      <section className="reset-card">


        {/* ========================================
            BRAND
        ======================================== */}

        <div className="reset-brand">
          FEXA
        </div>

        <span className="reset-label">
          PASSWORD RECOVERY
        </span>


        {/* ========================================
            HEADING
        ======================================== */}

        <h1>
          Create New
          <br />
          Password
        </h1>

        <p>
          Enter a new password for
          your FEXA account.
        </p>


        {/* ========================================
            FORM
        ======================================== */}

        {!success && (

          <form
            onSubmit={handleSubmit}
          >


            {/* ========================================
                NEW PASSWORD
            ======================================== */}

            <div className="reset-field">

              <label htmlFor="password">
                NEW PASSWORD
              </label>

              <div className="reset-password-wrapper">

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="Enter new password"
                  minLength={8}
                  required
                />


                {/* EYE BUTTON */}

                <button
                  type="button"
                  className="reset-eye-button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >

                  <EyeIcon
                    visible={
                      showPassword
                    }
                  />

                </button>

              </div>

            </div>


            {/* ========================================
                CONFIRM PASSWORD
            ======================================== */}

            <div className="reset-field">

              <label htmlFor="confirmPassword">
                CONFIRM PASSWORD
              </label>

              <div className="reset-password-wrapper">

                <input
                  id="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    confirmPassword
                  }
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  placeholder="Confirm new password"
                  required
                />


                {/* EYE BUTTON */}

                <button
                  type="button"
                  className="reset-eye-button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >

                  <EyeIcon
                    visible={
                      showConfirmPassword
                    }
                  />

                </button>

              </div>

            </div>


            {/* ========================================
                RESET PASSWORD BUTTON
            ======================================== */}

            <button
              type="submit"
              className="reset-submit-button"
              disabled={loading}
            >

              {loading
                ? "RESETTING..."
                : "RESET PASSWORD"}

            </button>

          </form>

        )}


        {/* ========================================
            MESSAGE
        ======================================== */}

        {message && (

          <div
            className={
              success
                ? "reset-message success"
                : "reset-message"
            }
          >
            {message}
          </div>

        )}


        {/* ========================================
            BACK TO LOGIN
        ======================================== */}

        {!success && (

          <button
            type="button"
            className="reset-back-login"
            onClick={() =>
              navigate("/login")
            }
          >
            ← Back to Login
          </button>

        )}

      </section>

    </main>
  );
}


export default ResetPassword;