import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// S3-compatible storage service (works with AWS S3, Cloudflare R2, etc.)
export class S3StorageService {
  private client: S3Client | null = null;
  private bucket: string | null = null;
  private useLocalStorage: boolean = true;
  private localStorageDir: string = "./uploads";

  constructor() {
    // Check if S3 configuration is available
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const region = process.env.S3_REGION || "auto";

    if (endpoint && bucket && accessKeyId && secretAccessKey) {
      // Use S3/R2 storage
      this.client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        // For R2 compatibility
        forcePathStyle: true,
      });
      this.bucket = bucket;
      this.useLocalStorage = false;
      console.log("S3 storage configured for bucket:", bucket);
    } else {
      // Fallback to local storage
      this.localStorageDir = process.env.STORAGE_DIR || "./uploads";
      if (!fs.existsSync(this.localStorageDir)) {
        fs.mkdirSync(this.localStorageDir, { recursive: true });
      }
      console.log("Using local storage at:", this.localStorageDir);
    }
  }

  // Generate a presigned URL for file upload
  async getUploadUrl(fileName: string, contentType: string): Promise<{ url: string; key: string }> {
    const key = `uploads/${randomUUID()}-${fileName}`;

    if (this.useLocalStorage) {
      // For local storage, return a direct upload endpoint
      return {
        url: `/api/upload/local/${key}`,
        key,
      };
    }

    // Generate presigned URL for S3/R2
    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client!, command, { expiresIn: 3600 });
    return { url, key };
  }

  // Save file locally (for local storage mode)
  async saveLocal(key: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(this.localStorageDir, key);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, buffer);
  }

  // Get file from storage
  async getFile(key: string): Promise<Buffer> {
    if (this.useLocalStorage) {
      const filePath = path.join(this.localStorageDir, key);
      if (!fs.existsSync(filePath)) {
        throw new Error("File not found");
      }
      return fs.readFileSync(filePath);
    }

    // Get from S3/R2
    const command = new GetObjectCommand({
      Bucket: this.bucket!,
      Key: key,
    });

    const response = await this.client!.send(command);
    const chunks: Uint8Array[] = [];
    
    if (response.Body) {
      const stream = response.Body as any;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    }
    
    return Buffer.concat(chunks);
  }

  // Check if file exists
  async fileExists(key: string): Promise<boolean> {
    if (this.useLocalStorage) {
      const filePath = path.join(this.localStorageDir, key);
      return fs.existsSync(filePath);
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      });
      await this.client!.send(command);
      return true;
    } catch {
      return false;
    }
  }

  // Get download URL
  async getDownloadUrl(key: string): Promise<string> {
    if (this.useLocalStorage) {
      return `/api/files/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket!,
      Key: key,
    });

    return await getSignedUrl(this.client!, command, { expiresIn: 3600 });
  }

  isUsingS3(): boolean {
    return !this.useLocalStorage;
  }
}

// Export singleton instance
export const storageService = new S3StorageService();