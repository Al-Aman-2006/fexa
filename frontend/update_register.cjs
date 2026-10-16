const fs = require('fs');
const path = require('path');

const registerPath = 'C:/Users/Aman Aziz/Desktop/FEXA/frontend/src/pages/auth/Register.jsx';
const registerCssPath = 'C:/Users/Aman Aziz/Desktop/FEXA/frontend/src/pages/auth/Register.css';

// 1. Add error CSS
let cssContent = fs.readFileSync(registerCssPath, 'utf8');
if (!cssContent.includes('.field-error')) {
  fs.writeFileSync(registerCssPath, cssContent + '\n.field-error { color: #e74c3c; font-size: 0.85rem; margin-top: 4px; display: block; }\n');
}

// 2. Update Register.jsx
let jsxContent = fs.readFileSync(registerPath, 'utf8');

// Replace form state and validation logic
const newLogic = `
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  const validateEmail = (email) => {
    return /^(([^<>()\\[\\]\\\\.,;:\\s@"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@"]+)*)|(".+"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$/.test(email);
  };

  const validateField = (name, value, currentFormData = formData) => {
    let error = "";
    if (name === "fullName") {
      if (!value.trim()) error = "Name is required.";
      else if (value.trim().length < 2) error = "Name must be at least 2 characters.";
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
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
           setErrors(prev => ({ ...prev, ...data.errors }));
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
`;

jsxContent = jsxContent.replace(/const \[formData, setFormData\] = useState\(\{[\s\S]*?console\.error\("Registration error:", error\);\s*alert\("Unable to connect to the server\."\);\s*\}/, newLogic.trim());

// Add noValidate to form
jsxContent = jsxContent.replace('<form onSubmit={handleSubmit}>', '<form onSubmit={handleSubmit} noValidate>');

// Add errors to fields
jsxContent = jsxContent.replace(/<input\s*id="fullName"[\s\S]*?\/>/, '$&\n              {touched.fullName && errors.fullName && <span className="field-error">{errors.fullName}</span>}');
jsxContent = jsxContent.replace(/<input\s*id="email"[\s\S]*?\/>/, '$&\n              {touched.email && errors.email && <span className="field-error">{errors.email}</span>}');
jsxContent = jsxContent.replace(/<input\s*id="password"[\s\S]*?\/>\s*<button[\s\S]*?<\/button>\s*<\/div>/, '$&\n              {touched.password && errors.password && <span className="field-error">{errors.password}</span>}');
jsxContent = jsxContent.replace(/<input\s*id="confirmPassword"[\s\S]*?\/>\s*<button[\s\S]*?<\/button>\s*<\/div>/, '$&\n              {touched.confirmPassword && errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}');

// Add onBlur attributes
jsxContent = jsxContent.replace(/onChange={handleChange}/g, 'onChange={handleChange}\n                onBlur={handleBlur}');

fs.writeFileSync(registerPath, jsxContent);
console.log("Register updated.");
