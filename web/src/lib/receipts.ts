import {
  ref,
  uploadBytes,
  getDownloadURL,
  getBlob,
  listAll,
  deleteObject,
} from 'firebase/storage'
import { storage } from './firebase'

export interface ReceiptFile {
  path: string
  url: string
  name: string
}

export async function uploadReceipt(
  transactionId: string,
  file: File | Blob,
  originalName?: string,
): Promise<string> {
  const name = originalName ?? ('name' in file ? (file as File).name : 'receipt')
  const ext = name.includes('.') ? name.split('.').pop() : 'jpg'
  const path = `receipts/${transactionId}/${Date.now()}.${ext}`
  await uploadBytes(ref(storage, path), file, {
    contentType: (file as File).type || 'application/octet-stream',
  })
  return path
}

export async function listReceipts(
  transactionId: string,
): Promise<ReceiptFile[]> {
  const res = await listAll(ref(storage, `receipts/${transactionId}`))
  return Promise.all(
    res.items.map(async (item) => ({
      path: item.fullPath,
      name: item.name,
      url: await getDownloadURL(item),
    })),
  )
}

export async function deleteReceipt(path: string): Promise<void> {
  await deleteObject(ref(storage, path))
}

/** Copy every receipt from one transaction to another (used when splitting). */
export async function copyReceipts(
  fromId: string,
  toId: string,
): Promise<number> {
  const files = await listReceipts(fromId)
  let n = 0
  for (const f of files) {
    try {
      const blob = await getBlob(ref(storage, f.path))
      await uploadReceipt(toId, blob, f.name)
      n++
    } catch (e) {
      console.error('copyReceipt failed', e)
    }
  }
  return n
}

/** Read a File as a base64 string (without the data: URL prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
