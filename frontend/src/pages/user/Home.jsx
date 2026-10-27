import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/common/Navbar";
import ProductCard from "../../components/product/ProductCard";
import ContactSection from "../../components/common/ContactSection";

// Editorial assets
import aboutAtelierImg from "../../assets/images/about/about_atelier.jpg";
import menPortfolioImg from "../../assets/images/men_portfolio.jpg";
import womenPortfolioImg from "../../assets/images/women_portfolio.jpg";
import unisexPortfolioImg from "../../assets/images/unisex_portfolio.jpg";

import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const videoRef = useRef(null);

  // Active section for Navbar tracking
  const [activeSection, setActiveSection] = useState("home");

  // Featured products state
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);

  // Video Autoplay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.info("Home hero video autoplay note:", err?.message || err);
      });
    }
  }, []);

  // Fetch Featured Products (8 products from MongoDB backend)
  useEffect(() => {
    let isMounted = true;
    const fetchFeatured = async () => {
      try {
        setLoadingProducts(true);
        setProductsError(null);
        const res = await fetch("http://localhost:5000/api/products?limit=8&sort=featured");
        const data = await res.json();
        if (isMounted) {
          if (res.ok && data.success) {
            setFeaturedProducts(data.products || []);
          } else {
            setProductsError(data.message || "Unable to load featured fragrances.");
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Home featured products fetch error:", err);
          setProductsError("Unable to connect to the FEXA atelier service.");
        }
      } finally {
        if (isMounted) {
          setLoadingProducts(false);
        }
      }
    };
    fetchFeatured();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle section scrolling when arriving with hash or state
  useEffect(() => {
    const targetId = location.hash ? location.hash.replace("#", "") : location.state?.scrollTo;
    if (targetId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [location.hash, location.state]);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 220;
      const contactEl = document.getElementById("contact-section");
      const aboutEl = document.getElementById("about-section");

      if (contactEl && scrollPos >= contactEl.offsetTop) {
        setActiveSection("contact");
      } else if (aboutEl && scrollPos >= aboutEl.offsetTop) {
        setActiveSection("about");
      } else {
        setActiveSection("home");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const scrollToAbout = () => {
    const el = document.getElementById("about-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToContact = () => {
    const el = document.getElementById("contact-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="home-page">
      {/* ── Navbar ── */}
      <Navbar activePage={activeSection} />

      {/* ── 1. Hero ── */}
      <section className="home-hero">
        {/* Background Video */}
        <video
          ref={videoRef}
          className="home-hero-bg-video hero-bg-video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          src="/videos/unisex-collection-hero.mp4"
        >
          <source src="/videos/unisex-collection-hero.mp4" type="video/mp4" />
        </video>

        {/* Clean Subtle Overlay (no blur) */}
        <div className="home-hero-overlay" />

        <div className="home-hero-inner">
          {/* Left: Editorial Copy */}
          <div className="home-hero-content">
            <span className="home-eyebrow">Welcome to Fexa</span>
            <h1 className="home-hero-title">
              The Art of<br />
              <em>Fragrance.</em>
            </h1>
            <p className="home-hero-desc">
              Discover a world of refined fragrances, carefully crafted for
              unforgettable moments. Explore curated Men's, Women's, and
              Unisex collections.
            </p>
            <div className="home-hero-actions">
              <button
                type="button"
                className="home-btn-primary"
                onClick={() => navigate("/collections")}
              >
                EXPLORE COLLECTION
                <span className="btn-arrow">→</span>
              </button>
              <button
                type="button"
                className="home-btn-secondary"
                onClick={scrollToAbout}
              >
                OUR STORY
              </button>
            </div>
          </div>

          {/* Right: Welcome Card */}
          <div className="home-welcome-card">
            <span className="welcome-card-tag">Patron Privé</span>
            <p className="welcome-card-greeting">
              Welcome back,<br />
              <strong>{user?.name || "Valued Patron"}.</strong>
            </p>

            <div className="welcome-status-row">
              <span className="status-dot"></span>
              <span className="status-text">
                {user ? (
                  <><strong>Signed in</strong> — your collection awaits.</>
                ) : (
                  <><strong>Atelier Guest</strong> — explore our creations.</>
                )}
              </span>
            </div>

            <div className="welcome-quick-links">
              <button
                type="button"
                className="quick-link-btn"
                onClick={() => navigate("/collections")}
              >
                <span>Browse Fragrances</span>
                <span className="ql-arrow">→</span>
              </button>
              {user ? (
                <>
                  <button
                    type="button"
                    className="quick-link-btn"
                    onClick={() => navigate("/profile")}
                  >
                    <span>My Profile & Orders</span>
                    <span className="ql-arrow">→</span>
                  </button>
                  <button
                    type="button"
                    className="quick-link-btn"
                    onClick={() => navigate("/wishlist")}
                  >
                    <span>My Wishlist</span>
                    <span className="ql-arrow">→</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="quick-link-btn"
                    onClick={() => navigate("/login")}
                  >
                    <span>Sign In to Your Account</span>
                    <span className="ql-arrow">→</span>
                  </button>
                  <button
                    type="button"
                    className="quick-link-btn"
                    onClick={() => navigate("/register")}
                  >
                    <span>Join Patron Privé</span>
                    <span className="ql-arrow">→</span>
                  </button>
                </>
              )}
            </div>

            {user ? (
              <button type="button" className="welcome-logout-btn" onClick={handleLogout}>
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                className="welcome-logout-btn"
                onClick={() => navigate("/login")}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. Product Showcase: THE FEXA EDIT ── */}
      <section className="home-featured-section" id="featured-products">
        <div className="home-section-container">
          <div className="home-section-header">
            <span className="home-section-eyebrow">THE FEXA EDIT</span>
            <h2 className="home-section-title">Discover Your Next Signature Scent.</h2>
            <p className="home-section-desc">
              Explore fragrances that bring together character, individuality, and the beauty of scent.
            </p>
          </div>

          {loadingProducts ? (
            <div className="home-products-loading">
              <span className="search-spinner" />
              <span>Curating fragrances from the atelier catalogue...</span>
            </div>
          ) : productsError ? (
            <div className="home-products-empty">
              <p>{productsError}</p>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="home-products-empty">
              <p>No featured fragrances currently available in the collection.</p>
            </div>
          ) : (
            <div className="home-products-grid">
              {featuredProducts.map((prod) => (
                <ProductCard key={prod._id} product={prod} />
              ))}
            </div>
          )}

          {/* ── 3. View All Button ── */}
          <div className="home-view-all-wrapper">
            <button
              type="button"
              className="home-view-all-btn"
              onClick={() => navigate("/collections")}
            >
              VIEW ALL FRAGRANCES
              <span className="btn-arrow">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 4. Fragrance Category Discovery ── */}
      <section className="home-categories-section">
        <div className="home-section-container">
          <div className="home-section-header">
            <span className="home-section-eyebrow">CURATED PORTFOLIOS</span>
            <h2 className="home-section-title">Find Your Fragrance.</h2>
            <p className="home-section-desc">
              Different personalities. Different moods. A fragrance for every side of you.
            </p>
          </div>

          <div className="home-categories-grid">
            {/* Men */}
            <div
              className="home-category-card"
              onClick={() => navigate("/collections/men")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("/collections/men");
                }
              }}
              aria-label="Explore Men's Collection"
            >
              <div className="home-category-media">
                <img
                  src={menPortfolioImg}
                  alt="Men's Luxury Perfume Flacon"
                  className="home-category-img"
                  loading="lazy"
                />
                <div className="home-category-overlay" />
              </div>
              <div className="home-category-info">
                <span className="category-tag-pill">ATELIER HOMME</span>
                <h3 className="category-card-heading">MEN</h3>
                <p className="category-card-desc">
                  Discover bold, refined, and distinctive fragrance experiences.
                </p>
                <button
                  type="button"
                  className="category-explore-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/collections/men");
                  }}
                >
                  EXPLORE MEN →
                </button>
              </div>
            </div>

            {/* Women */}
            <div
              className="home-category-card"
              onClick={() => navigate("/collections/women")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("/collections/women");
                }
              }}
              aria-label="Explore Women's Collection"
            >
              <div className="home-category-media">
                <img
                  src={womenPortfolioImg}
                  alt="Women's Luxury Perfume Flacon"
                  className="home-category-img"
                  loading="lazy"
                />
                <div className="home-category-overlay" />
              </div>
              <div className="home-category-info">
                <span className="category-tag-pill">ATELIER FEMME</span>
                <h3 className="category-card-heading">WOMEN</h3>
                <p className="category-card-desc">
                  Explore expressive, elegant, and captivating fragrance experiences.
                </p>
                <button
                  type="button"
                  className="category-explore-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/collections/women");
                  }}
                >
                  EXPLORE WOMEN →
                </button>
              </div>
            </div>

            {/* Unisex */}
            <div
              className="home-category-card"
              onClick={() => navigate("/collections/unisex")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("/collections/unisex");
                }
              }}
              aria-label="Explore Unisex Collection"
            >
              <div className="home-category-media">
                <img
                  src={unisexPortfolioImg}
                  alt="Unisex Luxury Perfume Flacon"
                  className="home-category-img"
                  loading="lazy"
                />
                <div className="home-category-overlay" />
              </div>
              <div className="home-category-info">
                <span className="category-tag-pill">ATELIER UNIVERSEL</span>
                <h3 className="category-card-heading">UNISEX</h3>
                <p className="category-card-desc">
                  Discover versatile fragrances designed to move beyond boundaries.
                </p>
                <button
                  type="button"
                  className="category-explore-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/collections/unisex");
                  }}
                >
                  EXPLORE UNISEX →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. About FEXA Section: OUR STORY ── */}
      <section id="about-section" className="home-about-section">
        <div className="home-section-container">
          <div className="home-about-grid">
            {/* Visual Column */}
            <div className="home-about-media-col">
              <div className="home-about-image-frame">
                <img
                  src={aboutAtelierImg}
                  alt="FEXA artisanal perfume atelier studio with lavender botanical essences"
                  className="home-about-img"
                  loading="lazy"
                />
                <div className="home-about-badge">
                  <span className="badge-flacon">HAUTE PARFUMERIE</span>
                  <span className="badge-atelier">ATELIER COMPOSITIONS</span>
                </div>
              </div>
            </div>

            {/* Story & Philosophy Column */}
            <div className="home-about-text-col">
              <span className="home-section-eyebrow">OUR STORY</span>
              <h2 className="home-about-title">Fragrance Is More Than a Scent.</h2>
              <div className="home-about-body">
                <p>
                  At FEXA, we believe fragrance has the power to express who we are
                  without saying a word. It is an expression of identity, a reflection
                  of emotion, and a memory that stays long after the moment has passed.
                </p>
                <p>
                  From the first impression to the lingering notes that follow,
                  every fragrance offers a personal experience. We bring together
                  the beauty of olfactory craftsmanship, thoughtful presentation,
                  and the freedom to discover a scent that feels uniquely yours.
                </p>
                <p>
                  Whether you are looking for something bold, soft, refreshing,
                  or timeless, FEXA invites you to explore fragrances designed
                  around different styles, moods, and expressions.
                </p>
              </div>

              {/* Three Core Pillars */}
              <div className="home-about-pillars">
                <div className="home-pillar-card">
                  <span className="pillar-num">01</span>
                  <div className="pillar-text">
                    <h4>Personal Expression</h4>
                    <p>Scents that complement your personality, your mood, and the moments that matter.</p>
                  </div>
                </div>

                <div className="home-pillar-card">
                  <span className="pillar-num">02</span>
                  <div className="pillar-text">
                    <h4>The Art of Scent</h4>
                    <p>Natural botanical extracts compounded for olfactory depth and quiet restraint.</p>
                  </div>
                </div>

                <div className="home-pillar-card">
                  <span className="pillar-num">03</span>
                  <div className="pillar-text">
                    <h4>Everyday Luxury</h4>
                    <p>Elevating daily rituals and special celebrations with refined flacon craftsmanship.</p>
                  </div>
                </div>
              </div>

              {/* CTA Action */}
              <div className="home-about-actions">
                <button
                  type="button"
                  className="home-btn-primary"
                  onClick={() => navigate("/collections")}
                >
                  EXPLORE OUR COLLECTION
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Contact Section: LET'S CONNECT ── */}
      <ContactSection id="contact-section" />

      {/* ── 7. Luxury Footer ── */}
      <footer className="home-luxury-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <h3 className="footer-fexa-logo">FEXA</h3>
            <span className="footer-fexa-sub">HAUTE PARFUMERIE</span>
            <p className="footer-fexa-tagline">
              Dedicated to evocative scents, refined craftsmanship, and authentic personal expression.
            </p>
          </div>

          <div className="home-footer-links-group">
            <div className="footer-nav-col">
              <h4>EXPLORE</h4>
              <button type="button" onClick={() => navigate("/collections")}>
                All Fragrances
              </button>
              <button type="button" onClick={() => navigate("/collections/men")}>
                Men's Collection
              </button>
              <button type="button" onClick={() => navigate("/collections/women")}>
                Women's Collection
              </button>
              <button type="button" onClick={() => navigate("/collections/unisex")}>
                Unisex Portfolio
              </button>
            </div>

            <div className="footer-nav-col">
              <h4>HOUSE</h4>
              <button type="button" onClick={scrollToAbout}>
                About FEXA
              </button>
              <button type="button" onClick={scrollToContact}>
                Contact Us
              </button>
              <button type="button" onClick={scrollToTop}>
                Home Atelier
              </button>
              <button
                type="button"
                onClick={() => navigate(user ? "/profile" : "/login")}
              >
                Patron Privé
              </button>
            </div>
          </div>
        </div>

        <div className="home-footer-bottom">
          <div className="footer-bottom-inner">
            <span>© {new Date().getFullYear()} FEXA HAUTE PARFUMERIE. ALL RIGHTS RESERVED.</span>
            <span>LAVENDER & WHITE LUXURY EDITORIAL.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
