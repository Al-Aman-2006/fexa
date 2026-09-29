const fs = require('fs');
const path = 'c:/Users/Aman Aziz/Desktop/FEXA/frontend/src/pages/user/Profile.jsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the undefined token checks
content = content.replace(/if \(!token\) \{[\s\S]*?return;\s*\}/g, '');
content = content.replace(/headers: \{\s*\},/g, 'credentials: "include",');

fs.writeFileSync(path, content);
console.log("Fixed undefined tokens");
