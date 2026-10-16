import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import "./Navbar.css";

function Navbar({ activePage, onMobileMenuToggle }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, openCart } = useCart();
  const { wishlistCount, openWishlist } = useWishlist();

  // Search UI state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const requestIdRef = useRef(0);

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

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setIsSearchOpen(false);
      }
    };

    if (isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isSearchOpen]);

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

  return (
    <header className="fexa-global-navbar">
      <div className="global-navbar-container">
        {/* Brand Logo */}
        <div className="global-navbar-brand" onClick={() => navigate("/home")}>
          <h1 className="global-brand-title">FEXA</h1>
          <span className="global-brand-subtitle">HAUTE PARFUMERIE</span>
        </div>

        {/* Navigation Links */}
        <nav className="global-navbar-links">
          <button
            className={`global-nav-btn ${activePage === "home" ? "active" : ""}`}
            onClick={() => navigate("/home")}
          >
            HOME
          </button>
          
          <button
            className={`global-nav-btn ${
              activePage === "collections" ? "active" : ""
            }`}
            onClick={() => navigate("/collections")}
          >
            COLLECTIONS
          </button>
          <button
            className={`global-nav-btn ${activePage === "about" ? "active" : ""}`}
            onClick={() => navigate("/about")}
          >
            ABOUT
          </button>

          <button
            className={`global-nav-btn ${activePage === "contact" ? "active" : ""}`}
            onClick={() => navigate("/contact")}
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

          {/* Optional Mobile Menu Toggle (e.g. for Profile) */}
          {onMobileMenuToggle && (
            <button
              className="global-mobile-menu-btn"
              onClick={onMobileMenuToggle}
            >
              ☰ Menu
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
