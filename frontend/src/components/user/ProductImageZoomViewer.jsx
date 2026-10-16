import { useState, useEffect, useRef, useCallback } from "react";
import "./ProductImageZoomViewer.css";

function ProductImageZoomViewer({
  isOpen,
  images = [],
  initialIndex = 0,
  productName = "Product",
  productBrand = "FEXA",
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const lastTouchDistRef = useRef(null);

  // Sync index when viewer opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex, images.length]);

  // Lock body scroll while viewer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Reset zoom & pan when image changes
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const changeImage = useCallback((newIndex) => {
    if (newIndex >= 0 && newIndex < images.length) {
      setCurrentIndex(newIndex);
      resetZoom();
    }
  }, [images.length, resetZoom]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    const prev = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    changeImage(prev);
  }, [currentIndex, images.length, changeImage]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    const next = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    changeImage(next);
  }, [currentIndex, images.length, changeImage]);

  // Keyboard navigation: ESC to close, Left/Right arrows to navigate
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Double click to toggle between 1x and 2.5x
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 4));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Mouse Drag / Pan Handling
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();

    // Bounded pan limits
    const maxPanX = (scale - 1) * 350;
    const maxPanY = (scale - 1) * 350;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    setPosition({
      x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Support: Drag & Pinch-to-zoom
  const handleTouchStart = (e) => {
    if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      const maxPanX = (scale - 1) * 300;
      const maxPanY = (scale - 1) * 300;
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;

      setPosition({
        x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
      });
    } else if (e.touches.length === 2 && lastTouchDistRef.current) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const delta = dist - lastTouchDistRef.current;
      lastTouchDistRef.current = dist;

      setScale((prev) => {
        const next = Math.max(1, Math.min(4, prev + delta * 0.01));
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    lastTouchDistRef.current = null;
  };

  if (!isOpen || !images || images.length === 0) return null;

  const activeSrc = images[currentIndex];

  const getFullImageUrl = (imgPath) => {
    if (!imgPath) return "";
    if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
      return imgPath;
    }
    return `http://localhost:5000${imgPath}`;
  };

  return (
    <div
      className="fexa-zoom-viewer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} image viewer`}
    >
      {/* Top Header Bar */}
      <div className="viewer-header-bar" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-product-meta">
          <span className="viewer-brand-tag">{productBrand}</span>
          <h3 className="viewer-product-title">{productName}</h3>
          {images.length > 1 && (
            <span className="viewer-counter-badge">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <div className="viewer-header-actions">
          <button
            type="button"
            className="viewer-icon-btn close-btn"
            onClick={onClose}
            title="Close viewer (Esc)"
            aria-label="Close enlarged image view"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        className="viewer-viewport"
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // Clicking the backdrop area closes the viewer
          if (e.target === containerRef.current) {
            onClose();
          }
        }}
      >
        {/* Navigation Previous Button */}
        {images.length > 1 && (
          <button
            type="button"
            className="viewer-nav-btn prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            title="Previous image (←)"
            aria-label="Previous image"
          >
            ‹
          </button>
        )}

        {/* Scaled & Panned Image Frame */}
        <div
          className={`viewer-image-stage ${isDragging ? "dragging" : ""} ${
            scale > 1 ? "zoomed" : ""
          }`}
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
          }}
          onDoubleClick={handleDoubleClick}
        >
          <img
            src={getFullImageUrl(activeSrc)}
            alt={`${productName} view ${currentIndex + 1}`}
            className="viewer-main-image"
            draggable={false}
          />
        </div>

        {/* Navigation Next Button */}
        {images.length > 1 && (
          <button
            type="button"
            className="viewer-nav-btn next-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            title="Next image (→)"
            aria-label="Next image"
          >
            ›
          </button>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="viewer-bottom-bar" onClick={(e) => e.stopPropagation()}>
        {/* Zoom Controls Pill */}
        <div className="viewer-controls-pill">
          <button
            type="button"
            className="pill-action-btn"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="pill-scale-text">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="pill-action-btn"
            onClick={handleZoomIn}
            disabled={scale >= 4}
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
          <div className="pill-divider" />
          <button
            type="button"
            className="pill-reset-btn"
            onClick={resetZoom}
            disabled={scale === 1 && position.x === 0 && position.y === 0}
            title="Reset zoom & position"
          >
            RESET
          </button>
        </div>

        {/* Thumbnails Gallery Strip */}
        {images.length > 1 && (
          <div className="viewer-thumbnails-strip">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                className={`viewer-thumb-btn ${idx === currentIndex ? "active" : ""}`}
                onClick={() => changeImage(idx)}
                aria-label={`View image ${idx + 1}`}
              >
                <img src={getFullImageUrl(img)} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductImageZoomViewer;
