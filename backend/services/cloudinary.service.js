import { Readable } from "stream";
import { getCloudinaryInstance, isCloudinaryConfigured } from "../config/cloudinary.js";

/**
 * Extracts Cloudinary public ID from a full Cloudinary secure_url.
 * Example URL:
 * https://res.cloudinary.com/demo/image/upload/v1612345678/fexa/products/prod-123.webp
 * -> extracts: "fexa/products/prod-123"
 *
 * @param {string} url
 * @returns {string|null}
 */
export const extractPublicIdFromUrl = (url) => {
  if (!url || typeof url !== "string") return null;

  // Check if it's actually a Cloudinary URL
  if (!url.includes("res.cloudinary.com")) return null;

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/image/upload/");
    if (parts.length < 2) return null;

    let pathAfterUpload = parts[1]; // e.g. "v123456789/fexa/products/prod-123.webp"
    
    // Remove version prefix if present (e.g. "v123456789/")
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, "");

    // Remove file extension at the end
    const lastDotIndex = pathAfterUpload.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      pathAfterUpload = pathAfterUpload.substring(0, lastDotIndex);
    }

    return pathAfterUpload || null;
  } catch (e) {
    return null;
  }
};

/**
 * Uploads a single buffer to Cloudinary using upload_stream.
 *
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {Object} options - Upload options (folder, public_id, etc.)
 * @returns {Promise<Object>} Resolves to Cloudinary result { secure_url, public_id, ... }
 */
export const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return reject(new Error("Invalid buffer provided for Cloudinary upload."));
    }

    let cloudinary;
    try {
      cloudinary = getCloudinaryInstance();
    } catch (err) {
      return reject(err);
    }

    const uploadOptions = {
      folder: options.folder || "fexa/products",
      resource_type: options.resource_type || "image",
      ...options,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(
            new Error(`Cloudinary upload failed: ${error.message || "Unknown error"}`)
          );
        }
        resolve(result);
      }
    );

    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

/**
 * Uploads multiple file buffers to Cloudinary.
 * If ANY upload fails, automatically cleans up previously succeeded uploads from this batch.
 *
 * @param {Array<Object>} files - Array of multer file objects ({ buffer, originalname, mimetype, etc. })
 * @param {Object} options - Upload options (e.g. { folder: "fexa/products" })
 * @returns {Promise<Array<Object>>} Resolves to array of Cloudinary upload results
 */
export const uploadMultipleToCloudinary = async (files, options = {}) => {
  if (!files || files.length === 0) return [];

  const successfulUploads = [];

  try {
    const uploadPromises = files.map(async (file) => {
      const result = await uploadToCloudinary(file.buffer, options);
      successfulUploads.push(result);
      return result;
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    // Rollback: delete all images that were successfully uploaded in this failed operation
    if (successfulUploads.length > 0) {
      console.warn(
        `[Cloudinary Rollback] Cleaning up ${successfulUploads.length} uploaded image(s) due to batch failure.`
      );
      await Promise.allSettled(
        successfulUploads.map((up) => deleteFromCloudinary(up.public_id))
      );
    }
    throw error;
  }
};

/**
 * Deletes an image from Cloudinary using its public_id or full URL.
 * Safely handles non-Cloudinary assets (e.g. local /uploads/ or external URLs) without failing.
 *
 * @param {string} publicIdOrUrl - The Cloudinary public ID or Cloudinary URL
 * @returns {Promise<Object>} Result of destruction or skipped status
 */
export const deleteFromCloudinary = async (publicIdOrUrl) => {
  if (!publicIdOrUrl || typeof publicIdOrUrl !== "string") {
    return { skipped: true, reason: "invalid_identifier" };
  }

  // Determine public ID
  let publicId = publicIdOrUrl;
  if (publicIdOrUrl.startsWith("http://") || publicIdOrUrl.startsWith("https://")) {
    if (!publicIdOrUrl.includes("res.cloudinary.com")) {
      return { skipped: true, reason: "not_a_cloudinary_url" };
    }
    publicId = extractPublicIdFromUrl(publicIdOrUrl);
    if (!publicId) {
      return { skipped: true, reason: "unable_to_extract_public_id" };
    }
  } else if (publicIdOrUrl.startsWith("/uploads/")) {
    return { skipped: true, reason: "local_disk_path" };
  }

  if (!isCloudinaryConfigured()) {
    console.warn(
      `[Cloudinary Deletion Skipped] Credentials not configured. Public ID: ${publicId}`
    );
    return { skipped: true, reason: "credentials_not_configured" };
  }

  try {
    const cloudinary = getCloudinaryInstance();
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
    return result;
  } catch (err) {
    // Non-fatal logging with safe information (no secrets)
    console.error(`[Cloudinary Deletion Error] Failed to delete asset '${publicId}':`, err.message);
    return { error: err.message, publicId };
  }
};

export default {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
};
