import React, { useMemo } from "react";
import "./AdminPagination.css";

/**
 * Generates an array of page numbers and ellipsis strings for smart windowed pagination.
 * e.g., for totalPages = 15, currentPage = 8:
 * [1, "...", 7, 8, 9, "...", 15]
 */
function getPaginationItems(currentPage, totalPages, maxVisiblePages = 7) {
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // If current page is close to the start
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  // If current page is close to the end
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  // If current page is in the middle
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

/**
 * Reusable FEXA Admin Pagination Component
 * 
 * @param {number} currentPage - Currently active page (1-indexed)
 * @param {number} totalPages - Total number of pages available
 * @param {number} totalItems - Total count of items in the dataset
 * @param {number} pageSize - Number of items displayed per page (default: 10)
 * @param {string} itemName - Noun describing the items (e.g. "users", "products", "coupons")
 * @param {function} onPageChange - Callback when a page number or prev/next is clicked
 * @param {boolean} loading - Whether data is actively loading
 * @param {string} variant - "card-footer" (attached to bottom of card) | "standalone" (bordered box)
 * @param {string} className - Optional additional CSS class
 */
function AdminPagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  itemName = "records",
  onPageChange,
  loading = false,
  variant = "card-footer",
  className = "",
}) {
  const safeCurrentPage = Math.max(1, Math.min(currentPage || 1, totalPages || 1));
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safeTotalItems = Math.max(0, totalItems || 0);

  // If no items at all and no pages, do not display pagination
  if (safeTotalItems === 0 && safeTotalPages <= 1) {
    return null;
  }

  const paginationItems = useMemo(() => {
    return getPaginationItems(safeCurrentPage, safeTotalPages);
  }, [safeCurrentPage, safeTotalPages]);

  const handlePrev = () => {
    if (safeCurrentPage > 1 && onPageChange && !loading) {
      onPageChange(safeCurrentPage - 1);
    }
  };

  const handleNext = () => {
    if (safeCurrentPage < safeTotalPages && onPageChange && !loading) {
      onPageChange(safeCurrentPage + 1);
    }
  };

  const handlePageClick = (pageNum) => {
    if (typeof pageNum === "number" && pageNum !== safeCurrentPage && onPageChange && !loading) {
      onPageChange(pageNum);
    }
  };

  return (
    <nav
      className={`admin-pagination-container ${variant === "standalone" ? "standalone" : "card-footer"} ${className}`}
      aria-label="Admin Table Pagination"
    >
      {/* LEFT: SUMMARY INFO */}
      <div className="admin-pagination-info">
        Showing page <strong>{safeCurrentPage}</strong> of{" "}
        <strong>{safeTotalPages}</strong>
        <span className="admin-pagination-total-tag">
          ({safeTotalItems.toLocaleString()} total {itemName})
        </span>
      </div>

      {/* RIGHT: PAGINATION BUTTONS & NUMBERS */}
      <div className="admin-pagination-controls">
        {/* PREVIOUS BUTTON */}
        <button
          type="button"
          className="admin-page-nav-btn prev-btn"
          onClick={handlePrev}
          disabled={safeCurrentPage <= 1 || loading}
          aria-label="Previous page"
          title="Previous page"
        >
          <span className="nav-arrow">‹</span>
          <span className="nav-text">PREVIOUS</span>
        </button>

        {/* NUMBER BUTTONS & ELLIPSIS */}
        <div className="admin-page-numbers-group">
          {paginationItems.map((item, idx) => {
            if (item === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="admin-page-ellipsis" aria-hidden="true">
                  •••
                </span>
              );
            }

            const isPageActive = item === safeCurrentPage;
            return (
              <button
                key={`page-${item}`}
                type="button"
                className={`admin-page-num-btn ${isPageActive ? "active" : ""}`}
                onClick={() => handlePageClick(item)}
                disabled={loading}
                aria-current={isPageActive ? "page" : undefined}
                aria-label={`Page ${item}`}
                title={`Go to page ${item}`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* NEXT BUTTON */}
        <button
          type="button"
          className="admin-page-nav-btn next-btn"
          onClick={handleNext}
          disabled={safeCurrentPage >= safeTotalPages || loading}
          aria-label="Next page"
          title="Next page"
        >
          <span className="nav-text">NEXT</span>
          <span className="nav-arrow">›</span>
        </button>
      </div>
    </nav>
  );
}

export default AdminPagination;
