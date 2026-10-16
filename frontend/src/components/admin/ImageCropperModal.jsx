import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import getCroppedImg from "../../utils/cropImage";
import "./ImageCropperModal.css";

function ImageCropperModal({
  isOpen,
  imageSrc,
  fileName = "product.webp",
  aspectRatio = 1, // Default 1:1 square luxury ratio
  onApply,
  onCancel,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cropError, setCropError] = useState(null);

  // Reset state whenever a new image is loaded or modal opens
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
      setIsProcessing(false);
      setCropError(null);
    }
  }, [isOpen, imageSrc]);

  // Handle ESC key to cancel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isProcessing) {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isProcessing, onCancel]);

  const onCropComplete = useCallback((croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 1));
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90) % 360);
  };

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      setCropError("Please adjust the crop area before applying.");
      return;
    }

    try {
      setIsProcessing(true);
      setCropError(null);

      const { file, previewUrl } = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        fileName
      );

      onApply(file, previewUrl);
    } catch (err) {
      console.error("Cropping error:", err);
      setCropError(err.message || "Failed to crop image. Please try again.");
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      className="cropper-modal-overlay"
      onClick={!isProcessing ? onCancel : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cropper-modal-title"
    >
      <div
        className="cropper-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="cropper-modal-header">
          <div>
            <span className="cropper-eyebrow">IMAGE REFINEMENT ATELIER</span>
            <h3 id="cropper-modal-title" className="cropper-title">
              Crop & Edit Product Image
            </h3>
          </div>
          <button
            type="button"
            className="cropper-close-btn"
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Cancel and close image editor"
          >
            ✕
          </button>
        </div>

        {cropError && (
          <div className="cropper-error-banner" role="alert">
            <span>⚠️</span>
            <span>{cropError}</span>
          </div>
        )}

        {/* Cropper Viewport */}
        <div className="cropper-viewport-wrapper">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            showGrid={true}
            cropShape="rect"
            style={{
              containerStyle: {
                backgroundColor: "#0a080e",
                borderRadius: "8px",
              },
              cropAreaStyle: {
                border: "2px solid #cbb8de",
                boxShadow: "0 0 0 9999px rgba(10, 8, 14, 0.75)",
              },
            }}
          />
          <div className="cropper-aspect-tag">1:1 LUXURY SQUARE RATIO</div>
        </div>

        {/* Control Toolbar */}
        <div className="cropper-controls-toolbar">
          {/* Zoom Section */}
          <div className="cropper-control-group">
            <span className="control-group-label">ZOOM</span>
            <div className="control-btn-group">
              <button
                type="button"
                className="control-icon-btn"
                onClick={handleZoomOut}
                disabled={zoom <= 1 || isProcessing}
                title="Zoom Out"
                aria-label="Zoom out"
              >
                −
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="cropper-slider"
                disabled={isProcessing}
                aria-label="Zoom slider"
              />
              <button
                type="button"
                className="control-icon-btn"
                onClick={handleZoomIn}
                disabled={zoom >= 3 || isProcessing}
                title="Zoom In"
                aria-label="Zoom in"
              >
                +
              </button>
              <span className="zoom-val-badge">{zoom.toFixed(2)}x</span>
            </div>
          </div>

          {/* Rotation & Reset Section */}
          <div className="cropper-control-group">
            <span className="control-group-label">ORIENTATION</span>
            <div className="control-btn-group">
              <button
                type="button"
                className="control-action-btn"
                onClick={handleRotateLeft}
                disabled={isProcessing}
                title="Rotate 90 degrees counter-clockwise"
              >
                ↺ -90°
              </button>
              <button
                type="button"
                className="control-action-btn"
                onClick={handleRotateRight}
                disabled={isProcessing}
                title="Rotate 90 degrees clockwise"
              >
                ↻ +90°
              </button>
              <button
                type="button"
                className="control-action-btn reset"
                onClick={handleReset}
                disabled={isProcessing}
                title="Reset zoom, rotation, and position"
              >
                RESET
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="cropper-modal-footer">
          <button
            type="button"
            className="cropper-btn-cancel"
            onClick={onCancel}
            disabled={isProcessing}
          >
            CANCEL
          </button>
          <button
            type="button"
            className="cropper-btn-apply"
            onClick={handleApply}
            disabled={isProcessing}
          >
            {isProcessing ? "PROCESSING CROP..." : "APPLY CROP"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageCropperModal;
