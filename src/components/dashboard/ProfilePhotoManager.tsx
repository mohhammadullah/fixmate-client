"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api";
import ProfileAvatar from "@/components/ui/ProfileAvatar";

/**
 * Profile photo manager — own-account avatar upload/replace/remove.
 *
 * The image is uploaded as multipart/form-data to POST /api/users/me/image,
 * which validates it server-side (JPEG/PNG/WebP, ≤5 MB, magic bytes), streams
 * it to ImgBB with the server-held key, and stores the hosted URL on the
 * Better Auth `user` record. DELETE /api/users/me/image clears it. Both
 * endpoints identify the caller exclusively from the verified JWT — there is
 * no way to target another account.
 *
 * The JWT is fetched per request and never stored/logged. After a successful
 * change the caller's `onImageChanged` refreshes the Better Auth session so
 * every avatar in the app updates immediately.
 */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

class PhotoError extends Error {}

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
    throw new PhotoError("Couldn't verify your session with FixMate. Check your connection and try again.");
  }
  if (response.error) {
    if (response.error.status === 401 || response.error.status === 403) {
      throw new PhotoError("Your session has expired. Sign in again to manage your photo.");
    }
    throw new PhotoError("We couldn't verify your session right now. Please try again.");
  }
  const data: unknown = response.data;
  if (!isRecord(data) || typeof data.token !== "string" || data.token.length === 0) {
    throw new PhotoError("The FixMate server returned an unexpected session-token response.");
  }
  return data.token;
}

