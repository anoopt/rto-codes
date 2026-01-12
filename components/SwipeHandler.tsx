'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';

const SWIPE_HINT_STORAGE_KEY = 'rto-swipe-hint-dismissed';

interface SwipeHandlerProps {
  currentCode: string;
  allCodes: string[];
  children: React.ReactNode;
}

/**
 * Client-side swipe handler for touch gestures on mobile
 * Wraps content to enable swipe left/right navigation
 */
export default function SwipeHandler({ currentCode, allCodes, children }: SwipeHandlerProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const hasMoved = useRef<boolean>(false);

  // Get current index and adjacent RTOs
  const currentIndex = allCodes.findIndex(code => code === currentCode.toLowerCase());
  const prevCode = currentIndex > 0 ? allCodes[currentIndex - 1] : null;
  const nextCode = currentIndex < allCodes.length - 1 ? allCodes[currentIndex + 1] : null;

  // Dismiss swipe hint when user successfully swipes
  const dismissSwipeHint = () => {
    try {
      localStorage.setItem(SWIPE_HINT_STORAGE_KEY, 'true');
    } catch {
      // localStorage might not be available
    }
  };

  const navigateTo = (code: string | null) => {
    if (!code || isNavigating) return;

    // Dismiss the swipe hint since user successfully swiped
    dismissSwipeHint();

    setIsNavigating(true);
    router.push(`/rto/${code}`);

    // Reset navigation state after a short delay
    setTimeout(() => setIsNavigating(false), 300);
  };

  // Touch swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = null;
    touchEndY.current = null;
    hasMoved.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    hasMoved.current = true;
  };

  const handleTouchEnd = () => {
    // Only process swipe if user actually moved their finger
    // This prevents taps from being interpreted as swipes
    if (!hasMoved.current || touchStartX.current === null || touchEndX.current === null) {
      // Reset refs for next interaction
      touchStartX.current = null;
      touchEndX.current = null;
      touchStartY.current = null;
      touchEndY.current = null;
      hasMoved.current = false;
      return;
    }

    const swipeDistanceX = touchStartX.current - touchEndX.current;
    const swipeDistanceY = Math.abs((touchStartY.current ?? 0) - (touchEndY.current ?? 0));
    const minSwipeDistance = 75; // Minimum horizontal distance for a swipe
    const maxVerticalDistance = 100; // Maximum vertical movement to still count as horizontal swipe

    // Only trigger swipe if horizontal movement is dominant
    if (Math.abs(swipeDistanceX) > minSwipeDistance && swipeDistanceY < maxVerticalDistance) {
      if (swipeDistanceX > 0) {
        // Swiped left - go to next
        navigateTo(nextCode);
      } else {
        // Swiped right - go to previous
        navigateTo(prevCode);
      }
    }

    // Reset refs for next interaction
    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
    hasMoved.current = false;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full h-full"
    >
      {children}
    </div>
  );
}
