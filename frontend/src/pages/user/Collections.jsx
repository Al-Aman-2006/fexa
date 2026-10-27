import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/common/Navbar";
import VideoHero from "../../components/common/VideoHero";
import collectionBannerImg from "../../assets/images/collection_banner.jpg";
import menPortfolioImg from "../../assets/images/men_portfolio.jpg";
import womenPortfolioImg from "../../assets/images/women_portfolio.jpg";
import unisexPortfolioImg from "../../assets/images/unisex_portfolio.jpg";
import "./Collections.css";

/**
 * Main Collections Landing Page (/collections)
 * Introduces FEXA's fragrance collections:
 * - Shared Luxury Navbar
 * - Full-width Video Hero with graceful fallback
 * - Category Discovery Section with prominent Men, Women, and Unisex cards
 * - Direct navigation to dedicated /collections/men, /collections/women, /collections/unisex
 * - Category activation/deactivation awareness
 * - Shared Luxury Footer
 */
export default function Collections() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Backward compatibility: If an old link accesses /collections?category=men, redirect directly to /collections/men
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      const lower = cat.trim().toLowerCase();
      if (lower === "men") {
        navigate("/collections/men", { replace: true });
      } else if (lower === "women") {
        navigate("/collections/women", { replace: true });
      } else if (lower === "unisex") {
        navigate("/collections/unisex", { replace: true });
      }
    }
  }, [searchParams, navigate]);

  // Live category statistics & activation statuses from MongoDB
  const [categoryCounts, setCategoryCounts] = useState({ all: 0, men: 0, women: 0, unisex: 0 });
  const [categoryStatuses, setCategoryStatuses] = useState({ Men: true, Women: true, Unisex: true });
  const [loadingStats, setLoadingStats] = useState(true);
  const [categoryAlertToast, setCategoryAlertToast] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCollectionsSummary() {
      try {
        setLoadingStats(true);
        const res = await fetch("http://localhost:5000/api/products/collections");
        const data = await res.json();
        if (isMounted && res.ok && data.success) {
          if (data.counts) {
            setCategoryCounts(data.counts);
          }
          if (data.categoryStatuses) {
            setCategoryStatuses(data.categoryStatuses);
          }
        }
      } catch (err) {
        console.error("Collections summary fetch error:", err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    }
    loadCollectionsSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleNavigateCategory = (cat) => {
    if (categoryStatuses[cat] === false) {
      setCategoryAlertToast(`The ${cat}'s Collection is currently unavailable for catalogue maintenance.`);
      setTimeout(() => setCategoryAlertToast(null), 4000);
      return;
    }
    navigate(`/collections/${cat.toLowerCase()}`);
  };

  return (
    <div className="fexa-collections-page main-collections-landing">
      {/* ================= FEXA GLOBAL LUXURY NAVBAR ================= */}
      <Navbar activePage="collections" />

      {/* ================= BREADCRUMB & LIVE STATUS ================= */}
      <div className="collections-breadcrumb-bar">
        <div className="breadcrumb-container">
          <div className="breadcrumb-path">
            <span onClick={() => navigate("/home")}>HOME</span>
            <span className="sep">/</span>
            <span className="active">COLLECTIONS</span>
          </div>
          <div className="breadcrumb-stats">
            <span>MONGODB LIVE CATALOGUE</span>
            <span className="live-dot">●</span>
            <span>{categoryCounts.all} REGISTERED FRAGRANCES</span>
          </div>
        </div>
      </div>

      {/* ================= FULL-WIDTH VIDEO HERO ================= */}
      <VideoHero
        videoSrc="/videos/collections-hero.mp4"
        posterSrc={collectionBannerImg}
        eyebrow="HAUTE PARFUMERIE // ATELIER ARCHIVE"
        heading="Discover Your Fragrance"
        headingAccent="World."
        description="Explore scents that reflect your personality, your mood, and your individual style."
        buttonText="EXPLORE COLLECTIONS"
        buttonTargetId="category-discovery"
        themeVariant="main"
      />

      {/* ================= CATEGORY DISCOVERY SECTION ================= */}
      <section className="category-discovery-section" id="category-discovery">
        <div className="section-container">
          {/* TOAST ALERT FOR INACTIVE CATEGORY */}
          {categoryAlertToast && (
            <div className="collections-category-toast">
              <span>⚠️ {categoryAlertToast}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => setCategoryAlertToast(null)}
              >
                ✕
              </button>
            </div>
          )}

          <div className="section-header-block">
            <span className="section-eyebrow">EXPLORE BY CATEGORY</span>
            <h2 className="section-main-heading">Find Your Fragrance.</h2>
            <p className="section-subtext">
              Explore collections designed around different styles, moods, and expressions.
            </p>
          </div>

          {/* THREE PROMINENT CATEGORY DISCOVERY CARDS */}
          <div className="category-discovery-grid">
            {/* CARD 1 — MEN */}
            <div
              className={`discovery-card men ${
                categoryStatuses.Men === false ? "category-inactive" : ""
              }`}
              onClick={() => handleNavigateCategory("Men")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleNavigateCategory("Men");
                }
              }}
              aria-label="Explore Men's Collection"
            >
              <div className="discovery-card-media">
                <img
                  src={menPortfolioImg}
                  alt="Men's Fragrance Collection"
                  className="discovery-card-img"
                  loading="lazy"
                />
                <div className="discovery-card-overlay"></div>
                <div className="discovery-card-badge">
                  {categoryStatuses.Men === false
                    ? "MEN // UNAVAILABLE"
                    : `MEN'S COLLECTION // ${categoryCounts.men} FRAGRANCES`}
                </div>
              </div>

              <div className="discovery-card-body">
                <h3 className="discovery-card-title">Men's Collection</h3>
                <p className="discovery-card-desc">
                  Bold, architectural fragrances compounded with smoked Haitian vetiver, dark amber resins, Italian birch, and spicy cracked pepper.
                </p>
                <div className="discovery-card-action">
                  <span className="action-text">
                    {categoryStatuses.Men === false
                      ? "CURRENTLY UNAVAILABLE"
                      : "EXPLORE MEN'S COLLECTION"}
                  </span>
                  <span className="action-arrow">→</span>
                </div>
              </div>
            </div>

            {/* CARD 2 — WOMEN */}
            <div
              className={`discovery-card women ${
                categoryStatuses.Women === false ? "category-inactive" : ""
              }`}
              onClick={() => handleNavigateCategory("Women")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleNavigateCategory("Women");
                }
              }}
              aria-label="Explore Women's Collection"
            >
              <div className="discovery-card-media">
                <img
                  src={womenPortfolioImg}
                  alt="Women's Fragrance Collection"
                  className="discovery-card-img"
                  loading="lazy"
                />
                <div className="discovery-card-overlay"></div>
                <div className="discovery-card-badge">
                  {categoryStatuses.Women === false
                    ? "WOMEN // UNAVAILABLE"
                    : `WOMEN'S COLLECTION // ${categoryCounts.women} FRAGRANCES`}
                </div>
              </div>

              <div className="discovery-card-body">
                <h3 className="discovery-card-title">Women's Collection</h3>
                <p className="discovery-card-desc">
                  Luminous, captivating compositions starring Centifolia rose petals, radiant Grasse jasmine sambac, powdery white amber, and delicate iris.
                </p>
                <div className="discovery-card-action">
                  <span className="action-text">
                    {categoryStatuses.Women === false
                      ? "CURRENTLY UNAVAILABLE"
                      : "EXPLORE WOMEN'S COLLECTION"}
                  </span>
                  <span className="action-arrow">→</span>
                </div>
              </div>
            </div>

            {/* CARD 3 — UNISEX */}
            <div
              className={`discovery-card unisex ${
                categoryStatuses.Unisex === false ? "category-inactive" : ""
              }`}
              onClick={() => handleNavigateCategory("Unisex")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleNavigateCategory("Unisex");
                }
              }}
              aria-label="Explore Unisex Collection"
            >
              <div className="discovery-card-media">
                <img
                  src={unisexPortfolioImg}
                  alt="Unisex Fragrance Collection"
                  className="discovery-card-img"
                  loading="lazy"
                />
                <div className="discovery-card-overlay"></div>
                <div className="discovery-card-badge">
                  {categoryStatuses.Unisex === false
                    ? "UNISEX // UNAVAILABLE"
                    : `UNISEX COLLECTION // ${categoryCounts.unisex} FRAGRANCES`}
                </div>
              </div>

              <div className="discovery-card-body">
                <h3 className="discovery-card-title">Unisex Collection</h3>
                <p className="discovery-card-desc">
                  Fragrance without boundaries. Fluid olfactory mastery balancing sparkling Calabrian bergamot, mineral sea salt crystals, and cashmeran musk.
                </p>
                <div className="discovery-card-action">
                  <span className="action-text">
                    {categoryStatuses.Unisex === false
                      ? "CURRENTLY UNAVAILABLE"
                      : "EXPLORE UNISEX COLLECTION"}
                  </span>
                  <span className="action-arrow">→</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= EDITORIAL PHILOSOPHY BANNER ================= */}
      <section className="fexa-philosophy-banner">
        <div className="philosophy-container">
          <span className="philosophy-label">THE PHILOSOPHY OF ATELIER FEXA</span>
          <h2 className="philosophy-title">
            Your Scent, <br />
            <em>Your Identity.</em>
          </h2>

          <blockquote className="philosophy-quote">
            "Fragrance is personal. It doesn't belong to a category — it belongs to the person who wears it. We compound with raw botanical materials so that every flacon lives uniquely upon your skin chemistry."
          </blockquote>

          <div className="philosophy-signoff">
            <span className="signoff-author">— ANTOINE LAURENT</span>
            <span className="signoff-role">MASTER NEZ DE FEXA GRASSE</span>
          </div>
        </div>
      </section>

      {/* ================= TRUST & CRAFTSMANSHIP BAR ================= */}
      <section className="fexa-trust-bar">
        <div className="section-container">
          <div className="trust-grid">
            <div className="trust-item">
              <span className="trust-num">01</span>
              <h4>Curated Collection</h4>
              <p>Hand-compounded in small batches with strictly non-synthetic botanical concentrates.</p>
            </div>
            <div className="trust-item">
              <span className="trust-num">02</span>
              <h4>100% Authentic Provenance</h4>
              <p>Direct provenance from our private extraction laboratories in Grasse and Florence.</p>
            </div>
            <div className="trust-item">
              <span className="trust-num">03</span>
              <h4>Luxury Samples</h4>
              <p>Complimentary 2ml flacon vial included with every ordered fragrance bottle.</p>
            </div>
            <div className="trust-item">
              <span className="trust-num">04</span>
              <h4>Climate-Controlled Shipping</h4>
              <p>Insulated, temperature-stabilized dispatch ensuring fragrance compounds stay pristine.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SHARED LUXURY FOOTER ================= */}
      <footer className="fexa-collections-footer">
        <div className="footer-container">
          <div className="footer-top-row">
            <div className="footer-brand-col">
              <h3 className="footer-logo">FEXA</h3>
              <p className="footer-bio">
                Haute Parfumerie engineered through artisanal extractions, rare botanical absolutes, and architectural elegance. Handcrafted in Grasse.
              </p>
              <div className="footer-newsletter">
                <label>SUBSCRIBE TO ATELIER GAZETTE</label>
                <div className="newsletter-input-box">
                  <input type="email" placeholder="Enter your email address..." />
                  <button type="button">JOIN</button>
                </div>
              </div>
            </div>

            <div className="footer-links-col">
              <h4>COLLECTIONS</h4>
              <button type="button" onClick={() => navigate("/collections")}>All Fragrances</button>
              <button type="button" onClick={() => navigate("/collections/men")}>Men's Portfolio</button>
              <button type="button" onClick={() => navigate("/collections/women")}>Women's Portfolio</button>
              <button type="button" onClick={() => navigate("/collections/unisex")}>Unisex Portfolio</button>
            </div>

            <div className="footer-links-col">
              <h4>CONCIERGE</h4>
              <button type="button" onClick={() => navigate("/contact")}>Boutique Concierge</button>
              <button type="button" onClick={() => navigate("/contact")}>Private Consultation</button>
              <button type="button" onClick={() => navigate("/contact")}>Shipping & Climate-Control</button>
              <button type="button" onClick={() => navigate("/profile")}>Fragrance Care & Storage</button>
            </div>

            <div className="footer-links-col">
              <h4>OLFACTORY ARCHIVES</h4>
              <button type="button" onClick={() => navigate("/about")}>About FEXA</button>
              <span>Grasse Harvest Journal</span>
              <span>Sustainability Code</span>
              <span>Terms of Atelier</span>
              <span>Privacy Charter</span>
            </div>
          </div>

          <div className="footer-bottom-row">
            <span>© {new Date().getFullYear()} FEXA HAUTE PARFUMERIE. ALL RIGHTS RESERVED. CRAFTED WITH QUIET RESTRAINT.</span>
            <div className="bottom-links">
              <span>PRIVACY NOTICE</span>
              <span>CONSUMER TRANSPARENCY</span>
              <span>COOKIE PREFERENCES</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
