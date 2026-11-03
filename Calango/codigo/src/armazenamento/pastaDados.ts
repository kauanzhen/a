// Escolha da pasta de dados e memória da escolha (IndexedDB do navegador),
// para que nas próximas vezes baste um clique para liberar o acesso.

const BANCO = 'calango';
const LOJA = 'preferencias';
const CHAVE = 'pasta-dados';

export function navegadorSuportaPastas(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrirBanco();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(LOJA, modo);
      const req = fn(tx.objectStore(LOJA));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function pastaLembrada(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return ((await operar('readonly', (s) => s.get(CHAVE))) as FileSystemDirectoryHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function lembrarPasta(h: FileSystemDirectoryHandle): Promise<void> {
  await operar('readwrite', (s) => s.put(h, CHAVE));
}

export async function esquecerPasta(): Promise<void> {
  await operar('readwrite', (s) => s.delete(CHAVE));
}

/** Abre a janela do Windows para escolher a pasta. null = o usuário cancelou. */
export async function escolherPasta(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) throw new Error('Este navegador não permite escolher pastas. Use o Microsoft Edge.');
  try {
    return await window.showDirectoryPicker({ id: 'calango-dados', mode: 'readwrite' });
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return null;
    throw e;
  }
}

export async function temPermissao(h: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    return (await h.queryPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

/** Precisa ser chamado a partir de um clique do usuário. */
export async function pedirPermissao(h: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}
