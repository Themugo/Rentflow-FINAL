import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2, Crop } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { ImageCropper } from "./image-cropper";
import { useSignedStorageUrl } from "@/shared/hooks/useSignedStorageUrl";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  bucket: string;
  folder?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  aspectRatio?: number;
  enableCrop?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  bucket,
  folder = "",
  label = "Image",
  placeholder = "Upload an image or paste a URL",
  className = "",
  aspectRatio = 16 / 9,
  enableCrop = true,
}: ImageUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const previewUrl = useSignedStorageUrl(urlInput);

  useEffect(() => {
    setUrlInput(value);
  }, [value]);

  const uploadBlob = useCallback(async (blob: Blob, originalFileName?: string) => {
    setIsUploading(true);

    try {
      const fileExt = originalFileName?.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, {
          cacheControl: "3600",
          contentType: blob.type || undefined,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const storageReference = `${bucket}/${filePath}`;
      onChange(storageReference);
      setUrlInput(storageReference);
      toast({
        title: "Image uploaded",
        description: "Your image has been uploaded successfully.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload image";
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setPendingFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [bucket, folder, onChange, toast]);

  const processFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    if (enableCrop) {
      // Show cropper
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setPendingFile(file);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    } else {
      // Upload directly
      await uploadBlob(file, file.name);
    }
  }, [enableCrop, uploadBlob, toast]);

  const handleCropComplete = async (croppedBlob: Blob) => {
    setShowCropper(false);
    setImageToCrop(null);
    await uploadBlob(croppedBlob, pendingFile?.name);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
    setPendingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  }, [processFile]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrlInput(newUrl);
    onChange(newUrl);
  };

  const handleClear = () => {
    setUrlInput("");
    onChange("");
  };

  const handleEditCrop = () => {
    if (urlInput) {
      setImageToCrop(urlInput);
      setShowCropper(true);
    }
  };

  return (
    <>
      <div className={`grid gap-2 ${className}`}>
        {label && <Label>{label}</Label>}
        
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-colors",
            isDragging
              ? "border-primary/50 bg-primary/10"
              : "border-border hover:border-muted-foreground/50",
            isUploading && "pointer-events-none opacity-50"
          )}
        >
          {/* Drop overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/10">
              <div className="flex flex-col items-center gap-2 text-primary">
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">Drop image here</span>
              </div>
            </div>
          )}

          <div className="p-3 space-y-3">
            {/* URL input row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={urlInput}
                  onChange={handleUrlChange}
                  placeholder={placeholder}
                  className="bg-background border-border pr-8"
                />
                {urlInput && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Clear image URL"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={handleClear}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload image"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Preview or placeholder */}
            {urlInput ? (
              <div className="relative w-full h-24 rounded-md overflow-hidden border border-border bg-muted group">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                </div>
                {enableCrop && (
                  <div className="absolute inset-0 bg-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleEditCrop}
                      className="gap-1"
                    >
                      <Crop className="h-3 w-3" />
                      Crop
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="flex flex-col items-center justify-center py-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <ImageIcon className="h-8 w-8 mb-2" />
                <span className="text-xs">Drag & drop an image or click to browse</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cropper Dialog */}
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          open={showCropper}
          onClose={handleCropCancel}
          onCropComplete={handleCropComplete}
          aspectRatio={aspectRatio}
        />
      )}
    </>
  );
}
