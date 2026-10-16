const fs = require('fs');
const path = require('path');

const loginPath = 'C:/Users/Aman Aziz/Desktop/FEXA/frontend/src/pages/auth/login.jsx';
const loginCssPath = 'C:/Users/Aman Aziz/Desktop/FEXA/frontend/src/pages/auth/Login.css';

// 1. Add error CSS
let cssContent = fs.readFileSync(loginCssPath, 'utf8');
if (!cssContent.includes('.field-error')) {
  fs.writeFileSync(loginCssPath, cssContent + '\n.field-error { color: #e74c3c; font-size: 0.85rem; margin-top: 4px; display: block; }\n');
}

let jsxContent = fs.readFileSync(loginPath, 'utf8');

const newLogic = `
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateEmail = (email) => {
    return /^(([^<>()\\[\\]\\\\.,;:\\s@"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@"]+)*)|(".+"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$/.test(email);
  };

  const validateField = (name, value) => {
    let error = "";
    if (name === "email") {
      if (!value.trim()) error = "Email is required.";
      else if (!validateEmail(value)) error = "Please enter a valid email address.";
    } else if (name === "password") {
      if (!value) error = "Password is required.";
    }
    return error;
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    
    setFormData((prev) => ({ ...prev, [name]: val }));
    
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, val) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {
      email: validateField("email", formData.email),
      password: validateField("password", formData.password),
    };

    setErrors(newErrors);
    setTouched({ email: true, password: true });

    if (Object.values(newErrors).some(err => err)) {
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(prev => ({ ...prev, ...data.errors }));
        } else {
          setErrors(prev => ({ ...prev, password: data.message || "Login failed." }));
        }
        return;
      }

      console.log("Login successful:", data);
      login(data.user);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate(location.state?.from?.pathname || "/home", { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      setErrors(prev => ({ ...prev, email: "Unable to connect to the server." }));
    }
  };
`;

jsxContent = jsxContent.replace(/const \[formData, setFormData\][\s\S]*?console\.error\([\s\S]*?"Unable to connect to the server\."\s*\);\s*\}/, newLogic.trim());

// Add noValidate to form
jsxContent = jsxContent.replace('<form\n          onSubmit={handleSubmit}\n          className="login-form"\n        >', '<form onSubmit={handleSubmit} className="login-form" noValidate>');

// Add errors to fields
jsxContent = jsxContent.replace(/<input\s*id="email"[\s\S]*?\/>/, '$&\n              {touched.email && errors.email && <span className="field-error">{errors.email}</span>}');
jsxContent = jsxContent.replace(/<input\s*id="password"[\s\S]*?\/>\s*\{\/\* ========================================\s*SHOW \/ HIDE PASSWORD\s*======================================== \*\/\}/, '$&\n              {touched.password && errors.password && <span className="field-error" style={{position: "absolute", bottom: "-20px"}}>{errors.password}</span>}');

// Ensure onBlur
jsxContent = jsxContent.replace(/onChange={handleChange}/g, 'onChange={handleChange}\n                onBlur={handleBlur}');

fs.writeFileSync(loginPath, jsxContent);
console.log("Login updated.");
