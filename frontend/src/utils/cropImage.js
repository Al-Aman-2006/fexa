/**
 * Utility helper to crop images using HTML5 Canvas with rotation and scaling.
 * Generates a high-quality WebP File and object preview URL.
 */

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
function calculateRotatedSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Crops an image source with pixelCrop coordinates and optional rotation.
 * @param {string} imageSrc - URL or blob URL of the source image
 * @param {Object} pixelCrop - { x, y, width, height } in pixels
 * @param {number} rotation - rotation angle in degrees
 * @param {string} fileName - output file name
 * @returns {Promise<{ file: File, previewUrl: string }>}
 */
export default async function getCroppedImg(
  imageSrc,
  pixelCrop,
  rotation = 0,
  fileName = "cropped-product.webp"
) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to create canvas 2D rendering context.");
  }

  const rotRad = getRadianAngle(rotation);

  // Calculate bounding box size after rotation
  const { width: bBoxWidth, height: bBoxHeight } = calculateRotatedSize(
    image.width,
    image.height,
    rotation
  );

  // Set canvas size to match the rotated bounding box
  canvas.width = Math.round(bBoxWidth);
  canvas.height = Math.round(bBoxHeight);

  // Center canvas context to rotate around center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Draw source image
  ctx.drawImage(image, 0, 0);

  // Create destination canvas for the cropped area
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Unable to create cropped canvas context.");
  }

  // Ensure positive integers for dimensions
  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));

  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;

  // Draw the cropped section from the rotated canvas onto the target canvas
  croppedCtx.drawImage(
    canvas,
    Math.round(pixelCrop.x),
    Math.round(pixelCrop.y),
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  // Export as WebP File (fallback to JPEG if webp not supported) with high quality (0.92)
  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas export failed: generated blob is empty."));
          return;
        }

        // Clean extension if fileName ends with another extension
        let safeName = fileName.replace(/\.[^/.]+$/, "") + ".webp";
        const file = new File([blob], safeName, { type: "image/webp" });
        const previewUrl = URL.createObjectURL(blob);

        resolve({ file, previewUrl });
      },
      "image/webp",
      0.92
    );
  });
}
