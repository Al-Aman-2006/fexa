import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import "./Navbar.css";

function Navbar({ activePage, onMobileMenuToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, openCart } = useCart();
  const { wishlistCount, openWishlist } = useWishlist();

  // Collections Dropdown state & ref
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const collectionsRef = useRef(null);
  const collectionsBtnRef = useRef(null);

  // Mobile navigation state & ref
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavRef = useRef(null);

  // Search UI state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const requestIdRef = useRef(0);

  // Close menus on route navigation
  useEffect(() => {
    setIsCollectionsOpen(false);
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  // Global Escape key handler
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.key === "Escape") {
        if (isCollectionsOpen) {
          setIsCollectionsOpen(false);
          collectionsBtnRef.current?.focus();
        }
        if (isSearchOpen) {
          setIsSearchOpen(false);
        }
        if (isMobileNavOpen) {
          setIsMobileNavOpen(false);
        }
      }
    };

    if (isCollectionsOpen || isSearchOpen || isMobileNavOpen) {
      document.addEventListener("keydown", handleGlobalKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isCollectionsOpen, isSearchOpen, isMobileNavOpen]);

  // Focus search input when search bar opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
    }
  }, [isSearchOpen]);

  // Click outside to close search, collections dropdown, and mobile menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setIsSearchOpen(false);
      }
      if (
        collectionsRef.current &&
        !collectionsRef.current.contains(event.target)
      ) {
        setIsCollectionsOpen(false);
      }
      if (
        mobileNavRef.current &&
        !mobileNavRef.current.contains(event.target) &&
        !event.target.closest(".global-mobile-menu-btn")
      ) {
        setIsMobileNavOpen(false);
      }
    };

    if (isSearchOpen || isCollectionsOpen || isMobileNavOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isSearchOpen, isCollectionsOpen, isMobileNavOpen]);

  // Debounced search effect with request cancellation / race-condition protection
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      const currentReqId = ++requestIdRef.current;
      try {
        const res = await fetch(
          `http://localhost:5000/api/products?search=${encodeURIComponent(
            trimmedQuery
          )}&limit=6`
        );
        const data = await res.json();

        // Ignore stale out-of-order responses
        if (currentReqId !== requestIdRef.current) return;

        if (res.ok && data.success) {
          setSearchResults(data.products || []);
        } else {
          setSearchError(
            data.message || "Unable to search products. Please try again."
          );
        }
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        console.error("Navbar search error:", err);
        setSearchError("Unable to connect to product search. Please try again.");
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Key handlers
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsSearchOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSearchSubmit();
    }
  };

  const handleSearchSubmit = () => {
    const query = searchQuery.trim();
    if (query) {
      navigate(`/collections?search=${encodeURIComponent(query)}`);
      setIsSearchOpen(false);
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
    setIsSearchOpen(false);
  };

  const handleViewAllClick = () => {
    const query = searchQuery.trim();
    if (query) {
      navigate(`/collections?search=${encodeURIComponent(query)}`);
      setIsSearchOpen(false);
    }
  };

  const formatPrice = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  const getImageUrl = (imgPath) => {
    if (!imgPath) return null;
    if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
      return imgPath;
    }
    return `http://localhost:5000${imgPath}`;
  };

  const handleCollectionsToggle = (e) => {
    e.stopPropagation();
    setIsCollectionsOpen((prev) => !prev);
  };

  const handleCategorySelect = (path) => {
    navigate(path);
    setIsCollectionsOpen(false);
    setIsMobileNavOpen(false);
  };

  const handleNavClick = (target) => {
    setIsMobileNavOpen(false);
    setIsCollectionsOpen(false);

    const isHomePage = location.pathname === "/home" || location.pathname === "/";

    if (target === "home") {
      if (isHomePage) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navigate("/home");
      }
      return;
    }

    if (target === "about") {
      if (isHomePage) {
        const el = document.getElementById("about-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        navigate("/home#about-section", { state: { scrollTo: "about-section" } });
      }
      return;
    }

    if (target === "contact") {
      if (isHomePage) {
        const el = document.getElementById("contact-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        navigate("/home#contact-section", { state: { scrollTo: "contact-section" } });
      }
      return;
    }
  };

  return (
    <header className="fexa-global-navbar">
      <div className="global-navbar-container">
        {/* Brand Logo */}
        <div className="global-navbar-brand" onClick={() => handleNavClick("home")}>
          <h1 className="global-brand-title">FEXA</h1>
          <span className="global-brand-subtitle">HAUTE PARFUMERIE</span>
        </div>

        {/* Navigation Links */}
        <nav
          ref={mobileNavRef}
          className={`global-navbar-links ${isMobileNavOpen ? "mobile-open" : ""}`}
        >
          <button
            className={`global-nav-btn ${activePage === "home" ? "active" : ""}`}
            onClick={() => handleNavClick("home")}
          >
            HOME
          </button>
          
          <div className="collections-nav-item-wrapper" ref={collectionsRef}>
            <button
              ref={collectionsBtnRef}
              type="button"
              className={`global-nav-btn collections-trigger-btn ${
                activePage === "collections" ||
                location.pathname.startsWith("/collections")
                  ? "active"
                  : ""
              } ${isCollectionsOpen ? "open" : ""}`}
              onClick={handleCollectionsToggle}
              aria-expanded={isCollectionsOpen}
              aria-haspopup="true"
              aria-controls="collections-dropdown-menu"
            >
              COLLECTIONS
            </button>

            {isCollectionsOpen && (
              <div
                id="collections-dropdown-menu"
                className="collections-dropdown-menu"
                role="menu"
                aria-label="Collections categories"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={`collections-dropdown-item ${
                    location.pathname === "/collections/men" ? "selected" : ""
                  }`}
                  onClick={() => handleCategorySelect("/collections/men")}
                >
                  Men
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`collections-dropdown-item ${
                    location.pathname === "/collections/women" ? "selected" : ""
                  }`}
                  onClick={() => handleCategorySelect("/collections/women")}
                >
                  Women
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`collections-dropdown-item ${
                    location.pathname === "/collections/unisex" ? "selected" : ""
                  }`}
                  onClick={() => handleCategorySelect("/collections/unisex")}
                >
                  Unisex
                </button>
              </div>
            )}
          </div>

          <button
            className={`global-nav-btn ${activePage === "about" ? "active" : ""}`}
            onClick={() => handleNavClick("about")}
          >
            ABOUT
          </button>

          <button
            className={`global-nav-btn ${activePage === "contact" ? "active" : ""}`}
            onClick={() => handleNavClick("contact")}
          >
            CONTACT US
          </button>
        </nav>

        {/* Action Icons */}
        <div className="global-navbar-actions">
          {/* Search Trigger / Toggle */}
          <div className="global-search-wrapper" ref={searchContainerRef}>
            {!isSearchOpen ? (
              <button
                className="global-nav-icon-btn search-trigger-btn"
                onClick={() => setIsSearchOpen(true)}
                title="Search fragrances"
                aria-label="Search fragrances"
              >
                <svg
                  className="global-icon-svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            ) : (
              <div className="global-search-input-box">
                <svg
                  className="search-box-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="global-search-input"
                  placeholder="Search fragrances, brands, categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                {searchQuery && (
                  <button
                    className="clear-search-btn"
                    onClick={() => setSearchQuery("")}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="close-search-btn"
                  onClick={() => setIsSearchOpen(false)}
                  title="Close search (Esc)"
                >
                  Close
                </button>
              </div>
            )}

            {/* Live Search Results Dropdown */}
            {isSearchOpen && (
              <div className="global-search-dropdown">
                {isSearching ? (
                  <div className="search-dropdown-status">
                    <span className="search-spinner"></span>
                    <span>Searching atelier catalogue...</span>
                  </div>
                ) : searchError ? (
                  <div className="search-dropdown-status error">
                    <span>{searchError}</span>
                  </div>
                ) : searchQuery.trim() && searchResults.length === 0 ? (
                  <div className="search-dropdown-status empty">
                    <span>No fragrances found for "{searchQuery}"</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <div className="search-dropdown-header">
                      <span>MATCHING FLACONS ({searchResults.length})</span>
                    </div>
                    <ul className="search-results-list">
                      {searchResults.map((product) => {
                        const imgUrl =
                          product.images && product.images.length > 0
                            ? getImageUrl(product.images[0])
                            : null;
                        return (
                          <li
                            key={product._id}
                            className="search-result-item"
                            onClick={() => handleProductClick(product._id)}
                          >
                            <div className="result-img-box">
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt={product.name}
                                  className="result-img"
                                />
                              ) : (
                                <div className="result-img-placeholder">
                                  <span>FEXA</span>
                                </div>
                              )}
                            </div>
                            <div className="result-details">
                              <span className="result-brand">{product.brand}</span>
                              <h4 className="result-title">{product.name}</h4>
                              <span className="result-cat">{product.category}</span>
                            </div>
                            <div className="result-price-box">
                              <span className="result-price">
                                {formatPrice(product.price)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div
                      className="search-dropdown-footer"
                      onClick={handleViewAllClick}
                    >
                      <span>
                        View all results for "{searchQuery.trim()}" →
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="search-dropdown-status initial">
                    <span>Type product name, brand, or category to search...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wishlist Icon */}
          <div
            className={`global-nav-icon-badge ${
              activePage === "wishlist" ? "active" : ""
            }`}
            title="Wishlist"
            onClick={openWishlist}
          >
            <span className="global-icon-symbol">♡</span>
            {wishlistCount > 0 && (
              <span className="global-badge-count">{wishlistCount}</span>
            )}
          </div>

          {/* Cart Icon */}
          <div
            className={`global-nav-icon-badge ${
              activePage === "cart" ? "active" : ""
            }`}
            title="Shopping Bag"
            onClick={openCart}
          >
            <span className="global-icon-symbol">🛍️</span>
            {cart.totalItems > 0 && (
              <span className="global-badge-count">{cart.totalItems}</span>
            )}
          </div>

          {/* Profile / Account Icon */}
          <button
            className="global-navbar-user-btn"
            onClick={() => navigate(user ? "/profile" : "/login")}
            title={user ? `Signed in as ${user.name}` : "Sign In"}
          >
            <span className="user-icon-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : "♙"}
            </span>
            <span className="user-nav-name">{user?.name || "Account"}</span>
          </button>

          {/* Mobile Menu Toggle */}
          {onMobileMenuToggle ? (
            <button
              className="global-mobile-menu-btn"
              onClick={onMobileMenuToggle}
              aria-label="Toggle profile menu"
            >
              ☰ Menu
            </button>
          ) : (
            <button
              className="global-mobile-menu-btn"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileNavOpen}
            >
              {isMobileNavOpen ? "✕" : "☰"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
