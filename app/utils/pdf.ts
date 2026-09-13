export async function loadPdfImage(source: string): Promise<string | null> {
  if (!source) return null;

  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Unable to load PDF background image", source, error);
    return null;
  }
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const safeFilename = filename
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename || "download.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
