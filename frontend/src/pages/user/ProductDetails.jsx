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

  // Reviews and ratings state
  const [reviews, setReviews] = useState([]);
  const [reviewsSummary, setReviewsSummary] = useState({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    percentages: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [userReview, setUserReview] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);
  const [reviewsSort, setReviewsSort] = useState("newest");
  const [ratingFilter, setRatingFilter] = useState(null);

  // Review modal and interaction state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewFormData, setReviewFormData] = useState({
    rating: 5,
    title: "",
    comment: "",
  });
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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

  // ── Product Reviews & Ratings Handlers ──

  // Format ISO review date
  const formatReviewDate = (isoString) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  // Render gold star icons
  const renderStarGlyphs = (ratingVal, max = 5) => {
    const rounded = Math.round(ratingVal);
    return (
      <div className="review-stars-wrapper" aria-label={`${ratingVal} out of ${max} stars`}>
        {Array.from({ length: max }, (_, i) => {
          const starNum = i + 1;
          return (
            <span
              key={starNum}
              className={`review-star-char ${starNum <= rounded ? "filled" : "empty"}`}
            >
              ★
            </span>
          );
        })}
      </div>
    );
  };

  // Fetch product reviews from API
  const fetchReviews = useCallback(
    async (productId, page = 1, sort = "newest", starFilter = null) => {
      if (!productId) return;
      try {
        setReviewsLoading(true);
        const token = localStorage.getItem("token");
        const headers = {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: "5",
          sort: sort || "newest",
        });
        if (starFilter) {
          queryParams.set("rating", String(starFilter));
        }

        const res = await fetch(
          `http://localhost:5000/api/reviews/product/${productId}?${queryParams.toString()}`,
          {
            headers,
            credentials: "include",
          }
        );
        const data = await res.json();
        if (res.ok && data.success) {
          setReviews(data.reviews || []);
          if (data.ratingSummary) {
            setReviewsSummary(data.ratingSummary);
          }
          if (data.pagination) {
            setReviewsTotalPages(data.pagination.totalPages || 1);
          }
          setUserReview(data.userReview || null);
        }
      } catch (err) {
        console.error("Fetch reviews error:", err);
      } finally {
        setReviewsLoading(false);
      }
    },
    []
  );

  // Trigger reviews fetch when product, pagination, sort, ratingFilter, or auth changes
  useEffect(() => {
    if (product?._id) {
      fetchReviews(product._id, reviewsPage, reviewsSort, ratingFilter);
    }
  }, [product?._id, reviewsPage, reviewsSort, ratingFilter, user?._id, fetchReviews]);

  // Open review modal (handles pre-fill if user already submitted)
  const handleOpenReviewModal = () => {
    if (!user) {
      setToastMessage({
        type: "info",
        text: "Please sign in to share your flacon review.",
      });
      navigate("/login", { state: { from: `/products/${product?._id}` } });
      return;
    }

    if (userReview) {
      setReviewFormData({
        rating: userReview.rating || 5,
        title: userReview.title || "",
        comment: userReview.comment || "",
      });
    } else {
      setReviewFormData({
        rating: 5,
        title: "",
        comment: "",
      });
    }
    setHoverRating(0);
    setReviewFormError("");
    setIsReviewModalOpen(true);
  };

  // Submit review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!reviewFormData.rating || reviewFormData.rating < 1 || reviewFormData.rating > 5) {
      setReviewFormError("Please select a star rating between 1 and 5.");
      return;
    }
    if (!reviewFormData.comment || reviewFormData.comment.trim().length < 5) {
      setReviewFormError("Please write a review comment with at least 5 characters.");
      return;
    }
    if (reviewFormData.comment.trim().length > 1000) {
      setReviewFormError("Review comment must not exceed 1000 characters.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewFormError("");
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          productId: product._id,
          rating: Number(reviewFormData.rating),
          title: reviewFormData.title ? reviewFormData.title.trim() : "",
          comment: reviewFormData.comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to submit review.");
      }

      setIsReviewModalOpen(false);
      setToastMessage({
        type: "success",
        text: data.message || "Review submitted! Awaiting atelier moderation.",
      });
      // Refresh reviews & user review
      fetchReviews(product._id, 1, reviewsSort, ratingFilter);
    } catch (err) {
      console.error("Submit review error:", err);
      setReviewFormError(err.message || "An error occurred while submitting your review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Delete user review
  const handleDeleteUserReview = async () => {
    if (!userReview?._id) return;
    try {
      setDeleteSubmitting(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/reviews/${userReview._id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete review.");
      }

      setIsDeleteModalOpen(false);
      setUserReview(null);
      setToastMessage({
        type: "info",
        text: "Your review has been successfully removed.",
      });
      fetchReviews(product._id, 1, reviewsSort, ratingFilter);
    } catch (err) {
      console.error("Delete review error:", err);
      setToastMessage({
        type: "error",
        text: err.message || "Failed to delete review.",
      });
    } finally {
      setDeleteSubmitting(false);
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
                  onClick={() => navigate(`/collections/${product.category.toLowerCase()}`)}
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
              <div
                className="product-rating-seal clickable"
                role="button"
                tabIndex={0}
                onClick={() => {
                  const el = document.getElementById("customer-reviews-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    const el = document.getElementById("customer-reviews-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                title="View customer reviews and ratings"
              >
                <div
                  className="stars-group"
                  aria-label={`Rating ${reviewsSummary.averageRating} out of 5 stars`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={
                        star <= Math.round(reviewsSummary.averageRating || 5)
                          ? "seal-star filled"
                          : "seal-star empty"
                      }
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="rating-text">
                  {reviewsSummary.totalReviews > 0
                    ? reviewsSummary.averageRating.toFixed(1)
                    : "5.0"}
                </span>
                <span className="rating-divider">|</span>
                <span className="rating-seal-label">
                  {reviewsSummary.totalReviews > 0
                    ? `${reviewsSummary.totalReviews} ${
                        reviewsSummary.totalReviews === 1 ? "PATRON REVIEW" : "PATRON REVIEWS"
                      }`
                    : "BE THE FIRST TO REVIEW"}
                </span>
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

        {/* ================= 5. CUSTOMER REVIEWS & RATINGS ================= */}
        {!loading && product && (
          <section
            id="customer-reviews-section"
            className="customer-reviews-section"
            aria-labelledby="reviews-section-heading"
          >
            <div className="reviews-section-header">
              <span className="reviews-eyebrow">AUTHENTIC IMPRESSIONS</span>
              <h2 id="reviews-section-heading" className="reviews-main-heading">
                Customer Reviews
              </h2>
              <p className="reviews-subheading">
                Olfactory observations and flacon appraisals shared by verified patrons of the Atelier.
              </p>
            </div>

            {/* RATING SUMMARY COMPONENT */}
            <div className="reviews-summary-card">
              {/* Column 1: Overall Average Rating */}
              <div className="summary-score-col">
                <div className="summary-score-value">
                  {reviewsSummary.averageRating.toFixed(1)}
                </div>
                <div className="summary-stars-display">
                  {renderStarGlyphs(reviewsSummary.averageRating, 5)}
                </div>
                <div className="summary-score-sub">
                  {reviewsSummary.averageRating.toFixed(1)} out of 5
                </div>
                <div className="summary-based-count">
                  Based on {reviewsSummary.totalReviews}{" "}
                  {reviewsSummary.totalReviews === 1 ? "review" : "reviews"}
                </div>
              </div>

              {/* Column 2: 5-Star Rating Distribution */}
              <div className="summary-distribution-col">
                <div className="distribution-table-header">Rating Breakdown</div>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = reviewsSummary.distribution[stars] || 0;
                  const pct = reviewsSummary.percentages[stars] || 0;
                  const isCurrentFilter = ratingFilter === stars;

                  return (
                    <button
                      type="button"
                      key={stars}
                      className={`distribution-row-btn ${isCurrentFilter ? "is-filtered" : ""}`}
                      onClick={() => setRatingFilter(isCurrentFilter ? null : stars)}
                      title={`Filter by ${stars} stars`}
                    >
                      <span className="dist-star-label">{stars} stars</span>
                      <div className="dist-bar-track">
                        <div
                          className="dist-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="dist-stats-label">
                        {count} {count === 1 ? "review" : "reviews"} ({pct}%)
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Column 3: Call to Action */}
              <div className="summary-cta-col">
                <div className="summary-cta-card">
                  <h3 className="cta-headline">Share Your Experience</h3>
                  <p className="cta-description">
                    How does {product.name} unfold on your skin? Share your notes on projection, longevity, and sillage.
                  </p>
                  {user ? (
                    <button
                      type="button"
                      className="write-review-cta-btn"
                      onClick={handleOpenReviewModal}
                    >
                      {userReview ? "✎ Edit Your Review" : "★ Write a Review"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="write-review-cta-btn"
                      onClick={() =>
                        navigate("/login", {
                          state: { from: `/products/${product._id}` },
                        })
                      }
                    >
                      Sign In to Review
                    </button>
                  )}
                  <span className="atelier-moderated-tag">
                    🛡️ Verified & Moderated for Authentic Patron Feedback
                  </span>
                </div>
              </div>
            </div>

            {/* USER'S OWN PENDING REVIEW NOTICE */}
            {userReview && userReview.status === "pending" && (
              <div className="user-pending-review-callout">
                <div className="callout-icon-box">⏳</div>
                <div className="callout-body">
                  <div className="callout-title">
                    Your Review is Awaiting Atelier Moderation
                  </div>
                  <p className="callout-text">
                    Thank you for reviewing {product.name}! Your {userReview.rating}-star review
                    {userReview.title ? ` ("${userReview.title}")` : ""} is currently in moderation. It will be publicly published once approved.
                  </p>
                </div>
                <div className="callout-actions">
                  <button
                    type="button"
                    className="callout-edit-btn"
                    onClick={handleOpenReviewModal}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="callout-delete-btn"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* FILTER & SORT BAR */}
            <div className="reviews-filter-bar">
              <div className="filter-chips-cluster">
                <span className="filter-chips-label">Filter:</span>
                <button
                  type="button"
                  className={`filter-chip ${ratingFilter === null ? "active" : ""}`}
                  onClick={() => setRatingFilter(null)}
                >
                  All ({reviewsSummary.totalReviews})
                </button>
                {[5, 4, 3, 2, 1].map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={`filter-chip ${ratingFilter === s ? "active" : ""}`}
                    onClick={() => setRatingFilter(ratingFilter === s ? null : s)}
                  >
                    {s} ★ ({reviewsSummary.distribution[s] || 0})
                  </button>
                ))}
              </div>

              <div className="reviews-sort-cluster">
                <label htmlFor="reviews-sort-dropdown">Sort by:</label>
                <select
                  id="reviews-sort-dropdown"
                  value={reviewsSort}
                  onChange={(e) => {
                    setReviewsSort(e.target.value);
                    setReviewsPage(1);
                  }}
                >
                  <option value="newest">Most Recent</option>
                  <option value="highest">Highest Rating</option>
                  <option value="lowest">Lowest Rating</option>
                </select>
              </div>
            </div>

            {/* REVIEWS LIST OR EMPTY STATE */}
            {reviewsLoading ? (
              <div className="reviews-loading-panel">
                <div className="atelier-spinner" />
                <p>Curating flacon impressions...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="reviews-empty-state">
                <div className="empty-flacon-icon">⚜️</div>
                <h3 className="empty-state-title">
                  {ratingFilter
                    ? `No ${ratingFilter}-Star Reviews Yet`
                    : "No reviews yet. Be the first to review this product."}
                </h3>
                <p className="empty-state-sub">
                  {ratingFilter
                    ? "No approved reviews match this star rating filter. Reset your filter to view all verified patron impressions."
                    : "Share your impressions of the opening notes, sillage, drydown, and flacon craftsmanship."}
                </p>
                {ratingFilter ? (
                  <button
                    type="button"
                    className="empty-action-btn"
                    onClick={() => setRatingFilter(null)}
                  >
                    Show All Reviews
                  </button>
                ) : (
                  <button
                    type="button"
                    className="empty-action-btn"
                    onClick={handleOpenReviewModal}
                  >
                    ★ Write the First Review
                  </button>
                )}
              </div>
            ) : (
              <div className="reviews-stream-container">
                {reviews.map((rev) => (
                  <article key={rev._id} className="review-stream-item">
                    <header className="review-item-header">
                      <div className="reviewer-identity">
                        <div className="reviewer-avatar-badge">
                          {rev.user?.name ? rev.user.name.charAt(0).toUpperCase() : "P"}
                        </div>
                        <div className="reviewer-details">
                          <div className="reviewer-name-row">
                            <span className="reviewer-display-name">
                              {rev.user?.name || "Verified Patron"}
                            </span>
                            <span className="patron-verified-tag">✓ Verified Patron</span>
                            {user && rev.user?._id === user._id && (
                              <span className="own-review-pill">Your Review</span>
                            )}
                          </div>
                          <time className="review-timestamp" dateTime={rev.createdAt}>
                            {formatReviewDate(rev.createdAt)}
                          </time>
                        </div>
                      </div>

                      <div className="review-stars-score">
                        {renderStarGlyphs(rev.rating, 5)}
                        <span className="review-numeric-score">{rev.rating}.0</span>
                      </div>
                    </header>

                    {rev.title && (
                      <h4 className="review-headline-title">{rev.title}</h4>
                    )}

                    <div className="review-content-body">
                      <p>{rev.comment}</p>
                    </div>

                    {user && rev.user?._id === user._id && (
                      <footer className="review-item-footer">
                        <button
                          type="button"
                          className="review-edit-link-btn"
                          onClick={handleOpenReviewModal}
                        >
                          ✎ Edit Review
                        </button>
                        <span className="footer-dot">•</span>
                        <button
                          type="button"
                          className="review-delete-link-btn"
                          onClick={() => setIsDeleteModalOpen(true)}
                        >
                          ✕ Delete
                        </button>
                      </footer>
                    )}
                  </article>
                ))}
              </div>
            )}

            {/* REVIEWS PAGINATION */}
            {reviewsTotalPages > 1 && (
              <div className="reviews-pagination-row">
                <button
                  type="button"
                  className="reviews-nav-page-btn"
                  disabled={reviewsPage <= 1}
                  onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className="reviews-page-indicator">
                  Page {reviewsPage} of {reviewsTotalPages}
                </span>
                <button
                  type="button"
                  className="reviews-nav-page-btn"
                  disabled={reviewsPage >= reviewsTotalPages}
                  onClick={() => setReviewsPage((p) => Math.min(reviewsTotalPages, p + 1))}
                >
                  Next →
                </button>
              </div>
            )}
          </section>
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

      {/* ================= 8. WRITE / EDIT REVIEW MODAL ================= */}
      {isReviewModalOpen && (
        <div
          className="review-modal-overlay"
          onClick={() => !reviewSubmitting && setIsReviewModalOpen(false)}
        >
          <div
            className="review-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
          >
            <div className="review-modal-header">
              <div>
                <span className="modal-eyebrow">HAUTE PARFUMERIE APPRAISAL</span>
                <h3 id="review-modal-title" className="modal-headline">
                  {userReview ? "Edit Your Flacon Impression" : "Share Your Flacon Impression"}
                </h3>
                <p className="modal-subheading">
                  {product?.name} • {product?.brand || "FEXA"}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => !reviewSubmitting && setIsReviewModalOpen(false)}
                disabled={reviewSubmitting}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="review-modal-form">
              {reviewFormError && (
                <div className="modal-error-banner" role="alert">
                  <span className="error-icon">⚠️</span>
                  <span>{reviewFormError}</span>
                </div>
              )}

              {/* Star Rating Picker */}
              <div className="form-group-rating">
                <label className="form-field-label">Overall Rating *</label>
                <div
                  className="interactive-star-row"
                  onMouseLeave={() => setHoverRating(0)}
                >
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled =
                      (hoverRating || reviewFormData.rating) >= star;
                    return (
                      <button
                        type="button"
                        key={star}
                        className={`interactive-star-btn ${isFilled ? "active" : ""}`}
                        onMouseEnter={() => setHoverRating(star)}
                        onClick={() =>
                          setReviewFormData((prev) => ({ ...prev, rating: star }))
                        }
                        aria-label={`${star} Star`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
                <div className="rating-descriptor-text">
                  {(hoverRating || reviewFormData.rating) === 5 && "★★★★★ 5 Stars — Extraordinary Masterpiece"}
                  {(hoverRating || reviewFormData.rating) === 4 && "★★★★☆ 4 Stars — Highly Recommended & Distinctive"}
                  {(hoverRating || reviewFormData.rating) === 3 && "★★★☆☆ 3 Stars — Average & Pleasant"}
                  {(hoverRating || reviewFormData.rating) === 2 && "★★☆☆☆ 2 Stars — Below Expectations"}
                  {(hoverRating || reviewFormData.rating) === 1 && "★☆☆☆☆ 1 Star — Disappointing Flacon"}
                </div>
              </div>

              {/* Review Title Input */}
              <div className="form-group-field">
                <label htmlFor="review-title-input" className="form-field-label">
                  Headline / Impression Summary (Optional)
                </label>
                <input
                  id="review-title-input"
                  type="text"
                  className="modal-text-input"
                  placeholder="e.g., Mesmerizing opening with exceptional projection"
                  value={reviewFormData.title}
                  maxLength={100}
                  onChange={(e) =>
                    setReviewFormData((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  disabled={reviewSubmitting}
                />
              </div>

              {/* Review Comment Textarea */}
              <div className="form-group-field">
                <div className="textarea-label-row">
                  <label htmlFor="review-comment-textarea" className="form-field-label">
                    Detailed Review *
                  </label>
                  <span className="char-counter-tag">
                    {reviewFormData.comment.length} / 1000
                  </span>
                </div>
                <textarea
                  id="review-comment-textarea"
                  className="modal-textarea-input"
                  rows={5}
                  placeholder="Describe your sensory observations: opening notes, sillage, drydown on skin, longevity, and flacon presentation..."
                  value={reviewFormData.comment}
                  maxLength={1000}
                  onChange={(e) =>
                    setReviewFormData((prev) => ({
                      ...prev,
                      comment: e.target.value,
                    }))
                  }
                  required
                  disabled={reviewSubmitting}
                />
              </div>

              {/* Moderation Note */}
              <div className="modal-moderation-disclaimer">
                <span>🛡️</span>
                <span>
                  To uphold the integrity of our atelier, all submitted impressions are curated and verified before publication.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsReviewModalOpen(false)}
                  disabled={reviewSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? "Submitting..." : userReview ? "Update Review" : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 9. DELETE REVIEW CONFIRMATION MODAL ================= */}
      {isDeleteModalOpen && (
        <div
          className="review-modal-overlay"
          onClick={() => !deleteSubmitting && setIsDeleteModalOpen(false)}
        >
          <div
            className="review-modal-card delete-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="delete-modal-inner">
              <div className="delete-warning-icon">🗑️</div>
              <h3 className="delete-title">Remove Your Flacon Impression?</h3>
              <p className="delete-sub">
                Are you sure you wish to permanently delete your review for <strong>{product?.name}</strong>? This action cannot be undone.
              </p>
              <div className="delete-actions-row">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleteSubmitting}
                >
                  Keep Review
                </button>
                <button
                  type="button"
                  className="modal-delete-confirm-btn"
                  onClick={handleDeleteUserReview}
                  disabled={deleteSubmitting}
                >
                  {deleteSubmitting ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 10. LUXURY FOOTER ================= */}
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