/** XHR upload so real byte-level progress can be shown (fetch cannot report upload progress). */
function uploadWithProgress(
  token: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/users/me/image`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.withCredentials = true;
    xhr.timeout = 60_000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      let body: unknown = null;
      try { body = JSON.parse(xhr.responseText); } catch { body = null; }
      if (xhr.status >= 200 && xhr.status < 300 && isRecord(body) && body.success === true) {
        const image = isRecord(body.data) && typeof body.data.image === "string" && /^https?:\/\//i.test(body.data.image)
          ? body.data.image
          : null;
        resolve(image);
        return;
      }
      const message =
        isRecord(body) && typeof body.message === "string" && body.message.length <= 200
          ? body.message
          : "The photo couldn't be uploaded. Please try again.";
      reject(new PhotoError(message));
    };
    xhr.onerror = () => reject(new PhotoError("Couldn't reach the FixMate server. Check your connection and try again."));
    xhr.ontimeout = () => reject(new PhotoError("The upload timed out. Check your connection and try again."));

    const form = new FormData();
    form.append("image", file, file.name);
    xhr.send(form);
  });
}

async function removePhoto(): Promise<void> {
  const token = await fetchAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/users/me/image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
  } catch {
    throw new PhotoError("Couldn't reach the FixMate server. Check your connection and try again.");
  }
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok || !isRecord(body) || body.success !== true) {
    const message =
      isRecord(body) && typeof body.message === "string" && body.message.length <= 200
        ? body.message
        : "The photo couldn't be removed. Please try again.";
    throw new PhotoError(message);
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ProfilePhotoManagerProps {
  /** Currently saved image URL (e.g. from the session), or null when none. */
  image: string | null;
  name?: string | null;
  email?: string | null;
  /** Outer avatar classes — must include h-* and w-*. */
  avatarClassName?: string;
  /** Called after a successful upload (new hosted URL) or removal (null) so the parent can refresh the session/DTO. */
  onImageChanged: (image: string | null) => void | Promise<void>;
}

export default function ProfilePhotoManager({
  image,
  name,
  email,
  avatarClassName = "h-24 w-24 text-xl",
  onImageChanged,
}: ProfilePhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Release object URLs when replaced or unmounted.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const cleanImage = typeof image === "string" && /^https?:\/\//i.test(image.trim()) ? image.trim() : null;
  const busy = uploading || removing;
  const shownImage = preview ?? cleanImage;

  function clearSelection() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    setSelectedFile(null);
    setSelectedName(null);
    setProgress(0);
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

  /** Preview a locally selected file — nothing is uploaded until confirmed. */
  function handleFile(file: File | undefined | null) {
    if (!file || busy) return;
    const problem = validate(file);
    if (problem) {
      clearSelection();
      setLocalError(problem);
      toast.error(problem);
      return;
    }
    clearSelection();
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreview(objectUrl);
    setSelectedFile(file);
    setSelectedName(file.name);
    setLocalError(null);
    setConfirmingRemove(false);
  }

  async function save() {
    if (!selectedFile || inFlightRef.current) return;
    const file = selectedFile;
    inFlightRef.current = true;
    setUploading(true);
    setProgress(0);
    setLocalError(null);
    try {
      const token = await fetchAccessToken();
      const imageUrl = await uploadWithProgress(token, file, setProgress);
      clearSelection();
      // The photo is saved server-side already — a session refresh hiccup
      // must not read as an upload failure.
      try { await onImageChanged(imageUrl); } catch { /* non-fatal */ }
      toast.success("Profile photo updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photo couldn't be uploaded. Please try again.";
      setLocalError(message);
      toast.error(message);
    } finally {
      inFlightRef.current = false;
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmRemove() {
    if (inFlightRef.current || removing) return;
    inFlightRef.current = true;
    setRemoving(true);
    setLocalError(null);
    try {
      await removePhoto();
      clearSelection();
      setConfirmingRemove(false);
      try { await onImageChanged(null); } catch { /* non-fatal — the removal already succeeded */ }
      toast.success("Profile photo removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photo couldn't be removed. Please try again.";
      setLocalError(message);
      toast.error(message);
    } finally {
      inFlightRef.current = false;
      setRemoving(false);
    }
  }

  const hasPhoto = cleanImage !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4">
        <ProfileAvatar
          image={shownImage}
          name={name}
          email={email}
          className={`${avatarClassName} border-4 border-surface shadow-lg`}
        />
        {uploading && (
          <span role="status" className="mb-1.5 inline-flex items-center gap-2 text-[11px] font-medium text-accent-strong dark:text-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
            Saving… {progress}%
          </span>
        )}
      </div>

      {/* Hidden-but-focusable file input */}
      <input
        ref={inputRef}
        id="profile-photo-input"
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        disabled={busy || preview !== null}
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        aria-label="Choose a profile photo"
        className="sr-only"
      />

      {preview ? (
        <div className="space-y-2">
          <p className="text-[11px] leading-snug text-muted">
            Previewing <span className="font-semibold text-heading">{selectedName}</span>
            {selectedFile ? ` · ${formatSize(selectedFile.size)}` : ""} — not saved yet.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              aria-live="polite"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? `Saving… ${progress}%` : "Save photo"}
            </button>
            <button
              type="button"
              onClick={() => { clearSelection(); setLocalError(null); }}
              disabled={uploading}
              className="cursor-pointer rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-all duration-200 enabled:hover:bg-surface-muted enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
          {uploading && (
            <div role="progressbar" aria-label="Uploading photo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-accent-500 transition-[width] duration-150" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      ) : confirmingRemove ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-heading">Remove your profile photo?</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void confirmRemove()}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-error px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 enabled:hover:opacity-90 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {removing ? "Removing…" : "Remove photo"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              disabled={removing}
              className="cursor-pointer rounded-full border border-border px-4 py-2 text-xs font-semibold text-heading transition-all duration-200 enabled:hover:bg-surface-muted enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Keep photo
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 enabled:hover:bg-primary-hover enabled:hover:shadow-md enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></svg>
            {hasPhoto ? "Change photo" : "Upload photo"}
          </button>
          {hasPhoto && (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              disabled={busy}
              className="cursor-pointer rounded-full border border-error/40 px-4 py-2 text-xs font-semibold text-error transition-all duration-200 enabled:hover:bg-error-soft enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {localError && (
        <p role="alert" className="max-w-xs text-[11px] font-medium leading-snug text-error">{localError}</p>
      )}
      <p className="text-[10px] leading-snug text-muted">JPEG, PNG or WebP · up to 5 MB. Shown on your public reviews and across your dashboard.</p>
    </div>
  );
}
