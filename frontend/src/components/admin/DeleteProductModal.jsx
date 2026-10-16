function DeleteProductModal({ isOpen, product, onClose, onConfirm, isDeleting }) {
  if (!isOpen || !product) return null;

  const primaryImg = product.images && product.images.length > 0 ? product.images[0] : null;
  const primaryImgUrl = primaryImg
    ? primaryImg.startsWith("http")
      ? primaryImg
      : `http://localhost:5000${primaryImg}`
    : null;

  return (
    <div className="admin-modal-overlay" onClick={isDeleting ? null : onClose}>
      <div
        className="admin-modal-card"
        style={{ maxWidth: "460px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h3 style={{ color: "#ff737d" }}>Confirm Product Deletion</h3>
          <button
            type="button"
            className="admin-modal-close-btn"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "center", margin: "16px 0" }}>
          <div className="product-img-thumbnail" style={{ width: "64px", height: "64px", flexShrink: 0 }}>
            {primaryImgUrl ? (
              <img src={primaryImgUrl} alt={product.name} />
            ) : (
              <span className="no-img-icon">⚗️</span>
            )}
          </div>
          <div>
            <span className="category-pill" style={{ marginBottom: "4px" }}>{product.category}</span>
            <h4 style={{ margin: "4px 0", color: "#ffffff", fontSize: "16px" }}>{product.name}</h4>
            <div style={{ fontSize: "12px", color: "#88789c" }}>
              Brand: {product.brand || "FEXA"} • Stock: {product.stock}
            </div>
          </div>
        </div>

        <p style={{ fontSize: "13px", color: "#e2daf0", lineHeight: "1.5", margin: "0 0 20px 0" }}>
          Are you sure you want to delete this product? This action will permanently remove it from the catalogue,
          search index, and user collections.
        </p>

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-modal-cancel-btn"
            onClick={onClose}
            disabled={isDeleting}
          >
            CANCEL
          </button>
          <button
            type="button"
            className="admin-modal-delete-confirm-btn"
            onClick={() => onConfirm(product)}
            disabled={isDeleting}
            style={{
              background: "#dc3545",
              color: "#ffffff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "12px",
              cursor: isDeleting ? "not-allowed" : "pointer",
              letterSpacing: "0.5px",
            }}
          >
            {isDeleting ? "DELETING..." : "CONFIRM DELETE"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteProductModal;
