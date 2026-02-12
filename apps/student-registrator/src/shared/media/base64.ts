import { stripDataUrlPrefix } from '../../utils/image';

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(stripDataUrlPrefix(result));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(stripDataUrlPrefix(result));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
