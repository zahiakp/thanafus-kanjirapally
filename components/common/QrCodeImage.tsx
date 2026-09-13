"use client";

import { toDataURL } from "qrcode";
import { useEffect, useState } from "react";

type QrCodeImageProps = {
  className?: string;
  size?: number;
  value: string;
};

export default function QrCodeImage({ className, size = 200, value }: QrCodeImageProps) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;
    toDataURL(value, { width: size, margin: 0, errorCorrectionLevel: "M" })
      .then((url) => { if (active) setSource(url); })
      .catch(() => { if (active) setSource(""); });
    return () => { active = false; };
  }, [size, value]);

  if (!source) return <span className={className} aria-label="Generating QR code" />;
  return <img src={source} className={className} width={size} height={size} alt="Participant QR code" />;
}
