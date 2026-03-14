import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

export async function saveFile(name: string, data: string) {
  if (!Capacitor.isNativePlatform()) return

  await Filesystem.writeFile({
    path: name,
    data,
    directory: Directory.Documents,
    recursive: true,
  })
}

export async function readFile(name: string) {
  if (!Capacitor.isNativePlatform()) return null

  const result = await Filesystem.readFile({
    path: name,
    directory: Directory.Documents,
  })

  return result.data
}
