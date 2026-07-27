import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { openFileUrl } from "@/lib/storageUrls";
import { toast } from "sonner";
import { Upload, X, Loader2, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  bucket: string;
  folder: string;
  accept?: string;
  maxSizeMB?: number;
  currentUrl?: string;
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
  className?: string;
  variant?: "image" | "file";
  placeholder?: string;
}

export function FileUpload({
  bucket,
  folder,
  accept = "*/*",
  maxSizeMB = 5,
  currentUrl,
  onUploadComplete,
  onRemove,
  className,
  variant = "file",
  placeholder = "Choose a file",
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Failed to upload file");
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onUploadComplete(urlData.publicUrl);
      toast.success("File uploaded successfully");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("An error occurred during upload");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    onRemove?.();
  };

  const isImage = variant === "image";

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {currentUrl && isImage ? (
        <div className="group relative">
          <div className="h-32 w-full overflow-hidden rounded-lg border border-line bg-surface-2">
            <img
              src={currentUrl}
              alt="Uploaded preview"
              className="size-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          </div>
          {/* The overlay fades in on hover, but focus must reveal it too or the
              controls are invisible to a keyboard user standing on them. */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--ink))]/60 opacity-0 transition-opacity duration-fast ease-zh group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              Replace
            </Button>
            {onRemove && (
              <Button
                type="button"
                size="icon-sm"
                variant="destructive"
                onClick={handleRemove}
                aria-label="Remove this image"
              >
                <X className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      ) : currentUrl && !isImage ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <FileText className="size-8 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">File uploaded</p>
            <button
              type="button"
              onClick={() =>
                openFileUrl(currentUrl).catch(() => toast.error("Could not open file"))
              }
              className="block truncate text-[13px] text-accent-text hover:underline focus-visible:underline focus-visible:outline-none"
            >
              View file
            </button>
          </div>
          {/* Both of these were icon-only buttons with no accessible name, so a
              screen reader announced two anonymous buttons on every upload. */}
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              aria-label="Replace this file"
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
            </Button>
            {onRemove && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={handleRemove}
                aria-label="Remove this file"
              >
                <X className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Was a bare <div onClick> — not focusable, not announced, and not
           operable by keyboard at all. A real button carries all three. */
        <button
          type="button"
          onClick={() => !isUploading && inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "block w-full rounded-lg border-2 border-dashed border-line-2 p-6 text-center",
            "transition-colors duration-fast ease-zh",
            "hover:border-accent-line hover:bg-accent-wash",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isUploading && "cursor-not-allowed opacity-50",
          )}
        >
          {isUploading ? (
            <span className="flex flex-col items-center gap-2">
              <Loader2 className="size-8 animate-spin text-ink-3" aria-hidden />
              <span className="text-sm text-ink-2">Uploading…</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2">
              {isImage ? (
                <ImageIcon className="size-8 text-ink-3" aria-hidden />
              ) : (
                <Upload className="size-8 text-ink-3" aria-hidden />
              )}
              <span className="text-sm text-ink-2">{placeholder}</span>
              <span className="text-[13px] text-ink-3">
                Max size: <span className="font-data">{maxSizeMB}</span>MB
              </span>
            </span>
          )}
        </button>
      )}
    </div>
  );
}