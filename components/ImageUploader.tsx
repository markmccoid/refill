"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ImageUploaderProps {
  imageUrl?: string;
  onImageChange: (url: string) => void;
  label?: string;
}

const MAX_WIDTH = 400;
const MAX_HEIGHT = 300;
const COMPRESSION_QUALITY = 0.8;

/** First http(s) URL in a text/uri-list payload (comment lines start with #). */
function firstHttpUrl(text: string): string | null {
  for (const line of text.split(/[\r\n]+/)) {
    const candidate = line.trim();
    if (!candidate || candidate.startsWith("#")) continue;
    if (/^https?:\/\//i.test(candidate)) return candidate;
  }
  return null;
}

export function ImageUploader({
  imageUrl,
  onImageChange,
  label = "Product image (optional)",
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback(
    (img: HTMLImageElement, fallbackUrl?: string) => {
      const canvas = document.createElement("canvas");
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // JPEG has no alpha; give transparent PNGs a white background, not black.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      try {
        onImageChange(canvas.toDataURL("image/jpeg", COMPRESSION_QUALITY));
      } catch {
        // Cross-origin image tainted the canvas — keep the remote URL as-is.
        if (fallbackUrl) onImageChange(fallbackUrl);
      }
    },
    [onImageChange]
  );

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => compressImage(img);
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [compressImage]
  );

  // Dragging an image from another page/tab hands us a URL, not a file.
  const handleUrl = useCallback(
    (url: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => compressImage(img, url);
      // CORS-blocked: store the URL itself, it still renders in <img>.
      img.onerror = () => onImageChange(url);
      img.src = url;
    },
    [compressImage, onImageChange]
  );

  const extractImage = useCallback(
    (dt: DataTransfer): boolean => {
      // Files first (Finder / Explorer). Safari sometimes only fills .items.
      let file: File | null = dt.files?.[0] ?? null;
      if (!file) {
        for (const item of Array.from(dt.items ?? [])) {
          if (item.kind === "file") {
            file = item.getAsFile();
            if (file) break;
          }
        }
      }
      if (file && file.type.startsWith("image/")) {
        handleFile(file);
        return true;
      }
      const url = firstHttpUrl(
        dt.getData("text/uri-list") || dt.getData("text/plain")
      );
      if (url) {
        handleUrl(url);
        return true;
      }
      return false;
    },
    [handleFile, handleUrl]
  );

  // Paste an image (e.g. a screenshot) anywhere on the page while empty.
  // Only image-file pastes are intercepted, so text pastes into inputs
  // keep working untouched.
  useEffect(() => {
    if (imageUrl) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find(
        (i) => i.kind === "file" && i.type.startsWith("image/")
      );
      const file = imageItem?.getAsFile();
      if (file) {
        e.preventDefault();
        handleFile(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [imageUrl, handleFile]);

  // Safari needs preventDefault on dragenter as well as dragover for a
  // drop target to be valid — without it drops silently do nothing on mac.
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    extractImage(e.dataTransfer);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const applyUrlDraft = () => {
    const url = urlDraft.trim();
    if (!url) return;
    handleUrl(url);
    setUrlDraft("");
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-text-label">{label}</label>

      {/* Image Preview */}
      {imageUrl && (
        <div className="flex items-center gap-3">
          <div className="relative w-24 h-24 flex-shrink-0 bg-surface-alt rounded-lg overflow-hidden border border-black/10">
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-text-muted">Image added</p>
            <button
              type="button"
              onClick={() => onImageChange("")}
              className="text-sm text-critical hover:text-critical/80 mt-1"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Drag / paste / browse zone */}
      {!imageUrl && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary-light/30"
              : "border-black/20 bg-surface-alt hover:border-primary/50"
          }`}
        >
          <div className="space-y-2">
            <div className="text-sm font-medium text-text">
              Drag an image here, or paste one (Ctrl/Cmd+V)
            </div>
            <div className="text-xs text-text-muted">
              PNG or JPG — or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline"
              >
                browse
              </button>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <input
              type="url"
              placeholder="…or paste an image URL"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyUrlDraft();
                }
              }}
              className="flex-1 px-3 py-1.5 border border-black/16 rounded-lg text-sm"
            />
            <button
              type="button"
              onClick={applyUrlDraft}
              disabled={!urlDraft.trim()}
              className="btn-outline text-sm py-1.5 disabled:opacity-50"
            >
              Use URL
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
