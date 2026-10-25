import { MAX_IMAGE_SIDE, scaledSize } from './inkorg'

/** A chosen photo scaled to at most MAX_IMAGE_SIDE and re-encoded as JPEG, as base64 (no data: prefix).
 *  Re-encoding also drops the EXIF block (location, camera) and bakes in the phone's rotation. Browser
 *  only — uses a canvas. Rejects when the file can't be decoded as an image. */
export async function photoToJpegBase64(file: Blob, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { width, height } = scaledSize(bitmap.width, bitmap.height, MAX_IMAGE_SIDE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas saknas')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('kunde inte koda bilden')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
