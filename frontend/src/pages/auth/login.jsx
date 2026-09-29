import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import "./Login.css";

function Login() {
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();

  // If already logged in, redirect to home or previous page
  if (user) {
    navigate(location.state?.from?.pathname || "/home", { replace: true });
    return null;
  }

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  // ========================================
  // HANDLE INPUT CHANGE
  // ========================================

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };


  // ========================================
  // LOGIN
  // ========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          credentials: "include", // Send cookies
          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      // ========================================
      // LOGIN FAILED
      // ========================================

      if (!response.ok) {
        alert(
          data.message ||
            "Login failed."
        );

        return;
      }

      // ========================================
      // LOGIN SUCCESSFUL
      // ========================================

      console.log(
        "Login successful:",
        data
      );

      // Store user information in context
      login(data.user);

      // Clean up any old tokens just in case
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Go to home page or previous attempted page
      navigate(location.state?.from?.pathname || "/home", { replace: true });

    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      alert(
        "Unable to connect to the server."
      );
    }
  };


  // ========================================
  // PAGE
  // ========================================

  return (
    <main className="login-page">

      <div className="login-card">

        {/* ========================================
            BRAND
        ======================================== */}

        <div className="login-brand">

          <div className="brand-logo">
            F
          </div>

          <div>
            <h1>FEXA</h1>

            <span>
              HAUTE PARFUMERIE
            </span>
          </div>

        </div>


        {/* ========================================
            HEADING
        ======================================== */}

        <div className="login-heading">

          <h2>
            Welcome Back
          </h2>

          <p>
            Sign in to continue your
            fragrance journey.
          </p>

        </div>


        {/* ========================================
            LOGIN FORM
        ======================================== */}

        <form
          onSubmit={handleSubmit}
          className="login-form"
        >

          {/* ========================================
              EMAIL
          ======================================== */}

          <div className="input-group">

            <label htmlFor="email">
              EMAIL ADDRESS
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                ✉
              </span>

              <input
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
              />

            </div>

          </div>


          {/* ========================================
              PASSWORD
          ======================================== */}

          <div className="input-group">

            <div className="password-label">

              <label htmlFor="password">
                PASSWORD
              </label>

              {/* ========================================
                  FORGOT PASSWORD
              ======================================== */}

              <button
                type="button"
                className="forgot-link"
                onClick={() =>
                  navigate(
                    "/forgot-password"
                  )
                }
              >
                Forgot password?
              </button>

            </div>


            <div className="input-wrapper">

              <span className="input-icon">
                ●
              </span>

              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />

              {/* ========================================
                  SHOW / HIDE PASSWORD
              ======================================== */}

              <button
                type="button"
                className="show-password"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
                aria-label="Toggle password visibility"
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>


          {/* ========================================
              REMEMBER ME
          ======================================== */}

          <label className="remember-me">

            <input
              type="checkbox"
              name="remember"
              checked={
                formData.remember
              }
              onChange={handleChange}
            />

            <span className="custom-checkbox"></span>

            <span>
              Remember me
            </span>

          </label>


          {/* ========================================
              LOGIN BUTTON
          ======================================== */}

          <button
            type="submit"
            className="login-button"
          >
            SIGN IN

            <span>
              →
            </span>

          </button>

        </form>


        {/* ========================================
            REGISTER
        ======================================== */}

        <div className="register-link">

          <span>
            Don't have an account?
          </span>

          <button
            type="button"
            onClick={() =>
              navigate("/register")
            }
          >
            Create account
          </button>

        </div>


        {/* ========================================
            FOOTER
        ======================================== */}

        <div className="login-footer">

          <span>
            FEXA
          </span>

          <span>
            •
          </span>

          <span>
            CRAFTED FOR THE SENSES
          </span>

        </div>

      </div>


      {/* ========================================
          DECORATIVE SIDE
      ======================================== */}

      <div className="login-decoration">

        <div className="decoration-circle circle-one"></div>

        <div className="decoration-circle circle-two"></div>


        <div className="decoration-content">

          <span>
            FEXA
          </span>

          <h3>
            A scent
            <br />
            becomes a
            <br />
            memory.
          </h3>

          <div className="decoration-line"></div>

          <p>
            Discover fragrances created
            <br />
            for unforgettable moments.
          </p>

        </div>

      </div>

    </main>
  );
}

export default Login;