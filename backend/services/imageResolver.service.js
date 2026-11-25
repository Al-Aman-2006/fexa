import { getSignedImageUrl } from "./s3.service.js";

// Resolve S3 image keys into temporary signed URLs.
// Existing Cloudinary URLs and local upload paths remain unchanged.
const resolveImageUrl = async (image) => {
  if (typeof image !== "string" || !image.trim()) {
    return image;
  }

  const key = image.trim();

  // Only sign product images uploaded to our S3 product folder.
  if (key.startsWith("uploads/products/")) {
    return getSignedImageUrl(key);
  }

  return image;
};

// Resolve all product images without modifying the original product.
const resolveProductImages = async (product) => {
  if (!product) {
    return product;
  }

  const productData =
    typeof product.toObject === "function"
      ? product.toObject()
      : { ...product };

  if (Array.isArray(productData.images)) {
    productData.images = await Promise.all(
      productData.images.map(resolveImageUrl)
    );
  }

  return productData;
};

export { resolveImageUrl, resolveProductImages };
