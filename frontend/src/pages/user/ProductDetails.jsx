import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import ProductImageZoomViewer from "../../components/user/ProductImageZoomViewer";
import Navbar from "../../components/common/Navbar";
import "./ProductDetails.css";

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, openCart, addToCart, actionLoading } = useCart();
  const {
    isWishlisted,
    addToWishlist,
    removeFromWishlist,
    wishlistCount,
    openWishlist,
  } = useWishlist();

  // Primary product data state
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { type: '404' | 'inactive' | 'network', message: string }

  // Gallery and UI states
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [toastMessage, setToastMessage] = useState(null);

  // Related products
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Fetch product by ID or slug
  const fetchProduct = useCallback(async (targetId) => {
    try {
      setLoading(true);
      setErrorState(null);
      setActiveImageIndex(0);
      setQuantity(1);

      const res = await fetch(`http://localhost:5000/api/products/${targetId}`);
      const data = await res.json();

      if (res.status === 404) {
        setErrorState({
          type: "404",
          message: data.message || "Product not found.",
        });
        setProduct(null);
        return;
      }

      if (data.isInactive || res.status === 400 || res.status === 403) {
        setErrorState({
          type: "inactive",
          message: data.message || "Product unavailable.",
        });
        setProduct(null);
        return;
      }

      if (res.ok && data.success && data.product) {
        setProduct(data.product);
        setErrorState(null);

        // Pre-select first purchasable in-stock variant, or first variant
        if (data.product.variants && data.product.variants.length > 0) {
          const firstInStock = data.product.variants.find(
            (v) => v.isAvailable !== false && v.stock > 0
          );
          const firstAvailable = data.product.variants.find(
            (v) => v.isAvailable !== false
          );
          const chosen = firstInStock || firstAvailable || data.product.variants[0];
          setSelectedVariantId(chosen._id);
        }
      } else {
        setErrorState({
          type: "network",
          message: data.message || "Unable to load this product. Please try again.",
        });
        setProduct(null);
      }
    } catch (err) {
      console.error("Fetch product error:", err);
      setErrorState({
        type: "network",
        message: "Unable to load this product. Please check your connection and try again.",
      });
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch related products in the same category
  const fetchRelatedProducts = useCallback(async (category, currentId) => {
    if (!category) return;
    try {
      setRelatedLoading(true);
      const params = new URLSearchParams({
        category: category.toLowerCase(),
        limit: "4",
      });
      if (currentId) {
        params.set("excludeId", currentId);
      }

      const res = await fetch(`http://localhost:5000/api/products?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.products)) {
        // Exclude current product ID in case backend didn't
        const filtered = data.products.filter((p) => p._id !== currentId).slice(0, 4);
        setRelatedProducts(filtered);
      } else {
        setRelatedProducts([]);
      }
    } catch (err) {
      console.error("Fetch related products error:", err);
      setRelatedProducts([]);
    } finally {
      setRelatedLoading(false);
    }
  }, []);

  // Effect to load product when route ID changes
  useEffect(() => {
    if (id) {
      fetchProduct(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [id, fetchProduct]);

  // Effect to load related products once current product is resolved
  useEffect(() => {
    if (product?.category && product?._id) {
      fetchRelatedProducts(product.category, product._id);
    }
  }, [product, fetchRelatedProducts]);

  // Handle ESC key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isLightboxOpen) {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Wishlist toggle via WishlistContext
  const handleToggleWishlist = async () => {
    if (!product) return;
    if (!user) {
      setToastMessage({
        type: "info",
        text: "Please sign in to save fragrances to your wishlist.",
      });
      openWishlist();
      return;
    }

    const currentlySaved = isWishlisted(product._id);
    if (currentlySaved) {
      const res = await removeFromWishlist(product._id);
      if (res.success) {
        setToastMessage({
          type: "wishlist",
          text: `${product.name} removed from your wishlist.`,
        });
      }
    } else {
      const res = await addToWishlist(product._id);
      if (res.success) {
        setToastMessage({
          type: "wishlist",
          text: `${product.name} saved to your wishlist.`,
        });
      } else {
        setToastMessage({
          type: "error",
          text: res.message || "Unable to save to wishlist.",
        });
      }
    }
  };

  // ── Helper functions (must be defined before any derived state that uses them) ──

  // Calculate discount percentage
  const calculateDiscount = (price, compareAtPrice) => {
    if (!compareAtPrice || compareAtPrice <= price) return null;
    const diff = compareAtPrice - price;
    const pct = Math.round((diff / compareAtPrice) * 100);
    return pct > 0 ? `${pct}% OFF` : null;
  };

  // Currency formatter
  const formatPrice = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  // Resolve image URL safely
  const getImageUrl = (imgPath) => {
    if (!imgPath) return null;
    if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
      return imgPath;
    }
    return `http://localhost:5000${imgPath}`;
  };

  // ── Derived state (uses helpers above) ──

  // Derive selected variant and live pricing/stock
  const selectedVariant =
    product?.variants && product.variants.length > 0
      ? product.variants.find(
          (v) => v._id && v._id.toString() === selectedVariantId?.toString()
        ) || product.variants[0]
      : null;

  const currentPrice = selectedVariant
    ? Number(selectedVariant.sellingPrice)
    : Number(product?.price || 0);

  const currentOriginalPrice = selectedVariant
    ? (selectedVariant.originalPrice ? Number(selectedVariant.originalPrice) : null)
    : (product?.compareAtPrice ? Number(product.compareAtPrice) : null);

  const currentStock = selectedVariant
    ? Number(selectedVariant.stock)
    : Number(product?.stock || 0);

  const isVariantAvailable = selectedVariant ? selectedVariant.isAvailable !== false : true;

  const isOutOfStock = !isVariantAvailable || currentStock === 0 || product?.status === "Out of Stock";

  const discountBadge = calculateDiscount(currentPrice, currentOriginalPrice);
  const isSavedInWishlist = product ? isWishlisted(product._id) : false;

  const imagesList = product?.images && Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [];

  const activeImageSrc = imagesList.length > 0
    ? getImageUrl(imagesList[activeImageIndex] || imagesList[0])
    : null;

  // Add to Cart via backend CartContext
  const handleAddToCart = async () => {
    if (!product) return;
    if (isOutOfStock) return;

    const maxAllowed = Math.min(currentStock, 5);
    const requestedQty = Math.max(1, Math.min(quantity, maxAllowed));
    const result = await addToCart(product._id, requestedQty, {
      variantId: selectedVariant?._id,
      volumeMl: selectedVariant?.volumeMl,
    });

    if (result.requiresLogin) {
      setToastMessage({
        type: "info",
        text: result.message,
      });
      openCart();
    } else if (!result.success) {
      setToastMessage({
        type: "error",
        text: result.message,
      });
    } else {
      setToastMessage({
        type: "cart",
        text: `${product.name} (${selectedVariant?.volumeMl || 100} ml) added to your bag.`,
      });
    }
  };

  // Quantity helpers (Max 5 or current variant stock)
  const handleIncreaseQty = () => {
    if (!product) return;
    const maxAllowed = Math.min(currentStock, 5);
    if (quantity < maxAllowed) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecreaseQty = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  return (
    <div className="fexa-product-details-page">
      {/* ================= FEXA GLOBAL LUXURY NAVBAR ================= */}
      <Navbar activePage="collections" />

      {/* ================= 3. TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div className={`details-toast-banner ${toastMessage.type}`} role="status">
          <span className="toast-icon">
            {toastMessage.type === "cart" ? "🛍️" : toastMessage.type === "wishlist" ? "♥" : "✦"}
          </span>
          <span className="toast-text">{toastMessage.text}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToastMessage(null)}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= 4. BREADCRUMB & BACK NAVIGATION ================= */}
      <div className="details-breadcrumb-bar">
        <div className="breadcrumb-inner">
          <div className="breadcrumb-path">
            <Link to="/home" className="crumb-link">
              HOME
            </Link>
            <span className="crumb-sep">/</span>
            <Link to="/collections" className="crumb-link">
              COLLECTIONS
            </Link>
            {product?.category && (
              <>
                <span className="crumb-sep">/</span>
                <span
                  className="crumb-link"
                  onClick={() => navigate(`/collections?category=${encodeURIComponent(product.category.toLowerCase())}`)}
                >
                  {product.category.toUpperCase()}
                </span>
              </>
            )}
            {product?.name && (
              <>
                <span className="crumb-sep">/</span>
                <span className="crumb-current">{product.name}</span>
              </>
            )}
          </div>

          <button
            type="button"
            className="back-to-collections-btn"
            onClick={() => navigate("/collections")}
          >
            ← Back to Collections
          </button>
        </div>
      </div>

      {/* ================= 5. MAIN CONTENT REGION ================= */}
      <main className="details-main-container">
        {/* CASE A: LOADING STATE */}
        {loading && (
          <div className="details-skeleton-grid" aria-busy="true" aria-label="Loading fragrance details">
            <div className="skel-left-col">
              <div className="skel-main-image"></div>
              <div className="skel-thumbnails-row">
                <div className="skel-thumb"></div>
                <div className="skel-thumb"></div>
                <div className="skel-thumb"></div>
              </div>
            </div>
            <div className="skel-right-col">
              <div className="skel-pill"></div>
              <div className="skel-h1"></div>
              <div className="skel-price-row"></div>
              <div className="skel-desc-block"></div>
              <div className="skel-actions-row"></div>
            </div>
          </div>
        )}

        {/* CASE B: ERROR STATE (404 NOT FOUND, INACTIVE, OR NETWORK) */}
        {!loading && errorState && (
          <div className="details-error-card">
            <div className="error-card-inner">
              <div className="error-icon-circle">
                {errorState.type === "404" ? "⚗️" : errorState.type === "inactive" ? "🔒" : "⚠️"}
              </div>

              <h2 className="error-heading">
                {errorState.type === "404"
                  ? "Product not found."
                  : errorState.type === "inactive"
                  ? "Product unavailable."
                  : "Unable to load this product."}
              </h2>

              <p className="error-description">
                {errorState.type === "404"
                  ? "The fragrance you are looking for does not exist or may have been removed from our archives."
                  : errorState.type === "inactive"
                  ? "This formulation is currently inactive and unavailable in the public boutique."
                  : errorState.message || "Please check your network and try again."}
              </p>

              <div className="error-actions-group">
                <button
                  type="button"
                  className="error-primary-btn"
                  onClick={() => navigate("/collections")}
                >
                  ← Back to Collections
                </button>
                {errorState.type === "network" && (
                  <button
                    type="button"
                    className="error-retry-btn"
                    onClick={() => fetchProduct(id)}
                  >
                    RETRY
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CASE C: SUCCESS STATE - DYNAMIC PRODUCT LOADED */}
        {!loading && !errorState && product && (
          <div className="product-details-showcase">
            {/* LEFT COLUMN: IMAGE GALLERY & LIGHTBOX TRIGGER */}
            <div className="product-gallery-column">
              <div className="main-image-viewport">
                {activeImageSrc ? (
                  <img
                    src={activeImageSrc}
                    alt={product.name}
                    className="details-main-img"
                    onClick={() => setIsLightboxOpen(true)}
                    title="Click to expand fragrance flacon"
                  />
                ) : (
                  <div className="details-image-fallback">
                    <span className="fallback-monogram">FEXA</span>
                    <span className="fallback-icon">⚗️</span>
                    <span className="fallback-tag">HAUTE EXTRAIT ARCHIVE</span>
                  </div>
                )}

                {/* Top Overlay Badges */}
                <div className="gallery-badges-overlay">
                  <span className={`gallery-category-pill ${product.category?.toLowerCase()}`}>
                    {product.category?.toUpperCase()}
                  </span>
                  {isOutOfStock && <span className="gallery-stock-pill out">OUT OF STOCK</span>}
                </div>

                {/* Zoom prompt icon */}
                {activeImageSrc && (
                  <button
                    type="button"
                    className="gallery-zoom-button"
                    onClick={() => setIsLightboxOpen(true)}
                    aria-label="Enlarge product image"
                    title="View enlarged flacon"
                  >
                    <span className="zoom-icon">🔍</span>
                    <span className="zoom-label">ENLARGE</span>
                  </button>
                )}
              </div>

              {/* Thumbnails Row if multiple images */}
              {imagesList.length > 1 && (
                <div className="thumbnails-selector-strip" role="tablist" aria-label="Product thumbnails">
                  {imagesList.map((img, idx) => {
                    const thumbUrl = getImageUrl(img);
                    const isActive = idx === activeImageIndex;
                    return (
                      <button
                        type="button"
                        key={`thumb-${idx}`}
                        className={`thumbnail-thumb-btn ${isActive ? "active" : ""}`}
                        onClick={() => setActiveImageIndex(idx)}
                        aria-label={`View image ${idx + 1} of ${imagesList.length}`}
                        role="tab"
                        aria-selected={isActive}
                      >
                        <img src={thumbUrl} alt={`${product.name} view ${idx + 1}`} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Atelier Trust Guarantee Badges */}
              <div className="gallery-trust-pills">
                <div className="trust-pill">
                  <span className="trust-ico">✓</span>
                  <span>100% Pure Botanical Concentrate</span>
                </div>
                <div className="trust-pill">
                  <span className="trust-ico">✓</span>
                  <span>Artisanal Small-Batch Maceration</span>
                </div>
                <div className="trust-pill">
                  <span className="trust-ico">✓</span>
                  <span>Handcrafted in Grasse</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PRODUCT INFORMATION & ACTIONS */}
            <div className="product-info-column">
              {/* Brand and Category eyebrow */}
              <div className="product-eyebrow-row">
                <span className="info-brand-label">{product.brand || "FEXA"}</span>
                <span className="dot">•</span>
                <span className="info-category-label">{product.category} Portfolio</span>
                <span className="dot">•</span>
                <span className="info-concentration">
                  EXTRAIT DE PARFUM ({selectedVariant ? `${selectedVariant.volumeMl}ml` : "100ml"})
                </span>
              </div>

              {/* Main Product Title */}
              <h1 className="product-headline">{product.name}</h1>

              {/* Rating Seal */}
              <div className="product-rating-seal">
                <div className="stars-group" aria-label="Rating 5 out of 5 stars">
                  ★★★★★
                </div>
                <span className="rating-text">5.0</span>
                <span className="rating-divider">|</span>
                <span className="rating-seal-label">ATELIER VERIFIED FLACON</span>
              </div>

              {/* Pricing Section */}
              <div className="product-pricing-card">
                <div className="price-display-row">
                  <span className="current-price-tag">{formatPrice(currentPrice)}</span>
                  {currentOriginalPrice > currentPrice && (
                    <span className="original-price-tag">
                      {formatPrice(currentOriginalPrice)}
                    </span>
                  )}
                  {discountBadge && (
                    <span className="discount-badge-tag">{discountBadge}</span>
                  )}
                </div>
                <div className="tax-inclusive-label">
                  INCLUSIVE OF ALL TAXES • COMPLIMENTARY COURIER ON ELIGIBLE ORDERS
                </div>
              </div>

              {/* Prominent Perfume Size Selection */}
              {product.variants && product.variants.length > 0 && (
                <div className="product-size-selection-section">
                  <div className="size-header-row">
                    <span className="size-section-title">CHOOSE YOUR SIZE</span>
                    {selectedVariant && (
                      <span className="selected-size-label">
                        Selected: <strong>{selectedVariant.volumeMl} ml</strong>
                      </span>
                    )}
                  </div>
                  <div className="size-options-grid">
                    {product.variants.map((variant) => {
                      const isSelected =
                        selectedVariant &&
                        selectedVariant._id.toString() === variant._id.toString();
                      const isUnavailable = variant.isAvailable === false;
                      const isZeroStock = variant.stock === 0;

                      return (
                        <button
                          type="button"
                          key={variant._id}
                          className={`size-chip-btn ${isSelected ? "selected" : ""} ${
                            isUnavailable ? "unavailable" : ""
                          } ${isZeroStock ? "out-of-stock" : ""}`}
                          onClick={() => {
                            if (!isUnavailable) {
                              setSelectedVariantId(variant._id);
                              setQuantity(1);
                            }
                          }}
                          disabled={isUnavailable}
                          title={
                            isUnavailable
                              ? "Size currently unavailable"
                              : `${variant.volumeMl} ml — ${formatPrice(variant.sellingPrice)}`
                          }
                        >
                          <span className="size-chip-volume">{variant.volumeMl} ml</span>
                          <span className="size-chip-price">{formatPrice(variant.sellingPrice)}</span>
                          {isUnavailable ? (
                            <span className="size-chip-badge">Unavailable</span>
                          ) : isZeroStock ? (
                            <span className="size-chip-badge out">Out of Stock</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stock Status Indicator */}
              <div className="product-stock-banner">
                <span className="stock-title">AVAILABILITY:</span>
                {isOutOfStock ? (
                  <span className="stock-state-badge out">
                    Out of Stock — Hand-compounding next atelier batch
                  </span>
                ) : currentStock <= 5 ? (
                  <span className="stock-state-badge low">
                    Only {currentStock} {currentStock === 1 ? "flacon" : "flacons"} left in vault
                  </span>
                ) : (
                  <span className="stock-state-badge in">
                    In Stock ({currentStock} flacons ready for dispatch)
                  </span>
                )}
              </div>

              {/* Quantity Selector & Action Buttons */}
              <div className="purchase-controls-box">
                <div className="quantity-selection-wrapper">
                  <label htmlFor="product-qty-input" className="qty-label">
                    SELECT QUANTITY:
                  </label>
                  <div className="quantity-counter-widget">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={handleDecreaseQty}
                      disabled={quantity <= 1 || isOutOfStock}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      id="product-qty-input"
                      type="number"
                      className="qty-input-box"
                      value={quantity}
                      min="1"
                      max={Math.min(currentStock, 5)}
                      readOnly
                      aria-label="Selected quantity"
                    />
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={handleIncreaseQty}
                      disabled={quantity >= Math.min(currentStock, 5) || isOutOfStock}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  {!isOutOfStock && currentStock > 0 && (
                    <span className="qty-max-hint">
                      Max {Math.min(currentStock, 5)} per order (Atelier limit: 5)
                    </span>
                  )}
                </div>

                {/* Primary CTA Buttons */}
                <div className="cta-buttons-row">
                  <button
                    type="button"
                    className={`btn-add-to-cart ${isOutOfStock ? "disabled" : ""}`}
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    aria-label={isOutOfStock ? "Product is out of stock" : "Add product to cart"}
                  >
                    {isOutOfStock ? "CURRENTLY UNAVAILABLE" : "ADD TO SHOPPING BAG"}
                  </button>

                  <button
                    type="button"
                    className={`btn-wishlist-toggle ${isSavedInWishlist ? "saved" : ""}`}
                    onClick={handleToggleWishlist}
                    aria-label={isSavedInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    {isSavedInWishlist ? "♥ IN WISHLIST" : "♡ ADD TO WISHLIST"}
                  </button>
                </div>
              </div>

              {/* Product Narrative / Description */}
              <div className="product-narrative-section">
                <h3 className="section-subheading">OLFACTORY ARCHIVE & STORY</h3>
                <p className="narrative-body-text">{product.description}</p>
              </div>

              {/* Authentic Specifications Table (Strict: No invented notes) */}
              <div className="product-specifications-section">
                <h3 className="section-subheading">PRODUCT DETAILS & SPECIFICATIONS</h3>
                <dl className="specs-definition-grid">
                  <div className="spec-row">
                    <dt className="spec-key">BRAND</dt>
                    <dd className="spec-value">{product.brand || "FEXA"}</dd>
                  </div>
                  <div className="spec-row">
                    <dt className="spec-key">PORTFOLIO CATEGORY</dt>
                    <dd className="spec-value">{product.category}</dd>
                  </div>
                  <div className="spec-row">
                    <dt className="spec-key">CONCENTRATION</dt>
                    <dd className="spec-value">Extrait de Parfum (Pure Concentrate)</dd>
                  </div>
                  <div className="spec-row">
                    <dt className="spec-key">VOLUME</dt>
                    <dd className="spec-value">100ml / 3.4 FL.OZ.</dd>
                  </div>
                  <div className="spec-row">
                    <dt className="spec-key">AVAILABILITY</dt>
                    <dd className="spec-value">
                      {isOutOfStock ? "Out of Stock" : `In Stock (${product.stock} available)`}
                    </dd>
                  </div>
                  <div className="spec-row">
                    <dt className="spec-key">ATELIER ARCHIVE ID</dt>
                    <dd className="spec-value font-mono">{product._id}</dd>
                  </div>
                </dl>
              </div>

              {/* Concierge Guarantee Card */}
              <div className="concierge-guarantee-card">
                <div className="guarantee-icon">⚜️</div>
                <div className="guarantee-text">
                  <strong>The FEXA Artisanal Guarantee</strong>
                  <p>
                    Every flacon is individually checked by our master perfumers prior to temperature-controlled dispatch. Includes a complimentary 2ml discovery vial.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. RELATED PRODUCTS ("YOU MAY ALSO LIKE") ================= */}
        {!loading && product && relatedProducts.length > 0 && (
          <section className="related-products-section" aria-labelledby="related-heading">
            <div className="related-header-block">
              <span className="related-eyebrow">CURATED COMPANIONS</span>
              <h2 id="related-heading" className="related-main-heading">
                You May Also Like
              </h2>
              <p className="related-subheading">
                Explore sibling formulations from our {product.category} collection, curated for distinction and depth.
              </p>
            </div>

            <div className="related-products-grid">
              {relatedProducts.map((item) => {
                const itemImg =
                  item.images && item.images.length > 0
                    ? getImageUrl(item.images[0])
                    : null;
                const itemOutOfStock = item.stock === 0 || item.status === "Out of Stock";

                return (
                  <div
                    key={item._id}
                    className="related-item-card"
                    onClick={() => navigate(`/products/${item._id}`)}
                  >
                    <div className="related-media-box">
                      {itemImg ? (
                        <img src={itemImg} alt={item.name} className="related-img" />
                      ) : (
                        <div className="related-placeholder">
                          <span>FEXA</span>
                          <small>⚗️</small>
                        </div>
                      )}
                      <span className={`related-category-tag ${item.category?.toLowerCase()}`}>
                        {item.category?.toUpperCase()}
                      </span>
                    </div>

                    <div className="related-body-box">
                      <span className="related-brand">{item.brand || "FEXA"}</span>
                      <h4 className="related-title" title={item.name}>
                        {item.name}
                      </h4>
                      <p className="related-snippet">{item.description}</p>
                      <div className="related-footer-row">
                        <span className="related-price">{formatPrice(item.price)}</span>
                        <button
                          type="button"
                          className="related-view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/products/${item._id}`);
                          }}
                        >
                          {itemOutOfStock ? "VIEW" : "EXPLORE →"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* ================= 7. PROFESSIONAL IMAGE ZOOM VIEWER (LIGHTBOX) ================= */}
      {isLightboxOpen && imagesList && imagesList.length > 0 && (
        <ProductImageZoomViewer
          isOpen={isLightboxOpen}
          images={imagesList}
          initialIndex={activeImageIndex}
          productName={product?.name}
          productBrand={product?.brand || "FEXA"}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}

      {/* ================= 8. LUXURY FOOTER ================= */}
      <footer className="details-footer-bar">
        <div className="footer-inner-container">
          <div className="footer-col-left">
            <h3 className="footer-brand">FEXA</h3>
            <p>
              Haute Parfumerie engineered through artisanal extractions, rare botanical absolutes, and architectural elegance. Handcrafted in Grasse.
            </p>
          </div>
          <div className="footer-col-nav">
            <h4>EXPLORE</h4>
            <Link to="/collections">All Collections</Link>
            <Link to="/home">Haute Parfumerie</Link>
            <Link to="/profile">Atelier Concierge</Link>
          </div>
          <div className="footer-col-contact">
            <h4>ATELIER HERITAGE</h4>
            <span>Grasse Harvest Journal</span>
            <span>Temperature-Stabilized Dispatch</span>
            <span>Ethical Botanical Sourcing</span>
          </div>
        </div>
        <div className="footer-copyright-row">
          <span>© {new Date().getFullYear()} FEXA HAUTE PARFUMERIE. ALL RIGHTS RESERVED.</span>
          <span>CRAFTED WITH QUIET RESTRAINT.</span>
        </div>
      </footer>
    </div>
  );
}

export default ProductDetails;
