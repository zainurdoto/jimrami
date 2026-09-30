let suppressDepth = 0

export function isCloudSyncSuppressed() {
  return suppressDepth > 0
}

export async function withCloudSyncSuppressed<T>(
  work: () => Promise<T>
) {
  suppressDepth += 1

  try {
    return await work()
  } finally {
    suppressDepth -= 1
  }
}
