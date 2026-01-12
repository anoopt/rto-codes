import { getVerifiedRTOs } from '@/lib/rto-data';
import { getGeneratedImages } from '@/lib/cloudinary';
import HomePage from '@/components/HomePage';

export default function Home() {
  const verifiedRTOs = getVerifiedRTOs();
  const availableImages = getGeneratedImages();

  return <HomePage rtos={verifiedRTOs} availableImages={availableImages} />;
}
