import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useGoogleLogin } from "@react-oauth/google";

import "./Login.css";

function Login() {
  // ========================================
  // STATE
  // ========================================

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // ========================================
  // ROUTER / AUTH
  // ========================================

  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();

  // ========================================
  // REDIRECT IF ALREADY LOGGED IN
  // ========================================

  useEffect(() => {
    if (user) {
      navigate(
        location.state?.from?.pathname || "/home",
        { replace: true }
      );
    }
  }, [user, navigate, location]);

  // ========================================
  // GOOGLE LOGIN
  // ========================================

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/google",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              credential: tokenResponse.access_token,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setErrors((prev) => ({
            ...prev,
            email:
              data.message ||
              "Google authentication failed.",
          }));
          return;
        }

        login(data.user);

        navigate("/home", {
          replace: true,
        });
      } catch (err) {
        console.error("Google auth error:", err);

        setErrors((prev) => ({
          ...prev,
          email:
            "Unable to connect to Google auth server.",
        }));
      }
    },

    onError: (err) => {
      console.error("Google OAuth error:", err);

      setErrors((prev) => ({
        ...prev,
        email: "Google sign-in failed.",
      }));
    },
  });

  // ========================================
  // EMAIL VALIDATION
  // ========================================

  const validateEmail = (email) => {
    return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
      email
    );
  };

  // ========================================
  // FIELD VALIDATION
  // ========================================

  const validateField = (name, value) => {
    let error = "";

    if (name === "email") {
      if (!value.trim()) {
        error = "Email is required.";
      } else if (!validateEmail(value)) {
        error = "Please enter a valid email address.";
      }
    }

    if (name === "password") {
      if (!value) {
        error = "Password is required.";
      }
    }

    return error;
  };

  // ========================================
  // INPUT BLUR
  // ========================================

  const handleBlur = (e) => {
    const { name, value } = e.target;

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name, value),
    }));
  };

  // ========================================
  // INPUT CHANGE
  // ========================================

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    const val =
      type === "checkbox"
        ? checked
        : value;

    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));

    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateField(name, val),
      }));
    }
  };

  // ========================================
  // NORMAL LOGIN
  // ========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate fields
    const newErrors = {
      email: validateField(
        "email",
        formData.email
      ),
      password: validateField(
        "password",
        formData.password
      ),
    };

    setErrors(newErrors);

    setTouched({
      email: true,
      password: true,
    });

    // Stop if validation failed
    if (
      Object.values(newErrors).some(
        (err) => err
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors((prev) => ({
            ...prev,
            ...data.errors,
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            password:
              data.message ||
              "Login failed.",
          }));
        }

        return;
      }

      console.log(
        "Login successful:",
        data
      );

      // Save user in AuthContext
      login(data.user);

      // Save token for cross-origin / header authentication fallback
      if (data.token) {
        localStorage.setItem("token", data.token);
      } else {
        localStorage.removeItem("token");
      }
      localStorage.removeItem("user");

      // Navigate
      navigate(
        location.state?.from?.pathname ||
          "/home",
        {
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setErrors((prev) => ({
        ...prev,
        email:
          "Unable to connect to the server.",
      }));
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
            GOOGLE LOGIN
        ======================================== */}

        <button
          type="button"
          className="google-btn"
          onClick={() =>
            handleGoogleLogin()
          }
          style={{
            width: "100%",
            padding: "12px",
            background: "#1a1622",
            border: "1px solid #332a3d",
            color: "#f5f0e6",
            borderRadius: "6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "20px",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          <strong
            style={{
              color: "#a184bd",
            }}
          >
            G
          </strong>

          Continue with Google
        </button>

        {/* ========================================
            LOGIN FORM
        ======================================== */}

        <form
          onSubmit={handleSubmit}
          className="login-form"
        >

          {/* EMAIL */}

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
                onBlur={handleBlur}
                required
              />

            </div>

            {touched.email && errors.email && (
              <span className="field-error">
                {errors.email}
              </span>
            )}

          </div>

          {/* PASSWORD */}

          <div className="input-group">

            <div className="password-label">

              <label htmlFor="password">
                PASSWORD
              </label>

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
                onBlur={handleBlur}
                required
              />

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

            {touched.password && errors.password && (
              <span className="field-error">
                {errors.password}
              </span>
            )}

          </div>

          {/* REMEMBER ME */}

          <label className="remember-me">

            <input
              type="checkbox"
              name="remember"
              checked={
                formData.remember
              }
              onChange={handleChange}
            />

            
          </label>

          {/* LOGIN BUTTON */}

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