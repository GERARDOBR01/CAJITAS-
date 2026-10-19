/**
 * A photo small enough to travel inside a Firestore document: JPEG, at most
 * `side` px on its longest edge and about `maxChars` once encoded.
 */
export async function compressImage(file, side = 900, maxChars = 300000) {
  if (!file.type.startsWith("image/"))
    throw new Error("Elige una foto (JPG o PNG).");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (let quality = 0.82; quality > 0.3; quality -= 0.12) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= maxChars) return url;
  }
  throw new Error("La foto es muy pesada. Prueba con otra.");
}
