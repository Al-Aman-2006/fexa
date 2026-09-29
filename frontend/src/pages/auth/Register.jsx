import { useState } from "react";
import "./Register.css";
import { useNavigate } from "react-router-dom";
import heroImage from "../../assets/hero.png";


function Register() {

const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (formData.password !== formData.confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:5000/api/auth/register",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
        }),
      }
    );

    const data = await response.json();

    // Registration failed
    if (!response.ok) {
      alert(data.message || "Registration failed.");
      return;
    }

    // Registration successful
    console.log("Registration successful:", data);

    // Go to OTP verification page
    navigate("/verify-otp", {
      state: {
        email: formData.email,
      },
    });

  } catch (error) {
    console.error("Registration error:", error);

    alert("Unable to connect to the server.");
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
          <button type="button" className="google-btn">
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
          <form onSubmit={handleSubmit}>

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
                required
              />
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
                required
              />
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