import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import ProductFormModal from "../../components/admin/ProductFormModal";
import ProductViewModal from "../../components/admin/ProductViewModal";
import AdminPagination from "../../components/admin/AdminPagination";
import { getImageUrl } from "../../utils/imageUrl.js";
import {
  getAdminProducts,
  getAdminCategoryBySlug,
  toggleCategoryStatusBySlug,
  toggleProductStatus,
} from "../../services/admin.service.js";
import "./AdminDashboard.css";
import "./AdminProducts.css";
import "./AdminCategoryPage.css";

const CATEGORY_CONFIGS = {
  All: {
    name: "All",
    slug: "all",
    heading: "All Fragrance Products",
    description: "Unified fragrance catalogue, category distribution, search, and inventory controls.",
    sidebarTab: "category-all",
    icon: "📦",
    isAll: true,
  },
  Men: {
    name: "Men",
    slug: "men",
    heading: "Men Category Management",
    description: "Manage Men category availability and its products.",
    sidebarTab: "category-men",
    icon: "🎩",
    isAll: false,
  },
  Women: {
    name: "Women",
    slug: "women",
    heading: "Women Category Management",
    description: "Manage Women category availability and its products.",
    sidebarTab: "category-women",
    icon: "🌸",
    isAll: false,
  },
  Unisex: {
    name: "Unisex",
    slug: "unisex",
    heading: "Unisex Category Management",
    description: "Manage Unisex category availability and its products.",
    sidebarTab: "category-unisex",
    icon: "✨",
    isAll: false,
  },
};

