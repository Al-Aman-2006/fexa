import { S3Client } from "@aws-sdk/client-s3";

const AWS_REGION = process.env.AWS_REGION || "ap-south-1";

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "fexa-media-production";

const s3Client = new S3Client({
  region: AWS_REGION,
});

export { s3Client, AWS_S3_BUCKET, AWS_REGION };
