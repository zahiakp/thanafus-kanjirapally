'use client';

import React, { useEffect } from "react";
import { hexColor } from "../../app/data/branding";

function LDRloader() {
  useEffect(() => {
    import("ldrs").then(({ tailspin }) => tailspin.register());
  }, []);

  return (
    <div className="w-full flex items-center justify-center">
      <l-tailspin size="40" stroke="5" speed="0.9" color={hexColor || "#f97316"}></l-tailspin>
    </div>
  );
}

export default LDRloader;
