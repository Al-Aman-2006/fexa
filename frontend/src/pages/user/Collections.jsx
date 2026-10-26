import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import Navbar from "../../components/common/Navbar";
import collectionBannerImg from "../../assets/images/collection_banner.jpg";
import menPortfolioImg from "../../assets/images/men_portfolio.jpg";
import womenPortfolioImg from "../../assets/images/women_portfolio.jpg";
import unisexPortfolioImg from "../../assets/images/unisex_portfolio.jpg";
import "./Collections.css";

function Collections() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { cart, openCart, addToCart } = useCart();
  const { wishlistCount, openWishlist, toggleWishlist, isWishlisted } = useWishlist();

  // URL-driven query parameters as single authoritative source of truth
  const categoryParam = searchParams.get("category");
  const activeCategory = (() => {
    if (!categoryParam) return "All";
    const lower = categoryParam.trim().toLowerCase();
    if (lower === "men") return "Men";
    if (lower === "women") return "Women";
    if (lower === "unisex") return "Unisex";
    return "All";
  })();

  const rawSortParam = searchParams.get("sort") || "featured";
  const validSorts = ["featured", "latest", "price-low", "price-high", "name-asc", "name-desc"];
  const sortBy = validSorts.includes(rawSortParam.toLowerCase()) ? rawSortParam.toLowerCase() : "featured";

  const appliedSearch = searchParams.get("search")?.trim() || "";
  const [search, setSearch] = useState(appliedSearch);

  const pageParam = parseInt(searchParams.get("page"), 10);
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Data states from MongoDB backend
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalProducts: 0, totalPages: 1 });
  const [categoryCounts, setCategoryCounts] = useState({ all: 0, men: 0, women: 0, unisex: 0 });
  const [categoryStatuses, setCategoryStatuses] = useState({ Men: true, Women: true, Unisex: true });
  const [isCurrentCategoryInactive, setIsCurrentCategoryInactive] = useState(false);
  const [categoryAlertToast, setCategoryAlertToast] = useState(null);

  // UI interaction states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null); // For Quick View Modal

  // Synchronize input text with URL search parameter
  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);

  // Request ID ref for stale network response protection
  const requestIdRef = useRef(0);

  // Scroll directly to the catalogue section (filter tabs + category products)
  const scrollToCatalogue = useCallback((behavior = "instant") => {
    const catalogEl = document.getElementById("catalog-catalogue-view");
    if (catalogEl) {
      const navbarHeight = 76;
      const elementPosition = catalogEl.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = Math.max(0, elementPosition - navbarHeight);
      window.scrollTo({
        top: offsetPosition,
        behavior: behavior,
      });
    }
  }, []);

  // Window scroll management:
  // If a category (Men, Women, Unisex) is selected in URL, scroll directly to that collection's catalogue portion
  // If "All" / general collection, start at the top
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (activeCategory !== "All") {
      const timer = setTimeout(() => {
        scrollToCatalogue("instant");
      }, 30);
      return () => clearTimeout(timer);
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activeCategory, scrollToCatalogue]);

  // Keep catalogue view positioned correctly once initial asynchronous data finishes loading
  useEffect(() => {
    if (!loading && isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (activeCategory !== "All") {
        scrollToCatalogue("instant");
      }
    }
  }, [loading, activeCategory, scrollToCatalogue]);

  // Fetch paginated products for specific category or search/sort with race-condition protection
  const fetchFilteredProducts = useCallback(
    async (targetCat, targetSearch, targetSort, targetPage) => {
      const currentReqId = ++requestIdRef.current;
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: targetPage,
          limit: 12,
          sort: targetSort,
        });

        if (targetCat && targetCat !== "All") {
          params.set("category", targetCat.toLowerCase());
        }

        if (targetSearch.trim()) {
          params.set("search", targetSearch.trim());
        }

        const res = await fetch(`http://localhost:5000/api/products?${params.toString()}`);
        const data = await res.json();

        // Prevent stale network responses from overwriting newer state
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
          setIsCurrentCategoryInactive(Boolean(data.isCategoryInactive));
        } else {
          setError(data.message || "Unable to load products.");
        }
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        console.error("Products fetch error:", err);
        setError("Unable to connect to the FEXA atelier service. Please try again.");
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Master fetch effect: triggers whenever category, search, sort, or page changes in URL
  useEffect(() => {
    fetchFilteredProducts(activeCategory, appliedSearch, sortBy, page);
  }, [activeCategory, appliedSearch, sortBy, page, fetchFilteredProducts]);

  // Category switch: updates URL search parameters and resets pagination
  const handleSelectCategory = (cat, shouldScrollToCatalogue = false) => {
    if (cat !== "All" && categoryStatuses[cat] === false) {
      setCategoryAlertToast(`The ${cat}'s Collection is currently unavailable.`);
      setTimeout(() => setCategoryAlertToast(null), 4000);
      return;
    }

    const newParams = new URLSearchParams(searchParams);
    if (cat === "All") {
      newParams.delete("category");
    } else {
      newParams.set("category", cat.toLowerCase());
    }
    newParams.delete("page"); // Reset to page 1 on category change
    setSearchParams(newParams);

    if (shouldScrollToCatalogue || cat !== "All") {
      setTimeout(() => {
        scrollToCatalogue("smooth");
      }, 30);
    }
  };

  // Sort change: updates URL search parameters and resets pagination
  const handleSortChange = (newSort) => {
    const newParams = new URLSearchParams(searchParams);
    if (newSort === "featured") {
      newParams.delete("sort");
    } else {
      newParams.set("sort", newSort);
    }
    newParams.delete("page"); // Reset to page 1 on sort change
    setSearchParams(newParams);
  };

  // Search submit: writes search query to URL
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

  // Clear search: removes search query from URL
  const handleClearSearch = () => {
    setSearch("");
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("search");
    newParams.delete("page");
    setSearchParams(newParams);
  };

  // Page navigation
  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams);
    if (newPage > 1) {
      newParams.set("page", newPage.toString());
    } else {
      newParams.delete("page");
    }
    setSearchParams(newParams);
    const catalogSection = document.getElementById("catalog-catalogue-view");
    if (catalogSection) {
      catalogSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Reset all filters in empty state
  const handleResetAllFilters = () => {
    setSearch("");
    setSearchParams(new URLSearchParams());
  };

  const formatPrice = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  // Dynamic editorial hero text based on active category
  const getHeroContent = () => {
    switch (activeCategory) {
      case "Men":
        return {
          badge: "MEN'S PORTFOLIO // CURATED FORMULATIONS",
          title: "Define Your",
          accent: "Presence.",
          narrative:
            "Discover fragrances crafted for confidence, character, and unforgettable moments. Hand-compounded extraits and rare botanical resins curated for the modern connoisseur.",
          tag1: "24% Extrait Concentration",
          tag2: "Smoked Woods & Amber",
          tag3: "100% Pure Extracts",
          sampleBadge: "MEN'S SIGNATURE // NOIR OUD",
        };
      case "Women":
        return {
          badge: "WOMEN'S PORTFOLIO // ATELIER GRASSE",
          title: "Leave Your",
          accent: "Signature.",
          narrative:
            "Discover fragrances created for confidence, beauty, and unforgettable moments. Handcrafted in Grasse with Centifolia rose petals, luminous white amber, and radiant jasmine sambac.",
          tag1: "36 Sourced Blooms",
          tag2: "7 Olfactory Families",
          tag3: "100% Sustainable Flora",
          sampleBadge: "WOMEN'S SIGNATURE // ROSE IMPÉRIALE",
        };
      case "Unisex":
        return {
          badge: "UNISEX PORTFOLIO // ATELIER ARCHIVE",
          title: "Fragrance Without",
          accent: "Boundaries.",
          narrative:
            "Distinct scents created for individuality, expression, and every version of you. Fluid olfactory artistry balancing crisp bergamot, mineral sea salt crystals, and velvet cashmeran.",
          tag1: "42 Curated Accords",
          tag2: "8 Olfactory Profiles",
          tag3: "100% Pure Extracts",
          sampleBadge: "UNISEX SIGNATURE // L'AMBRE SOLAIRE",
        };
      default:
        return {
          badge: "ATELIER PORTFOLIO // THE DEFINITIVE OLFACTORY ARCHIVE",
          title: "Explore Our",
          accent: "Collections.",
          narrative:
            "Discover fragrances curated for every mood, personality, and moment. An olfactory odyssey across Grasse floral concentrates, smoked agarwood accents, and luminous extracts crafted with quiet restraint.",
          tag1: "Artisanal Hand-Bottling",
          tag2: "14 Days Maceration Window",
          tag3: "100% Pure Extractions",
          sampleBadge: "FLAGSHIP ATELIER // HAUTE PARFUMERIE",
        };
    }
  };

  const hero = getHeroContent();

  // Render individual product card
  const renderProductCard = (product) => {
    const purchasableVariants = product.variants && product.variants.length > 0
      ? product.variants.filter((v) => v.isAvailable !== false)
      : [];

    const hasPurchasableStock = purchasableVariants.length > 0
      ? purchasableVariants.some((v) => Number(v.stock) > 0)
      : (Number(product.stock) > 0 && product.status !== "Out of Stock");

    const isOutOfStock = !hasPurchasableStock || product.status === "Out of Stock";

    // Representative price calculation consistent with backend effectivePrice
    const inStockVariants = purchasableVariants.filter((v) => Number(v.stock) > 0);
    const candidateVariants = inStockVariants.length > 0 ? inStockVariants : purchasableVariants;

    let representativePrice = product.effectivePrice !== undefined ? product.effectivePrice : product.price;
    let displayPriceText = formatPrice(representativePrice);

    if (candidateVariants.length > 0) {
      const prices = candidateVariants.map((v) => Number(v.sellingPrice));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      if (minPrice !== maxPrice) {
        displayPriceText = `From ${formatPrice(minPrice)}`;
      } else {
        displayPriceText = formatPrice(minPrice);
      }
    }

    const primaryImage =
      product.images && product.images.length > 0
        ? `http://localhost:5000${product.images[0]}`
        : null;
    const isSaved = isWishlisted(product._id);

    return (
      <div
        key={product._id}
        className="fexa-product-card"
        onClick={() => navigate(`/products/${product._id}`)}
      >
        {/* Card Image Container */}
        <div className="product-card-media">
          {primaryImage ? (
            <img src={primaryImage} alt={product.name} className="product-card-img" />
          ) : (
            <div className="product-card-placeholder">
              <span className="placeholder-monogram">FEXA</span>
              <span className="placeholder-icon">⚗️</span>
            </div>
          )}

          {/* Top Badges */}
          <div className="card-top-badges">
            <span className={`category-tag ${product.category?.toLowerCase()}`}>
              {product.category?.toUpperCase()}
            </span>
            {isOutOfStock && <span className="card-stock-tag">OUT OF STOCK</span>}
          </div>

          {/* Wishlist Heart Button */}
          <button
            type="button"
            className={`card-wishlist-btn ${isSaved ? "saved" : ""}`}
            onClick={async (e) => {
              e.stopPropagation();
              const res = await toggleWishlist(product._id);
              if (res && res.requiresLogin) {
                openWishlist();
              }
            }}
            title={isSaved ? "Remove from wishlist" : "Add to wishlist"}
          >
            {isSaved ? "♥" : "♡"}
          </button>
        </div>

        {/* Card Content Details */}
        <div className="product-card-body">
          <div className="product-card-brand">{product.brand || "FEXA"}</div>

          <h3
            className="product-card-name"
            title={product.name}
          >
            {product.name}
          </h3>

          <p className="product-card-desc">
            {product.description || "An exquisite olfactory creation formulated with precious natural ingredients."}
          </p>

          <div className="product-card-footer">
            <div className="card-price-group">
              <span className="card-current-price">{displayPriceText}</span>
              {product.compareAtPrice > product.price && (
                <span className="card-original-price">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </div>

            <button
              type="button"
              className={`card-action-btn ${isOutOfStock ? "disabled" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/products/${product._id}`);
              }}
            >
              {isOutOfStock ? "OUT OF STOCK" : "EXPLORE FLACON"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fexa-collections-page">
      {/* ================= FEXA GLOBAL LUXURY NAVBAR ================= */}
      <Navbar activePage="collections" />

      {/* ================= 3. BREADCRUMB & QUICK STATUS ================= */}
      <div className="collections-breadcrumb-bar">
        <div className="breadcrumb-container">
          <div className="breadcrumb-path">
            <span onClick={() => navigate("/home")}>HOME</span>
            <span className="sep">/</span>
            <span className="active">COLLECTIONS</span>
            {activeCategory !== "All" && (
              <>
                <span className="sep">/</span>
                <span className="current-category">{activeCategory.toUpperCase()}</span>
              </>
            )}
          </div>
          <div className="breadcrumb-stats">
            <span>MONGODB LIVE CATALOGUE</span>
            <span className="live-dot">●</span>
            <span>{categoryCounts.all} REGISTERED FRAGRANCES</span>
          </div>
        </div>
      </div>

      {/* ================= 4. COLLECTION IMAGE BANNER ================= */}
      <section className="collections-image-banner-section">
        <div className="banner-image-container">
          <img
            src={collectionBannerImg}
            alt="Fexa Collection Featured Showcase"
            className="collection-featured-banner-img"
          />
        </div>
      </section>

      {/* ================= 5. SILHOUETTE PORTFOLIOS BANNER ================= */}
      <section className="silhouette-portfolios-section">
        <div className="section-container">
          <div className="section-header-block">
            <span className="section-eyebrow">PORTFOLIO BY SILHOUETTE</span>
            <h2 className="section-main-heading">Explore By Olfactory Persona</h2>
            <p className="section-subtext">
              Three definitive expressions of luxury perfumery, tailored to presence, elegance, and individuality.
            </p>
          </div>

          <div className="silhouettes-grid">
            {/* Men's Portfolio Card */}
            <div
              className={`silhouette-card men ${activeCategory === "Men" ? "selected" : ""} ${
                categoryStatuses.Men === false ? "category-inactive-card" : ""
              }`}
              onClick={() => handleSelectCategory("Men", true)}
            >
              <div className="silhouette-image-wrapper">
                <img src={menPortfolioImg} alt="Men's Portfolio" className="silhouette-bg-img" />
                <div className="silhouette-overlay"></div>
              </div>
              <div className="silhouette-card-content">
                <div className="silhouette-badge">
                  {categoryStatuses.Men === false
                    ? "MEN // UNAVAILABLE"
                    : `MEN // ${categoryCounts.men} FRAGRANCES`}
                </div>
                <h3 className="silhouette-title">Men's Portfolio</h3>
                <p className="silhouette-notes">
                  Bold, architectural fragrances compounded with smoked Haitian vetiver, dark amber resins, Italian birch, and spicy cracked pepper.
                </p>
                <div className="silhouette-link">
                  <span>
                    {categoryStatuses.Men === false
                      ? "COLLECTION CURRENTLY UNAVAILABLE"
                      : "EXPLORE MEN'S COLLECTION"}
                  </span>
                  <span className="arrow-sym">→</span>
                </div>
              </div>
            </div>

            {/* Women's Portfolio Card */}
            <div
              className={`silhouette-card women ${activeCategory === "Women" ? "selected" : ""} ${
                categoryStatuses.Women === false ? "category-inactive-card" : ""
              }`}
              onClick={() => handleSelectCategory("Women", true)}
            >
              <div className="silhouette-image-wrapper">
                <img src={womenPortfolioImg} alt="Women's Portfolio" className="silhouette-bg-img" />
                <div className="silhouette-overlay"></div>
              </div>
              <div className="silhouette-card-content">
                <div className="silhouette-badge">
                  {categoryStatuses.Women === false
                    ? "WOMEN // UNAVAILABLE"
                    : `WOMEN // ${categoryCounts.women} FRAGRANCES`}
                </div>
                <h3 className="silhouette-title">Women's Portfolio</h3>
                <p className="silhouette-notes">
                  Luminous, captivating compositions starring Centifolia rose petals, radiant Grasse jasmine sambac, powdery white amber, and delicate iris.
                </p>
                <div className="silhouette-link">
                  <span>
                    {categoryStatuses.Women === false
                      ? "COLLECTION CURRENTLY UNAVAILABLE"
                      : "EXPLORE WOMEN'S COLLECTION"}
                  </span>
                  <span className="arrow-sym">→</span>
                </div>
              </div>
            </div>

            {/* Unisex Portfolio Card */}
            <div
              className={`silhouette-card unisex ${activeCategory === "Unisex" ? "selected" : ""} ${
                categoryStatuses.Unisex === false ? "category-inactive-card" : ""
              }`}
              onClick={() => handleSelectCategory("Unisex", true)}
            >
              <div className="silhouette-image-wrapper">
                <img src={unisexPortfolioImg} alt="Unisex Portfolio" className="silhouette-bg-img" />
                <div className="silhouette-overlay"></div>
              </div>
              <div className="silhouette-card-content">
                <div className="silhouette-badge">
                  {categoryStatuses.Unisex === false
                    ? "UNISEX // UNAVAILABLE"
                    : `UNISEX // ${categoryCounts.unisex} FRAGRANCES`}
                </div>
                <h3 className="silhouette-title">Unisex Portfolio</h3>
                <p className="silhouette-notes">
                  Fragrance without boundaries. Fluid olfactory mastery balancing sparkling Calabrian bergamot, mineral sea salt crystals, and cashmeran musk.
                </p>
                <div className="silhouette-link">
                  <span>
                    {categoryStatuses.Unisex === false
                      ? "COLLECTION CURRENTLY UNAVAILABLE"
                      : "EXPLORE UNISEX COLLECTION"}
                  </span>
                  <span className="arrow-sym">→</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 6. CATEGORY FILTER TABS & SEARCH COMMAND ================= */}
      <section className="collections-filter-bar-section" id="catalog-catalogue-view">
        <div className="section-container">
          <div className="filter-command-wrapper">
            {/* Category Navigation Pills */}
            <div className="category-tabs-group">
              <button
                className={`category-tab-btn ${activeCategory === "All" ? "active" : ""}`}
                onClick={() => handleSelectCategory("All")}
              >
                <span>ALL</span>
                <span className="tab-count-pill">{categoryCounts.all}</span>
              </button>

              {categoryStatuses.Men !== false && (
                <button
                  className={`category-tab-btn ${activeCategory === "Men" ? "active" : ""}`}
                  onClick={() => handleSelectCategory("Men")}
                >
                  <span>MEN</span>
                  <span className="tab-count-pill">{categoryCounts.men}</span>
                </button>
              )}

              {categoryStatuses.Women !== false && (
                <button
                  className={`category-tab-btn ${activeCategory === "Women" ? "active" : ""}`}
                  onClick={() => handleSelectCategory("Women")}
                >
                  <span>WOMEN</span>
                  <span className="tab-count-pill">{categoryCounts.women}</span>
                </button>
              )}

              {categoryStatuses.Unisex !== false && (
                <button
                  className={`category-tab-btn ${activeCategory === "Unisex" ? "active" : ""}`}
                  onClick={() => handleSelectCategory("Unisex")}
                >
                  <span>UNISEX</span>
                  <span className="tab-count-pill">{categoryCounts.unisex}</span>
                </button>
              )}
            </div>

            {/* Search and Sort Form */}
            <div className="search-sort-group">
              <form onSubmit={handleSearchSubmit} className="catalog-search-form">
                <div className="search-input-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search notes, ingredients, name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={handleClearSearch}
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

      {/* ================= 7. DYNAMIC CATALOGUE VIEW ================= */}
      <main className="collections-main-catalogue">
        <div className="section-container">
          {/* TOAST NOTIFICATION FOR UNAVAILABLE CATEGORY */}
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

          {/* INACTIVE CATEGORY BANNER */}
          {isCurrentCategoryInactive && (
            <div className="collections-inactive-category-banner">
              <span className="inactive-banner-icon">🔒</span>
              <div className="inactive-banner-info">
                <h3>The {activeCategory}'s Collection is currently unavailable.</h3>
                <p>
                  This fragrance portfolio is temporarily offline for catalogue maintenance.
                  Explore our other handcrafted collections below.
                </p>
              </div>
              <button
                type="button"
                className="inactive-banner-action-btn"
                onClick={() => handleSelectCategory("All")}
              >
                Browse Available Fragrances →
              </button>
            </div>
          )}

          {/* ERROR ALERT */}
          {error && (
            <div className="fexa-alert-card error">
              <p>{error}</p>
              <button
                onClick={() => fetchFilteredProducts(activeCategory, appliedSearch, sortBy, page)}
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

          {/* UNIFIED DYNAMIC CATALOGUE VIEW */}
          {!loading && !error && (
            <div className="filtered-results-wrapper">
              <div className="filtered-header-bar">
                <div className="filtered-header-left">
                  <h2 className="filtered-heading">
                    {appliedSearch
                      ? `Search Results for "${appliedSearch}"`
                      : activeCategory === "All"
                      ? "All Fragrances"
                      : activeCategory === "Unisex"
                      ? "Unisex Collection"
                      : `${activeCategory}'s Collection`}
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
                    {products.map(renderProductCard)}
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
                      ? `We couldn't find any formulations matching "${appliedSearch}". Try searching for notes like "Oud", "Rose", or "Amber".`
                      : `A new ${activeCategory === "All" ? "" : activeCategory + " "}collection is being prepared by our master perfumers. Check back soon.`}
                  </p>
                  <button
                    className="empty-reset-btn"
                    onClick={handleResetAllFilters}
                  >
                    RESET ALL FILTERS
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ================= 8. EDITORIAL PHILOSOPHY BANNER ================= */}
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

      {/* ================= 9. TRUST & CRAFTSMANSHIP BAR ================= */}
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

      {/* ================= 10. PRODUCT DETAIL QUICK VIEW MODAL ================= */}
      {selectedProduct && (
        <div className="fexa-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="fexa-quick-view-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-icon-btn" onClick={() => setSelectedProduct(null)}>
              ✕
            </button>

            <div className="quick-view-grid">
              {/* Media left */}
              <div className="quick-view-media">
                {selectedProduct.images && selectedProduct.images.length > 0 ? (
                  <img
                    src={`http://localhost:5000${selectedProduct.images[0]}`}
                    alt={selectedProduct.name}
                    className="quick-view-img"
                  />
                ) : (
                  <div className="quick-view-placeholder">
                    <span>FEXA</span>
                    <small>HAUTE PARFUMERIE</small>
                  </div>
                )}
                <span className="quick-view-cat-badge">
                  {selectedProduct.category?.toUpperCase()}
                </span>
              </div>

              {/* Details right */}
              <div className="quick-view-info">
                <div className="quick-brand">{selectedProduct.brand || "FEXA"}</div>
                <h2 className="quick-name">{selectedProduct.name}</h2>
                <div className="quick-spec-row">
                  <span>100ml / 3.4 FL.OZ.</span>
                  <span className="dot">•</span>
                  <span>EXTRAIT DE PARFUM</span>
                  <span className="dot">•</span>
                  <span>MADE IN GRASSE</span>
                </div>

                <div className="quick-price-row">
                  <span className="quick-price">{formatPrice(selectedProduct.price)}</span>
                  {selectedProduct.compareAtPrice > selectedProduct.price && (
                    <span className="quick-compare">{formatPrice(selectedProduct.compareAtPrice)}</span>
                  )}
                  <span className="quick-tax-label">INCL. OF ALL TAXES</span>
                </div>

                <div className="quick-divider"></div>

                <div className="quick-desc-block">
                  <label>OLFACTORY ARCHIVE & STORY</label>
                  <p>{selectedProduct.description}</p>
                </div>

                <div className="quick-stock-status">
                  <span className="status-label">AVAILABILITY:</span>
                  {selectedProduct.stock === 0 || selectedProduct.status === "Out of Stock" ? (
                    <span className="stock-val out">Out of Stock (Awaiting Atelier Batch)</span>
                  ) : (
                    <span className="stock-val in">In Stock ({selectedProduct.stock} flacons available)</span>
                  )}
                </div>

                <div className="quick-modal-actions">
                  <button
                    className="quick-view-full-btn"
                    onClick={() => {
                      const prodId = selectedProduct._id;
                      setSelectedProduct(null);
                      navigate(`/products/${prodId}`);
                    }}
                  >
                    EXPLORE FULL FLACON DETAILS →
                  </button>

                  <button
                    className={`quick-wishlist-toggle ${
                      isWishlisted(selectedProduct._id) ? "saved" : ""
                    }`}
                    onClick={() => toggleWishlist(selectedProduct._id)}
                  >
                    {isWishlisted(selectedProduct._id) ? "♥ IN WISHLIST" : "♡ ADD TO WISHLIST"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 11. LUXURY FOOTER ================= */}
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
              <button onClick={() => handleSelectCategory("All", true)}>All Fragrances</button>
              <button onClick={() => handleSelectCategory("Men", true)}>Men's Portfolio</button>
              <button onClick={() => handleSelectCategory("Women", true)}>Women's Portfolio</button>
              <button onClick={() => handleSelectCategory("Unisex", true)}>Unisex Portfolio</button>
              <button onClick={() => {
                window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                navigate("/collections");
              }}>Discovery Extraits</button>
            </div>

            <div className="footer-links-col">
              <h4>CONCIERGE</h4>
              <button onClick={() => navigate("/contact")}>Boutique Concierge</button>
              <button onClick={() => navigate("/contact")}>Private Consultation</button>
              <button onClick={() => navigate("/contact")}>Shipping & Climate-Control</button>
              <button onClick={() => navigate("/profile")}>Fragrance Care & Storage</button>
            </div>

            <div className="footer-links-col">
              <h4>OLFACTORY ARCHIVES</h4>
              <button onClick={() => navigate("/about")}>About FEXA</button>
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

export default Collections;
