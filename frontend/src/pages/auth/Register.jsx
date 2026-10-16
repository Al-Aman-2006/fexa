import { useState } from "react";
import "./Register.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useGoogleLogin } from "@react-oauth/google";
import heroImage from "../../assets/hero.png";
import { validateName, normalizeName } from "../../utils/validation";


function Register() {

const navigate = useNavigate();
  const { login } = useAuth();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await fetch("http://localhost:5000/api/auth/google", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: tokenResponse.access_token }),
        });
        const data = await response.json();
        if (!response.ok) {
          setErrors((prev) => ({ ...prev, email: data.message || "Google authentication failed." }));
          return;
        }
        login(data.user);
        navigate("/home", { replace: true });
      } catch (err) {
        console.error("Google auth error:", err);
        setErrors((prev) => ({ ...prev, email: "Unable to connect to Google auth server." }));
      }
    },
    onError: (err) => {
      console.error("Google OAuth error:", err);
      setErrors((prev) => ({ ...prev, email: "Google sign-in failed." }));
    },
  });

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const validateEmail = (email) => {
    return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
  };

  const validateField = (name, value, currentFormData = formData) => {
    let error = "";
    if (name === "fullName") {
      error = validateName(value) || "";
    } else if (name === "email") {
      if (!value.trim()) error = "Email is required.";
      else if (!validateEmail(value)) error = "Please enter a valid email address.";
    } else if (name === "password") {
      if (!value) error = "Password is required.";
      else if (value.length < 8) error = "Password must be at least 8 characters.";
      else if (!/[A-Z]/.test(value)) error = "Password must contain at least one uppercase letter.";
      else if (!/[a-z]/.test(value)) error = "Password must contain at least one lowercase letter.";
      else if (!/[0-9]/.test(value)) error = "Password must contain at least one number.";
      else if (!/[^A-Za-z0-9]/.test(value)) error = "Password must contain at least one special character.";
    } else if (name === "confirmPassword") {
      if (!value) error = "Please confirm your password.";
      else if (value !== currentFormData.password) error = "Passwords do not match.";
    }
    return error;
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    
    // Validate instantly if touched
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value, newFormData) }));
    }
    if (name === "password" && touched.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: validateField("confirmPassword", newFormData.confirmPassword, newFormData) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all
    const newErrors = {
      fullName: validateField("fullName", formData.fullName),
      email: validateField("email", formData.email),
      password: validateField("password", formData.password),
      confirmPassword: validateField("confirmPassword", formData.confirmPassword),
    };
    
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });
    
    if (Object.values(newErrors).some(err => err)) {
      const firstInvalidField = Object.keys(newErrors).find(key => newErrors[key]);
      if (firstInvalidField) {
        document.getElementById(firstInvalidField)?.focus();
      }
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizeName(formData.fullName),
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const mappedErrors = { ...data.errors };
          if (data.errors.name && !data.errors.fullName) {
            mappedErrors.fullName = data.errors.name;
          }
          setErrors(prev => ({ ...prev, ...mappedErrors }));
        } else if (data.message && data.message.toLowerCase().includes("email already exists")) {
          setErrors(prev => ({ ...prev, email: "An account with this email already exists." }));
        } else {
          setErrors(prev => ({ ...prev, email: data.message || "Registration failed." }));
        }
        return;
      }

      navigate("/verify-otp", { state: { email: formData.email } });
    } catch (error) {
      console.error("Registration error:", error);
      setErrors(prev => ({ ...prev, email: "Unable to connect to the server." }));
    }
  };

  return (
    <div className="register-page">

      {/* LEFT SIDE */}
      <section className="register-panel">

        <div className="register-inner">

          

          <div className="brand">
         
          

          
           
      <div className="login-brand">
        <div className="brand-logo">F</div>
          
       
         <h1>FEXA</h1>
            <p>        </p>
          </div>
 </div>
          <div className="intro">
            <span className="eyebrow">
                
            </span>

            <h2>
              Begin Your
              <br />
              Fragrance Journey
            </h2>

            <p>
              Create your Fexa account and discover
              a world of refined fragrances.
            </p>
          </div>

          {/* GOOGLE */}
          <button type="button" className="google-btn" onClick={() => handleGoogleLogin()}>
            <strong>G</strong>
            Continue with Google
          </button>

          {/* DIVIDER */}
          <div className="divider">
            <span />
            <small>OR REGISTER WITH EMAIL</small>
            <span />
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} noValidate>

            <div className="field">
              <label htmlFor="fullName">
                FULL NAME
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="e.g. Elena Moreau"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                className={touched.fullName && errors.fullName ? "input-error" : ""}
                required
              />
              {touched.fullName && errors.fullName && <span className="field-error">{errors.fullName}</span>}
            </div>

            <div className="field">
              <label htmlFor="email">
                EMAIL ADDRESS
              </label>

              <input
                id="email"
                name="email"
                type="email"
                placeholder="elena@example.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              {touched.email && errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="password">
                CREATE PASSWORD
              </label>

              <div className="password-box">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                onBlur={handleBlur}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {touched.password && errors.password && <span className="field-error">{errors.password}</span>}

              <div className="strength">
                <span />
                <span />
                <span />
              </div>

              <small>
                Minimum 8 characters
              </small>
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">
                CONFIRM PASSWORD
              </label>

              <div className="password-box">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                onBlur={handleBlur}
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
            </div>

            <div className="terms">
              <input
                id="terms"
                type="checkbox"
                required
              />

              <label htmlFor="terms">
                I agree to the{" "}
                <a href="#">Terms of Service</a>{" "}
                &{" "}
                <a href="#">Privacy Policy</a>.
              </label>
            </div>

            <button
              type="submit"
              className="create-btn"
            >
              CREATE ACCOUNT
              <span>→</span>
            </button>

          </form>

          <div className="login-link">
            Already have an account?
            <a href="/login"> Log In</a>
          </div>

          <footer>
            <span>© 2026 FEXA HAUTE PARFUMERIE</span>

            <div>
              <a href="#">PRIVACY</a>
              <a href="#">CONCIERGE</a>
              <a href="#">ARCHIVES</a>
            </div>
          </footer>

        </div>

      </section>


      {/* RIGHT SIDE */}
     <section className="visual-panel">

  <img
    src={heroImage}
    alt="Fexa floral fragrance"
    className="hero-image"
  />

  <div className="hero-overlay"></div>

  <div className="edition-tag">
    FLORAL HARVEST № 84
  </div>

  <div className="fragrance-card">

    <span>EXTRAIT DE PARFUM</span>

    <h3>
      The Olfactory
      <br />
      Tapestry
    </h3>

    <p>
      Harvest Edition · Grassé & Florence
    </p>

    <div className="notes">
      <span>WILDFLOWER</span>
      <span>IRIS</span>
      <span>ORRIS ROOT</span>
    </div>

    <blockquote>
      "Every memory begins with a scent."
    </blockquote>

    <small>
      FEXA · MASTER PERFUMERY
    </small>

  </div>

</section>

    </div>
  );
}

export default Register;