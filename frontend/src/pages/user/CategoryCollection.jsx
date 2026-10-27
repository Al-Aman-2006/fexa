import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/common/Navbar";
import VideoHero from "../../components/common/VideoHero";
import ProductCard from "../../components/product/ProductCard";
import menPortfolioImg from "../../assets/images/men_portfolio.jpg";
import womenPortfolioImg from "../../assets/images/women_portfolio.jpg";
import unisexPortfolioImg from "../../assets/images/unisex_portfolio.jpg";
import "./Collections.css";

/**
 * CategoryCollection Page
 * Dedicated page for Men, Women, or Unisex collections.
 * Features:
 * - Dedicated Video Hero with local video asset and poster fallback
 * - Category-restricted search, sorting, and backend pagination
 * - MongoDB real product rendering with perfume volume variants
 * - Enforced category activation/deactivation rules
 * - FEXA lavender-and-white luxury theme preservation
 */
export default function CategoryCollection({ category }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Normalize category string
  const normalizedCategory = (() => {
    const lower = (category || "").trim().toLowerCase();
    if (lower === "men") return "Men";
    if (lower === "women") return "Women";
    if (lower === "unisex") return "Unisex";
    return "Men";
  })();

  // Sorting
  const rawSortParam = searchParams.get("sort") || "featured";
  const validSorts = ["featured", "latest", "price-low", "price-high", "name-asc", "name-desc"];
  const sortBy = validSorts.includes(rawSortParam.toLowerCase()) ? rawSortParam.toLowerCase() : "featured";

  // Search
  const appliedSearch = searchParams.get("search")?.trim() || "";
  const [search, setSearch] = useState(appliedSearch);

  // Pagination
  const pageParam = parseInt(searchParams.get("page"), 10);
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Data states from MongoDB backend
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalProducts: 0, totalPages: 1 });
  const [categoryCounts, setCategoryCounts] = useState({ all: 0, men: 0, women: 0, unisex: 0 });
  const [categoryStatuses, setCategoryStatuses] = useState({ Men: true, Women: true, Unisex: true });
  const [isCategoryInactive, setIsCategoryInactive] = useState(false);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synchronize input text with URL search parameter
  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);

  // Request ID ref for stale network response protection
  const requestIdRef = useRef(0);

  // Fetch category products from backend
  const fetchCategoryProducts = useCallback(
    async (targetCat, targetSearch, targetSort, targetPage) => {
      const currentReqId = ++requestIdRef.current;
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          category: targetCat.toLowerCase(),
          page: targetPage,
          limit: 12,
          sort: targetSort,
        });

        if (targetSearch.trim()) {
          params.set("search", targetSearch.trim());
        }

        const res = await fetch(`http://localhost:5000/api/products?${params.toString()}`);
        const data = await res.json();

        // Stale network response protection
        if (currentReqId !== requestIdRef.current) return;

        if (res.ok && data.success) {
          setProducts(data.products || []);
          setPagination(data.pagination || { page: targetPage, limit: 12, totalProducts: 0, totalPages: 1 });
          if (data.categoryCounts) {
            setCategoryCounts(data.categoryCounts);
          }
          if (data.categoryStatuses) {
            setCategoryStatuses(data.categoryStatuses);
          }
          setIsCategoryInactive(Boolean(data.isCategoryInactive));
        } else {
          setError(data.message || "Unable to load collection fragrances.");
        }
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        console.error(`Category ${targetCat} fetch error:`, err);
        setError("Unable to connect to the FEXA atelier service. Please try again.");
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Master fetch effect on filter/sort/page changes
  useEffect(() => {
    fetchCategoryProducts(normalizedCategory, appliedSearch, sortBy, page);
  }, [normalizedCategory, appliedSearch, sortBy, page, fetchCategoryProducts]);

  // Handle Sort Change
  const handleSortChange = (newSort) => {
    const newParams = new URLSearchParams(searchParams);
    if (newSort === "featured") {
      newParams.delete("sort");
    } else {
      newParams.set("sort", newSort);
    }
    newParams.delete("page");
    setSearchParams(newParams);
  };

  // Handle Search Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (search.trim()) {
      newParams.set("search", search.trim());
    } else {
      newParams.delete("search");
    }
    newParams.delete("page");
    setSearchParams(newParams);
  };

  // Handle Clear Search
  const handleClearSearch = () => {
    setSearch("");
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("search");
    newParams.delete("page");
    setSearchParams(newParams);
  };

  // Handle Page Change
  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams);
    if (newPage > 1) {
      newParams.set("page", newPage.toString());
    } else {
      newParams.delete("page");
    }
    setSearchParams(newParams);

    const catalogSection = document.getElementById("category-catalogue-view");
    if (catalogSection) {
      catalogSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Reset all filters in empty state
  const handleResetFilters = () => {
    setSearch("");
    setSearchParams(new URLSearchParams());
  };

  // Category specific editorial hero configuration
  const getCategoryHeroData = () => {
    switch (normalizedCategory) {
      case "Men":
        return {
          videoSrc: "/videos/men-collection-hero.mp4",
          posterSrc: menPortfolioImg,
          eyebrow: "THE MEN'S COLLECTION",
          heading: "Make Your Presence",
          headingAccent: "Memorable.",
          description:
            "Discover fragrances that express confidence, character, and individuality.",
          buttonText: "EXPLORE THE COLLECTION",
          introTitle: "Men's Olfactory Portfolio",
          introSubtitle:
            "Architectural formulations balancing smoked Haitian vetiver, dark amber resins, Italian birch, and spicy cracked pepper.",
          badgeLabel: "CURATED FOR MEN",
          count: categoryCounts.men,
        };
      case "Women":
        return {
          videoSrc: "/videos/women-collection-hero.mp4",
          posterSrc: womenPortfolioImg,
          eyebrow: "THE WOMEN'S COLLECTION",
          heading: "Find Your Signature",
          headingAccent: "Scent.",
          description:
            "Explore fragrances that celebrate your style, your mood, and every side of you.",
          buttonText: "EXPLORE THE COLLECTION",
          introTitle: "Women's Olfactory Portfolio",
          introSubtitle:
            "Luminous, captivating compositions starring Centifolia rose petals, radiant Grasse jasmine sambac, powdery white amber, and delicate iris.",
          badgeLabel: "CURATED FOR WOMEN",
          count: categoryCounts.women,
        };
      case "Unisex":
      default:
        return {
          videoSrc: "/videos/unisex-collection-hero.mp4",
          posterSrc: unisexPortfolioImg,
          eyebrow: "THE UNISEX COLLECTION",
          heading: "Beyond Labels.",
          headingAccent: "Into Fragrance.",
          description:
            "Explore distinctive scents created for every mood, every moment, and every individual.",
          buttonText: "EXPLORE THE COLLECTION",
          introTitle: "Unisex Olfactory Portfolio",
          introSubtitle:
            "Fragrance without boundaries. Fluid olfactory mastery balancing sparkling Calabrian bergamot, mineral sea salt crystals, and cashmeran musk.",
          badgeLabel: "CURATED FOR ALL",
          count: categoryCounts.unisex,
        };
    }
  };

  const heroData = getCategoryHeroData();

  return (
    <div className="fexa-collections-page category-dedicated-page">
      {/* ================= FEXA GLOBAL LUXURY NAVBAR ================= */}
      <Navbar activePage="collections" />

      {/* ================= BREADCRUMB NAVIGATION ================= */}
      <div className="collections-breadcrumb-bar">
        <div className="breadcrumb-container">
          <div className="breadcrumb-path">
            <span onClick={() => navigate("/home")}>HOME</span>
            <span className="sep">/</span>
            <span onClick={() => navigate("/collections")}>COLLECTIONS</span>
            <span className="sep">/</span>
            <span className="active current-category">{normalizedCategory.toUpperCase()}</span>
          </div>
          <div className="breadcrumb-stats">
            <span>MONGODB LIVE CATALOGUE</span>
            <span className="live-dot">●</span>
            <span>
              {pagination.totalProducts} {normalizedCategory.toUpperCase()} FRAGRANCE
              {pagination.totalProducts !== 1 ? "S" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ================= DEDICATED VIDEO HERO ================= */}
      <VideoHero
        videoSrc={heroData.videoSrc}
        themeVariant={normalizedCategory.toLowerCase()}
      />

      {/* ================= CATEGORY INTRODUCTION ================= */}
      <section className="category-intro-section">
        <div className="section-container">
          <div className="category-intro-header">
            <span className="category-intro-badge">{heroData.badgeLabel}</span>
            <h2 className="category-intro-title">{heroData.introTitle}</h2>
            <p className="category-intro-desc">{heroData.introSubtitle}</p>
          </div>

          {/* Quick Category Switcher Tabs */}
          <div className="category-quick-nav-bar">
            <button
              type="button"
              className={`cat-nav-tab ${normalizedCategory === "Men" ? "active" : ""}`}
              onClick={() => navigate("/collections/men")}
            >
              MEN'S COLLECTION
              <span className="tab-bubble">{categoryCounts.men}</span>
            </button>
            <button
              type="button"
              className={`cat-nav-tab ${normalizedCategory === "Women" ? "active" : ""}`}
              onClick={() => navigate("/collections/women")}
            >
              WOMEN'S COLLECTION
              <span className="tab-bubble">{categoryCounts.women}</span>
            </button>
            <button
              type="button"
              className={`cat-nav-tab ${normalizedCategory === "Unisex" ? "active" : ""}`}
              onClick={() => navigate("/collections/unisex")}
            >
              UNISEX COLLECTION
              <span className="tab-bubble">{categoryCounts.unisex}</span>
            </button>
            <button
              type="button"
              className="cat-nav-tab all-link"
              onClick={() => navigate("/collections")}
            >
              ALL COLLECTIONS →
            </button>
          </div>
        </div>
      </section>

      {/* ================= FILTER & SEARCH COMMAND BAR ================= */}
      <section className="collections-filter-bar-section" id="category-catalogue-view">
        <div className="section-container">
          <div className="filter-command-wrapper">
            {/* Category Indicator Tag */}
            <div className="category-indicator-tag">
              <span className="indicator-label">CURRENT COLLECTION:</span>
              <span className="indicator-val">{normalizedCategory.toUpperCase()}</span>
            </div>

            {/* Search and Sort Form */}
            <div className="search-sort-group">
              <form onSubmit={handleSearchSubmit} className="catalog-search-form">
                <div className="search-input-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder={`Search within ${normalizedCategory}'s...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label={`Search within ${normalizedCategory} collection`}
                  />
                  {search && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={handleClearSearch}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button type="submit" className="search-submit-btn">
                  FILTER
                </button>
              </form>

              {/* Sort Selection */}
              <div className="sort-select-wrapper">
                <span className="sort-label">SORT BY:</span>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="catalog-sort-select"
                  aria-label="Sort products by"
                >
                  <option value="featured">Featured / Default</option>
                  <option value="latest">Newest Arrivals</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name-asc">Product Name: A to Z</option>
                  <option value="name-desc">Product Name: Z to A</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MAIN PRODUCT LISTING ================= */}
      <main className="collections-main-catalogue">
        <div className="section-container">
          {/* INACTIVE CATEGORY NOTIFICATION */}
          {isCategoryInactive && (
            <div className="collections-inactive-category-banner">
              <span className="inactive-banner-icon">🔒</span>
              <div className="inactive-banner-info">
                <h3>The {normalizedCategory}'s Collection is currently unavailable.</h3>
                <p>
                  This fragrance portfolio is temporarily offline for catalogue maintenance.
                  Explore our other handcrafted collections.
                </p>
              </div>
              <button
                type="button"
                className="inactive-banner-action-btn"
                onClick={() => navigate("/collections")}
              >
                Browse All Collections →
              </button>
            </div>
          )}

          {/* ERROR ALERT */}
          {error && (
            <div className="fexa-alert-card error">
              <p>{error}</p>
              <button
                onClick={() =>
                  fetchCategoryProducts(normalizedCategory, appliedSearch, sortBy, page)
                }
                className="retry-btn"
              >
                RETRY
              </button>
            </div>
          )}

          {/* LOADING SKELETON */}
          {loading && (
            <div className="fexa-products-grid skeleton-grid">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={`skel-${idx}`} className="skeleton-card">
                  <div className="skel-img"></div>
                  <div className="skel-text skel-brand"></div>
                  <div className="skel-text skel-title"></div>
                  <div className="skel-text skel-desc"></div>
                  <div className="skel-text skel-price"></div>
                </div>
              ))}
            </div>
          )}

          {/* PRODUCT RESULTS */}
          {!loading && !error && !isCategoryInactive && (
            <div className="filtered-results-wrapper">
              <div className="filtered-header-bar">
                <div className="filtered-header-left">
                  <h2 className="filtered-heading">
                    {appliedSearch
                      ? `Search in ${normalizedCategory}'s: "${appliedSearch}"`
                      : normalizedCategory === "Unisex"
                      ? "Unisex Fragrances"
                      : `${normalizedCategory}'s Fragrances`}
                  </h2>
                  <span className="filtered-count-badge">
                    {pagination.totalProducts} FRAGRANCE{pagination.totalProducts !== 1 ? "S" : ""} FOUND
                  </span>
                </div>
                {appliedSearch && (
                  <button className="clear-search-link" onClick={handleClearSearch}>
                    Clear search filter ✕
                  </button>
                )}
              </div>

              {products.length > 0 ? (
                <>
                  <div className="fexa-products-grid">
                    {products.map((product) => (
                      <ProductCard key={product._id} product={product} />
                    ))}
                  </div>

                  {/* BACKEND PAGINATION BAR */}
                  {pagination.totalPages > 1 && (
                    <div className="fexa-pagination-bar">
                      <button
                        className="pagination-nav-btn"
                        onClick={() => handlePageChange(Math.max(1, page - 1))}
                        disabled={page <= 1}
                      >
                        ← PREVIOUS
                      </button>

                      <div className="pagination-pages-list">
                        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((num) => (
                          <button
                            key={num}
                            className={`pagination-num-btn ${num === page ? "active" : ""}`}
                            onClick={() => handlePageChange(num)}
                          >
                            {num}
                          </button>
                        ))}
                      </div>

                      <button
                        className="pagination-nav-btn"
                        onClick={() => handlePageChange(Math.min(pagination.totalPages, page + 1))}
                        disabled={page >= pagination.totalPages}
                      >
                        NEXT →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="fexa-empty-category-card">
                  <span className="empty-leaf-icon">🌿</span>
                  <h4>No fragrances match your criteria.</h4>
                  <p>
                    {appliedSearch
                      ? `We couldn't find any ${normalizedCategory} formulations matching "${appliedSearch}". Try searching for notes like "Oud", "Rose", or "Amber".`
                      : `A new ${normalizedCategory} collection is being prepared by our master perfumers. Check back soon.`}
                  </p>
                  <button className="empty-reset-btn" onClick={handleResetFilters}>
                    RESET FILTERS
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

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

      {/* ================= LUXURY FOOTER ================= */}
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
