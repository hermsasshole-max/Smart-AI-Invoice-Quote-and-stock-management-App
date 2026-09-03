import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ScreenDimensions {
  width: number;
  height: number;
  isLandscape: boolean;
  isPortrait: boolean;
  orientationType: string;
}

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface SafeAreaContextType {
  dimensions: ScreenDimensions;
  insets: SafeAreaInsets;
  isLandscape: boolean;
}

const defaultContext: SafeAreaContextType = {
  dimensions: {
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
    isLandscape: false,
    isPortrait: true,
    orientationType: 'portrait-primary',
  },
  insets: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  isLandscape: false,
};

const SafeAreaContext = createContext<SafeAreaContextType>(defaultContext);

export const SafeAreaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dimensions, setDimensions] = useState<ScreenDimensions>(() => {
    if (typeof window === 'undefined') return defaultContext.dimensions;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isLand = w > h;
    return {
      width: w,
      height: h,
      isLandscape: isLand,
      isPortrait: !isLand,
      orientationType: window.screen?.orientation?.type || (isLand ? 'landscape-primary' : 'portrait-primary'),
    };
  });

  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateMetrics = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isLand = w > h;
      const orientType = window.screen?.orientation?.type || (isLand ? 'landscape-primary' : 'portrait-primary');

      setDimensions({
        width: w,
        height: h,
        isLandscape: isLand,
        isPortrait: !isLand,
        orientationType: orientType,
      });

      // Compute safe area insets from CSS env variables if accessible via dummy element
      const div = document.createElement('div');
      div.style.paddingTop = 'env(safe-area-inset-top, 0px)';
      div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
      div.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
      div.style.paddingRight = 'env(safe-area-inset-right, 0px)';
      div.style.position = 'fixed';
      div.style.left = '-9999px';
      document.body.appendChild(div);

      const computed = window.getComputedStyle(div);
      const top = parseFloat(computed.paddingTop) || 0;
      const bottom = parseFloat(computed.paddingBottom) || 0;
      const left = parseFloat(computed.paddingLeft) || 0;
      const right = parseFloat(computed.paddingRight) || 0;
      document.body.removeChild(div);

      setInsets({ top, bottom, left, right });
    };

    // Initial calculation
    updateMetrics();

    // Orientation change event listeners
    window.addEventListener('resize', updateMetrics, { passive: true });
    window.addEventListener('orientationchange', updateMetrics, { passive: true });

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', updateMetrics);
    }

    return () => {
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('orientationchange', updateMetrics);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', updateMetrics);
      }
    };
  }, []);

  return (
    <SafeAreaContext.Provider
      value={{
        dimensions,
        insets,
        isLandscape: dimensions.isLandscape,
      }}
    >
      <div
        className="safe-area-root w-full min-h-full flex flex-col flex-1"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        {children}
      </div>
    </SafeAreaContext.Provider>
  );
};

export const useSafeArea = () => useContext(SafeAreaContext);

export const SafeAreaView: React.FC<{
  children: React.ReactNode;
  className?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}> = ({ children, className = '', edges = ['top', 'bottom', 'left', 'right'] }) => {
  const { insets } = useSafeArea();

  const style: React.CSSProperties = {};
  if (edges.includes('top')) {
    style.paddingTop = `max(${insets.top}px, env(safe-area-inset-top, 0px))`;
  }
  if (edges.includes('bottom')) {
    style.paddingBottom = `max(${insets.bottom}px, env(safe-area-inset-bottom, 0px))`;
  }
  if (edges.includes('left')) {
    style.paddingLeft = `max(${insets.left}px, env(safe-area-inset-left, 0px))`;
  }
  if (edges.includes('right')) {
    style.paddingRight = `max(${insets.right}px, env(safe-area-inset-right, 0px))`;
  }

  return (
    <div className={`w-full flex-1 flex flex-col ${className}`} style={style}>
      {children}
    </div>
  );
};
