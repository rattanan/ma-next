"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Copy, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Detector = { detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

export function AssetQrDialog({ assetId, assetCode }: { assetId: string; assetCode: string }) {
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const detailUrl = typeof window === "undefined" ? `/assets/${assetId}` : `${window.location.origin}/assets/${assetId}`;

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    let timer = 0;
    async function start() {
      const DetectorClass = (window as typeof window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (!DetectorClass || !navigator.mediaDevices?.getUserMedia) { setScanMessage("QR camera scanning is not supported by this browser. You can still use or share this asset code."); setScanning(false); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current || cancelled) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new DetectorClass({ formats: ["qr_code"] });
        const detect = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results[0]?.rawValue) { window.location.assign(results[0].rawValue); return; }
          } catch { /* A frame can be unavailable while the camera warms up. */ }
          timer = window.setTimeout(detect, 350);
        };
        detect();
      } catch { setScanMessage("Camera permission was not granted. Allow camera access in your browser settings and try again."); setScanning(false); }
    }
    start();
    return () => { cancelled = true; window.clearTimeout(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [scanning]);

  async function copy() { await navigator.clipboard.writeText(detailUrl); setScanMessage("Asset link copied."); }
  async function share() { if (navigator.share) await navigator.share({ title: `${assetCode} asset`, url: detailUrl }); else await copy(); }

  return <Dialog onOpenChange={(open) => { if (!open) setScanning(false); }}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 border-white bg-white text-[#0b2a4a] hover:bg-blue-50 hover:text-[#0b2a4a] focus-visible:ring-white/70"><QrCode className="size-4" /> QR code</Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
      <DialogTitle>{assetCode} mobile QR</DialogTitle>
      <DialogDescription>Scan this label to open the canonical asset record, or use the device camera to scan another asset.</DialogDescription>
      <div className="grid place-items-center rounded-2xl border bg-white p-4">
        {/* QR is an authenticated SVG response, not a static image optimization candidate. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/assets/${assetId}/qr`} alt={`QR code for asset ${assetCode}`} className="w-full max-w-72" />
      </div>
      <p className="break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{detailUrl}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="min-h-11" onClick={copy}><Copy className="size-4" /> Copy link</Button>
        <Button variant="outline" className="min-h-11" onClick={share}><Share2 className="size-4" /> Share</Button>
      </div>
      <Button className="min-h-11" onClick={() => { setScanMessage(""); setScanning((value) => !value); }}><Camera className="size-4" /> {scanning ? "Stop camera" : "Scan an asset QR"}</Button>
      {scanning && <video ref={videoRef} muted playsInline aria-label="Camera preview for QR scanning" className="aspect-video w-full rounded-xl bg-slate-950 object-cover" />}
      {scanMessage && <p aria-live="polite" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">{scanMessage}</p>}
    </DialogContent>
  </Dialog>;
}
