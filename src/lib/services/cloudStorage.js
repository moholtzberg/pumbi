/**
 * Cloud Storage Service
 * Supports multiple cloud storage providers (S3, Cloudinary, etc.)
 * Configure via environment variables
 */

import { env } from '$env/dynamic/private';

// Read storage provider dynamically to ensure env vars are loaded
function getStorageProvider() {
  return env.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER || 'local'; // 'local', 's3', 'cloudinary'
}

export function getStorageProviderName() {
  return getStorageProvider();
}

/**
 * Upload a file buffer to cloud storage
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} folder - Folder path in storage (e.g., 'lots')
 * @param {string} contentType - Validated MIME type supplied by the server
 * @returns {Promise<{url: string, key: string}>} - Uploaded file URL and storage key
 */
export async function uploadFile(buffer, filename, folder = 'lots', contentType = null) {
  const provider = getStorageProvider();
  
  switch (provider) {
    case 's3':
      return await uploadToS3(buffer, filename, folder, contentType);
    case 'cloudinary':
      return await uploadToCloudinary(buffer, filename, folder);
    case 'local':
    default:
      return await uploadToLocal(buffer, filename, folder);
  }
}

/**
 * Delete a file from cloud storage
 * @param {string} key - Storage key/identifier
 * @param {string} folder - Folder path
 * @returns {Promise<void>}
 */
export async function deleteFile(key, folder = 'lots') {
  const provider = getStorageProvider();
  switch (provider) {
    case 's3':
      return await deleteFromS3(key, folder);
    case 'cloudinary':
      return await deleteFromCloudinary(key);
    case 'local':
    default:
      return await deleteFromLocal(key, folder);
  }
}

/**
 * Get a presigned URL for accessing a private S3 object
 * @param {string} key - Storage key/identifier
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const provider = getStorageProvider();
  if (provider === 's3') {
    return await getS3PresignedUrl(key, expiresIn);
  }
  // For local or cloudinary, return the URL as-is
  return key.startsWith('http') ? key : `/uploads/${key}`;
}

// ===== S3 Implementation =====

// DigitalOcean Spaces region identifiers (non-AWS regions)
const DO_REGIONS = new Set(['nyc3', 'nyc2', 'ams3', 'sgp1', 'lon1', 'fra1', 'tor1', 'blr1', 'sfo2', 'sfo3', 'syd1']);

/**
 * Build S3Client config, with DigitalOcean Spaces endpoint support.
 * The endpoint is resolved in this order:
 *   1. DO_SPACES_ENDPOINT env var (explicit override)
 *   2. Auto-constructed from AWS_REGION when it is a known DO region (e.g. nyc3)
 *   3. Standard AWS S3 (no endpoint override)
 */
function getS3Config() {
  const accessKeyId = env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET;
  const region = env.AWS_REGION || process.env.AWS_REGION || 'us-east-1';

  let endpoint = env.DO_SPACES_ENDPOINT || process.env.DO_SPACES_ENDPOINT || null;

  // Auto-detect DigitalOcean Spaces: if the region is a DO region and no explicit
  // endpoint was provided, construct the endpoint automatically so that the AWS SDK
  // does not try to reach <bucket>.s3.<do-region>.amazonaws.com (which does not exist).
  if (!endpoint && DO_REGIONS.has(region)) {
    endpoint = `https://${region}.digitaloceanspaces.com`;
  }

  const clientConfig = {
    region,
    credentials: { accessKeyId, secretAccessKey }
  };

  if (endpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.forcePathStyle = false; // DigitalOcean uses virtual-hosted-style URLs
  }

  return { accessKeyId, secretAccessKey, bucket, region, endpoint, clientConfig };
}

