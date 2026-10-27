import React, { useState, useEffect, useRef } from "react";
import "./VideoHero.css";

/**
 * VideoHero Component
 * Premium full-width video hero designed for FEXA Haute Parfumerie.
 *
 * Supports:
 * - Autoplay, loop, muted, playsInline
 * - Object-fit cover with controlled proportions (no distortion)
 * - Lavender-and-white theme overlay ensuring excellent text legibility
 * - Graceful fallback on load error, missing file, or prefers-reduced-motion
 * - Shimmer/poster loading state to eliminate layout shifts
 * - Accessible HTML typography and smooth CTA scrolling
 */
export default function VideoHero({
  videoSrc,
  posterSrc,
  eyebrow,
  heading,
  headingAccent,
  description,
  buttonText,
  buttonTargetId,
  onButtonClick,
  themeVariant = "main", // "main" | "men" | "women" | "unisex"
}) {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(!videoSrc);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRef = useRef(null);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mediaQuery.matches);

      const handleChange = (e) => setReducedMotion(e.matches);
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }
    }
  }, []);

  // Update error state if videoSrc changes
  useEffect(() => {
    if (!videoSrc) {
      setHasVideoError(true);
      setIsVideoLoaded(false);
    } else {
      setHasVideoError(false);
      setIsVideoLoaded(false);
    }
  }, [videoSrc]);

  // Attempt video playback safely
  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasVideoError || reducedMotion) return;

    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay may be restricted by browser policy; retain poster fallback
        console.info("Video autoplay note (fallback retained):", err?.message || err);
      });
    }
  }, [hasVideoError, reducedMotion, videoSrc]);

  const handleLoadedData = () => {
    setIsVideoLoaded(true);
    setHasVideoError(false);
  };

  const handleVideoError = () => {
    setHasVideoError(true);
    setIsVideoLoaded(false);
  };

  const handleCtaClick = () => {
    if (onButtonClick) {
      onButtonClick();
      return;
    }
    if (buttonTargetId) {
      const targetElement = document.getElementById(buttonTargetId);
      if (targetElement) {
        const navHeight = 76;
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: Math.max(0, targetPosition - navHeight),
          behavior: "smooth",
        });
      }
    }
  };

  const isCategoryHero = ["men", "women", "unisex"].includes(themeVariant);
  const hasContent = !isCategoryHero && (heading || eyebrow || description || buttonText);

  return (
    <section className={`fexa-video-hero variant-${themeVariant}`}>
      {/* Background Media Container */}
      <div className="hero-media-wrapper">
        {/* Poster / Fallback Image (Only for non-category landing heroes) */}
        {!isCategoryHero && posterSrc && (
          <img
            src={posterSrc}
            alt={heading || "Collection Hero"}
            className={`hero-poster-fallback ${isVideoLoaded && !hasVideoError && !reducedMotion ? "fade-out" : "active"}`}
            aria-hidden="true"
          />
        )}

        {/* Video Element — Clean, Unblurred, Only Hero Content on Category Pages */}
        {!hasVideoError && !reducedMotion && videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            className={`hero-bg-video ${isVideoLoaded ? "loaded" : "loading"}`}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster={!isCategoryHero ? posterSrc || undefined : undefined}
            onLoadedData={handleLoadedData}
            onCanPlay={handleLoadedData}
            onPlaying={handleLoadedData}
            onPlay={handleLoadedData}
            onError={handleVideoError}
            tabIndex={-1}
            aria-hidden="true"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}

        {/* Theme-aligned Luxury Gradient Overlay (Only for main landing hero when content exists) */}
        {!isCategoryHero && (
          <>
            <div className="hero-gradient-overlay" aria-hidden="true"></div>
            <div className="hero-vignette-overlay" aria-hidden="true"></div>
          </>
        )}
      </div>

      {/* Hero Accessible Text Content — Completely omitted on Category Heroes */}
      {hasContent && (
        <div className="hero-inner-container">
          <div className="hero-content-card">
            {eyebrow && (
              <div className="hero-eyebrow-badge">
                <span className="eyebrow-dot"></span>
                <span className="eyebrow-text">{eyebrow}</span>
              </div>
            )}

            {heading && (
              <h1 className="hero-headline-title">
                {heading}
                {headingAccent && (
                  <>
                    {" "}
                    <em className="hero-headline-accent">{headingAccent}</em>
                  </>
                )}
              </h1>
            )}

            {description && <p className="hero-supporting-text">{description}</p>}

            {buttonText && (
              <div className="hero-action-row">
                <button
                  type="button"
                  className="hero-cta-btn"
                  onClick={handleCtaClick}
                  aria-label={buttonText}
                >
                  <span>{buttonText}</span>
                  <span className="cta-arrow" aria-hidden="true">↓</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
