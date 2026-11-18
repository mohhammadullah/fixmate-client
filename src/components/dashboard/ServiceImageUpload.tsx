"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Reusable service image upload (ImgBB via server proxy). The JWT is fetched per upload and never stored/logged. */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface UploadResponse {
  url: string;
  mime: string;
  size: number;
}

class UploadError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchAccessToken(): Promise<string> {
  let response: {
    data: unknown;
    error: null | ({ status: number } & Record<string, unknown>);
  };
  try {
    response = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
  } catch {
    throw new UploadError("Couldn't verify your session with FixMate. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new UploadError("Your session has expired. Sign in again to upload an image.");
    }
    throw new UploadError("We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new UploadError("The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

async function uploadImage(file: File): Promise<UploadResponse> {
  const token = await fetchAccessToken();
  const form = new FormData();
  form.append("image", file, file.name);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/uploads/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      body: form,
    });
  } catch {
    throw new UploadError("Couldn't reach the FixMate server. Check your connection and try again.");
  }

  let body: unknown = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === "string" && body.message.length <= 200
      ? body.message
      : "The image couldn't be uploaded. Please try again.";
    throw new UploadError(message);
  }
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    throw new UploadError("The server returned an unexpected upload response.");
  }
  const url = body.data.url;
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
    throw new UploadError("The image host didn't return a usable image URL.");
  }
  return {
    url,
    mime: typeof body.data.mime === "string" ? body.data.mime : file.type,
    size: typeof body.data.size === "number" ? body.data.size : file.size,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ServiceImageUploadProps {
  /** Currently saved/selected image URL. */
  value: string;
  /** Called with the uploaded URL (or "" when removed). */
  onChange: (url: string) => void;
  /** Disable all controls while the parent form is saving. */
  disabled?: boolean;
  /** Form-level image error, if any. */
  error?: string | null;
  /** Unique input id for label association and form focus wiring. */
  id?: string;
  /** "edit" keeps the saved image until replaced and hides the Remove action. */
  mode?: "add" | "edit";
}

export default function ServiceImageUpload({
  value,
  onChange,
  disabled = false,
  error = null,
  id = "service-image-upload",
  mode = "add",
}: ServiceImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (success === null) return;
    const timeout = window.setTimeout(() => setSuccess(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  // Release object URLs when replaced or unmounted.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const busy = disabled || uploading;
  const showSaved = value.trim().length > 0 && isHttpUrl(value) && !preview;

  function clearLocalSelection() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    setSelectedFile(null);
    setSelectedName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function validate(file: File): string | null {
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      return "Choose a JPEG, PNG or WebP image.";
    }
    if (file.size === 0) return "That file is empty.";
    if (file.size > MAX_BYTES) return "The image must be 5 MB or smaller.";
    return null;
  }

  /** Select a file locally only — no network request until "Upload image". */
  function handleFile(file: File | undefined | null) {
    if (!file || busy) return;
    const problem = validate(file);
    if (problem) {
      clearLocalSelection();
      setUploadError(problem);
      setSuccess(null);
      return;
    }

    clearLocalSelection();
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreview(objectUrl);
    setSelectedFile(file);
    setSelectedName(file.name);
    setUploadError(null);
    setSuccess(null);
  }

  /** Discard a newly selected file before uploading. Never touches `value`,
   *  so a saved image remains untouched. */
  function cancelSelection() {
    if (uploading) return;
    clearLocalSelection();
    setUploadError(null);
    setSuccess(null);
  }

  async function startUpload() {
    if (!selectedFile || busy || uploadInFlightRef.current) return;
    const file = selectedFile;
    uploadInFlightRef.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadImage(file);
      onChange(result.url);
      clearLocalSelection();
      setSuccess(`Uploaded ${file.name} (${formatSize(result.size)}).`);
      return;
    } catch (err) {
      // Keep the selection so the technician can retry or cancel it.
      setUploadError(err instanceof Error ? err.message : "The image couldn't be uploaded. Please try again.");
      return;
    } finally {
      uploadInFlightRef.current = false;
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    if (busy) return;
    clearLocalSelection();
    onChange("");
    setUploadError(null);
    setSuccess(null);
  }

  return (
    <div className="space-y-3">
      {/* Hidden-but-focusable file input with a labelled drop zone */}
      <label
        htmlFor={id}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition-colors duration-200 ${
          dragActive ? "border-accent-500 bg-accent-50/60 dark:bg-accent-400/10" : "border-border-strong bg-background"
        } ${busy ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-accent-500"}`}
        onDragEnter={(event) => { event.preventDefault(); if (!busy) setDragActive(true); }}
        onDragOver={(event) => { event.preventDefault(); if (!busy) setDragActive(true); }}
        onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (!busy) void handleFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          disabled={busy}
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          aria-describedby={`${id}-helper`}
          className="sr-only"
        />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-7 w-7 text-accent-strong dark:text-accent"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <span className="text-xs font-semibold text-heading">
          {uploading ? "Uploading image…" : "Choose an image or drop it here"}
        </span>
        <span className="text-[11px] text-muted">JPEG, PNG or WebP · up to 5 MB</span>
      </label>

      {/* Preview: a newly selected file (pre-upload) or the saved URL */}
      {(showSaved || preview) && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2">
          <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-navy-900">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview URLs are either local blob URLs or remote backend URLs not known at build time. */}
            <img src={preview ?? value} alt="Service image preview" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-heading">
              {preview ? selectedName : mode === "edit" ? "Current image — kept until replaced" : "Current service image"}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-muted">
              {preview ? "Selected locally — not uploaded yet" : value}
            </p>
          </div>
          {preview ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={cancelSelection}
                disabled={uploading}
                className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-heading transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void startUpload()}
                disabled={busy}
                className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Upload image"}
              </button>
            </div>
          ) : mode === "add" ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="shrink-0 rounded-full border border-error/40 px-3 py-1.5 text-[11px] font-semibold text-error transition-colors duration-200 hover:bg-error-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          ) : (
            <span className="shrink-0 text-[10px] font-medium text-muted">Replace via upload</span>
          )}
        </div>
      )}

      {uploading && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs font-medium text-accent-strong dark:text-accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none">
            <circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" />
          </svg>
          Uploading to the image host…
        </div>
      )}
      {success && !uploadError && <p role="status" className="text-xs font-medium text-success">{success}</p>}
      {(uploadError || error) && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-error">
          {uploadError ?? error}
        </p>
      )}
      <p id={`${id}-helper`} className="text-[11px] leading-snug text-muted">
        {mode === "edit"
          ? "Your current image is kept until you upload a replacement. Choose a file to preview it first, then confirm or cancel the upload."
          : "Choose a file to preview it first, then confirm or cancel the upload. The uploaded URL is saved with your service."}
      </p>
    </div>
  );
}
