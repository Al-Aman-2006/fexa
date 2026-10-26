import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

import User from "../models/user.model.js";

import {
  generateOtp,
  hashOtp,
} from "../utils/otp.js";

import {
  generateResetToken,
  hashResetToken,
} from "../utils/resetToken.js";

import {
  sendOtpEmail,
  sendPasswordResetEmail,
} from "./email.service.js";


// ========================================
// REGISTER USER
// ========================================

const registerUser = async (userData) => {

  const {
    name,
    email,
    password,
    phone,
  } = userData;


  // ========================================
  // NORMALIZE EMAIL
  // ========================================

  const normalizedEmail =
    email.trim().toLowerCase();


  // ========================================
  // DEBUG INFORMATION
  // ========================================

  console.log("====================================");

  console.log(
    "REGISTER EMAIL RECEIVED:",
    email
  );

  console.log(
    "NORMALIZED EMAIL:",
    normalizedEmail
  );


  // ========================================
  // CHECK EXISTING USER
  // ========================================

  const existingUser =
    await User.findOne({
      email: normalizedEmail,
    });


  if (existingUser) {

    console.log(
      "❌ EXISTING USER FOUND"
    );

    console.log(
      "USER ID:",
      existingUser._id
    );

    console.log(
      "USER NAME:",
      existingUser.name
    );

    console.log(
      "USER EMAIL:",
      existingUser.email
    );

    console.log(
      "EMAIL VERIFIED:",
      existingUser.emailVerified
    );

  } else {

    console.log(
      "✅ NO EXISTING USER FOUND"
    );
  }


  console.log(
    "===================================="
  );


  if (existingUser) {

    throw new Error(
      "User already exists"
    );
  }


  // ========================================
  // HASH PASSWORD
  // ========================================

  const hashedPassword =
    await bcrypt.hash(
      password,
      10
    );


  // ========================================
  // GENERATE OTP
  // ========================================

  const otp =
    generateOtp();


  // Hash OTP before storing

  const otpHash =
    hashOtp(otp);


  // OTP expires after 1 minute

  const otpExpiresAt =
    new Date(
      Date.now() + 60 * 1000
    );


  // ========================================
  // CREATE USER
  // ========================================

  const user =
    await User.create({

      name,

      email:
        normalizedEmail,

      password:
        hashedPassword,

      phone,

      emailVerified:
        false,

      otpHash,

      otpExpiresAt,

    });


  // ========================================
  // SEND OTP EMAIL
  // ========================================

  try {

    await sendOtpEmail(
      normalizedEmail,
      otp
    );


    console.log(
      "✅ OTP email sent successfully"
    );

  } catch (error) {

    console.error(
      "❌ OTP email failed:",
      error
    );


    // Remove user if email failed

    await User.deleteOne({
      _id: user._id,
    });


    throw new Error(
      "Unable to send verification email"
    );
  }


  // ========================================
  // RETURN USER
  // ========================================

  return {

    id: user._id,

    name: user.name,

    email: user.email,

  };
};


// ========================================
// LOGIN USER
// ========================================

const loginUser = async (
  email,
  password
) => {


  // ========================================
  // NORMALIZE EMAIL
  // ========================================

  const normalizedEmail =
    email.trim().toLowerCase();


  // ========================================
  // FIND USER
  // ========================================

  const user =
    await User.findOne({
      email: normalizedEmail,
    });


  if (!user) {

    throw new Error(
      "Invalid email or password"
    );
  }

  if (user.isBlocked) {
    throw new Error(
      "Your account has been blocked. Please contact the administrator."
    );
  }


  // ========================================
  // CHECK EMAIL VERIFICATION
  // ========================================

  if (!user.emailVerified) {

    throw new Error(
      "Please verify your email before logging in"
    );
  }


  // ========================================
  // CHECK PASSWORD
  // ========================================

  const isPasswordCorrect =
    await bcrypt.compare(
      password,
      user.password
    );


  if (!isPasswordCorrect) {

    throw new Error(
      "Invalid email or password"
    );
  }


  // ========================================
  // GENERATE JWT
  // ========================================

  const token =
    jwt.sign(

      {
        id: user._id,
        email: user.email,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "7d",
      }
    );


  // ========================================
  // RETURN LOGIN DATA
  // ========================================

  return {

    token,

    user: {

      id: user._id,

      name: user.name,

      email: user.email,

      phone: user.phone,

      profileImage: user.profileImage,

      authProvider: user.authProvider || "local",

    },
  };
};


