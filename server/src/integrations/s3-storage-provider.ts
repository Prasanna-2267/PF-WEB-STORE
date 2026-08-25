import { createHash, createHmac } from "node:crypto";
import type { StorageProvider, UploadIntent } from "./storage-provider.js";

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  signedUrlTtlSeconds: number;
}

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const hmac = (key: string | Buffer, value: string) => createHmac("sha256", key).update(value).digest();
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const encodePath = (value: string) => value.split("/").map(encode).join("/");
const amzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

export class S3StorageProvider implements StorageProvider {
  readonly #config: S3Config;
  readonly #endpoint: URL;

  constructor(config: S3Config) {
    this.#config = config;
    this.#endpoint = new URL(config.endpoint);
    if (!/^https?:$/.test(this.#endpoint.protocol)) throw new Error("Storage endpoint must use HTTP(S).");
  }

  #objectUrl(objectKey: string) {
    const basePath = this.#endpoint.pathname.replace(/\/$/, "");
    return new URL(`${basePath}/${encode(this.#config.bucket)}/${encodePath(objectKey)}`, this.#endpoint.origin);
  }

  #signingKey(shortDate: string) {
    const dateKey = hmac(`AWS4${this.#config.secretAccessKey}`, shortDate);
    const regionKey = hmac(dateKey, this.#config.region);
    const serviceKey = hmac(regionKey, "s3");
    return hmac(serviceKey, "aws4_request");
  }

  #presign(method: string, objectKey: string, expiresInSeconds: number, signedHeaders: Record<string, string> = {}) {
    const now = new Date();
    const timestamp = amzDate(now);
    const shortDate = timestamp.slice(0, 8);
    const scope = `${shortDate}/${this.#config.region}/s3/aws4_request`;
    const url = this.#objectUrl(objectKey);
    const headers = { host: url.host, ...Object.fromEntries(Object.entries(signedHeaders).map(([key, value]) => [key.toLowerCase(), value.trim()])) };
    const headerNames = Object.keys(headers).sort();
    url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    url.searchParams.set("X-Amz-Credential", `${this.#config.accessKeyId}/${scope}`);
    url.searchParams.set("X-Amz-Date", timestamp);
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    url.searchParams.set("X-Amz-SignedHeaders", headerNames.join(";"));
    const canonicalQuery = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&");
    const canonicalHeaders = headerNames.map((name) => `${name}:${headers[name as keyof typeof headers]}\n`).join("");
    const canonicalRequest = [method, url.pathname, canonicalQuery, canonicalHeaders, headerNames.join(";"), "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, sha256(canonicalRequest)].join("\n");
    url.searchParams.set("X-Amz-Signature", createHmac("sha256", this.#signingKey(shortDate)).update(stringToSign).digest("hex"));
    return url.toString();
  }

  #authorization(method: string, url: URL, headers: Record<string, string>, payloadHash: string) {
    const now = new Date();
    const timestamp = amzDate(now);
    const shortDate = timestamp.slice(0, 8);
    const scope = `${shortDate}/${this.#config.region}/s3/aws4_request`;
    const allHeaders: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": timestamp, ...headers };
    const headerNames = Object.keys(allHeaders).map((key) => key.toLowerCase()).sort();
    const canonicalHeaders = headerNames.map((name) => `${name}:${allHeaders[name]}\n`).join("");
    const canonicalRequest = [method, url.pathname, url.searchParams.toString(), canonicalHeaders, headerNames.join(";"), payloadHash].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, sha256(canonicalRequest)].join("\n");
    const signature = createHmac("sha256", this.#signingKey(shortDate)).update(stringToSign).digest("hex");
    return { ...allHeaders, authorization: `AWS4-HMAC-SHA256 Credential=${this.#config.accessKeyId}/${scope}, SignedHeaders=${headerNames.join(";")}, Signature=${signature}` };
  }

  async #request(method: string, objectKey: string, headers: Record<string, string> = {}) {
    const url = this.#objectUrl(objectKey);
    const signed = this.#authorization(method, url, headers, sha256(""));
    const response = await fetch(url, { method, headers: signed });
    if (!response.ok) throw new Error(`Storage provider ${method} failed with HTTP ${response.status}.`);
    return response;
  }

  async createUploadUrl(intent: UploadIntent) {
    const expiresAt = new Date(Date.now() + this.#config.signedUrlTtlSeconds * 1_000);
    const headers = { "content-type": intent.mimeType, "x-amz-meta-sha256": intent.checksumSha256 };
    return { uploadUrl: this.#presign("PUT", intent.objectKey, this.#config.signedUrlTtlSeconds, headers), expiresAt, headers };
  }

  async createDownloadUrl(objectKey: string, expiresInSeconds: number) {
    return this.#presign("GET", objectKey, expiresInSeconds);
  }

  async statObject(objectKey: string) {
    const response = await this.#request("HEAD", objectKey, { "accept-encoding": "identity" });
    const rawLength = response.headers.get("content-length") ?? response.headers.get("x-amz-meta-size-bytes");
    return {
      sizeBytes: Number(rawLength ?? "0"),
      mimeType: response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream",
      checksumSha256: response.headers.get("x-amz-meta-sha256") ?? undefined,
    };
  }

  async deleteObject(objectKey: string): Promise<void> { await this.#request("DELETE", objectKey); }
  async copyObject(sourceObjectKey: string, destinationObjectKey: string): Promise<void> {
    await this.#request("PUT", destinationObjectKey, { "x-amz-copy-source": `/${this.#config.bucket}/${encodePath(sourceObjectKey)}` });
  }
  async putObject(objectKey: string, body: Buffer, mimeType: string, checksumSha256: string): Promise<void> {
    const url = this.#objectUrl(objectKey);
    const payloadHash = sha256(body);
    const headers = { "content-type": mimeType, "x-amz-meta-sha256": checksumSha256 };
    const signed = this.#authorization("PUT", url, headers, payloadHash);
    const payload = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    const response = await fetch(url, { method: "PUT", headers: signed, body: payload });
    if (!response.ok) throw new Error(`Storage provider PUT failed with HTTP ${response.status}.`);
  }
}
