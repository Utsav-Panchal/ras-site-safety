export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Phone photos are often 4 to 8 MB. We shrink them in the browser first
 * (max 1600 px on the long side, JPEG), which keeps uploads fast on site
 * and under the 6 MB request limit of Netlify Functions.
 */
export async function compressImage(file, { maxSide = 1600, maxBytes = 1.5 * 1024 * 1024 } = {}) {
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`"${file.name}" is not a JPG, PNG or WebP image.`);
    }

    let bitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        throw new Error(`"${file.name}" could not be read as an image.`);
    }

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // PNGs with see-through areas get a white background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    // lower the quality step by step until the file is small enough
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= maxBytes) {
            const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            return new File([blob], name, { type: 'image/jpeg' });
        }
    }
    throw new Error(`"${file.name}" is still too large after shrinking. Try a different photo.`);
}