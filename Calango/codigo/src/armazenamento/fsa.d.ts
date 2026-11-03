// Partes da File System Access API que ainda não estão nos tipos do TypeScript.
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}
interface FileSystemHandle {
  queryPermission(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}
interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: string | FileSystemHandle;
}
interface Window {
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
}
