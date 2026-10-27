import React from "react";
import { useNavigate } from "react-router-dom";
import { useWishlist } from "../../context/WishlistContext";
import "./ProductCard.css";

/**
 * Reusable FEXA ProductCard
 * Used across Main Collections and dedicated Men, Women, Unisex collection pages.
 * Fully supports MongoDB perfume size variants, accurate representative price ("From ₹..."),
 * live stock status, and real-time Wishlist toggle.
 */
export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { wishlistCount, openWishlist, toggleWishlist, isWishlisted } = useWishlist();

  if (!product) return null;

  // Evaluate volume variants & availability
  const purchasableVariants =
    product.variants && product.variants.length > 0
      ? product.variants.filter((v) => v.isAvailable !== false)
      : [];

  const hasPurchasableStock =
    purchasableVariants.length > 0
      ? purchasableVariants.some((v) => Number(v.stock) > 0)
      : Number(product.stock) > 0 && product.status !== "Out of Stock";

  const isOutOfStock = !hasPurchasableStock || product.status === "Out of Stock";

  // Calculate representative starting price
  const formatPrice = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  const inStockVariants = purchasableVariants.filter((v) => Number(v.stock) > 0);
  const candidateVariants = inStockVariants.length > 0 ? inStockVariants : purchasableVariants;

  let displayPriceText = formatPrice(
    product.effectivePrice !== undefined ? product.effectivePrice : product.price
  );

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
      ? product.images[0].startsWith("http")
        ? product.images[0]
        : `http://localhost:5000${product.images[0]}`
      : null;

  const isSaved = isWishlisted(product._id);

  const handleCardClick = () => {
    navigate(`/products/${product._id}`);
  };

  const handleWishlistClick = async (e) => {
    e.stopPropagation();
    const res = await toggleWishlist(product._id);
    if (res && res.requiresLogin) {
      openWishlist();
    }
  };

  return (
    <div
      className="fexa-product-card"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-label={`${product.name} by ${product.brand || "FEXA"}`}
    >
      {/* Card Image Container */}
      <div className="product-card-media">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="product-card-img"
            loading="lazy"
          />
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
          onClick={handleWishlistClick}
          title={isSaved ? "Remove from wishlist" : "Add to wishlist"}
          aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
        >
          {isSaved ? "♥" : "♡"}
        </button>
      </div>

      {/* Card Body Details */}
      <div className="product-card-body">
        <div className="product-card-brand">{product.brand || "FEXA"}</div>

        <h3 className="product-card-name" title={product.name}>
          {product.name}
        </h3>

        <p className="product-card-desc">
          {product.description ||
            "An exquisite olfactory creation formulated with precious natural ingredients."}
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
              handleCardClick();
            }}
            disabled={isOutOfStock}
          >
            {isOutOfStock ? "OUT OF STOCK" : "EXPLORE FLACON"}
          </button>
        </div>
      </div>
    </div>
  );
}
