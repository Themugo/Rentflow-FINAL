import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/shared/components/ui/button";
import { Slider } from "@/shared/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface ImageCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedImageBlob: Blob) => void;
  aspectRatio?: number;
}

// Helper function to create cropped image
const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas is empty"));
        }
      },
      "image/jpeg",
      0.9
    );
  });
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });

export function ImageCropper({
  image,
  open,
  onClose,
  onCropComplete,
  aspectRatio = 16 / 9,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropAreaComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedImage = await createCroppedImage(image, croppedAreaPixels);
      onCropComplete(croppedImage);
      onClose();
    } catch (error) {
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogDescription>
            Drag to reposition and use the slider to zoom. Click "Apply" when done.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[300px] bg-muted rounded-lg overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
            classes={{
              containerClassName: "rounded-lg",
            }}
          />
        </div>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-4">
            <Label className="w-16 text-sm">Zoom</Label>
            <div className="flex items-center gap-2 flex-1">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(values) => setZoom(values[0])}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Apply Crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
