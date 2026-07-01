"use client";

import { useState, useRef } from "react";
import { ImageSearchModal } from "./ImageSearchModal";

interface ImageUploaderProps {
  imageUrl?: string;
  onImageChange: (url: string) => void;
  label?: string;
  searchQuery?: string;
}

const MAX_WIDTH = 400;
const MAX_HEIGHT = 300;
const COMPRESSION_QUALITY = 0.8;

export function ImageUploader({
  imageUrl,
  onImageChange,
  label = "Product image (optional)",
  searchQuery = "",
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      compressImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

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
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL("image/jpeg", COMPRESSION_QUALITY);
        onImageChange(compressedUrl);
      }
    };
    img.src = dataUrl;
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
              onClick={() => onImageChange("")}
              className="text-sm text-critical hover:text-critical/80 mt-1"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Drag-Drop Zone */}
      {!imageUrl && (
        <div
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
            <div className="text-sm font-medium text-text">Drag image here</div>
            <div className="text-xs text-text-muted">
              PNG or JPG — or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline"
              >
                browse
              </button>
              {" "}or{" "}
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-primary hover:underline"
              >
                search images
              </button>
            </div>
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

      {/* Image Search Modal (Open Food Facts) */}
      <ImageSearchModal
        isOpen={showModal}
        initialQuery={searchQuery}
        onClose={() => setShowModal(false)}
        onSelectImage={(dataUrl) => {
          // Modal already returns a base64 data URL; compress to keep it small
          compressImage(dataUrl);
          setShowModal(false);
        }}
      />
    </div>
  );
}
