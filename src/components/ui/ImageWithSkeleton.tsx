"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

interface ImageWithSkeletonProps extends Omit<ImageProps, "onLoad" | "onLoadingComplete" | "onError"> {
  skeletonClassName?: string;
  containerClassName?: string;
  fallbackSrc?: string;
}

export function ImageWithSkeleton({
  className,
  skeletonClassName,
  containerClassName,
  fallbackSrc = "/Logo2.png",
  src,
  ...props
}: ImageWithSkeletonProps) {
  const [loaded, setLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <div className={cn("relative w-full h-full", containerClassName)}>
      {!loaded && (
        <div
          className={cn(
            "absolute inset-0 bg-slate-200 animate-pulse z-[1]",
            skeletonClassName
          )}
        />
      )}
      <Image
        {...props}
        src={imgSrc}
        className={cn(
          "transition-opacity duration-300 z-[2]",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setLoaded(true)}
        onError={() => { setImgSrc(fallbackSrc); setLoaded(false); }}
      />
    </div>
  );
}
