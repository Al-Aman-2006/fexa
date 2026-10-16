import { useState } from "react";

function ProductViewModal({ isOpen, product, onClose, onEdit }) {
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);

  if (!isOpen || !product) return null;

  const images = product.images && product.images.length > 0 ? product.images : [];
  const primaryImg = images[selectedImgIndex] || images[0];
  const primaryImgUrl = primaryImg
    ? primaryImg.startsWith("http")
      ? primaryImg
      : `http://localhost:5000${primaryImg}`
    : null;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-card product-modal-card"
        style={{ maxWidth: "680px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <div>
            <h3>Product Specification</h3>
            <span className="product-slug-sub">ID: {product._id}</span>
          </div>
          <button
            type="button"
            className="admin-modal-close-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "24px", marginTop: "16px" }}>
          {/* Gallery Column */}
          <div>
            <div
              style={{
                width: "100%",
                height: "260px",
                borderRadius: "10px",
                overflow: "hidden",
                border: "1px solid rgba(161, 132, 189, 0.3)",
                background: "#0d0b10",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {primaryImgUrl ? (
                <img
                  src={primaryImgUrl}
                  alt={product.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: "40px", opacity: 0.5 }}>⚗️</span>
              )}
            </div>

            {images.length > 1 && (
              <div style={{ display: "flex", gap: "8px", marginTop: "10px", overflowX: "auto" }}>
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImgIndex(idx)}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: idx === selectedImgIndex ? "2px solid #a184bd" : "1px solid rgba(161, 132, 189, 0.3)",
                      padding: 0,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={img.startsWith("http") ? img : `http://localhost:5000${img}`}
                      alt="Thumbnail"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span className="category-pill">{product.category}</span>
                <span style={{ fontSize: "12px", color: "#88789c", textTransform: "uppercase", letterSpacing: "1px" }}>
                  {product.brand || "FEXA"}
                </span>
              </div>
              <h2 style={{ fontSize: "20px", color: "#ffffff", margin: 0, fontWeight: 700 }}>{product.name}</h2>
              {product.slug && <span className="product-slug-sub">/{product.slug}</span>}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontSize: "22px", fontWeight: 700, color: "#cbb8de" }}>
                {formatCurrency(product.price)}
              </span>
              {product.compareAtPrice > product.price && (
                <span className="compare-price-sub" style={{ fontSize: "14px" }}>
                  {formatCurrency(product.compareAtPrice)}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
              <div style={{ background: "rgba(23, 18, 30, 0.7)", padding: "8px 12px", borderRadius: "6px" }}>
                <span style={{ color: "#88789c", display: "block" }}>TOTAL STOCK</span>
                <strong style={{ color: "#ffffff" }}>{product.stock} units</strong>
              </div>
              <div style={{ background: "rgba(23, 18, 30, 0.7)", padding: "8px 12px", borderRadius: "6px" }}>
                <span style={{ color: "#88789c", display: "block" }}>STATUS</span>
                <strong style={{ color: product.status === "Active" ? "#75db8b" : "#ff737d" }}>
                  ● {product.status}
                </strong>
              </div>
            </div>

            {/* Configured Size Variants List */}
            {product.variants && product.variants.length > 0 && (
              <div style={{ background: "rgba(23, 18, 30, 0.7)", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(161, 132, 189, 0.15)" }}>
                <span style={{ fontSize: "10px", color: "#a184bd", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  CONFIGURED SIZE VARIANTS ({product.variants.length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
                  {product.variants.map((v, i) => (
                    <div key={v._id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", padding: "4px 6px", background: "rgba(13, 11, 16, 0.6)", borderRadius: "4px" }}>
                      <strong style={{ color: "#ffffff" }}>{v.volumeMl} ml</strong>
                      <span style={{ color: "#cbb8de" }}>{formatCurrency(v.sellingPrice)}</span>
                      <span style={{ color: "#88789c" }}>Stock: {v.stock}</span>
                      <span style={{ color: v.isAvailable !== false ? (v.stock > 0 ? "#75db8b" : "#ffaa00") : "#ff737d", fontSize: "10px", fontWeight: 600 }}>
                        {v.isAvailable !== false ? (v.stock > 0 ? "In Stock" : "Out of Stock") : "Unavailable"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span style={{ fontSize: "11px", color: "#88789c", letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                FRAGRANCE PROFILE
              </span>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: "1.5",
                  color: "#e2daf0",
                  background: "rgba(13, 11, 16, 0.6)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(161, 132, 189, 0.15)",
                  margin: 0,
                  maxHeight: "100px",
                  overflowY: "auto",
                }}
              >
                {product.description || "No description available."}
              </p>
            </div>

            <div style={{ fontSize: "11px", color: "#88789c", marginTop: "auto" }}>
              Created: {formatDate(product.createdAt)} • Updated: {formatDate(product.updatedAt)}
            </div>
          </div>
        </div>

        <div className="admin-modal-actions" style={{ marginTop: "24px" }}>
          <button type="button" className="admin-modal-cancel-btn" onClick={onClose}>
            CLOSE
          </button>
          {onEdit && (
            <button
              type="button"
              className="admin-modal-save-btn"
              onClick={() => {
                onClose();
                onEdit(product);
              }}
            >
              EDIT PRODUCT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductViewModal;
