import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { validateName } from "../../utils/validation";
import "./ContactSection.css";

const CONTACT_REASONS = [
  "General Inquiry",
  "Fragrance Information",
  "Order Support",
  "Shipping and Delivery",
  "Returns and Refunds",
  "Product Availability",
  "Other",
];

const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export default function ContactSection({ id = "contact-section" }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    reason: "General Inquiry",
    orderNumber: "",
    subject: "",
    message: "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);

  // Authenticated User Orders (for Order Support selector)
  const [userOrders, setUserOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSelectionMode, setOrderSelectionMode] = useState("manual");

  // Auto-fill user details if logged in
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.name || "",
        email: prev.email || user.email || "",
      }));
    }
  }, [user]);

  // Fetch user orders when Order Support is selected and user is logged in
  useEffect(() => {
    if (user && formData.reason === "Order Support" && userOrders.length === 0) {
      const fetchOrders = async () => {
        try {
          setLoadingOrders(true);
          const res = await fetch("http://localhost:5000/api/orders", {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            const orders = data.orders || [];
            setUserOrders(orders);
            if (orders.length > 0) {
              setOrderSelectionMode("select");
            }
          }
        } catch (err) {
          console.warn("Unable to fetch user orders for contact selector:", err);
        } finally {
          setLoadingOrders(false);
        }
      };
      fetchOrders();
    }
  }, [user, formData.reason, userOrders.length]);

  // Validation function
  const validateField = (name, value) => {
    switch (name) {
      case "fullName": {
        const err = validateName(value);
        return err || "";
      }
      case "email": {
        const trimmed = (value || "").trim().toLowerCase();
        if (!trimmed) return "Email address is required.";
        if (!EMAIL_REGEX.test(trimmed)) return "Please enter a valid email address.";
        if (trimmed.length > 254) return "Email cannot exceed 254 characters.";
        return "";
      }
      case "reason": {
        if (!value || !CONTACT_REASONS.includes(value)) {
          return "Please select a valid reason for contact.";
        }
        return "";
      }
      case "orderNumber": {
        const trimmed = (value || "").trim();
        if (trimmed && trimmed.length > 50) {
          return "Order number cannot exceed 50 characters.";
        }
        if (trimmed && !/^[A-Za-z0-9\-_#]+$/.test(trimmed)) {
          return "Order number contains invalid characters.";
        }
        return "";
      }
      case "subject": {
        const trimmed = (value || "").trim();
        if (!trimmed) return "Subject is required.";
        if (trimmed.length < 3) return "Subject must be at least 3 characters.";
        if (trimmed.length > 120) return "Subject cannot exceed 120 characters.";
        return "";
      }
      case "message": {
        const trimmed = (value || "").trim();
        if (!trimmed) return "Message is required.";
        if (trimmed.length < 10) return "Message must be at least 10 characters.";
        if (trimmed.length > 1500) return "Message cannot exceed 1500 characters.";
        return "";
      }
      default:
        return "";
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (submissionError) setSubmissionError(null);

    if (touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleOrderSelect = (e) => {
    const selectedVal = e.target.value;
    if (selectedVal === "MANUAL_ENTRY") {
      setOrderSelectionMode("manual");
      setFormData((prev) => ({ ...prev, orderNumber: "" }));
    } else {
      setFormData((prev) => ({ ...prev, orderNumber: selectedVal }));
      if (touched.orderNumber) {
        setErrors((prev) => ({ ...prev, orderNumber: "" }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionError(null);

    // Validate all fields
    const newErrors = {};
    const fieldsToValidate = ["fullName", "email", "reason", "orderNumber", "subject", "message"];

    fieldsToValidate.forEach((field) => {
      const err = validateField(field, formData[field]);
      if (err) newErrors[field] = err;
    });

    setTouched({
      fullName: true,
      email: true,
      reason: true,
      orderNumber: true,
      subject: true,
      message: true,
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstInvalid = fieldsToValidate.find((f) => newErrors[f]);
      if (firstInvalid) {
        const el = document.getElementById(`contact-field-${firstInvalid}`);
        if (el) el.focus();
      }
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("http://localhost:5000/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          reason: formData.reason,
          orderNumber: formData.orderNumber.trim() || null,
          subject: formData.subject.trim(),
          message: formData.message.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmissionSuccess({
          message: data.message,
          inquiryId: data.inquiry?.id,
          email: formData.email.trim(),
        });
      } else {
        setSubmissionError(data.message || "Unable to send your inquiry. Please try again.");
      }
    } catch (err) {
      console.error("Contact submission network error:", err);
      setSubmissionError(
        "Unable to connect to the atelier service. Please verify your internet connection or email us directly at concierge@fexa.com."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      fullName: user?.name || "",
      email: user?.email || "",
      reason: "General Inquiry",
      orderNumber: "",
      subject: "",
      message: "",
    });
    setErrors({});
    setTouched({});
    setSubmissionSuccess(null);
    setSubmissionError(null);
  };

  return (
    <section id={id} className="home-contact-section">
      <div className="contact-section-container">
        {/* Section Header */}
        <div className="contact-section-header">
          <span className="home-section-eyebrow">LET'S CONNECT</span>
          <h2 className="contact-section-title">We'd Love to Hear From You.</h2>
          <p className="contact-section-subtitle">
            Have a question about a fragrance, an order, or your FEXA experience? Send us a message.
          </p>
        </div>

        {/* 3 Contact Information Cards */}
        <div className="contact-info-cards-grid">
          {/* Card 1: Email Correspondence */}
          <article className="contact-summary-card">
            <div className="summary-card-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <span className="summary-card-badge">CLIENT CONCIERGE</span>
            <h3 className="summary-card-title">Email Correspondence</h3>
            <p className="summary-card-desc">
              For detailed fragrance inquiries, bespoke consultations, or general assistance, write directly to our atelier team.
            </p>
            <div className="summary-card-footer">
              <a href="mailto:concierge@fexa.com" className="summary-link-primary">
                concierge@fexa.com
              </a>
              <span className="summary-availability">Reviewed within 24 hours</span>
            </div>
          </article>

          {/* Card 2: Orders & Dispatch */}
          <article className="contact-summary-card">
            <div className="summary-card-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <span className="summary-card-badge">DISPATCH & ORDERS</span>
            <h3 className="summary-card-title">Order Assistance</h3>
            <p className="summary-card-desc">
              Questions about shipping status, temperature-stabilized packaging, or order modifications?
            </p>
            <div className="summary-card-footer">
              <button
                type="button"
                className="summary-button-link"
                onClick={() => navigate(user ? "/profile" : "/login")}
              >
                View Order History →
              </button>
              <span className="summary-availability">Track status live in your profile</span>
            </div>
          </article>

          {/* Card 3: Atelier Consultation */}
          <article className="contact-summary-card">
            <div className="summary-card-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span className="summary-card-badge">ALWAYS AVAILABLE</span>
            <h3 className="summary-card-title">Atelier Consultation</h3>
            <p className="summary-card-desc">
              Send us a message anytime using the contact form below, and our team will get back to you promptly.
            </p>
            <div className="summary-card-footer">
              <span className="summary-link-primary">Direct Form Message</span>
              <span className="summary-availability">Active 7 days a week</span>
            </div>
          </article>
        </div>

        {/* Contact Form Section Layout */}
        <div className="contact-form-layout">
          {/* Editorial Column */}
          <div className="form-editorial-col">
            <span className="home-section-eyebrow">DIRECT INQUIRY</span>
            <h3 className="form-editorial-title">
              Send Us <br />
              <span className="title-accent">a Message</span>
            </h3>
            <p className="form-editorial-text">
              Tell us how we can help, and our team will get back to you. Whether seeking guidance on notes,
              inquiring about bottle maceration, or checking dispatch timelines, we treat every inquiry with utmost care.
            </p>

            <div className="form-pledge-card">
              <div className="pledge-icon">✨</div>
              <div className="pledge-body">
                <h4>Quiet Restraint & Privacy</h4>
                <p>Your correspondence is strictly confidential. We never share your email address or personal details.</p>
              </div>
            </div>

            <div className="form-quick-direct">
              <span className="direct-label">NEED IMMEDIATE ASSISTANCE?</span>
              <p>
                Reach our head perfumery concierge at{" "}
                <a href="mailto:concierge@fexa.com">concierge@fexa.com</a>
              </p>
            </div>
          </div>

          {/* Form Card Box */}
          <div className="form-card-col">
            <div className="contact-card-box">
              {submissionSuccess ? (
                <div className="contact-success-state" role="status" aria-live="polite">
                  <div className="success-icon-wrap">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#765493" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <h4 className="success-title">Message Received</h4>
                  <p className="success-desc">
                    Thank you. Your message has been sent to our concierge. We will review it and reply to{" "}
                    <strong>{submissionSuccess.email}</strong> as soon as possible.
                  </p>
                  {submissionSuccess.inquiryId && (
                    <div className="success-reference-box">
                      <span>Inquiry Reference:</span>
                      <code>{submissionSuccess.inquiryId}</code>
                    </div>
                  )}
                  <button type="button" className="success-new-btn" onClick={handleResetForm}>
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form className="fexa-contact-form" onSubmit={handleSubmit} noValidate>
                  {submissionError && (
                    <div className="form-alert-error" role="alert">
                      <span className="alert-icon">⚠️</span>
                      <span>{submissionError}</span>
                    </div>
                  )}

                  {/* Name & Email Row */}
                  <div className="form-row-two-col">
                    <div className={`form-field-group ${errors.fullName && touched.fullName ? "has-error" : ""}`}>
                      <label htmlFor="contact-field-fullName" className="form-label">
                        Full Name <span className="req-star">*</span>
                      </label>
                      <input
                        id="contact-field-fullName"
                        type="text"
                        name="fullName"
                        className="form-input"
                        placeholder="e.g. Julian Vance"
                        value={formData.fullName}
                        onChange={handleChange}
                        onBlur={() => handleBlur("fullName")}
                        autoComplete="name"
                        maxLength={100}
                        disabled={submitting}
                      />
                      {errors.fullName && touched.fullName && (
                        <span className="field-error-msg">{errors.fullName}</span>
                      )}
                    </div>

                    <div className={`form-field-group ${errors.email && touched.email ? "has-error" : ""}`}>
                      <label htmlFor="contact-field-email" className="form-label">
                        Email Address <span className="req-star">*</span>
                      </label>
                      <input
                        id="contact-field-email"
                        type="email"
                        name="email"
                        className="form-input"
                        placeholder="e.g. patron@fexa.com"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={() => handleBlur("email")}
                        autoComplete="email"
                        maxLength={254}
                        disabled={submitting}
                      />
                      {errors.email && touched.email && (
                        <span className="field-error-msg">{errors.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Reason & Order Number Row */}
                  <div className="form-row-two-col">
                    <div className={`form-field-group ${errors.reason && touched.reason ? "has-error" : ""}`}>
                      <label htmlFor="contact-field-reason" className="form-label">
                        Reason for Contact <span className="req-star">*</span>
                      </label>
                      <div className="select-wrapper">
                        <select
                          id="contact-field-reason"
                          name="reason"
                          className="form-select"
                          value={formData.reason}
                          onChange={handleChange}
                          onBlur={() => handleBlur("reason")}
                          disabled={submitting}
                        >
                          {CONTACT_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <span className="select-arrow">▾</span>
                      </div>
                      {errors.reason && touched.reason && (
                        <span className="field-error-msg">{errors.reason}</span>
                      )}
                    </div>

                    <div className={`form-field-group ${errors.orderNumber && touched.orderNumber ? "has-error" : ""}`}>
                      <div className="label-with-mode-row">
                        <label htmlFor="contact-field-orderNumber" className="form-label">
                          Order Number <span className="opt-tag">(Optional)</span>
                        </label>
                        {user && userOrders.length > 0 && formData.reason === "Order Support" && (
                          <button
                            type="button"
                            className="mode-toggle-link"
                            onClick={() =>
                              setOrderSelectionMode((prev) => (prev === "select" ? "manual" : "select"))
                            }
                          >
                            {orderSelectionMode === "select" ? "Enter manually" : "Pick from orders"}
                          </button>
                        )}
                      </div>

                      {user && userOrders.length > 0 && formData.reason === "Order Support" && orderSelectionMode === "select" ? (
                        <div className="select-wrapper">
                          <select
                            id="contact-field-orderNumber"
                            name="orderNumber"
                            className="form-select"
                            value={formData.orderNumber}
                            onChange={handleOrderSelect}
                            disabled={submitting || loadingOrders}
                          >
                            <option value="">-- Select an Order --</option>
                            {userOrders.map((ord) => (
                              <option key={ord._id} value={ord.orderNumber || ord._id}>
                                #{ord.orderNumber || ord._id.slice(-8)} (
                                {new Date(ord.createdAt).toLocaleDateString()}) - ₹{ord.totalAmount}
                              </option>
                            ))}
                            <option value="MANUAL_ENTRY">Enter a different order ID...</option>
                          </select>
                          <span className="select-arrow">▾</span>
                        </div>
                      ) : (
                        <input
                          id="contact-field-orderNumber"
                          type="text"
                          name="orderNumber"
                          className="form-input"
                          placeholder="e.g. FX-94821"
                          value={formData.orderNumber}
                          onChange={handleChange}
                          onBlur={() => handleBlur("orderNumber")}
                          maxLength={50}
                          disabled={submitting}
                        />
                      )}
                      {errors.orderNumber && touched.orderNumber && (
                        <span className="field-error-msg">{errors.orderNumber}</span>
                      )}
                    </div>
                  </div>

                  {/* Subject Field */}
                  <div className={`form-field-group ${errors.subject && touched.subject ? "has-error" : ""}`}>
                    <label htmlFor="contact-field-subject" className="form-label">
                      Subject <span className="req-star">*</span>
                    </label>
                    <input
                      id="contact-field-subject"
                      type="text"
                      name="subject"
                      className="form-input"
                      placeholder="e.g. Olfactory pyramid consultation for evening extrait"
                      value={formData.subject}
                      onChange={handleChange}
                      onBlur={() => handleBlur("subject")}
                      maxLength={120}
                      disabled={submitting}
                    />
                    {errors.subject && touched.subject && (
                      <span className="field-error-msg">{errors.subject}</span>
                    )}
                  </div>

                  {/* Message Field */}
                  <div className={`form-field-group ${errors.message && touched.message ? "has-error" : ""}`}>
                    <div className="label-with-charcount-row">
                      <label htmlFor="contact-field-message" className="form-label">
                        Message <span className="req-star">*</span>
                      </label>
                      <span className="char-counter">
                        {formData.message.length} / 1500
                      </span>
                    </div>
                    <textarea
                      id="contact-field-message"
                      name="message"
                      rows={5}
                      className="form-textarea"
                      placeholder="Please share your questions, fragrance preferences, or inquiry details..."
                      value={formData.message}
                      onChange={handleChange}
                      onBlur={() => handleBlur("message")}
                      maxLength={1500}
                      disabled={submitting}
                    />
                    {errors.message && touched.message && (
                      <span className="field-error-msg">{errors.message}</span>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="form-submit-row">
                    <button
                      type="submit"
                      className="contact-submit-btn"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span className="btn-spinner" />
                          <span>Dispatching to Concierge...</span>
                        </>
                      ) : (
                        <>
                          <span>SEND INQUIRY</span>
                          <span className="btn-arrow">→</span>
                        </>
                      )}
                    </button>
                    <span className="form-submit-privacy-note">
                      Protected by 256-bit atelier TLS encryption.
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
