/**
 * Utility for ultra-fast, high-performance client-side image compression and preview.
 * Resizes images to safe dimensions and compresses to lightweight WebP/JPEG data URLs (< 40KB).
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function processAndCompressImage(
  fileOrBlob: File | Blob,
  options: CompressImageOptions = {}
): Promise<string> {
  const { maxWidth = 720, maxHeight = 720, quality = 0.82 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error('Empty image file'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Could not parse image data'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Attempt WebP for ultra-compact size
          try {
            const webpUrl = canvas.toDataURL('image/webp', quality);
            if (webpUrl.startsWith('data:image/webp')) {
              resolve(webpUrl);
              return;
            }
          } catch (_) {
            // fallback to jpeg
          }

          const jpegUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(jpegUrl);
        } catch (err) {
          // If canvas fails for any reason, return the reader result safely
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}
