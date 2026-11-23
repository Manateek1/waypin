import { createLibrary, type Audit, type AuditLibrary } from "./data";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("waypin", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("audit");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readAuditLibrary(): Promise<AuditLibrary> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const store = database.transaction("audit").objectStore("audit");
      const library = store.get("library");
      const legacy = store.get("current");
      store.transaction.oncomplete = () => {
        const saved: AuditLibrary | undefined = library.result;
        resolve(saved ?? createLibrary(legacy.result as Audit | undefined));
      };
      store.transaction.onerror = () => reject(store.transaction.error);
      store.transaction.onabort = () => reject(store.transaction.error);
    });
  } finally {
    database.close();
  }
}

async function writeLibrary(library: AuditLibrary) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("audit", "readwrite");
      const store = transaction.objectStore("audit");
      store.put(library, "library");
      store.delete("current");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

let pendingWrite = Promise.resolve();

export function saveAuditLibrary(library: AuditLibrary) {
  const result = pendingWrite.then(() => writeLibrary(library));
  pendingWrite = result.catch(() => undefined);
  return result;
}

export async function preparePhoto(file: File) {
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error("Choose a JPEG or PNG up to 20 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    bitmap.close();
  }
}
