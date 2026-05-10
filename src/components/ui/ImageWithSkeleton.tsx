"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

interface ImageWithSkeletonProps extends Omit<ImageProps, "onLoad" | "onLoadingComplete"> {
  skeletonClassName?: string;
  containerClassName?: string;
}

/**
 * Wraps next/image with an animate-pulse skeleton shown while the image loads.
 * The parent element must have position:relative and an explicit size (or fill context).
 */
export function ImageWithSkeleton({
  className,
  skeletonClassName,
  containerClassName,
  ...props
}: ImageWithSkeletonProps) {
  const [loaded, setLoaded] = useState(false);

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
        className={cn(
          "transition-opacity duration-300 z-[2]",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
