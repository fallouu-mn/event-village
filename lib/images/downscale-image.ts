/**
 * Finition 2a (1b) — réduction d'une image dans le navigateur avant l'envoi (page de création d'un événement seulement),
 * sans bibliothèque : l'image est redessinée dans un canvas, plus grand côté ramené à `maxSide`, puis encodée en WebP
 * (ou dans le format que le navigateur sait produire). Redessiner retire aussi les métadonnées de la photo. Le serveur
 * réencode de toute façon chaque dépôt (app/api/partner/upload) : cette étape ne fait qu'alléger l'envoi.
 * Rend le fichier d'origine si rien n'est à réduire, si le navigateur ne sait pas faire, ou si le résultat n'est pas plus
 * léger.
 */
const LIGHT_ENOUGH_BYTES = 1_500_000;

export async function downscaleImage(file: File, maxSide: number): Promise<File> {
    if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file;
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        return file;
    }
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= LIGHT_ENOUGH_BYTES) {
        bitmap.close();
        return file;
    }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
        bitmap.close();
        return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob || blob.size >= file.size || !['image/webp', 'image/jpeg', 'image/png'].includes(blob.type)) return file;
    const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${extension}`, { type: blob.type });
}
