import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import path from "path";

import { s3Client, AWS_S3_BUCKET } from "../config/s3.js";

// Upload a single image to AWS S3
const uploadToS3 = async (buffer, options = {}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Invalid image buffer.");
  }

  const {
    folder = "uploads",
    contentType = "image/jpeg",
    originalName = "",
  } = options;

  const extension = path.extname(originalName).toLowerCase();

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  const safeExtension = allowedExtensions.includes(extension)
    ? extension
    : ".jpg";

  const fileName = `${randomUUID()}${safeExtension}`;
  const key = `${folder}/${fileName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    })
  );

  return {
    key,
    bucket: AWS_S3_BUCKET,
    contentType,
  };
};

// Upload multiple images to AWS S3
const uploadMultipleToS3 = async (files, options = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const uploadedImages = [];

  try {
    for (const file of files) {
      const result = await uploadToS3(file.buffer, {
        folder: options.folder || "uploads/products",
        contentType: file.mimetype,
        originalName: file.originalname,
      });

      uploadedImages.push(result);
    }

    return uploadedImages;
  } catch (error) {
    // Roll back successfully uploaded images if another upload fails
    await Promise.allSettled(
      uploadedImages.map((image) => deleteFromS3(image.key))
    );

    throw error;
  }
};

// Generate a temporary URL for displaying a private S3 image
const getSignedImageUrl = async (key, expiresIn = 3600) => {
  if (!key || typeof key !== "string" || key.startsWith("http")) {
    throw new Error("A valid S3 object key is required.");
  }

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
    }),
    { expiresIn }
  );
};

// Delete an S3 image using its object key
const deleteFromS3 = async (key) => {
  if (!key || typeof key !== "string" || key.startsWith("http")) {
    return;
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
      })
    );
  } catch (error) {
    // Specifically handle AWS AccessDenied when IAM policy intentionally omits s3:DeleteObject
    const isAccessDenied =
      error.name === "AccessDenied" ||
      error.Code === "AccessDenied" ||
      error.name === "Forbidden";

    if (isAccessDenied) {
      console.warn(
        `[S3 Service] Non-critical delete skip for key "${key}" (AccessDenied: IAM policy intentionally omits s3:DeleteObject).`
      );
      return;
    }

    // All other errors (unidentified 403, network errors, 5xx server errors, etc.) must be logged and rethrown
    console.error(`[S3 Service] Unexpected error deleting S3 key "${key}":`, error);
    throw error;
  }
};

export {
  uploadToS3,
  uploadMultipleToS3,
  getSignedImageUrl,
  deleteFromS3,
};