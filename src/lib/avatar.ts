/** Accepted avatar formats — JPG, JPEG, PNG, WEBP. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Reasonable ceiling for an uploaded avatar file. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

/** Largest dimension after resizing — keeps stored avatars small. */
const MAX_DIMENSION = 512
const JPEG_QUALITY = 0.85

export function isValidAvatarType(type: string): boolean {
  return ACCEPTED_TYPES.includes(type)
}

export function isAvatarTooLarge(size: number): boolean {
  return size > MAX_AVATAR_BYTES
}

/**
 * Validates the picked file and returns a compressed square-ish data URL
 * suitable for storage. Rejects wrong types and oversized files with a
 * human-readable reason; never throws for user-caused failures.
 */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isValidAvatarType(file.type)) {
      reject(new Error('Please choose a JPG, PNG or WEBP image.'))
      return
    }
    if (isAvatarTooLarge(file.size)) {
      reject(new Error('That image is over 5 MB. Choose a smaller one.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that image. Try again.'))
    reader.onload = () => {
      const source = reader.result
      if (typeof source !== 'string') {
        reject(new Error('Could not read that image. Try again.'))
        return
      }
      const image = new Image()
      image.onerror = () => reject(new Error('That file is not a valid image.'))
      image.onload = () => {
        try {
          const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
          const width = Math.max(1, Math.round(image.width * scale))
          const height = Math.max(1, Math.round(image.height * scale))

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d')
          if (!context) {
            reject(new Error('Could not process that image. Try again.'))
            return
          }
          context.drawImage(image, 0, 0, width, height)
          // JPEG for photos; PNG keeps transparency from PNG/WEBP sources.
          const keepAlpha = file.type === 'image/png' || file.type === 'image/webp'
          resolve(canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', keepAlpha ? undefined : JPEG_QUALITY))
        } catch {
          reject(new Error('Could not process that image. Try again.'))
        }
      }
      image.src = source
    }
    reader.readAsDataURL(file)
  })
}
