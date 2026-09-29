const fs = require('fs');
const path = 'c:/Users/Aman Aziz/Desktop/FEXA/frontend/src/pages/user/Profile.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!content.includes('useAuth')) {
    content = content.replace('import { useNavigate } from "react-router-dom";', 'import { useNavigate } from "react-router-dom";\nimport { useAuth } from "../../context/AuthContext";');
}

// 2. Add useAuth to component
if (!content.includes('const { logout } = useAuth();')) {
    content = content.replace('const navigate = useNavigate();', 'const navigate = useNavigate();\n  const { logout } = useAuth();');
}

// 3. Fix fetchProfile (remove token check and auth header, add credentials)
content = content.replace(/const token =[\s\S]*?if \(!token\) \{[\s\S]*?return;\s*\}/g, '');
content = content.replace(/headers: \{\s*Authorization: `Bearer \$\{token\}`,\s*\}/g, 'credentials: "include"');
content = content.replace(/headers: \{\s*"Content-Type":\s*"application\/json",\s*Authorization:\s*`Bearer \$\{token\}`,\s*\}/g, 'credentials: "include",\n          headers: {\n            "Content-Type": "application/json",\n          }');

content = content.replace(/localStorage\.removeItem\("token"\);\s*localStorage\.removeItem\("user"\);/g, 'await logout();');

content = content.replace(/const handleLogout = \(\) => \{[\s\S]*?navigate\("\/login"\);\s*\};/g, 'const handleLogout = async () => {\n    await logout();\n    navigate("/login", { replace: true });\n  };');

fs.writeFileSync(path, content);
console.log("Done");