async function uploadToS3(buffer, filename, folder, contentTypeOverride = null) {
  try {
    const { accessKeyId, secretAccessKey, bucket, clientConfig } = getS3Config();
    
    if (!accessKeyId || !secretAccessKey || !bucket) {
      console.error('S3 Configuration Check:');
      console.error('  STORAGE_PROVIDER:', env.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER);
      console.error('  AWS_ACCESS_KEY_ID:', accessKeyId ? '***SET***' : 'NOT SET');
      console.error('  AWS_SECRET_ACCESS_KEY:', secretAccessKey ? '***SET***' : 'NOT SET');
      console.error('  AWS_S3_BUCKET:', bucket || 'NOT SET');
      throw new Error('Missing required S3 configuration: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET must be set');
    }
    
    // Install: npm install @aws-sdk/client-s3
    // Lazy import to prevent Vite from analyzing at build time
    const s3Package = '@aws-sdk/client-s3';
    const s3Module = await import(/* @vite-ignore */ s3Package).catch(() => {
      throw new Error('@aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3');
    });
    const { S3Client, PutObjectCommand } = s3Module;
    
    const s3Client = new S3Client(clientConfig);

    const ext = filename.split('.').pop() || 'jpg';
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    // Determine content type based on file extension
    let contentType = contentTypeOverride;
    if (!contentType && (folder === 'voice-notes' || ['mp3', 'wav', 'webm', 'ogg', 'm4a', 'aac'].includes(ext.toLowerCase()))) {
      // Audio files
      contentType = `audio/${ext === 'mp3' ? 'mpeg' : ext === 'm4a' ? 'mp4' : ext}`;
    } else if (!contentType) {
      // Image files (default)
      contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
      // Note: ACL is deprecated. Use bucket policy for public access or presigned URLs for private access
    }));

    // Store the S3 key - we'll generate presigned URLs when serving images
    // The URL will be generated on-demand via the presigned URL endpoint
    const url = key; // Store just the key, will be converted to presigned URL when needed
    return { url, key };
  } catch (error) {
    if (error.message.includes('not installed')) {
      throw error;
    }
    console.error('S3 upload error:', {
      name: error?.name,
      code: error?.Code,
      message: error?.message,
      status: error?.$metadata?.httpStatusCode
    });
    if (error?.name === 'InvalidAccessKeyId' || error?.Code === 'InvalidAccessKeyId') {
      throw new Error('S3 rejected the configured access key');
    }
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

async function deleteFromS3(key, folder) {
  try {
    const { accessKeyId, secretAccessKey, bucket, clientConfig } = getS3Config();
    
    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('Missing required S3 configuration: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET must be set');
    }
    
    // Lazy import to prevent Vite from analyzing at build time
    const s3Package = '@aws-sdk/client-s3';
    const s3Module = await import(/* @vite-ignore */ s3Package).catch(() => {
      throw new Error('@aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3');
    });
    const { S3Client, DeleteObjectCommand } = s3Module;
    
    const s3Client = new S3Client(clientConfig);

    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    }));
  } catch (error) {
    if (error.message.includes('not installed')) {
      throw error;
    }
    console.error('S3 delete error:', error);
    throw new Error(`S3 delete failed: ${error.message}`);
  }
}

async function getS3PresignedUrl(key, expiresIn = 3600) {
  try {
    const { accessKeyId, secretAccessKey, bucket, clientConfig } = getS3Config();
    
    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('Missing required S3 configuration');
    }
    
    // Lazy import to prevent Vite from analyzing at build time
    const s3Package = '@aws-sdk/client-s3';
    const s3Module = await import(/* @vite-ignore */ s3Package).catch(() => {
      throw new Error('@aws-sdk/client-s3 is not installed');
    });
    const { S3Client, GetObjectCommand } = s3Module;
    
    // Import presigner package
    let getSignedUrl;
    try {
      const presignerModule = await import(/* @vite-ignore */ '@aws-sdk/s3-request-presigner');
      getSignedUrl = presignerModule.getSignedUrl;
      if (!getSignedUrl) {
        throw new Error('getSignedUrl not found in @aws-sdk/s3-request-presigner');
      }
    } catch (error) {
      if (error.message.includes('not installed') || error.message.includes('Cannot find module')) {
        throw new Error('@aws-sdk/s3-request-presigner is not installed. Run: npm install @aws-sdk/s3-request-presigner');
      }
      throw error;
    }
    
    const s3Client = new S3Client(clientConfig);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('S3 presigned URL error:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

// ===== Cloudinary Implementation =====
async function uploadToCloudinary(buffer, filename, folder) {
  try {
    // Install: npm install cloudinary
    // Lazy import to prevent Vite from analyzing at build time
    const cloudinaryPackage = 'cloudinary';
    const cloudinaryModule = await import(/* @vite-ignore */ cloudinaryPackage).catch(() => {
      throw new Error('cloudinary is not installed. Run: npm install cloudinary');
    });
    const cloudinary = cloudinaryModule.v2;
    
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'image'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve({ url: result.secure_url, key: result.public_id });
        }
      ).end(buffer);
    });
  } catch (error) {
    if (error.message.includes('not installed')) {
      throw error;
    }
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
}

async function deleteFromCloudinary(key) {
  try {
    // Lazy import to prevent Vite from analyzing at build time
    const cloudinaryPackage = 'cloudinary';
    const cloudinaryModule = await import(/* @vite-ignore */ cloudinaryPackage).catch(() => {
      throw new Error('cloudinary is not installed. Run: npm install cloudinary');
    });
    const cloudinary = cloudinaryModule.v2;
    
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    await cloudinary.uploader.destroy(key);
  } catch (error) {
    if (error.message.includes('not installed')) {
      throw error;
    }
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
}

// ===== Local Storage Implementation =====
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

async function uploadToLocal(buffer, filename, folder) {
  const uploadDir = join(process.cwd(), 'static', 'uploads', folder);
  await mkdir(uploadDir, { recursive: true });

  const ext = filename.split('.').pop() || 'jpg';
  const uniqueFilename = `${randomBytes(16).toString('hex')}.${ext}`;
  const filepath = join(uploadDir, uniqueFilename);

  await writeFile(filepath, buffer);
  
  const url = `/uploads/${folder}/${uniqueFilename}`;
  const key = `${folder}/${uniqueFilename}`;
  
  return { url, key };
}

async function deleteFromLocal(key, folder) {
  const filepath = join(process.cwd(), 'static', 'uploads', key);
  try {
    await unlink(filepath);
  } catch (error) {
    // File might not exist, ignore
    console.warn('File not found for deletion:', filepath);
  }
}
