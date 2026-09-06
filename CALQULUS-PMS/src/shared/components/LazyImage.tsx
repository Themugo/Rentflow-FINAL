import { useState, useEffect, useRef, memo, type CSSProperties } from 'react';
import { cn } from '@/shared/lib/utils';

interface LazyImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  /** IntersectionObserver root margin (default: '200px' for early loading) */
  rootMargin?: string;
  /** Placeholder shown while loading */
  placeholder?: React.ReactNode;
  /** Blur up placeholder (loads low-res first) */
  blurPlaceholder?: boolean;
}

function LazyImage({
  src,
  alt,
  className,
  fallbackSrc,
  width,
  height,
  style,
  onLoad,
  onError,
  rootMargin = '200px',
  placeholder,
  blurPlaceholder = false,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [src, rootMargin]);

  // Handle load
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Handle error
  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Determine final src
  const finalSrc = hasError || !src 
    ? (fallbackSrc || '/placeholder.svg') 
    : src;

  // Create blur style for placeholder
  const blurStyle: CSSProperties = blurPlaceholder && !isLoaded ? {
    filter: 'blur(20px)',
    transform: 'scale(1.1)', // Prevent blur edges from showing
  } : {};

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted',
        className
      )}
      style={{
        width,
        height,
        ...style,
      }}
    >
      {/* Placeholder shown before load */}
      {!isLoaded && placeholder && (
        <div className="absolute inset-0 flex items-center justify-center">
          {placeholder}
        </div>
      )}

      {/* Skeleton placeholder when no custom placeholder */}
      {!isLoaded && !placeholder && (
        <div 
          className="absolute inset-0 animate-pulse bg-muted"
          style={blurStyle}
        />
      )}

      {/* Actual image - only load when in view */}
      {isInView && (
        <img
          ref={imgRef}
          src={finalSrc}
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            ...blurStyle,
          }}
        />
      )}
    </div>
  );
}

// Avatar-optimized lazy image
interface LazyAvatarProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackInitials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

function LazyAvatar({
  src,
  alt,
  className,
  fallbackInitials = '?',
  size = 'md',
}: LazyAvatarProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-full overflow-hidden bg-navy-primary flex items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      {/* Fallback initials */}
      {!isLoaded && !isInView && (
        <span className="font-medium text-slate-900">{fallbackInitials}</span>
      )}

      {/* Image */}
      {isInView && src && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setIsLoaded(true);
            setHasError(true);
          }}
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Initials fallback overlay */}
      {(!src || hasError) && (
        <span className="font-medium text-slate-900">{fallbackInitials}</span>
      )}
    </div>
  );
}

// Property card optimized image with blur-up effect
interface PropertyImageProps {
  src: string | null | undefined;
  propertyName: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'portrait' | '4/3' | '16/9';
}

const aspectRatioClasses = {
  video: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
};

function PropertyImage({
  src,
  propertyName,
  className,
  aspectRatio = 'video',
}: PropertyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [blurDataUrl, setBlurDataUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px', threshold: 0 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  // Generate a tiny placeholder (you'd typically have server-generated blur hashes)
  useEffect(() => {
    if (src) {
      // For Unsplash images, we can use their tiny size for blur
      if (src.includes('unsplash.com')) {
        setBlurDataUrl(src.split('?')[0] + '?w=20&q=10');
      }
    }
  }, [src]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted',
        aspectRatioClasses[aspectRatio],
        className
      )}
    >
      {/* Blur placeholder */}
      {blurDataUrl && !isLoaded && (
        <img
          src={blurDataUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
          aria-hidden="true"
        />
      )}

      {/* Skeleton for when no blur available */}
      {!blurDataUrl && !isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {/* Actual image */}
      {isInView && src && (
        <img
          src={src}
          alt={propertyName}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-all duration-500',
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          )}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Fallback icon */}
      {!src && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export { LazyImage, LazyAvatar, PropertyImage };
export default LazyImage;
