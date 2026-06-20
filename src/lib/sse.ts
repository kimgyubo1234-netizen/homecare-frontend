export async function subscribeSse(
  url: string,
  token: string,
  onMessage: (data: unknown) => void,
  onError: (err: unknown) => void,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (err) {
    if (signal.aborted) return;
    onError(err);
    return;
  }

  if (res.status === 401) {
    onError('unauthorized');
    return;
  }

  if (!res.ok || !res.body) {
    onError(new Error(`SSE error: ${res.status}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            onMessage(JSON.parse(line.slice(6)));
          } catch {
            // malformed JSON — skip
          }
        }
      }
    }
  } catch (err) {
    if (signal.aborted) return;
    onError(err);
  }
}
