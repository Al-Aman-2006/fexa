import { useState, useEffect } from "react";
import ImageCropperModal from "./ImageCropperModal";
import {
  validateProductField,
  validateProductForm,
  validateVariantsList,
} from "../../utils/validation";

function ProductFormModal({
  isOpen,
  mode = "create",
  product = null,
  initialCategory = "Men",
  onClose,
  onSuccess,
}) {
  const isEdit = mode === "edit";

  const STANDARD_SIZES = [10, 15, 20, 30, 50, 75, 100, 150, 200];

  const [formData, setFormData] = useState({
    name: "",
    brand: "FEXA",
    category: initialCategory || "Men",
    status: "Active",
    description: "",
  });

  const [variants, setVariants] = useState([
    {
      volumeMl: 100,
      sellingPrice: "",
      originalPrice: "",
      stock: "",
      isAvailable: true,
    },
  ]);
  const [variantErrors, setVariantErrors] = useState([]);

  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);

  // Cropper state
  const [cropperState, setCropperState] = useState({
    isOpen: false,
    imageSrc: null,
    fileName: "",
    mode: null, // "queue" | "edit-new" | "edit-existing"
    targetIndex: null,
    queue: [],
  });

  const [modalErrors, setModalErrors] = useState({});
  const [modalTouched, setModalTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      if (isEdit && product) {
        setFormData({
          name: product.name || "",
          brand: product.brand || "FEXA",
          category: product.category || initialCategory || "Men",
          status: product.status || "Active",
          description: product.description || "",
        });

        if (product.variants && product.variants.length > 0) {
          setVariants(
            product.variants.map((v) => ({
              _id: v._id,
              volumeMl: v.volumeMl || 100,
              sellingPrice: v.sellingPrice !== undefined ? v.sellingPrice : "",
              originalPrice:
                v.originalPrice !== undefined && v.originalPrice !== null
                  ? v.originalPrice
                  : "",
              stock: v.stock !== undefined ? v.stock : 0,
              isAvailable: v.isAvailable !== false,
            }))
          );
        } else {
          setVariants([
            {
              volumeMl: 100,
              sellingPrice: product.price !== undefined ? product.price : "",
              originalPrice:
                product.compareAtPrice !== undefined && product.compareAtPrice !== null
                  ? product.compareAtPrice
                  : "",
              stock: product.stock !== undefined ? product.stock : "",
              isAvailable: true,
            },
          ]);
        }

        setExistingImages(product.images || []);
      } else {
        setFormData({
          name: "",
          brand: "FEXA",
          category: initialCategory || "Men",
          status: "Active",
          description: "",
        });
        setVariants([
          {
            volumeMl: 100,
            sellingPrice: "",
            originalPrice: "",
            stock: "",
            isAvailable: true,
          },
        ]);
        setExistingImages([]);
      }
      setVariantErrors([]);
      setNewImageFiles([]);
      setNewImagePreviews([]);
      setModalErrors({});
      setModalTouched({});
      setIsSubmitting(false);
      setCropperState({
        isOpen: false,
        imageSrc: null,
        fileName: "",
        mode: null,
        targetIndex: null,
        queue: [],
      });
    }
  }, [isOpen, isEdit, product, initialCategory]);

  if (!isOpen) return null;

  // Real-time Field Change Handler for top-level product fields
  const handleFieldChange = (name, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (modalTouched[name]) {
        const fieldError = validateProductField(name, value, updated);
        setModalErrors((prevErrors) => {
          const next = { ...prevErrors };
          if (fieldError) {
            next[name] = fieldError;
          } else {
            delete next[name];
          }
          return next;
        });
      }

      return updated;
    });
  };

  // Field Blur Handler
  const handleFieldBlur = (name) => {
    setModalTouched((prev) => ({ ...prev, [name]: true }));
    const fieldError = validateProductField(name, formData[name], formData);
    setModalErrors((prev) => {
      const next = { ...prev };
      if (fieldError) {
        next[name] = fieldError;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  // Add new empty variant
  const handleAddVariant = (defaultVolume = "") => {
    setVariants((prev) => [
      ...prev,
      {
        volumeMl: defaultVolume || "",
        sellingPrice: "",
        originalPrice: "",
        stock: "",
        isAvailable: true,
      },
    ]);
    setModalErrors((prev) => {
      const next = { ...prev };
      delete next.variants;
      return next;
    });
  };

  // Add standard preset size pill
  const handleAddPresetSize = (size) => {
    const existing = variants.find((v) => Number(v.volumeMl) === size);
    if (existing) {
      setModalErrors((prev) => ({
        ...prev,
        variants: `${size} ml size is already added.`,
      }));
      return;
    }
    setModalErrors((prev) => {
      const next = { ...prev };
      delete next.variants;
      return next;
    });
    handleAddVariant(size);
  };

  // Remove variant
  const handleRemoveVariant = (index) => {
    if (variants.length <= 1) {
      setModalErrors((prev) => ({
        ...prev,
        variants: "Every product must have at least one size variant.",
      }));
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
    setVariantErrors((prev) => prev.filter((_, i) => i !== index));
    setModalErrors((prev) => {
      const next = { ...prev };
      delete next.variants;
      return next;
    });
  };

  // Update variant field
  const handleVariantChange = (index, field, value) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // Real-time inline field check
    setVariantErrors((prev) => {
      const updated = [...prev];
      const variantObj = { ...variants[index], [field]: value };
      const fieldErrors = updated[index] ? { ...updated[index] } : {};

      if (field === "volumeMl") {
        const volNum = Number(value);
        if (!value || isNaN(volNum) || volNum <= 0) {
          fieldErrors.volumeMl = "Volume must be a positive number in ml.";
        } else if (!Number.isInteger(volNum)) {
          fieldErrors.volumeMl = "Volume in ml must be a whole integer.";
        } else {
          const duplicate = variants.some(
            (v, i) => i !== index && Number(v.volumeMl) === volNum
          );
          if (duplicate) {
            fieldErrors.volumeMl = `Duplicate size: ${volNum} ml already exists.`;
          } else {
            delete fieldErrors.volumeMl;
          }
        }
      } else if (field === "sellingPrice") {
        const priceNum = Number(value);
        if (!value || isNaN(priceNum) || priceNum <= 0) {
          fieldErrors.sellingPrice = "Selling price must be greater than zero.";
        } else {
          delete fieldErrors.sellingPrice;
          if (variantObj.originalPrice) {
            const mrpNum = Number(variantObj.originalPrice);
            if (!isNaN(mrpNum) && mrpNum > 0 && mrpNum < priceNum) {
              fieldErrors.originalPrice = "Original price (MRP) cannot be less than selling price.";
            } else {
              delete fieldErrors.originalPrice;
            }
          }
        }
      } else if (field === "originalPrice") {
        if (value && String(value).trim() !== "") {
          const mrpNum = Number(value);
          const sellNum = Number(variantObj.sellingPrice);
          if (isNaN(mrpNum) || mrpNum <= 0) {
            fieldErrors.originalPrice = "Original price (MRP) must be greater than zero.";
          } else if (!isNaN(sellNum) && sellNum > 0 && mrpNum < sellNum) {
            fieldErrors.originalPrice = "Original price (MRP) cannot be less than selling price.";
          } else {
            delete fieldErrors.originalPrice;
          }
        } else {
          delete fieldErrors.originalPrice;
        }
      } else if (field === "stock") {
        const stockNum = Number(value);
        if (value === "" || isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
          fieldErrors.stock = "Stock must be a valid non-negative whole integer.";
        } else {
          delete fieldErrors.stock;
        }
      }

      updated[index] = fieldErrors;
      return updated;
    });
  };

  // Image Selection Handler with Cropper Integration
  const handleImageFileChange = (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    if (files.length === 0) return;

    const currentTotal = existingImages.length + newImageFiles.length;
    if (currentTotal + files.length > 5) {
      setModalErrors((prev) => ({
        ...prev,
        images: "Maximum 5 product images allowed.",
      }));
      return;
    }

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    for (const file of files) {
      if (!allowed.includes(file.type.toLowerCase())) {
        setModalErrors((prev) => ({
          ...prev,
          images: "Only JPG, JPEG, PNG and WEBP images are allowed.",
        }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setModalErrors((prev) => ({
          ...prev,
          images: "Each image must be 5MB or smaller.",
        }));
        return;
      }
    }

    setModalErrors((prev) => ({ ...prev, images: null }));

    const firstFile = files[0];
    const remainingFiles = files.slice(1);
    const objectUrl = URL.createObjectURL(firstFile);

    setCropperState({
      isOpen: true,
      imageSrc: objectUrl,
      fileName: firstFile.name,
      mode: "queue",
      targetIndex: null,
      queue: remainingFiles,
    });
  };

  // Cropper Apply
  const handleCropperApply = (croppedFile, croppedPreviewUrl) => {
    if (cropperState.mode === "queue") {
      setNewImageFiles((prev) => [...prev, croppedFile]);
      setNewImagePreviews((prev) => [...prev, croppedPreviewUrl]);

      if (cropperState.queue && cropperState.queue.length > 0) {
        const nextFile = cropperState.queue[0];
        const nextRemaining = cropperState.queue.slice(1);
        const nextUrl = URL.createObjectURL(nextFile);
        setCropperState({
          isOpen: true,
          imageSrc: nextUrl,
          fileName: nextFile.name,
          mode: "queue",
          targetIndex: null,
          queue: nextRemaining,
        });
        return;
      }
    } else if (cropperState.mode === "edit-new") {
      const idx = cropperState.targetIndex;
      setNewImageFiles((prev) => {
        const updated = [...prev];
        updated[idx] = croppedFile;
        return updated;
      });
      setNewImagePreviews((prev) => {
        const updated = [...prev];
        updated[idx] = croppedPreviewUrl;
        return updated;
      });
    } else if (cropperState.mode === "edit-existing") {
      const idx = cropperState.targetIndex;
      setExistingImages((prev) => prev.filter((_, i) => i !== idx));
      setNewImageFiles((prev) => [...prev, croppedFile]);
      setNewImagePreviews((prev) => [...prev, croppedPreviewUrl]);
    }

    setCropperState({
      isOpen: false,
      imageSrc: null,
      fileName: "",
      mode: null,
      targetIndex: null,
      queue: [],
    });
  };

  // Cropper Cancel
  const handleCropperCancel = () => {
    if (cropperState.mode === "queue" && cropperState.queue && cropperState.queue.length > 0) {
      const nextFile = cropperState.queue[0];
      const nextRemaining = cropperState.queue.slice(1);
      const nextUrl = URL.createObjectURL(nextFile);
      setCropperState({
        isOpen: true,
        imageSrc: nextUrl,
        fileName: nextFile.name,
        mode: "queue",
        targetIndex: null,
        queue: nextRemaining,
      });
      return;
    }

    setCropperState({
      isOpen: false,
      imageSrc: null,
      fileName: "",
      mode: null,
      targetIndex: null,
      queue: [],
    });
  };

  // Edit / Recrop an already added new image
  const handleEditNewImage = (idx) => {
    const file = newImageFiles[idx];
    const preview = newImagePreviews[idx];
    const imageSrc = preview || (file ? URL.createObjectURL(file) : null);
    if (!imageSrc) return;

    setCropperState({
      isOpen: true,
      imageSrc,
      fileName: file ? file.name : `product-img-${idx + 1}.webp`,
      mode: "edit-new",
      targetIndex: idx,
      queue: [],
    });
  };

  // Edit / Crop an existing saved image
  const handleEditExistingImage = async (idx) => {
    const imgUrl = existingImages[idx];
    if (!imgUrl) return;

    try {
      const fullUrl = imgUrl.startsWith("http://") || imgUrl.startsWith("https://")
        ? imgUrl
        : `http://localhost:5000${imgUrl}`;

      const res = await fetch(fullUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      setCropperState({
        isOpen: true,
        imageSrc: objectUrl,
        fileName: `cropped-saved-${idx + 1}.webp`,
        mode: "edit-existing",
        targetIndex: idx,
        queue: [],
      });
    } catch (err) {
      console.error("Failed to load existing image for cropping:", err);
      setCropperState({
        isOpen: true,
        imageSrc: imgUrl.startsWith("http") ? imgUrl : `http://localhost:5000${imgUrl}`,
        fileName: `cropped-saved-${idx + 1}.webp`,
        mode: "edit-existing",
        targetIndex: idx,
        queue: [],
      });
    }
  };

  const handleRemoveNewImage = (index) => {
    setNewImageFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      const remainingTotal = existingImages.length + updated.length;
      if (remainingTotal === 0) {
        setModalErrors((errs) => ({ ...errs, images: "Please upload at least one product image." }));
      } else if (remainingTotal <= 5) {
        setModalErrors((errs) => {
          const next = { ...errs };
          delete next.images;
          return next;
        });
      }
      return updated;
    });
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = (index) => {
    setExistingImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      const remainingTotal = updated.length + newImageFiles.length;
      if (remainingTotal === 0) {
        setModalErrors((errs) => ({
          ...errs,
          images: "A product must have at least one image. Please keep an existing image or upload a new one.",
        }));
      } else if (remainingTotal <= 5) {
        setModalErrors((errs) => {
          const next = { ...errs };
          delete next.images;
          return next;
        });
      }
      return updated;
    });
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalErrors({});

    const fields = ["name", "brand", "category", "description"];
    const touchedAll = {};
    fields.forEach((f) => {
      touchedAll[f] = true;
    });
    setModalTouched(touchedAll);

    // 1. Validate top-level product fields
    const { isValid, errors } = validateProductForm(
      { ...formData, variants },
      {
        isEdit,
        existingImages,
        newImageFiles,
      }
    );

    // 2. Validate variants
    const variantsCheck = validateVariantsList(variants);
    if (!variantsCheck.isValid) {
      errors.variants = variantsCheck.errors.variants;
      setVariantErrors(variantsCheck.variantErrors);
    }

    if (!isValid || !variantsCheck.isValid) {
      setModalErrors(errors);
      const firstInvalid = fields.find((f) => errors[f]);
      if (firstInvalid) {
        const el = document.querySelector(`[name="${firstInvalid}"]`);
        if (el) el.focus();
      }
      return;
    }

    try {
      setIsSubmitting(true);
      const dataPayload = new FormData();
      dataPayload.append("name", formData.name.trim());
      dataPayload.append("brand", formData.brand.trim() || "FEXA");
      dataPayload.append("category", formData.category);
      dataPayload.append("status", formData.status);
      dataPayload.append("description", formData.description.trim());

      // Calculate top-level price and stock from variants
      const sellingPrices = variants.map((v) => Number(v.sellingPrice));
      const minSellingPrice = Math.min(...sellingPrices);
      const totalStock = variants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);
      const firstOriginalPrice = variants.find((v) => v.originalPrice)?.originalPrice || "0";

      dataPayload.append("price", minSellingPrice.toString());
      dataPayload.append("compareAtPrice", firstOriginalPrice.toString());
      dataPayload.append("stock", totalStock.toString());
      dataPayload.append("variants", JSON.stringify(variants));

      if (isEdit) {
        dataPayload.append("existingImages", JSON.stringify(existingImages));
      }

      newImageFiles.forEach((file) => {
        dataPayload.append("images", file);
      });

      const categorySlug = (formData.category || "men").toLowerCase();
      const url = isEdit
        ? `http://localhost:5000/api/admin/products/${product._id}`
        : `http://localhost:5000/api/admin/categories/${categorySlug}/products`;

      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        body: dataPayload,
      });

      let data = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text || `HTTP ${response.status} ${response.statusText}` };
      }

      if (response.ok && data.success) {
        if (onSuccess) {
          onSuccess(data.product, isEdit ? "edit" : "create");
        }
        onClose();
      } else {
        if (response.status === 401) {
          setModalErrors({ general: "Your admin session has expired. Please log in again." });
        } else if (response.status === 403) {
          setModalErrors({ general: "Access denied. Admin privileges required." });
        } else if (response.status === 404) {
          setModalErrors({ general: "Product API route not found on the backend." });
        } else if (response.status === 409) {
          setModalErrors({ general: data.message || "A product with this name already exists." });
        } else if (response.status === 413) {
          setModalErrors({ general: "Image size is too large. Maximum size per image is 5MB." });
        } else if (response.status === 415) {
          setModalErrors({ general: "Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP." });
        } else {
          if (data.errors) {
            setModalErrors((prev) => ({ ...prev, ...data.errors }));
            const firstInvalidKey = Object.keys(data.errors)[0];
            const el = document.querySelector(`[name="${firstInvalidKey}"]`);
            if (el) el.focus();
          }
          if (data.message && !data.errors) {
            setModalErrors((prev) => ({
              ...prev,
              general: data.message,
            }));
          }
        }
      }
    } catch (error) {
      console.error("Save product error:", error);
      if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
        setModalErrors({ general: "Unable to connect to the server. Please check that the backend is running." });
      } else {
        setModalErrors({ general: error.message || "Something went wrong while saving the product." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="admin-modal-overlay" onClick={isSubmitting ? null : onClose}>
        <div className="admin-modal-card product-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-header">
            <h3>{isEdit ? "Edit Product Details" : "Add New Perfume Product"}</h3>
            <button
              type="button"
              className="admin-modal-close-btn"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          {modalErrors.general && (
            <div className="admin-toast-error" style={{ marginBottom: "16px" }}>
              {modalErrors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-modal-form" noValidate>
            <div className="product-form-grid">
              {/* Product Name */}
              <div className="admin-modal-field">
                <label>PRODUCT NAME *</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Imperial Oud Eau de Parfum"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  onBlur={() => handleFieldBlur("name")}
                  className={modalTouched.name && modalErrors.name ? "input-error" : ""}
                />
                {modalTouched.name && modalErrors.name && (
                  <span className="modal-field-error">{modalErrors.name}</span>
                )}
              </div>

              {/* Brand */}
              <div className="admin-modal-field">
                <label>BRAND *</label>
                <input
                  type="text"
                  name="brand"
                  placeholder="FEXA"
                  value={formData.brand}
                  onChange={(e) => handleFieldChange("brand", e.target.value)}
                  onBlur={() => handleFieldBlur("brand")}
                  className={modalTouched.brand && modalErrors.brand ? "input-error" : ""}
                />
                {modalTouched.brand && modalErrors.brand && (
                  <span className="modal-field-error">{modalErrors.brand}</span>
                )}
              </div>

              {/* Category */}
              <div className="admin-modal-field">
                <label>CATEGORY *</label>
                {isEdit ? (
                  <select
                    name="category"
                    value={formData.category}
                    onChange={(e) => handleFieldChange("category", e.target.value)}
                    onBlur={() => handleFieldBlur("category")}
                    className={`admin-modal-select ${modalTouched.category && modalErrors.category ? "input-error" : ""}`}
                  >
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                ) : (
                  <div className="category-readonly-display" id="product-category-readonly-display">
                    <span className="readonly-category-label">CATEGORY:</span>
                    <span className="readonly-category-badge">{formData.category.toUpperCase()}</span>
                    <span className="readonly-category-lock" title="Derived from Category Management route">🔒</span>
                  </div>
                )}
                {modalTouched.category && modalErrors.category && (
                  <span className="modal-field-error">{modalErrors.category}</span>
                )}
              </div>

              {/* Status */}
              <div className="admin-modal-field">
                <label>PRODUCT STATUS</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={(e) => handleFieldChange("status", e.target.value)}
                  className="admin-modal-select"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* ======================================================== */}
            {/* PERFUME SIZE & INVENTORY SECTION                        */}
            {/* ======================================================== */}
            <div className="variants-admin-section">
              <div className="variants-section-header">
                <div>
                  <h4 className="variants-section-title">PERFUME SIZE & INVENTORY</h4>
                  <p className="variants-section-sub">
                    Configure flacon volumes, selling prices, MRPs, and individual stock quantities.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-add-variant-custom"
                  onClick={() => handleAddVariant("")}
                >
                  + Add Size Option
                </button>
              </div>

              {/* Preset quick pills */}
              <div className="preset-sizes-container">
                <span className="preset-label">STANDARD PRESETS:</span>
                <div className="preset-pills-list">
                  {STANDARD_SIZES.map((size) => {
                    const isAlreadyAdded = variants.some((v) => Number(v.volumeMl) === size);
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`preset-pill-btn ${isAlreadyAdded ? "added" : ""}`}
                        onClick={() => handleAddPresetSize(size)}
                        title={isAlreadyAdded ? "Already configured" : `Add ${size} ml size option`}
                      >
                        {size} ml {isAlreadyAdded ? "✓" : "+"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Variants Error Alert */}
              {modalErrors.variants && (
                <div className="variants-error-banner" role="alert">
                  <span className="alert-ico">⚠️</span>
                  <span>{modalErrors.variants}</span>
                </div>
              )}

              {/* Variants List Cards */}
              <div className="variants-cards-list">
                {variants.map((variant, index) => {
                  const itemErr = variantErrors[index] || {};

                  return (
                    <div
                      key={variant._id || `variant-${index}`}
                      className={`variant-item-card ${!variant.isAvailable ? "unavailable" : ""}`}
                    >
                      <div className="variant-card-top">
                        <span className="variant-card-index">SIZE OPTION #{index + 1}</span>
                        <div className="variant-card-actions">
                          <label className="variant-available-toggle">
                            <input
                              type="checkbox"
                              checked={variant.isAvailable !== false}
                              onChange={(e) =>
                                handleVariantChange(index, "isAvailable", e.target.checked)
                              }
                            />
                            <span>{variant.isAvailable !== false ? "Available" : "Unavailable"}</span>
                          </label>
                          <button
                            type="button"
                            className="variant-remove-btn"
                            onClick={() => handleRemoveVariant(index)}
                            disabled={variants.length <= 1}
                            title={
                              variants.length <= 1
                                ? "At least one size option is required"
                                : "Remove this size option"
                            }
                            aria-label={`Remove size option ${index + 1}`}
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      <div className="variant-fields-grid">
                        {/* Volume Field */}
                        <div className="variant-input-group">
                          <label>FLACON SIZE *</label>
                          <div className="input-with-unit">
                            <input
                              type="number"
                              step="1"
                              min="1"
                              placeholder="e.g. 50"
                              value={variant.volumeMl}
                              onChange={(e) =>
                                handleVariantChange(index, "volumeMl", e.target.value)
                              }
                              className={itemErr.volumeMl ? "input-error" : ""}
                            />
                            <span className="input-unit-label">ml</span>
                          </div>
                          {itemErr.volumeMl && (
                            <span className="variant-inline-error">{itemErr.volumeMl}</span>
                          )}
                        </div>

                        {/* Selling Price */}
                        <div className="variant-input-group">
                          <label>SELLING PRICE (₹) *</label>
                          <div className="input-with-unit">
                            <input
                              type="number"
                              step="any"
                              min="1"
                              placeholder="e.g. 1299"
                              value={variant.sellingPrice}
                              onChange={(e) =>
                                handleVariantChange(index, "sellingPrice", e.target.value)
                              }
                              className={itemErr.sellingPrice ? "input-error" : ""}
                            />
                            <span className="input-unit-label">₹</span>
                          </div>
                          {itemErr.sellingPrice && (
                            <span className="variant-inline-error">{itemErr.sellingPrice}</span>
                          )}
                        </div>

                        {/* Original Price / MRP */}
                        <div className="variant-input-group">
                          <label>ORIGINAL PRICE / MRP (₹)</label>
                          <div className="input-with-unit">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="e.g. 1499"
                              value={variant.originalPrice}
                              onChange={(e) =>
                                handleVariantChange(index, "originalPrice", e.target.value)
                              }
                              className={itemErr.originalPrice ? "input-error" : ""}
                            />
                            <span className="input-unit-label">₹</span>
                          </div>
                          {itemErr.originalPrice && (
                            <span className="variant-inline-error">{itemErr.originalPrice}</span>
                          )}
                        </div>

                        {/* Stock */}
                        <div className="variant-input-group">
                          <label>STOCK *</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="e.g. 20"
                            value={variant.stock}
                            onChange={(e) =>
                              handleVariantChange(index, "stock", e.target.value)
                            }
                            className={itemErr.stock ? "input-error" : ""}
                          />
                          {itemErr.stock && (
                            <span className="variant-inline-error">{itemErr.stock}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="admin-modal-field" style={{ marginTop: "16px" }}>
              <label>PRODUCT DESCRIPTION *</label>
              <textarea
                name="description"
                rows="3"
                placeholder="Enter detailed olfactory notes, top/middle/base notes, fragrance story..."
                value={formData.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                onBlur={() => handleFieldBlur("description")}
                className={`admin-modal-textarea ${modalTouched.description && modalErrors.description ? "input-error" : ""}`}
              />
              {modalTouched.description && modalErrors.description && (
                <span className="modal-field-error">{modalErrors.description}</span>
              )}
            </div>

            {/* Image Upload Area */}
            <div className="admin-modal-field" style={{ marginTop: "16px" }}>
              <label>PRODUCT IMAGES (MAX 5 IMAGES, UP TO 5MB EACH) *</label>
              <input
                type="file"
                name="images"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={handleImageFileChange}
                className="admin-modal-file-input"
                id="product-image-input"
              />

              {modalErrors.images && (
                <span className="modal-field-error">{modalErrors.images}</span>
              )}

              {/* Image Previews Container */}
              <div className="image-previews-grid">
                {/* Existing Images (Edit mode) */}
                {existingImages.map((imgUrl, idx) => (
                  <div key={`exist-${idx}`} className="preview-thumb-card">
                    <img src={imgUrl.startsWith("http") ? imgUrl : `http://localhost:5000${imgUrl}`} alt="Existing" />
                    <div className="thumb-actions-overlay">
                      <button
                        type="button"
                        className="thumb-crop-btn"
                        onClick={() => handleEditExistingImage(idx)}
                        title="Crop & edit this image"
                        aria-label={`Crop existing image ${idx + 1}`}
                      >
                        ✂
                      </button>
                      <button
                        type="button"
                        className="remove-thumb-btn"
                        onClick={() => handleRemoveExistingImage(idx)}
                        title="Remove image"
                        aria-label={`Remove existing image ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                    <span className="thumb-label">Saved</span>
                  </div>
                ))}

                {/* New Upload Previews */}
                {newImagePreviews.map((previewUrl, idx) => (
                  <div key={`new-${idx}`} className="preview-thumb-card">
                    <img src={previewUrl} alt="New upload" />
                    <div className="thumb-actions-overlay">
                      <button
                        type="button"
                        className="thumb-crop-btn"
                        onClick={() => handleEditNewImage(idx)}
                        title="Crop & edit this image"
                        aria-label={`Crop new image ${idx + 1}`}
                      >
                        ✂
                      </button>
                      <button
                        type="button"
                        className="remove-thumb-btn"
                        onClick={() => handleRemoveNewImage(idx)}
                        title="Remove image"
                        aria-label={`Remove new image ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                    <span className="thumb-label new">New</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="admin-modal-actions" style={{ marginTop: "24px" }}>
              <button
                type="button"
                className="admin-modal-cancel-btn"
                onClick={onClose}
                disabled={isSubmitting}
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="admin-modal-save-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>PROCESSING...</span>
                ) : isEdit ? (
                  <span>UPDATE PRODUCT</span>
                ) : (
                  <span>SAVE PRODUCT</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperState.isOpen}
        imageSrc={cropperState.imageSrc}
        fileName={cropperState.fileName}
        onApply={handleCropperApply}
        onCancel={handleCropperCancel}
      />
    </>
  );
}

export default ProductFormModal;
