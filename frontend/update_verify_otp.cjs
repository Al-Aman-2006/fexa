const fs = require('fs');
const path = require('path');

const otpPath = 'C:/Users/Aman Aziz/Desktop/FEXA/frontend/src/pages/auth/VerifyOtp.jsx';

let jsxContent = fs.readFileSync(otpPath, 'utf8');

// The file already uses \`message\` and \`messageType\` for displaying errors on screen.
// Let's modify handleVerify to not throw generic alerts if there are any.
// And ensure the error messages are clean and specific.

const newLogic = `
  const handleVerify = async () => {
    const enteredOtp = otp.join("");

    if (!email) {
      setMessage("Email information is missing. Please register again.");
      setMessageType("error");
      return;
    }

    if (enteredOtp.length !== 6 || !/^\\d+$/.test(enteredOtp)) {
      setMessage("Please enter a valid 6-digit OTP.");
      setMessageType("error");
      return;
    }

    if (isVerifying) return;
    setIsVerifying(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: enteredOtp }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors && data.errors.otp) {
          setMessage(data.errors.otp);
        } else {
          setMessage(data.message || "Invalid OTP.");
        }
        setMessageType("error");
        return;
      }

      setIsVerified(true);
      setMessage("Verification successful! Redirecting...");
      setMessageType("success");
      
      setTimeout(() => { navigate("/login"); }, 2000);
    } catch (error) {
      console.error("OTP Error:", error);
      setMessage("Unable to connect to the server.");
      setMessageType("error");
    } finally {
      setIsVerifying(false);
    }
  };
`;

jsxContent = jsxContent.replace(/const handleVerify = async \(\) => \{[\s\S]*?setIsVerifying\(false\);\s*\n\s*\};/, newLogic.trim());
fs.writeFileSync(otpPath, jsxContent);
console.log("VerifyOTP updated.");
