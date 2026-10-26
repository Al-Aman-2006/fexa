import { ContactMessage, ALLOWED_REASONS } from "../models/contact.model.js";
import { sendContactConfirmationEmail } from "../services/email.service.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// In-memory rate limiter for contact form abuse protection (sliding window)
// Max 5 inquiries per IP within 10 minutes
const submissionTimestamps = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of submissionTimestamps.entries()) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) {
      submissionTimestamps.delete(ip);
    } else {
      submissionTimestamps.set(ip, fresh);
    }
  }
}, 5 * 60 * 1000);

const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

/**
 * Extract authenticated user if JWT token cookie exists (optional auth)
 */
const getOptionalUser = async (req) => {
  try {
    const token = req.cookies?.token;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    const user = await User.findById(decoded.id).select("_id name email");
    return user || null;
  } catch (err) {
    return null;
  }
};

/**
 * POST /api/contact
 * Submit a customer support inquiry
 */
const submitContactMessage = async (req, res) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";

    // Rate limiting check
    const now = Date.now();
    const history = submissionTimestamps.get(ip) || [];
    const recent = history.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (recent.length >= MAX_SUBMISSIONS_PER_WINDOW) {
      return res.status(429).json({
        success: false,
        message: "You have submitted several inquiries recently. Please allow a few minutes before sending another message.",
      });
    }

    const { fullName, name, email, reason, orderNumber, subject, message } = req.body;

    const rawName = fullName || name;

    // 1. Name validation
    if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
        field: "fullName",
      });
    }

    const trimmedName = rawName.trim();
    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters.",
        field: "fullName",
      });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name cannot exceed 100 characters.",
        field: "fullName",
      });
    }

    if (/\d/.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        message: "Name cannot contain numbers.",
        field: "fullName",
      });
    }

    if (!/^[\p{L}\s'\-.’]+$/u.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid human name using letters.",
        field: "fullName",
      });
    }

    const letterCount = (trimmedName.match(/\p{L}/gu) || []).length;
    if (letterCount < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must contain at least 2 letters.",
        field: "fullName",
      });
    }

    // 2. Email validation
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
        field: "email",
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail.length > 254 || !EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
        field: "email",
      });
    }

    // 3. Reason validation
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please select a reason for contact.",
        field: "reason",
      });
    }

    const trimmedReason = reason.trim();
    if (!ALLOWED_REASONS.includes(trimmedReason)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reason for contact selected. Please choose a valid option.",
        field: "reason",
      });
    }

    // 4. Order number validation (optional)
    let sanitizedOrderNumber = null;
    if (orderNumber && typeof orderNumber === "string" && orderNumber.trim()) {
      sanitizedOrderNumber = orderNumber.trim().toUpperCase();
      if (sanitizedOrderNumber.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Order number cannot exceed 50 characters.",
          field: "orderNumber",
        });
      }
      if (!/^[A-Z0-9\-_#]+$/i.test(sanitizedOrderNumber)) {
        return res.status(400).json({
          success: false,
          message: "Order number contains invalid characters.",
          field: "orderNumber",
        });
      }
    }

    // 5. Subject validation
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required.",
        field: "subject",
      });
    }

    const trimmedSubject = subject.trim();
    if (trimmedSubject.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Subject must be at least 3 characters.",
        field: "subject",
      });
    }

    if (trimmedSubject.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Subject cannot exceed 120 characters.",
        field: "subject",
      });
    }

    // 6. Message validation
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
        field: "message",
      });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please provide a message with at least 10 characters.",
        field: "message",
      });
    }

    if (trimmedMessage.length > 1500) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 1500 characters.",
        field: "message",
      });
    }

    // Check optional authenticated user
    const user = await getOptionalUser(req);

    // Persist to MongoDB
    const contactRecord = new ContactMessage({
      name: trimmedName,
      email: trimmedEmail,
      reason: trimmedReason,
      orderNumber: sanitizedOrderNumber,
      subject: trimmedSubject,
      message: trimmedMessage,
      user: user ? user._id : null,
      ipAddress: typeof ip === "string" ? ip.slice(0, 45) : null,
    });

    await contactRecord.save();

    // Update rate limiting tracker
    recent.push(now);
    submissionTimestamps.set(ip, recent);

    // Trigger non-blocking email delivery in background (graceful fallback)
    sendContactConfirmationEmail({
      name: trimmedName,
      email: trimmedEmail,
      reason: trimmedReason,
      orderNumber: sanitizedOrderNumber,
      subject: trimmedSubject,
      message: trimmedMessage,
    })
      .then(async (emailSent) => {
        if (emailSent) {
          contactRecord.emailDelivered = true;
          await contactRecord.save();
        }
      })
      .catch((mailErr) => {
        console.warn("Contact email delivery notice: SMTP delivery deferred or failed:", mailErr.message);
      });

    return res.status(201).json({
      success: true,
      message:
        "Thank you for reaching out! Your message has been submitted successfully. Our team will review your inquiry and respond using the email address you provided.",
      inquiry: {
        id: contactRecord._id,
        createdAt: contactRecord.createdAt,
      },
    });
  } catch (error) {
    console.error("Submit contact error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while submitting your message. Please try again shortly.",
    });
  }
};

/**
 * GET /api/contact/reasons
 * List supported contact reasons
 */
const getContactReasons = (req, res) => {
  return res.status(200).json({
    success: true,
    reasons: ALLOWED_REASONS,
  });
};

export {
  submitContactMessage,
  getContactReasons,
};

export default {
  submitContactMessage,
  getContactReasons,
};
