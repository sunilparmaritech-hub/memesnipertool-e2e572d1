import { useState } from "react";
import { cn } from "@/lib/utils";

interface TokenImageProps {
  symbol: string;
  address?: string | null;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "w-5 h-5 text-[8px]",
  sm: "w-7 h-7 text-[9px]",
  md: "w-9 h-9 text-[11px]",
  lg: "w-11 h-11 text-sm",
};

/**
 * Shows a real token image from DexScreener CDN, falling back to a letter avatar.
 * Usage: <TokenImage symbol="BONK" address="DezXAZ8z7..." size="sm" />
 */
export default function TokenImage({ symbol, address, imageUrl, size = "sm", className }: TokenImageProps) {
  const [imgError, setImgError] = useState(false);
  const [fallbackIdx, setFallbackIdx] = useState(0);

  // Try multiple image sources in order
  const imageSources = [
    imageUrl, // metadata image first
    address ? `https://dd.dexscreener.com/ds-data/tokens/solana/${address}.png?size=sm` : null,
    address ? `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${address}/logo.png` : null,
  ].filter(Boolean) as string[];

  const fallback = (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-primary/30 to-accent/20 border border-border/40 flex items-center justify-center font-bold uppercase shrink-0",
        sizeClasses[size],
        className
      )}
    >
      {(symbol || "?").slice(0, 2)}
    </div>
  );

  const currentSrc = imageSources[fallbackIdx];

  if (!currentSrc || imgError) return fallback;

  return (
    <img
      src={currentSrc}
      alt={symbol}
      onError={() => {
        if (fallbackIdx < imageSources.length - 1) {
          setFallbackIdx(prev => prev + 1);
        } else {
          setImgError(true);
        }
      }}
      className={cn(
        "rounded-full object-cover shrink-0 bg-secondary",
        sizeClasses[size],
        className
      )}
      loading="lazy"
    />
  );
}
