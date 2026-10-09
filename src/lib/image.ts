// Shrinks a photo in the browser and returns it as a JPEG data URL small enough
// to store directly inside a Firestore document (hard limit ~1 MB per document).
export const MAX_IMAGE_CHARS = 650000;

export async function compressImage(file: File, maxDim = 1024): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image. Try a JPG or PNG.'));
      el.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const quality of [0.8, 0.65, 0.5, 0.4]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= MAX_IMAGE_CHARS) return data;
    }
    throw new Error('That image is too large. Please choose a smaller one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
