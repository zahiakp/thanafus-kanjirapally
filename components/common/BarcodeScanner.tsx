"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useId, useRef } from "react";

type BarcodeScannerProps = {
  active?: boolean;
  className?: string;
  onError?: (message: string) => void;
  onScan: (text: string) => void;
};

export default function BarcodeScanner({
  active = true,
  className = "h-full w-full",
  onError,
  onScan,
}: BarcodeScannerProps) {
  const regionId = `qr-scanner-${useId().replace(/:/g, "")}`;
  const onErrorRef = useRef(onError);
  const onScanRef = useRef(onScan);
  const lastScanRef = useRef({ text: "", timestamp: 0 });

  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!active) return;
    const scanner = new Html5Qrcode(regionId);
    let disposed = false;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
      (decodedText) => {
        const text = decodedText.trim();
        const now = Date.now();
        if (!text || (lastScanRef.current.text === text && now - lastScanRef.current.timestamp < 1500)) return;
        lastScanRef.current = { text, timestamp: now };
        onScanRef.current(text);
      },
      () => undefined,
    ).catch((error: unknown) => {
      if (!disposed) onErrorRef.current?.(error instanceof Error ? error.message : "Unable to start the camera scanner.");
    });

    return () => {
      disposed = true;
      const cleanup = async () => {
        try {
          if (scanner.isScanning) await scanner.stop();
        } catch {
          // Camera teardown errors are harmless during navigation/unmount.
        } finally {
          scanner.clear();
        }
      };
      void cleanup();
    };
  }, [active, regionId]);

  return <div id={regionId} className={className} />;
}
