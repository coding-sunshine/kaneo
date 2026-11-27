import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "./config";

function client(config: BackupConfig) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    // S3-compatible providers reject the SDK's default trailing checksums.
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function backupObjectKey(config: BackupConfig, name: string) {
  return config.keyPrefix ? `${config.keyPrefix}/${name}` : name;
}

/** Uploads the dump, then reads its size back so "offsite copy ok" is true. */
export async function uploadBackup(
  config: BackupConfig,
  key: string,
  filePath: string,
) {
  const { size } = await stat(filePath);
  const s3 = client(config);
  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: "application/gzip",
    }),
  );
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  return head.ContentLength === size;
}

export async function downloadBackup(
  config: BackupConfig,
  key: string,
  filePath: string,
) {
  const result = await client(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  if (!result.Body) throw new Error("Empty backup object");
  await pipeline(result.Body as Readable, createWriteStream(filePath));
}
