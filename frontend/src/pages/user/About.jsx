import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/common/Navbar";

// Local editorial imagery
import aboutHeroImg from "../../assets/images/about/about_hero.jpg";
import aboutAtelierImg from "../../assets/images/about/about_atelier.jpg";
import aboutLifestyleImg from "../../assets/images/about/about_lifestyle.jpg";
import aboutBotanicalsImg from "../../assets/images/about/about_botanicals.jpg";
import menPortfolioImg from "../../assets/images/men_portfolio.jpg";
import womenPortfolioImg from "../../assets/images/women_portfolio.jpg";
import unisexPortfolioImg from "../../assets/images/unisex_portfolio.jpg";
import rougeChaotiqueImg from "../../assets/images/rouge_chaotique.jpg";

import "./About.css";

function About() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const handleCategoryNavigate = (cat) => {
    navigate(`/collections?category=${cat.toLowerCase()}`);
  };

  const handleCollectionsNavigate = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    navigate("/collections");
  };

  const scrollToStory = () => {
    const el = document.getElementById("our-story");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="fexa-about-page">
      {/* 1. Global Navigation */}
      <Navbar activePage="about" />

      {/* 2. Hero Section: The World of FEXA */}
      <section className="about-hero-section">
        <div className="about-hero-container">
          <div className="about-hero-content">
            <span className="about-eyebrow">THE WORLD OF FEXA</span>
            <h1 className="about-hero-title">
              More Than a Fragrance.
              <br />
              <span className="about-title-italic">A Feeling That Stays.</span>
            </h1>
            <p className="about-hero-desc">
              At FEXA, we believe fragrance is more than something you wear.
              It is an expression of identity, a reflection of emotion, and a
              memory that stays long after the moment has passed.
            </p>
            <div className="about-hero-actions">
              <button
                type="button"
                className="about-btn-primary"
                onClick={handleCollectionsNavigate}
              >
                EXPLORE OUR COLLECTION
              </button>
              <button
                type="button"
                className="about-btn-secondary"
                onClick={scrollToStory}
              >
                DISCOVER OUR STORY
              </button>
            </div>
          </div>

          <div className="about-hero-visual">
            <div className="about-hero-image-frame">
              <img
                src={aboutHeroImg}
                alt="FEXA Haute Parfumerie Signature Flacon"
                className="about-hero-img"
              />
              <div className="about-hero-badge">
                <span className="badge-flacon">HAUTE PARFUMERIE</span>
                <span className="badge-atelier">ATELIER ARCHIVE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Our Story Section */}
      <section id="our-story" className="about-story-section">
        <div className="about-story-container">
          <div className="about-story-media">
            <div className="story-media-wrapper">
              <img
                src={aboutAtelierImg}
                alt="Artisanal perfume atelier studio with lavender botanical essences"
                className="about-story-img"
                loading="lazy"
              />
              <div className="story-caption-card">
                <span className="story-caption-tag">PURE COMPOSITIONS</span>
                <p>Thoughtfully formulated with quiet restraint and botanical finesse.</p>
              </div>
            </div>
          </div>

          <div className="about-story-text-col">
            <span className="about-eyebrow">OUR STORY</span>
            <h2 className="about-section-title">Every Scent Tells a Story.</h2>
            <div className="about-story-body">
              <p>
                FEXA was created around a simple belief: fragrance has the power
                to express who we are without saying a word.
              </p>
              <p>
                From the first impression to the lingering notes that follow,
                every fragrance offers a personal experience. We bring together
                the beauty of fragrance, thoughtful presentation, and the
                freedom to discover a scent that feels uniquely yours.
              </p>
              <p>
                Whether you are looking for something bold, soft, refreshing,
                mysterious, or timeless, FEXA invites you to explore fragrances
                that complement your individuality.
              </p>
            </div>
            <div className="about-signature-block">
              <span className="signature-fexa">FEXA</span>
              <span className="signature-sub">Haute Parfumerie & Pure Botanical Distillates</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Our Philosophy Section */}
      <section className="about-philosophy-section">
        <div className="about-philosophy-container">
          <div className="about-section-header-center">
            <span className="about-eyebrow">THE FEXA PHILOSOPHY</span>
            <h2 className="about-section-title">Fragrance Is Personal.</h2>
            <p className="about-section-subtitle">
              Three cornerstones that shape every bottle, every flacon, and every moment.
            </p>
          </div>

          <div className="about-philosophy-grid">
            {/* Card 1 */}
            <article className="philosophy-card">
              <div className="philosophy-card-image-wrap">
                <img
                  src={aboutLifestyleImg}
                  alt="Personal Expression through scent"
                  className="philosophy-card-img"
                  loading="lazy"
                />
                <span className="philosophy-card-number">01</span>
              </div>
              <div className="philosophy-card-content">
                <h3 className="philosophy-card-title">PERSONAL EXPRESSION</h3>
                <p className="philosophy-card-text">
                  Your fragrance should feel like you. Discover scents that
                  complement your personality, your mood, and the moments that
                  matter.
                </p>
              </div>
            </article>

            {/* Card 2 */}
            <article className="philosophy-card">
              <div className="philosophy-card-image-wrap">
                <img
                  src={aboutBotanicalsImg}
                  alt="The Art of Scent and fine natural extracts"
                  className="philosophy-card-img"
                  loading="lazy"
                />
                <span className="philosophy-card-number">02</span>
              </div>
              <div className="philosophy-card-content">
                <h3 className="philosophy-card-title">THE ART OF SCENT</h3>
                <p className="philosophy-card-text">
                  Explore the beauty of fragrance through different moods,
                  impressions, and scent experiences, from fresh and delicate to
                  rich and captivating.
                </p>
              </div>
            </article>

            {/* Card 3 */}
            <article className="philosophy-card">
              <div className="philosophy-card-image-wrap">
                <img
                  src={aboutHeroImg}
                  alt="Everyday Luxury in perfume"
                  className="philosophy-card-img"
                  loading="lazy"
                />
                <span className="philosophy-card-number">03</span>
              </div>
              <div className="philosophy-card-content">
                <h3 className="philosophy-card-title">EVERYDAY LUXURY</h3>
                <p className="philosophy-card-text">
                  Bring a touch of luxury to everyday moments, celebrations, and
                  the memories you want to make unforgettable.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 5. Explore Our Fragrance World (Category Navigation) */}
      <section className="about-categories-section">
        <div className="about-categories-container">
          <div className="about-section-header-center">
            <span className="about-eyebrow">CURATED PORTFOLIOS</span>
            <h2 className="about-section-title">Find Your Fragrance.</h2>
            <p className="about-section-subtitle">
              Different personalities. Different moods. A fragrance for every
              side of you.
            </p>
          </div>

          <div className="about-categories-grid">
            {/* MEN */}
            <div
              className="category-editorial-card"
              onClick={() => handleCategoryNavigate("men")}
              role="button"
              tabIndex={0}
            >
              <div className="category-card-media">
                <img
                  src={menPortfolioImg}
                  alt="Men's Luxury Fragrance Collection"
                  className="category-card-img"
                  loading="lazy"
                />
                <div className="category-overlay-gradient" />
              </div>
              <div className="category-card-info">
                <span className="category-tag-pill">ATELIER HOMME</span>
                <h3 className="category-card-heading">MEN</h3>
                <p className="category-card-desc">
                  Discover bold, refined, and distinctive fragrance experiences.
                </p>
                <button
                  type="button"
                  className="category-explore-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCategoryNavigate("men");
                  }}
                >
                  EXPLORE MEN →
                </button>
              </div>
            </div>

            {/* WOMEN */}
            <div
              className="category-editorial-card"
              onClick={() => handleCategoryNavigate("women")}
              role="button"
              tabIndex={0}
            >
              <div className="category-card-media">
                <img
                  src={womenPortfolioImg}
                  alt="Women's Luxury Fragrance Collection"
                  className="category-card-img"
                  loading="lazy"
                />
                <div className="category-overlay-gradient" />
              </div>
              <div className="category-card-info">
                <span className="category-tag-pill">ATELIER FEMME</span>
                <h3 className="category-card-heading">WOMEN</h3>
                <p className="category-card-desc">
                  Explore expressive, elegant, and captivating fragrance experiences.
                </p>
                <button
                  type="button"
                  className="category-explore-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCategoryNavigate("women");
                  }}
                >
                  EXPLORE WOMEN →
                </button>
              </div>
            </div>

            {/* UNISEX */}
            <div
              className="category-editorial-card"
              onClick={() => handleCategoryNavigate("unisex")}
              role="button"
              tabIndex={0}
            >
              <div className="category-card-media">
                <img
                  src={unisexPortfolioImg}
                  alt="Unisex Luxury Fragrance Collection"
                  className="category-card-img"
                  loading="lazy"
                />
                <div className="category-overlay-gradient" />
              </div>
              <div className="category-card-info">
                <span className="category-tag-pill">ATELIER UNIVERSEL</span>
                <h3 className="category-card-heading">UNISEX</h3>
                <p className="category-card-desc">
                  Discover versatile fragrances designed to move beyond boundaries.
                </p>
                <button
                  type="button"
                  className="category-explore-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCategoryNavigate("unisex");
                  }}
                >
                  EXPLORE UNISEX →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. The Beauty of Fragrance Section */}
      <section className="about-beauty-section">
        <div className="about-beauty-container">
          <div className="about-beauty-card">
            <div className="about-beauty-content">
              <span className="about-eyebrow">THE EXPERIENCE</span>
              <h2 className="about-section-title">A Scent for Every Moment.</h2>
              <div className="about-beauty-text">
                <p>
                  Some scents feel fresh and effortless. Others feel warm, bold,
                  or unforgettable.
                </p>
                <p>
                  The right fragrance can complement your style, reflect your
                  mood, and become part of the moments you treasure.
                </p>
                <p>
                  Explore the FEXA collection and discover the scent that feels
                  right for you.
                </p>
              </div>
              <button
                type="button"
                className="about-btn-primary"
                onClick={handleCollectionsNavigate}
              >
                DISCOVER THE COLLECTION
              </button>
            </div>

            <div className="about-beauty-visual">
              <img
                src={rougeChaotiqueImg}
                alt="The beauty and depth of FEXA perfume creations"
                className="about-beauty-img"
                loading="lazy"
              />
              <div className="beauty-visual-quote">
                <p>"Quiet luxury woven into every drop."</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Brand Values Section */}
      <section className="about-values-section">
        <div className="about-values-container">
          <div className="about-section-header-center">
            <span className="about-eyebrow">OUR COMMITMENT</span>
            <h2 className="about-section-title">What Matters to Us.</h2>
            <p className="about-section-subtitle">
              Guiding principles that define our craft and customer experience.
            </p>
          </div>

          <div className="about-values-grid">
            <div className="value-item-card">
              <div className="value-icon-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <h3 className="value-title">INDIVIDUALITY</h3>
              <p className="value-desc">
                Fragrance is personal. Explore scents that reflect your own
                style and preferences.
              </p>
            </div>

            <div className="value-item-card">
              <div className="value-icon-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <h3 className="value-title">DISCOVERY</h3>
              <p className="value-desc">
                Find new fragrance experiences and explore different scent
                personalities through the FEXA collection.
              </p>
            </div>

            <div className="value-item-card">
              <div className="value-icon-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h3 className="value-title">EXPERIENCE</h3>
              <p className="value-desc">
                From exploring the collection to choosing your fragrance, we
                aim to make the FEXA experience simple, enjoyable, and memorable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Luxury Footer */}
      <footer className="about-footer">
        <div className="about-footer-inner">
          <div className="about-footer-brand">
            <h3 className="footer-fexa-logo">FEXA</h3>
            <span className="footer-fexa-sub">HAUTE PARFUMERIE</span>
            <p className="footer-fexa-tagline">
              Dedicated to evocative scents, refined craftsmanship, and authentic personal expression.
            </p>
          </div>

          <div className="about-footer-links-group">
            <div className="footer-nav-col">
              <h4>EXPLORE</h4>
              <button type="button" onClick={handleCollectionsNavigate}>All Fragrances</button>
              <button type="button" onClick={() => handleCategoryNavigate("men")}>Men's Collection</button>
              <button type="button" onClick={() => handleCategoryNavigate("women")}>Women's Collection</button>
              <button type="button" onClick={() => handleCategoryNavigate("unisex")}>Unisex Portfolio</button>
            </div>

            <div className="footer-nav-col">
              <h4>HOUSE</h4>
              <button type="button" onClick={() => navigate("/about")}>About FEXA</button>
              <button type="button" onClick={() => navigate("/contact")}>Contact Us</button>
              <button type="button" onClick={() => navigate("/home")}>Home Atelier</button>
              <button type="button" onClick={() => navigate("/profile")}>Patron Privé</button>
            </div>
          </div>
        </div>

        <div className="about-footer-bottom">
          <div className="footer-bottom-inner">
            <span>© {new Date().getFullYear()} FEXA HAUTE PARFUMERIE. ALL RIGHTS RESERVED.</span>
            <span>LAVENDER & WHITE LUXURY EDITORIAL.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default About;
