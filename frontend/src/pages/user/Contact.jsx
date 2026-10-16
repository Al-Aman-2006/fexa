import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/common/Navbar";
import contactHeroImg from "../../assets/images/contact/contact_hero.jpg";
import { validateName } from "../../utils/validation";
import "./Contact.css";

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

function Contact() {
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
  const [orderSelectionMode, setOrderSelectionMode] = useState("manual"); // 'select' | 'manual'

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Auto-fill user details if logged in
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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
      // Focus on the first invalid field
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

  const faqItems = [
    {
      q: "How do I choose the right fragrance for my skin chemistry?",
      a: "Our fragrances are compounded at high extrait concentrations with natural botanical resins and pure absolutes that evolve uniquely with your skin warmth. We recommend reviewing the olfactory pyramid (top, heart, and base accords) on each product page or contacting our concierge for tailored recommendations.",
    },
    {
      q: "Where can I track my order and dispatch details?",
      a: "You can view real-time status and tracking details anytime in your Profile under Order History. All FEXA flacons are dispatched with climate-stabilized packaging to ensure delicate aromatic notes remain pristine throughout transport.",
    },
    {
      q: "What is your return and exchange policy?",
      a: "Due to the artisanal and hygienic nature of haute parfumerie, unopened and sealed flacons in their original tamper-evident packaging may be returned within 14 days of delivery. Sample vials included with orders allow you to experience the fragrance before unsealing the full flacon.",
    },
    {
      q: "Are FEXA fragrances formulated for Men, Women, or Unisex?",
      a: "FEXA creates curated portfolios for Men, Women, and Unisex. Perfumery is an art of personal expression—we invite you to explore any composition that resonates with your character, regardless of category designation.",
    },
    {
      q: "How can I request bespoke gifting or corporate orders?",
      a: "Please submit an inquiry using the contact form above with the reason 'General Inquiry' and specify your gifting timeline in the message, or email us directly at concierge@fexa.com. Our concierge will curate custom presentation boxes and sample cards.",
    },
  ];

  return (
    <div className="fexa-contact-page">
      {/* 1. Global Navigation */}
      <Navbar activePage="contact" />

      {/* 2. Hero Section: We're Here for You */}
      <section className="contact-hero-section">
        <div className="contact-hero-container">
          <div className="contact-hero-content">
            <span className="contact-eyebrow">LET'S CONNECT</span>
            <h1 className="contact-hero-title">
              We're Here <br />
              <span className="contact-title-italic">for You.</span>
            </h1>
            <p className="contact-hero-desc">
              Every fragrance journey is personal, and we're here to help make yours a beautiful experience.
              Whether you have a question about a fragrance, an order, or your FEXA experience, we'd love to hear from you.
            </p>

            <div className="contact-hero-highlights">
              <div className="hero-highlight-item">
                <span className="highlight-dot">●</span>
                <span>Personalized Olfactory Consultation</span>
              </div>
              <div className="hero-highlight-item">
                <span className="highlight-dot">●</span>
                <span>Direct Atelier Client Care</span>
              </div>
            </div>
          </div>

          <div className="contact-hero-visual">
            <div className="contact-hero-image-frame">
              <img
                src={contactHeroImg}
                alt="FEXA luxury perfume flacon on marble vanity with lavender petals"
                className="contact-hero-img"
              />
              <div className="contact-hero-badge">
                <span className="badge-flacon">HAUTE PARFUMERIE</span>
                <span className="badge-atelier">ATELIER CONCIERGE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Contact Information Cards: How Can We Help? */}
      <section className="contact-info-section">
        <div className="contact-info-container">
          <div className="contact-section-header-center">
            <span className="contact-eyebrow">HOW CAN WE HELP?</span>
            <h2 className="contact-section-title">Choose the Best Way to Reach Us</h2>
            <p className="contact-section-subtitle">
              Our dedicated atelier advisors and concierge team are available to ensure your fragrance experience is effortless and memorable.
            </p>
          </div>

          <div className="contact-info-grid">
            {/* Card 1: Email Support */}
            <article className="contact-info-card">
              <div className="info-card-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <span className="info-card-badge">CLIENT CONCIERGE</span>
              <h3 className="info-card-title">Email Correspondence</h3>
              <p className="info-card-desc">
                For detailed fragrance inquiries, bespoke consultations, or general assistance, write directly to our atelier team.
              </p>
              <div className="info-card-links">
                <a href="mailto:concierge@fexa.com" className="info-link-primary">
                  concierge@fexa.com
                </a>
                <span className="info-availability">Reviewed within 24 hours</span>
              </div>
            </article>

            {/* Card 2: Orders & Dispatch */}
            <article className="contact-info-card">
              <div className="info-card-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <span className="info-card-badge">DISPATCH & ORDERS</span>
              <h3 className="info-card-title">Order Assistance</h3>
              <p className="info-card-desc">
                Questions about shipping status, temperature-stabilized packaging, or order modifications?
              </p>
              <div className="info-card-links">
                <button
                  type="button"
                  className="info-button-link"
                  onClick={() => navigate("/profile")}
                >
                  View Order History →
                </button>
                <span className="info-availability">Track status live in your profile</span>
              </div>
            </article>

            {/* Card 3: Atelier Sanctuary & Hours */}
            <article className="contact-info-card">
              <div className="info-card-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span className="info-card-badge">ALWAYS AVAILABLE</span>
              <h3 className="info-card-title">Atelier Consultation</h3>
              <p className="info-card-desc">
                Send us a message anytime using the contact form below, and our team will get back to you as soon as possible.
              </p>
              <div className="info-card-links">
                <a href="#contact-form-section" className="info-link-primary">
                  Send Form Message ↓
                </a>
                <span className="info-availability">Active 7 days a week</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 4. Contact Form Section: Send Us a Message */}
      <section id="contact-form-section" className="contact-form-section">
        <div className="contact-form-container">
          <div className="contact-form-layout">
            {/* Form Left Side: Editorial Context */}
            <div className="form-editorial-col">
              <span className="contact-eyebrow">DIRECT INQUIRY</span>
              <h2 className="form-editorial-title">
                Send Us <br />
                <span className="title-accent">a Message</span>
              </h2>
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

            {/* Form Right Side: Interactive Form Card */}
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

                    <h3 className="success-heading">Thank You for Reaching Out!</h3>
                    <p className="success-desc">
                      {submissionSuccess.message}
                    </p>

                    <div className="success-receipt-badge">
                      <span>INQUIRY CONFIRMATION SENT TO:</span>
                      <strong>{submissionSuccess.email}</strong>
                    </div>

                    <button
                      type="button"
                      className="contact-btn-primary"
                      onClick={handleResetForm}
                    >
                      SEND ANOTHER MESSAGE
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate className="fexa-contact-form">
                    {submissionError && (
                      <div className="form-alert-error" role="alert">
                        <span className="alert-icon">⚠️</span>
                        <span>{submissionError}</span>
                      </div>
                    )}

                    {/* Row 1: Full Name & Email */}
                    <div className="form-row-two-col">
                      <div className="form-field-group">
                        <label htmlFor="contact-field-fullName" className="form-label">
                          Full Name <span className="req-star">*</span>
                        </label>
                        <input
                          id="contact-field-fullName"
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          onBlur={() => handleBlur("fullName")}
                          placeholder="e.g. Eleanor Vance"
                          className={`form-input ${touched.fullName && errors.fullName ? "invalid" : ""}`}
                          aria-invalid={touched.fullName && !!errors.fullName}
                          aria-describedby={touched.fullName && errors.fullName ? "error-fullName" : undefined}
                          autoComplete="name"
                          required
                        />
                        {touched.fullName && errors.fullName && (
                          <span id="error-fullName" className="field-error-msg" role="alert">
                            {errors.fullName}
                          </span>
                        )}
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="contact-field-email" className="form-label">
                          Email Address <span className="req-star">*</span>
                        </label>
                        <input
                          id="contact-field-email"
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          onBlur={() => handleBlur("email")}
                          placeholder="eleanor@example.com"
                          className={`form-input ${touched.email && errors.email ? "invalid" : ""}`}
                          aria-invalid={touched.email && !!errors.email}
                          aria-describedby={touched.email && errors.email ? "error-email" : undefined}
                          autoComplete="email"
                          required
                        />
                        {touched.email && errors.email && (
                          <span id="error-email" className="field-error-msg" role="alert">
                            {errors.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Reason for Contact & Order Number */}
                    <div className="form-row-two-col">
                      <div className="form-field-group">
                        <label htmlFor="contact-field-reason" className="form-label">
                          Reason for Contact <span className="req-star">*</span>
                        </label>
                        <select
                          id="contact-field-reason"
                          name="reason"
                          value={formData.reason}
                          onChange={handleChange}
                          onBlur={() => handleBlur("reason")}
                          className={`form-select ${touched.reason && errors.reason ? "invalid" : ""}`}
                          required
                        >
                          {CONTACT_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        {touched.reason && errors.reason && (
                          <span className="field-error-msg" role="alert">
                            {errors.reason}
                          </span>
                        )}
                      </div>

                      <div className="form-field-group">
                        <div className="label-with-mode-row">
                          <label htmlFor="contact-field-orderNumber" className="form-label">
                            Order Number <span className="opt-tag">(Optional)</span>
                          </label>
                          {user && userOrders.length > 0 && formData.reason === "Order Support" && (
                            <button
                              type="button"
                              className="order-mode-toggle-btn"
                              onClick={() =>
                                setOrderSelectionMode((prev) =>
                                  prev === "select" ? "manual" : "select"
                                )
                              }
                            >
                              {orderSelectionMode === "select" ? "Enter manually" : "Choose from my orders"}
                            </button>
                          )}
                        </div>

                        {user &&
                        userOrders.length > 0 &&
                        formData.reason === "Order Support" &&
                        orderSelectionMode === "select" ? (
                          <select
                            id="contact-field-orderNumber"
                            name="orderNumber"
                            value={formData.orderNumber}
                            onChange={handleOrderSelect}
                            className="form-select order-select"
                          >
                            <option value="">-- Select an Order --</option>
                            {userOrders.map((ord) => (
                              <option key={ord._id} value={ord.orderNumber}>
                                #{ord.orderNumber} — ₹{ord.totalAmount?.toLocaleString("en-IN")} ({ord.status || "Placed"})
                              </option>
                            ))}
                            <option value="MANUAL_ENTRY">+ Type a different order number...</option>
                          </select>
                        ) : (
                          <input
                            id="contact-field-orderNumber"
                            type="text"
                            name="orderNumber"
                            value={formData.orderNumber}
                            onChange={handleChange}
                            onBlur={() => handleBlur("orderNumber")}
                            placeholder="e.g. FEXA-2026-1082"
                            className={`form-input ${touched.orderNumber && errors.orderNumber ? "invalid" : ""}`}
                          />
                        )}

                        {touched.orderNumber && errors.orderNumber && (
                          <span className="field-error-msg" role="alert">
                            {errors.orderNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Subject */}
                    <div className="form-field-group">
                      <label htmlFor="contact-field-subject" className="form-label">
                        Subject <span className="req-star">*</span>
                      </label>
                      <input
                        id="contact-field-subject"
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        onBlur={() => handleBlur("subject")}
                        placeholder="What can we help you with?"
                        className={`form-input ${touched.subject && errors.subject ? "invalid" : ""}`}
                        maxLength={120}
                        required
                      />
                      {touched.subject && errors.subject && (
                        <span className="field-error-msg" role="alert">
                          {errors.subject}
                        </span>
                      )}
                    </div>

                    {/* Row 4: Message with Character Count */}
                    <div className="form-field-group">
                      <div className="message-header-row">
                        <label htmlFor="contact-field-message" className="form-label">
                          Message <span className="req-star">*</span>
                        </label>
                        <span className={`char-counter ${formData.message.length > 1400 ? "warn" : ""}`}>
                          {formData.message.length} / 1500
                        </span>
                      </div>
                      <textarea
                        id="contact-field-message"
                        name="message"
                        rows={5}
                        value={formData.message}
                        onChange={handleChange}
                        onBlur={() => handleBlur("message")}
                        placeholder="Please share details about your inquiry or fragrance request..."
                        className={`form-textarea ${touched.message && errors.message ? "invalid" : ""}`}
                        maxLength={1500}
                        required
                      />
                      {touched.message && errors.message && (
                        <span className="field-error-msg" role="alert">
                          {errors.message}
                        </span>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`contact-submit-btn ${submitting ? "loading" : ""}`}
                    >
                      {submitting ? (
                        <>
                          <span className="submit-spinner" aria-hidden="true" />
                          <span>SENDING INQUIRY...</span>
                        </>
                      ) : (
                        <span>SEND MESSAGE</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Quick Answers (FAQ Accordion) */}
      <section className="contact-faq-section">
        <div className="contact-faq-container">
          <div className="contact-section-header-center">
            <span className="contact-eyebrow">QUICK ANSWERS</span>
            <h2 className="contact-section-title">Frequently Asked Questions</h2>
            <p className="contact-section-subtitle">
              Common questions regarding our Grasse formulations, climate dispatch, and ordering process.
            </p>
          </div>

          <div className="faq-accordion-list">
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className={`faq-accordion-item ${isOpen ? "open" : ""}`}>
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    aria-expanded={isOpen}
                  >
                    <span className="faq-q-text">{item.q}</span>
                    <span className="faq-toggle-icon">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="faq-answer-pane">
                      <p>{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Luxury Footer */}
      <footer className="contact-footer">
        <div className="contact-footer-inner">
          <div className="contact-footer-brand">
            <h3 className="footer-fexa-logo">FEXA</h3>
            <span className="footer-fexa-sub">HAUTE PARFUMERIE</span>
            <p className="footer-fexa-tagline">
              Dedicated to evocative scents, refined craftsmanship, and authentic personal expression.
            </p>
          </div>

          <div className="contact-footer-links-group">
            <div className="footer-nav-col">
              <h4>EXPLORE</h4>
              <button type="button" onClick={() => navigate("/collections")}>All Fragrances</button>
              <button type="button" onClick={() => navigate("/collections?category=men")}>Men's Collection</button>
              <button type="button" onClick={() => navigate("/collections?category=women")}>Women's Collection</button>
              <button type="button" onClick={() => navigate("/collections?category=unisex")}>Unisex Portfolio</button>
            </div>

            <div className="footer-nav-col">
              <h4>HOUSE</h4>
              <button type="button" onClick={() => navigate("/about")}>About FEXA</button>
              <button type="button" onClick={() => navigate("/contact")}>Contact Us</button>
              <button type="button" onClick={() => navigate("/profile")}>Client Concierge</button>
            </div>
          </div>
        </div>

        <div className="contact-footer-bottom">
          <div className="footer-bottom-inner">
            <span>© {new Date().getFullYear()} FEXA HAUTE PARFUMERIE. ALL RIGHTS RESERVED.</span>
            <span>LAVENDER & WHITE LUXURY EDITORIAL.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Contact;
