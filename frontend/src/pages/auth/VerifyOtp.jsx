import { useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import { verifyOtp as verifyOtpApi, resendOtp as resendOtpApi } from "../../services/auth.service.js";

import "./VerifyOtp.css";

function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();

  const inputRefs = useRef([]);

  // Email received from Register page
  const email = location.state?.email || "";

  // ========================================
  // STATES
  // ========================================

  const [otp, setOtp] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const [timeLeft, setTimeLeft] = useState(60);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] =
    useState("");

  const [isVerified, setIsVerified] =
    useState(false);

  const [isVerifying, setIsVerifying] =
    useState(false);

  const [isResending, setIsResending] =
    useState(false);


  // ========================================
  // OTP TIMER
  // ========================================

  useEffect(() => {
    if (timeLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previousTime) => {
        if (previousTime <= 1) {
          return 0;
        }

        return previousTime - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [timeLeft]);


  // ========================================
  // HANDLE OTP INPUT
  // ========================================

  const handleChange = (value, index) => {
    // Only numbers are allowed
    if (!/^\d*$/.test(value)) {
      return;
    }

    const newOtp = [...otp];

    // Store only one digit
    newOtp[index] = value.slice(-1);

    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };


  // ========================================
  // HANDLE BACKSPACE
  // ========================================

  const handleKeyDown = (e, index) => {
    if (
      e.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };


  // ========================================
  // HANDLE PASTE
  // ========================================

  const handlePaste = (e) => {
    e.preventDefault();

    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pastedData) {
      return;
    }

    const newOtp = [
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    pastedData.split("").forEach(
      (number, index) => {
        newOtp[index] = number;
      }
    );

    setOtp(newOtp);

    const focusIndex = Math.min(
      pastedData.length,
      5
    );

    inputRefs.current[
      focusIndex
    ]?.focus();
  };


  // ========================================
  // VERIFY OTP
  // ========================================

  const handleVerify = async () => {
    const enteredOtp = otp.join("");

    // Check email
    if (!email) {
      setMessage(
        "Email information is missing. Please register again."
      );

      setMessageType("error");

      return;
    }

    // Check OTP
    if (enteredOtp.length !== 6) {
      setMessage(
        "Please enter the complete 6-digit OTP."
      );

      setMessageType("error");

      return;
    }

    // Prevent multiple requests
    if (isVerifying) {
      return;
    }

    setIsVerifying(true);

    try {
      console.log(
        "Sending OTP verification request..."
      );

      console.log(
        "Email:",
        email
      );

      console.log(
        "OTP:",
        enteredOtp
      );

      const data = await verifyOtpApi(email, enteredOtp);

      console.log(
        "OTP verification response:",
        data
      );

      // ========================================
      // VERIFICATION SUCCESS
      // ========================================

      setIsVerified(true);

      setMessage(
        "Your email has been verified successfully."
      );

      setMessageType("success");

      // Go to Login after 2 seconds
      setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 2000);

    } catch (error) {
      console.error(
        "OTP verification error:",
        error
      );

      const errorMsg =
        error.response?.data?.message ||
        (error.response
          ? "Invalid OTP. Please try again."
          : "Unable to connect to the server. Please try again.");

      setMessage(errorMsg);

      setMessageType("error");

      setIsVerifying(false);
    }
  };


  // ========================================
  // RESEND OTP
  // ========================================

  const handleResend = async () => {
    // Don't resend after verification
    if (isVerified) {
      return;
    }

    // Prevent multiple requests
    if (isResending) {
      return;
    }

    // Check email
    if (!email) {
      setMessage(
        "Email information is missing. Please register again."
      );

      setMessageType("error");

      return;
    }

    setIsResending(true);

    try {
      console.log(
        "Requesting new OTP..."
      );

      const data = await resendOtpApi(email);

      console.log(
        "Resend OTP response:",
        data
      );

      // ========================================
      // RESEND SUCCESS
      // ========================================

      // Clear old OTP
      setOtp([
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      // Reset timer
      setTimeLeft(60);

      // Show success message
      setMessage(
        "A new OTP has been sent to your email."
      );

      setMessageType("success");

      // Focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);

    } catch (error) {
      console.error(
        "Resend OTP error:",
        error
      );

      const errorMsg =
        error.response?.data?.message ||
        (error.response
          ? "Unable to resend OTP."
          : "Unable to connect to the server.");

      setMessage(errorMsg);

      setMessageType("error");

    } finally {
      setIsResending(false);
    }
  };


  // ========================================
  // TIME FORMAT
  // ========================================

  const minutes = Math.floor(
    timeLeft / 60
  );

  const seconds = timeLeft % 60;

  const formattedTime =
    `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;


  // ========================================
  // PAGE
  // ========================================

  return (
    <main className="otp-page">

      {/* ========================================
          MAIN CARD
      ======================================== */}

      <section className="otp-card">

        {/* BRAND */}

        <div className="otp-brand">

          <div className="otp-logo">
            F
          </div>

          <div>
            <h1>FEXA</h1>

            <span>
              HAUTE PARFUMERIE
            </span>
          </div>

        </div>


        {/* HEADING */}

        <div className="otp-heading">

          <span className="otp-label">
            SECURITY VERIFICATION
          </span>

          <h2>
            Verify Your
            <br />
            Email
          </h2>

          <p>
            We've sent a 6-digit
            verification code to
          </p>

          <strong>
            {email || "your email address"}
          </strong>

        </div>


        {/* OTP INPUTS */}

        <div className="otp-input-container">

          {otp.map((value, index) => (
            <input
              key={index}

              ref={(element) => {
                inputRefs.current[index] =
                  element;
              }}

              className="otp-input"

              type="text"

              inputMode="numeric"

              maxLength={1}

              value={value}

              onChange={(e) =>
                handleChange(
                  e.target.value,
                  index
                )
              }

              onKeyDown={(e) =>
                handleKeyDown(
                  e,
                  index
                )
              }

              onPaste={handlePaste}

              disabled={
                isVerified ||
                isVerifying
              }

              aria-label={`OTP digit ${
                index + 1
              }`}
            />
          ))}

        </div>


        {/* TIMER */}

        <div className="otp-timer">

          {timeLeft > 0 ? (
            <>
              Code expires in{" "}

              <strong>
                {formattedTime}
              </strong>
            </>
          ) : (
            <span className="expired-text">
              Your OTP has expired
            </span>
          )}

        </div>


        {/* VERIFY BUTTON */}

        <button
          type="button"
          className="verify-button"
          onClick={handleVerify}
          disabled={
            isVerified ||
            isVerifying
          }
        >
          {isVerifying
            ? "VERIFYING..."
            : "VERIFY OTP"}

          {!isVerifying && (
            <span>
              →
            </span>
          )}
        </button>


        {/* RESEND OTP */}

        <div className="resend-section">

          <span>
            Didn't receive the code?
          </span>

          <button
            type="button"
            className="resend-button"
            onClick={handleResend}
            disabled={
              isVerified ||
              isResending
            }
          >
            {isResending
              ? "Sending..."
              : "Resend OTP"}
          </button>

        </div>


        {/* BACK TO REGISTER */}

        <button
          type="button"
          className="back-login"
          onClick={() =>
            navigate("/register")
          }
        >
          ← Back to Sign Up
        </button>


        {/* FOOTER */}

        <div className="otp-footer">

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

      </section>


      {/* ========================================
          MESSAGE POPUP
      ======================================== */}

      {message && (
        <div
          className={`otp-message ${
            messageType === "success"
              ? "success"
              : "error"
          }`}
        >

          <div className="message-icon">
            {messageType === "success"
              ? "✓"
              : "!"}
          </div>

          <div>

            <strong>
              {messageType === "success"
                ? "Verification Successful"
                : "Verification Failed"}
            </strong>

            <p>
              {message}
            </p>

          </div>

          <button
            type="button"
            onClick={() => {
              setMessage("");
              setMessageType("");
            }}
          >
            ×
          </button>

        </div>
      )}

    </main>
  );
}

export default VerifyOtp;