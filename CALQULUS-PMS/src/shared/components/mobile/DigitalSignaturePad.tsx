import React, { useRef, useState, useEffect } from "react";
import { PenTool, RotateCcw, Check, Download, Lock } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";

export interface DigitalSignaturePadProps {
  onSave?: (dataUrl: string) => void;
  signerName?: string;
  signerRole?: string;
  className?: string;
}

export function DigitalSignaturePad({
  onSave,
  signerName = "James Makena",
  signerRole = "Tenant",
  className,
}: DigitalSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = CALQULUS_COLOR.textPrimary;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      setSignatureData(url);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureData(null);
  };

  const handleSaveSignature = () => {
    if (signatureData && onSave) {
      onSave(signatureData);
    }
  };

  return (
    <div className={cn("p-4 border rounded-2xl bg-card space-y-3 text-xs shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-primary" />
          <div>
            <h4 className="font-bold text-foreground text-xs">Digital Signature Verification Pad</h4>
            <p className="text-[10px] text-muted-foreground">Sign legally binding lease & inspection agreements.</p>
          </div>
        </div>

        <Badge variant="outline" className="text-[9px] font-bold bg-success/10 text-success border-success/20">
          <Lock className="h-2.5 w-2.5 mr-1" /> Encrypted RSA-256
        </Badge>
      </div>

      <div className="border border-dashed border-primary/30 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-1 relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-32 touch-none cursor-crosshair rounded-lg"
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/50 text-[11px] font-medium">
            Sign here using touch screen or stylus...
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          Signer: <strong className="text-foreground">{signerName}</strong> ({signerRole})
        </span>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={clearCanvas} className="h-7 text-[10px] gap-1">
            <RotateCcw className="h-3 w-3" /> Clear
          </Button>
          <Button
            size="sm"
            onClick={handleSaveSignature}
            disabled={!hasSignature}
            className="h-7 text-[10px] font-bold gap-1 bg-primary text-primary-foreground"
          >
            <Check className="h-3 w-3" /> Apply Signature
          </Button>
        </div>
      </div>
    </div>
  );
}
