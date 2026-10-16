import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import "./AdminLogin.css";

const validateEmailFormat = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdmin } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setFieldErrors({});
    setGeneralError("");

    const errors = {};

    if (!email || !email.trim()) {
      errors.email = "Email is required.";
    } else if (!validateEmailFormat(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await loginAdmin(email.trim(), password);

      if (result.ok) {
        navigate("/admin/dashboard", { replace: true });
      } else {
        if (result.data && result.data.errors) {
          setFieldErrors(result.data.errors);
        }
        setGeneralError(
          result.data?.message || "Invalid admin credentials."
        );
      }
    } catch (err) {
      console.error("Admin login error:", err);
      setGeneralError("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <h1 className="admin-login-logo">
            FEXA <span>ADMIN PORTAL</span>
          </h1>
          <p className="admin-login-title">
            Sign in with administrator credentials
          </p>
        </div>

        {generalError && (
          <div className="admin-error-banner">{generalError}</div>
        )}

        <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-form-group">
            <label htmlFor="admin-email">EMAIL ADDRESS</label>
            <div className="admin-input-wrapper">
              <input
                id="admin-email"
                type="email"
                placeholder="admin@fexa.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: "" }));
                  }
                }}
                className={fieldErrors.email ? "has-error" : ""}
                disabled={isSubmitting}
              />
            </div>
            {fieldErrors.email && (
              <span className="admin-field-error">{fieldErrors.email}</span>
            )}
          </div>

          <div className="admin-form-group">
            <label htmlFor="admin-password">PASSWORD</label>
            <div className="admin-input-wrapper">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: "" }));
                  }
                }}
                className={fieldErrors.password ? "has-error" : ""}
                disabled={isSubmitting}
                style={{ paddingRight: "44px" }}
              />
              <button
                type="button"
                className="admin-toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="admin-field-error">{fieldErrors.password}</span>
            )}
          </div>

          <button
            type="submit"
            className="admin-login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "AUTHENTICATING..." : "LOG IN TO DASHBOARD"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
