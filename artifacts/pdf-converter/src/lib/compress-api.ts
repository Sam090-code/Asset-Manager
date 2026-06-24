import type { CompressResult } from "@workspace/api-client-react";

export async function compressFileApi(file: File, level: 'low' | 'balanced' | 'maximum'): Promise<{ result: CompressResult; blob: Blob }> {
  const form = new FormData();
  form.append('file', file);
  form.append('level', level);

  const res = await fetch('/api/compress', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Compression failed');
  const result: CompressResult = await res.json();

  const dlRes = await fetch(`/api/files/${result.fileId}/download`);
  if (!dlRes.ok) throw new Error('Download failed');
  const blob = await dlRes.blob();
  return { result, blob };
}