// ========================================
// VERIFY OTP
// ========================================

const verifyOtp = async (
  email,
  otp
) => {


  // ========================================
  // NORMALIZE EMAIL
  // ========================================

  const normalizedEmail =
    email.trim().toLowerCase();


  // ========================================
  // FIND USER
  // ========================================

  const user =
    await User.findOne({
      email: normalizedEmail,
    });


  if (!user) {

    throw new Error(
      "User not found"
    );
  }


  // ========================================
  // CHECK IF ALREADY VERIFIED
  // ========================================

  if (user.emailVerified) {

    throw new Error(
      "Email is already verified"
    );
  }


  // ========================================
  // CHECK OTP EXISTS
  // ========================================

  if (
    !user.otpHash ||
    !user.otpExpiresAt
  ) {

    throw new Error(
      "No OTP found. Please request a new OTP"
    );
  }


  // ========================================
  // CHECK OTP EXPIRATION
  // ========================================

  if (
    new Date() >
    user.otpExpiresAt
  ) {

    throw new Error(
      "OTP has expired"
    );
  }


  // ========================================
  // HASH ENTERED OTP
  // ========================================

  const enteredOtpHash =
    hashOtp(otp);


  // ========================================
  // COMPARE OTP
  // ========================================

  if (
    enteredOtpHash !==
    user.otpHash
  ) {

    throw new Error(
      "Invalid OTP"
    );
  }


  // ========================================
  // OTP IS CORRECT
  // ========================================

  user.emailVerified =
    true;


  // Remove OTP

  user.otpHash =
    null;

  user.otpExpiresAt =
    null;


  await user.save();


  console.log(
    "✅ Email verified successfully:",
    normalizedEmail
  );


  // ========================================
  // RETURN USER
  // ========================================

  return {

    id: user._id,

    name: user.name,

    email: user.email,

  };
};


// ========================================
// RESEND OTP
// ========================================

const resendOtp = async (
  email
) => {


  // ========================================
  // NORMALIZE EMAIL
  // ========================================

  const normalizedEmail =
    email.trim().toLowerCase();


  // ========================================
  // FIND USER
  // ========================================

  const user =
    await User.findOne({
      email: normalizedEmail,
    });


  if (!user) {

    throw new Error(
      "User not found"
    );
  }


  // ========================================
  // CHECK VERIFICATION
  // ========================================

  if (user.emailVerified) {

    throw new Error(
      "Email is already verified"
    );
  }


  // ========================================
  // GENERATE NEW OTP
  // ========================================

  const otp =
    generateOtp();


  // Hash new OTP

  const otpHash =
    hashOtp(otp);


  // New expiry = 1 minute

  const otpExpiresAt =
    new Date(
      Date.now() + 60 * 1000
    );


  // ========================================
  // UPDATE USER
  // ========================================

  user.otpHash =
    otpHash;

  user.otpExpiresAt =
    otpExpiresAt;


  await user.save();


  // ========================================
  // SEND NEW OTP
  // ========================================

  try {

    await sendOtpEmail(
      normalizedEmail,
      otp
    );


    console.log(
      "✅ New OTP sent successfully:",
      normalizedEmail
    );

  } catch (error) {

    console.error(
      "❌ Resend OTP email failed:",
      error
    );


    throw new Error(
      "Unable to send verification email"
    );
  }


  return true;
};


// ========================================
// FORGOT PASSWORD
// ========================================

const forgotPassword = async (
  email
) => {


  // ========================================
  // NORMALIZE EMAIL
  // ========================================

  const normalizedEmail =
    email.trim().toLowerCase();


  // ========================================
  // FIND USER
  // ========================================

  const user =
    await User.findOne({
      email: normalizedEmail,
    });


  /*
    IMPORTANT:

    We don't reveal whether the
    email exists or not.
  */

  if (!user) {

    return true;
  }


  // ========================================
  // GENERATE RESET TOKEN
  // ========================================

  const resetToken =
    generateResetToken();


  // ========================================
  // HASH RESET TOKEN
  // ========================================

  const resetTokenHash =
    hashResetToken(
      resetToken
    );


  // ========================================
  // RESET TOKEN EXPIRATION
  // ========================================

  const resetPasswordExpiresAt =
    new Date(
      Date.now() +
      15 * 60 * 1000
    );


  // ========================================
  // SAVE RESET TOKEN
  // ========================================

  user.resetPasswordToken =
    resetTokenHash;

  user.resetPasswordExpiresAt =
    resetPasswordExpiresAt;


  await user.save();


  // ========================================
  // SEND RESET EMAIL
  // ========================================

  try {

    await sendPasswordResetEmail(
      normalizedEmail,
      resetToken
    );


    console.log(
      "✅ Password reset email sent:",
      normalizedEmail
    );

  } catch (error) {

    console.error(
      "❌ Password reset email failed:",
      error
    );


    // Remove token if email failed

    user.resetPasswordToken =
      null;

    user.resetPasswordExpiresAt =
      null;


    await user.save();


    throw new Error(
      "Unable to send password reset email"
    );
  }


  return true;
};


