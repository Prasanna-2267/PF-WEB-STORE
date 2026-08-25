import dotenv from "dotenv";
dotenv.config({ path: "server/.env" });
import { getConfig } from "../server/src/config/env.js";
import { getStorageProvider } from "../server/src/integrations/provider-registry.js";
import { R2Service } from "../server/src/services/r2Service.js";

async function testR2() {
  console.log("Config loaded:", {
    driver: getConfig().storage.driver,
    endpoint: getConfig().storage.endpoint,
    bucket: getConfig().storage.bucket,
    accessKeyId: getConfig().storage.accessKeyId,
  });

  const provider = getStorageProvider();
  console.log("Storage provider initialized successfully.");

  const uploadIntent = await provider.createUploadUrl({
    academyId: "platform",
    objectKey: "test-connection/health-check.txt",
    mimeType: "text/plain",
    sizeBytes: 13,
    checksumSha256: "5d41402abc4b2a76b9719d911017c592",
  });

  console.log("Upload intent generated successfully:");
  console.log("Upload URL:", uploadIntent.uploadUrl);
  console.log("Expires At:", uploadIntent.expiresAt);

  console.log("Attempting direct upload to Cloudflare R2...");
  const res = await fetch(uploadIntent.uploadUrl, {
    method: "PUT",
    headers: uploadIntent.headers,
    body: "Health Check",
  });

  console.log("Cloudflare R2 PUT Response Status:", res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text();
    console.error("Cloudflare R2 Upload Failed:", text);
    process.exit(1);
  }

  console.log("Verifying object stat on R2...");
  const stat = await provider.statObject("test-connection/health-check.txt");
  console.log("R2 Stat result:", stat);

  console.log("Cleaning up test object from R2...");
  await provider.deleteObject("test-connection/health-check.txt");
  console.log("Test object deleted successfully!");

  console.log("SUCCESS: Cloudflare R2 is 100% operational!");
}

testR2().catch((err) => {
  console.error("R2 Test Failed:", err);
  process.exit(1);
});