function AdminCategoryPage({ category: categoryProp }) {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  // Determine current category from prop, route params, or pathname
  const resolvedCategory = (() => {
    if (categoryProp && CATEGORY_CONFIGS[categoryProp]) {
      return categoryProp;
    }
    const path = location.pathname.toLowerCase();
    if (path.includes("/all") || path === "/admin/categories/all") return "All";
    if (path.includes("/men")) return "Men";
    if (path.includes("/women")) return "Women";
    if (path.includes("/unisex")) return "Unisex";
    if (params.categorySlug) {
      const lower = params.categorySlug.toLowerCase();
      if (lower === "all") return "All";
      if (lower === "men") return "Men";
      if (lower === "women") return "Women";
      if (lower === "unisex") return "Unisex";
    }
    return "All";
  })();

  const config = CATEGORY_CONFIGS[resolvedCategory] || CATEGORY_CONFIGS.Men;

  // Category State
  const [categoryStatus, setCategoryStatus] = useState({
    name: config.name,
    slug: config.slug,
    isActive: true,
  });
  const [categoryCounts, setCategoryCounts] = useState({
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    outOfStockProducts: 0,
  });
  const [isTogglingCategory, setIsTogglingCategory] = useState(false);
  const [showCategoryConfirmModal, setShowCategoryConfirmModal] = useState(false);

  // Products & Pagination State
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalProducts: 0,
    totalPages: 1,
  });

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  // Loading & Feedback states
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  // Sidebar & Modal states
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // "create" | "edit" | "view"
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Request race-condition tracking
  const requestIdRef = useRef(0);

  // Reset page and search if category changes
  useEffect(() => {
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("All");
  }, [resolvedCategory]);

  // Debounce search input (350ms)
  useEffect(() => {
    setSearchLoading(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setSearchLoading(false);
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Category Details & Real Counts
  const fetchCategoryDetails = useCallback(async () => {
    try {
      if (config.isAll) {
        const data = await getAdminProducts({ limit: 1 });
        if (data && data.success) {
          setCategoryStatus({
            name: "All",
            slug: "all",
            isActive: true,
          });
          if (data.categoryCounts) {
            setCategoryCounts({
              totalProducts: data.categoryCounts.all || 0,
              menProducts: data.categoryCounts.men || 0,
              womenProducts: data.categoryCounts.women || 0,
              unisexProducts: data.categoryCounts.unisex || 0,
              activeProducts: data.categoryCounts.all || 0,
              inactiveProducts: 0,
              outOfStockProducts: 0,
            });
          }
        }
        return;
      }

      const data = await getAdminCategoryBySlug(config.slug);
      if (data && data.success && data.category) {
        setCategoryStatus({
          name: data.category.name,
          slug: data.category.slug,
          isActive: data.category.isActive,
        });
        if (data.category.counts) {
          setCategoryCounts(data.category.counts);
        }
      }
    } catch (err) {
      console.error("Error fetching category details:", err);
    }
  }, [config.isAll, config.slug]);

  // Fetch Category Products from MongoDB
  const fetchCategoryProducts = useCallback(
    async (targetCategory, targetPage, targetSearch, targetStatus) => {
      const currentReqId = ++requestIdRef.current;

      try {
        setLoading(true);
        setFetchError(null);

        const params = {
          category: targetCategory,
          page: targetPage,
          limit: 10,
        };

        if (targetSearch) {
          params.search = targetSearch;
        }

        if (targetStatus && targetStatus !== "All") {
          params.status = targetStatus;
        }

        const data = await getAdminProducts(params);

        if (currentReqId !== requestIdRef.current) return;

        if (data && data.success) {
          setProducts(data.products || []);
          setPagination(
            data.pagination || { page: 1, limit: 10, totalProducts: 0, totalPages: 1 }
          );
        } else {
          setFetchError(data?.message || `Unable to fetch ${targetCategory} products.`);
        }
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        console.error("Fetch category products error:", err);
        setFetchError("Unable to connect to the server. Please ensure the backend is running.");
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Load category details and products on mount / filter change
  useEffect(() => {
    fetchCategoryDetails();
  }, [fetchCategoryDetails, resolvedCategory]);

  useEffect(() => {
    fetchCategoryProducts(resolvedCategory, page, debouncedSearch, statusFilter);
  }, [fetchCategoryProducts, resolvedCategory, page, debouncedSearch, statusFilter]);

  // Category Activation / Deactivation Handler
  const handleToggleCategoryActivation = async () => {
    try {
      setIsTogglingCategory(true);
      setToast(null);

      const targetNewStatus = !categoryStatus.isActive;

      const data = await toggleCategoryStatusBySlug(config.slug, { isActive: targetNewStatus });

      if (data && data.success) {
        setCategoryStatus({
          name: data.category.name,
          slug: data.category.slug,
          isActive: data.category.isActive,
        });
        if (data.category.counts) {
          setCategoryCounts(data.category.counts);
        }
        setShowCategoryConfirmModal(false);
        setToast({
          type: "success",
          text:
            data.category.isActive
              ? `✓ ${data.category.name} Category activated. It is now available to customers.`
              : `⚠ ${data.category.name} Category deactivated. Customers can no longer browse or purchase from this category.`,
        });
      } else {
        setToast({
          type: "error",
          text: data?.message || "Failed to update category activation status.",
        });
      }
    } catch (err) {
      console.error("Toggle category status error:", err);
      setToast({
        type: "error",
        text: err.response?.data?.message || "Network error while updating category status. Please try again.",
      });
    } finally {
      setIsTogglingCategory(false);
    }
  };

  // Toggle Individual Product Status
  const handleToggleProductStatus = async (prod) => {
    try {
      setToast(null);
      const data = await toggleProductStatus(prod._id);

      if (data && data.success) {
        setToast({
          type: "success",
          text: data.message || `Product status updated to ${data.product?.status || "updated"}.`,
        });
        fetchCategoryDetails();
        fetchCategoryProducts(resolvedCategory, page, debouncedSearch, statusFilter);
      } else {
        setToast({
          type: "error",
          text: data?.message || "Failed to update product status.",
        });
      }
    } catch (err) {
      console.error("Toggle product status error:", err);
      setToast({
        type: "error",
        text: err.response?.data?.message || "Network error while toggling product status.",
      });
    }
  };

  const handleFormSuccess = (savedProduct, mode) => {
    setToast({
      type: "success",
      text:
        mode === "create"
          ? `Product "${savedProduct.name}" created successfully in ${savedProduct.category}.`
          : `Product "${savedProduct.name}" updated successfully.`,
    });
    fetchCategoryDetails();
    fetchCategoryProducts(resolvedCategory, page, debouncedSearch, statusFilter);
  };

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

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
    <div className="admin-dashboard-page">
      {/* SIDEBAR NAVIGATION */}
      <AdminSidebar
        activeTab={config.sidebarTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN CONTENT AREA */}
      <div className="admin-main-wrapper">
        {/* TOP COMMAND BAR */}
        <nav className="admin-command-bar">
          <div className="command-bar-left">
            <button
              className="admin-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              aria-label="Toggle mobile menu"
            >
              ☰
            </button>
            <div className="breadcrumb-line">
              <span className="breadcrumb-root">FEXA CONTROL</span> /{" "}
              <span className="breadcrumb-root" onClick={() => navigate("/admin/categories/all")} style={{ cursor: "pointer" }}>
                CATEGORIES
              </span>{" "}
              / <span className="breadcrumb-current">{config.isAll ? "ALL PRODUCTS" : config.name.toUpperCase()}</span>
            </div>
          </div>

          <div className="command-bar-right">
            {!config.isAll && (
              <button
                type="button"
                className="command-btn batch-btn"
                onClick={() => {
                  setSelectedProduct(null);
                  setActiveModal("create");
                }}
              >
                <span>+</span> NEW {config.name.toUpperCase()} FRAGRANCE
              </button>
            )}

            <div className="admin-user-pill">
              <div className="admin-user-avatar">
                {(admin?.name || "A").charAt(0).toUpperCase()}
              </div>
              <div className="admin-user-details">
                <span className="admin-user-name">{admin?.name || "Fexa Admin"}</span>
                <span className="admin-user-role">ROOT ADMIN</span>
              </div>
            </div>

            <button type="button" className="admin-top-logout" onClick={logoutAdmin}>
              LOGOUT
            </button>
          </div>
        </nav>

        {/* NOTIFICATION TOAST */}
        {toast && (
          <div className={`admin-toast-banner ${toast.type}`}>
            <span className="toast-icon">{toast.type === "success" ? "✓" : "⚠"}</span>
            <span className="toast-text">{toast.text}</span>
            <button
              className="toast-close-btn"
              onClick={() => setToast(null)}
              aria-label="Dismiss toast"
            >
              ✕
            </button>
          </div>
        )}

        <main className="admin-main-container">
          {/* CATEGORY MASTER HEADER & ACTIVATION CARD */}
          <div className="category-master-banner">
            <div className="category-master-info">
              <div className="category-title-row">
                <span className="category-avatar-icon">{config.icon}</span>
                <div>
                  <h1 className="category-main-heading">{config.heading}</h1>
                  <p className="category-main-subtext">{config.description}</p>
                </div>
              </div>
            </div>

            <div className="category-activation-action-box">
              {config.isAll ? (
                <div className="category-status-pill-row">
                  <span className="status-meta-label">CATALOGUE SCOPE:</span>
                  <span className="category-live-status-badge active">
                    <span className="status-live-dot">●</span>
                    ALL CATEGORIES (MEN, WOMEN, UNISEX)
                  </span>
                </div>
              ) : (
                <>
                  <div className="category-status-pill-row">
                    <span className="status-meta-label">CATEGORY AVAILABILITY:</span>
                    <span
                      className={`category-live-status-badge ${
                        categoryStatus.isActive ? "active" : "inactive"
                      }`}
                    >
                      <span className="status-live-dot">●</span>
                      {categoryStatus.isActive ? "ACTIVE (PUBLIC)" : "INACTIVE (HIDDEN)"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`category-toggle-activation-btn ${
                      categoryStatus.isActive ? "deactivate-action" : "activate-action"
                    }`}
                    onClick={() => setShowCategoryConfirmModal(true)}
                    disabled={isTogglingCategory}
                  >
                    {isTogglingCategory ? (
                      <span>UPDATING...</span>
                    ) : categoryStatus.isActive ? (
                      <span>DEACTIVATE {config.name.toUpperCase()} CATEGORY</span>
                    ) : (
                      <span>ACTIVATE {config.name.toUpperCase()} CATEGORY</span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* REAL DATABASE STATS CARDS */}
          {config.isAll ? (
            <section className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-label">TOTAL CATALOGUE PRODUCTS</span>
                <span className="admin-stat-value">{categoryCounts.totalProducts || 0}</span>
              </div>
              <div className="admin-stat-card active">
                <span className="admin-stat-label">MEN FRAGRANCES</span>
                <span className="admin-stat-value">{categoryCounts.menProducts || 0}</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">WOMEN FRAGRANCES</span>
                <span className="admin-stat-value">{categoryCounts.womenProducts || 0}</span>
              </div>
              <div className="admin-stat-card blocked">
                <span className="admin-stat-label">UNISEX FRAGRANCES</span>
                <span className="admin-stat-value">{categoryCounts.unisexProducts || 0}</span>
              </div>
            </section>
          ) : (
            <section className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-label">TOTAL {config.name.toUpperCase()} PRODUCTS</span>
                <span className="admin-stat-value">{categoryCounts.totalProducts}</span>
              </div>
              <div className="admin-stat-card active">
                <span className="admin-stat-label">INDIVIDUALLY ACTIVE PRODUCTS</span>
                <span className="admin-stat-value">{categoryCounts.activeProducts}</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">INDIVIDUALLY INACTIVE PRODUCTS</span>
                <span className="admin-stat-value">{categoryCounts.inactiveProducts}</span>
              </div>
              <div className="admin-stat-card blocked">
                <span className="admin-stat-label">OUT OF STOCK PRODUCTS</span>
                <span className="admin-stat-value">{categoryCounts.outOfStockProducts}</span>
              </div>
            </section>
          )}

          {/* TOOLBAR: SEARCH, STATUS FILTER, AND ADD PRODUCT */}
          <div className="category-toolbar">
            <div className="category-search-wrapper">
              <span className="search-leading-icon">🔍</span>
              <input
                type="text"
                className="category-search-input"
                placeholder={config.isAll ? "Search all fragrances across Men, Women & Unisex..." : `Search ${config.name} fragrances by name or brand...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searchLoading && <span className="search-spinner-inline" />}
              {search && (
                <button
                  type="button"
                  className="search-clear-cross"
                  onClick={handleClearSearch}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="category-actions-right">
              <select
                className="admin-filter-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>

              {!config.isAll && (
                <button
                  type="button"
                  className="admin-create-user-btn"
                  onClick={() => {
                    setSelectedProduct(null);
                    setActiveModal("create");
                  }}
                >
                  <span>+</span>
                  <span>ADD NEW {config.name.toUpperCase()} PRODUCT</span>
                </button>
              )}
            </div>
          </div>

          {/* FETCH ERROR BANNER */}
          {fetchError && (
            <div className="admin-toast-banner error">
              <span>⚠ {fetchError}</span>
              <button
                type="button"
                className="empty-state-btn"
                style={{ marginLeft: "auto" }}
                onClick={() =>
                  fetchCategoryProducts(resolvedCategory, page, debouncedSearch, statusFilter)
                }
              >
                Retry
              </button>
            </div>
          )}

          {/* PRODUCTS TABLE CARD */}
          <div className="admin-table-card">
            <div className="admin-table-scroll-wrapper">
              <table className="admin-products-table">
                <thead>
                  <tr>
                    <th>IMAGE</th>
                    <th>PRODUCT NAME</th>
                    <th>BRAND</th>
                    <th>CATEGORY</th>
                    <th>PRICE</th>
                    <th>STOCK</th>
                    <th>PRODUCT STATUS</th>
                    <th>CREATED DATE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="admin-loading-row">
                        Loading {config.name} fragrances...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: "0" }}>
                        <div className="category-empty-state">
                          <span className="empty-state-icon">{config.icon}</span>
                          <h4 className="empty-state-title">
                            {debouncedSearch
                              ? `No products matching "${debouncedSearch}".`
                              : config.isAll
                              ? "No products currently registered in the catalogue."
                              : `No products currently registered in the ${config.name} category.`}
                          </h4>
                          <p className="empty-state-sub">
                            {debouncedSearch
                              ? "Check your spelling, try different keywords, or clear the search filter."
                              : config.isAll
                              ? "To add new products, open the Men, Women, or Unisex category management page."
                              : `Click '+ ADD NEW ${config.name.toUpperCase()} PRODUCT' to add your first fragrance to this collection.`}
                          </p>
                          {debouncedSearch ? (
                            <button
                              type="button"
                              className="empty-state-btn"
                              onClick={handleClearSearch}
                            >
                              Clear Search Filter
                            </button>
                          ) : !config.isAll ? (
                            <button
                              type="button"
                              className="empty-state-btn"
                              onClick={() => {
                                setSelectedProduct(null);
                                setActiveModal("create");
                              }}
                            >
                              + Add New {config.name} Product
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    products.map((prod) => {
                      const primaryImage =
                        prod.images && prod.images.length > 0
                          ? getImageUrl(prod.images[0])
                          : null;

                      return (
                        <tr key={prod._id}>
                          <td>
                            <div className="product-img-thumbnail">
                              {primaryImage ? (
                                <img src={primaryImage} alt={prod.name} />
                              ) : (
                                <span className="no-img-icon">⚗️</span>
                              )}
                            </div>
                          </td>
                          <td className="user-name-cell">
                            <div>{prod.name}</div>
                            {prod.slug && <small className="product-slug-sub">/{prod.slug}</small>}
                          </td>
                          <td>{prod.brand || "FEXA"}</td>
                          <td>
                            <span className="category-pill">{prod.category}</span>
                          </td>
                          <td className="product-price-cell">
                            {prod.variants && prod.variants.length > 1 ? (
                              <>
                                <span>
                                  From{" "}
                                  {formatCurrency(
                                    Math.min(...prod.variants.map((v) => Number(v.sellingPrice)))
                                  )}
                                </span>
                                <span className="compare-price-sub">
                                  {prod.variants.length} sizes configured
                                </span>
                              </>
                            ) : (
                              <>
                                {formatCurrency(prod.price)}
                                {prod.compareAtPrice > prod.price && (
                                  <span className="compare-price-sub">
                                    {formatCurrency(prod.compareAtPrice)}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td>
                            {prod.stock === 0 ? (
                              <span className="stock-pill zero">0 (Out of Stock)</span>
                            ) : prod.stock <= 5 ? (
                              <span className="stock-pill low">{prod.stock} (Low Stock)</span>
                            ) : (
                              <span className="stock-pill in-stock">{prod.stock} in stock</span>
                            )}
                          </td>
                          <td>
                            {prod.status === "Active" && (
                              <span className="status-badge active">● Active</span>
                            )}
                            {prod.status === "Inactive" && (
                              <span className="status-badge blocked">● Inactive</span>
                            )}
                            {prod.status === "Out of Stock" && (
                              <span className="status-badge out-of-stock">● Out of Stock</span>
                            )}
                          </td>
                          <td>{formatDate(prod.createdAt)}</td>
                          <td>
                            <div className="admin-actions-cell">
                              <button
                                type="button"
                                className="action-view-btn"
                                onClick={() => {
                                  setSelectedProduct(prod);
                                  setActiveModal("view");
                                }}
                              >
                                VIEW
                              </button>

                              <button
                                type="button"
                                className="action-edit-btn"
                                onClick={() => {
                                  setSelectedProduct(prod);
                                  setActiveModal("edit");
                                }}
                              >
                                EDIT
                              </button>

                              {prod.stock > 0 && (
                                <button
                                  type="button"
                                  className={
                                    prod.status === "Active"
                                      ? "action-block-btn"
                                      : "action-unblock-btn"
                                  }
                                  onClick={() => handleToggleProductStatus(prod)}
                                >
                                  {prod.status === "Active" ? "DEACTIVATE" : "ACTIVATE"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION CONTROLS */}
            {!loading && (
              <AdminPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalProducts}
                pageSize={pagination.limit || 10}
                itemName={`${config.name.toLowerCase()} products`}
                onPageChange={handlePageChange}
                loading={loading}
                variant="card-footer"
              />
            )}
          </div>
        </main>
      </div>

      {/* CATEGORY ACTIVATION / DEACTIVATION CONFIRMATION MODAL */}
      {showCategoryConfirmModal && (
        <div className="category-confirm-modal-overlay">
          <div className="category-confirm-modal-box">
            <div className="category-confirm-modal-header">
              <span className="modal-header-icon">
                {categoryStatus.isActive ? "⚠️" : "✨"}
              </span>
              <h3>
                {categoryStatus.isActive
                  ? `Deactivate ${config.name} category?`
                  : `Activate ${config.name} category?`}
              </h3>
            </div>

            <div className="category-confirm-modal-body">
              {categoryStatus.isActive ? (
                <p>
                  Customers will no longer be able to browse or purchase products from the{" "}
                  <strong>{config.name}</strong> category. Existing product statuses and order
                  history will remain unchanged.
                </p>
              ) : (
                <p>
                  The <strong>{config.name}</strong> category will be reactivated for customers.
                  Individually active products with stock will become available again. Individually
                  inactive products will remain inactive.
                </p>
              )}
            </div>

            <div className="category-confirm-modal-actions">
              <button
                type="button"
                className="category-modal-cancel-btn"
                onClick={() => setShowCategoryConfirmModal(false)}
                disabled={isTogglingCategory}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`category-modal-submit-btn ${
                  categoryStatus.isActive ? "deactivate-btn" : "activate-btn"
                }`}
                onClick={handleToggleCategoryActivation}
                disabled={isTogglingCategory}
              >
                {isTogglingCategory
                  ? "Processing..."
                  : categoryStatus.isActive
                  ? "Deactivate Category"
                  : "Activate Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE & EDIT PRODUCT MODAL */}
      <ProductFormModal
        isOpen={activeModal === "create" || activeModal === "edit"}
        mode={activeModal === "edit" ? "edit" : "create"}
        product={selectedProduct}
        initialCategory={config.name === "All" ? (selectedProduct?.category || "Men") : config.name}
        onClose={() => {
          setActiveModal(null);
          setSelectedProduct(null);
        }}
        onSuccess={handleFormSuccess}
      />

      {/* VIEW PRODUCT MODAL */}
      <ProductViewModal
        isOpen={activeModal === "view"}
        product={selectedProduct}
        onClose={() => {
          setActiveModal(null);
          setSelectedProduct(null);
        }}
        onEdit={(prod) => {
          setSelectedProduct(prod);
          setActiveModal("edit");
        }}
      />
    </div>
  );
}

export default AdminCategoryPage;