// ========================================
// RESET PASSWORD
// ========================================

const resetPassword = async (
  token,
  newPassword
) => {

  // ========================================
  // HASH TOKEN FROM URL
  // ========================================

  const tokenHash =
    hashResetToken(token);


  // ========================================
  // FIND USER
  // ========================================

  const user =
    await User.findOne({

      resetPasswordToken:
        tokenHash,

      resetPasswordExpiresAt: {
        $gt: new Date(),
      },

    });


  // ========================================
  // TOKEN INVALID / EXPIRED
  // ========================================

  if (!user) {

    throw new Error(
      "Password reset link is invalid or expired"
    );
  }


  // ========================================
  // HASH NEW PASSWORD
  // ========================================

  const hashedPassword =
    await bcrypt.hash(
      newPassword,
      10
    );


  // ========================================
  // UPDATE PASSWORD
  // ========================================

  user.password =
    hashedPassword;


  // ========================================
  // VERIFY EMAIL
  // ========================================

  /*
    The user successfully opened the
    password reset link that was sent
    to their email.

    Therefore, we can mark the email
    as verified.
  */

  user.emailVerified = true;


  // ========================================
  // CLEAR RESET TOKEN
  // ========================================

  user.resetPasswordToken =
    null;

  user.resetPasswordExpiresAt =
    null;


  // ========================================
  // SAVE USER
  // ========================================

  await user.save();


  console.log(
    "✅ Password reset successfully:",
    user.email
  );

  console.log(
    "✅ Email marked as verified:",
    user.emailVerified
  );


  return true;
};

// ========================================
// GOOGLE LOGIN USER
// ========================================

const googleLoginUser = async (credential) => {
  if (!credential) {
    throw new Error("Google credential token is required");
  }

  let payload;
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID || undefined,
    });
    payload = ticket.getPayload();
  } catch (err) {
    payload = jwt.decode(credential);
  }

  if (!payload || !payload.sub || !payload.email) {
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${credential}` },
      });
      if (response.ok) {
        payload = await response.json();
      }
    } catch (e) {
      console.error("Google userinfo fetch error:", e);
    }
  }

  if (!payload || (!payload.sub && !payload.id) || !payload.email) {
    throw new Error("Invalid or expired Google token");
  }

  const sub = payload.sub || payload.id;
  const email = payload.email;
  const email_verified = payload.email_verified;
  const name = payload.name;
  const picture = payload.picture;

  if (email_verified === false) {
    throw new Error("Google email is not verified");
  }

  const normalizedEmail = email.trim().toLowerCase();

  let user = await User.findOne({
    $or: [{ googleId: sub }, { email: normalizedEmail }],
  });

  if (user) {
    if (user.isBlocked) {
      throw new Error("Your account has been blocked. Please contact the administrator.");
    }
    if (!user.googleId) {
      user.googleId = sub;
    }
    user.authProvider = "google";
    user.emailVerified = true;
    if (!user.profileImage && picture) {
      user.profileImage = picture;
    }
    await user.save();
  } else {
    user = await User.create({
      name: name || "Google User",
      email: normalizedEmail,
      authProvider: "google",
      googleId: sub,
      emailVerified: true,
      profileImage: picture || "",
    });
  }

  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      profileImage: user.profileImage || "",
      authProvider: user.authProvider || "google",
    },
  };
};

// ========================================
// EXPORTS
// ========================================

export {
  registerUser,
  loginUser,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  googleLoginUser,
};

export default {
  registerUser,
  loginUser,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  googleLoginUser,
};