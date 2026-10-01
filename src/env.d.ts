/**
 * Cloudflare Worker type declarations (minimal, Workers-safe — no
 * @cloudflare/workers-types dependency needed for these surfaces).
 */

interface D1ResultMeta {
  changes?: number;
  last_row_id?: number | string;
  rows_read?: number;
  rows_written?: number;
  duration?: number;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1ResultMeta>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1ResultMeta[]>;
  exec(query: string): Promise<unknown>;
}

interface R2HTTPMetadata {
  contentType?: string;
  [key: string]: unknown;
}

interface R2ObjectBody {
  readonly body: ReadableStream;
  readonly httpMetadata: R2HTTPMetadata;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream | Blob,
    options?: { httpMetadata?: R2HTTPMetadata },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

interface Env {
  DB?: D1Database;
  IMAGES?: R2Bucket;
  [key: string]: unknown;
}

declare namespace App {
  interface Locals {
    runtime?: { env?: Env };
    user?: import('./lib/session').SessionUser | null;
    googleEnabled?: boolean;
  }
}
