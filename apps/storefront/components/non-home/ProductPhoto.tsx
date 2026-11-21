"use client";

import Image, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

function publicMirror(src: ImageProps["src"]) {
  if (typeof src !== "string") return undefined;
  try {
    const url = new URL(src);
    if (!url.pathname.startsWith("/static/products/")) return undefined;
    const name = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    if (!name || /[\\/]/.test(name) || !/\.(avif|webp|png|jpe?g)$/i.test(name)) return undefined;
    return `/products/${encodeURIComponent(name)}`;
  } catch {
    return undefined;
  }
}

type ProductPhotoProps = ImageProps & { fallbackSrc?: string };

export function ProductPhoto({ src, alt, onError, fallbackSrc, ...props }: ProductPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  const mirror = fallbackSrc ?? publicMirror(src);
  const [failedMirror, setFailedMirror] = useState<string>();
  const resolved = failedSrc === src ? mirror : src;
  if (!resolved || resolved === failedMirror) {
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-xs font-medium text-[#506577]">
        <ImageOff aria-hidden="true" className="size-5" />
        <span>Photo unavailable</span>
      </span>
    );
  }

  return <Image {...props} src={resolved} alt={alt} onError={event => {
    if (resolved === mirror) setFailedMirror(mirror);
    else setFailedSrc(src);
    onError?.(event);
  }} />;
}
