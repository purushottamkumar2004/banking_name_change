// backend/src/storage/s3.js
// S3-compatible storage using MinIO locally or real AWS S3 in production.
// Handles document upload and pre-signed URL generation.

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const client = new S3Client({
  endpoint:         process.env.S3_ENDPOINT  || 'http://localhost:9000',
  region:           process.env.S3_REGION    || 'us-east-1',
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  // Required for MinIO path-style addressing
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || 'name-change-docs';

/**
 * Upload a file buffer to S3/MinIO.
 * Returns the S3 key (path) of the uploaded object.
 */
async function uploadDocument(requestId, fileBuffer, originalName, mimeType) {
  const ext  = path.extname(originalName) || '.bin';
  const key  = `documents/${requestId}/original${ext}`;

  await client.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        fileBuffer,
    ContentType: mimeType || 'application/octet-stream',
    Metadata: {
      request_id:    requestId,
      original_name: originalName,
    },
  }));

  return key;
}

/**
 * Store extracted JSON alongside the document.
 */
async function uploadExtractedJSON(requestId, data) {
  const key = `documents/${requestId}/extracted.json`;

  await client.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }));

  return key;
}

/**
 * Generate a pre-signed URL valid for 1 hour (for document preview).
 */
async function getPresignedUrl(key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

module.exports = { uploadDocument, uploadExtractedJSON, getPresignedUrl };
