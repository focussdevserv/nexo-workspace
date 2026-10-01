function fileTimestamp(file) {
  for (const value of [file.updatedAt, file.modifiedTime, file.createdAt, file.date]) {
    if (!value) continue;
    const text = String(value).trim();
    const localDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    const timestamp = localDate
      ? new Date(Number(localDate[3]), Number(localDate[2]) - 1, Number(localDate[1])).getTime()
      : Date.parse(text);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

export function sortFilesByRecent(files) {
  return (Array.isArray(files) ? files : [])
    .map((file, index) => ({ file, index, timestamp: fileTimestamp(file) }))
    .sort((left, right) => {
      if (left.timestamp === null && right.timestamp !== null) return 1;
      if (left.timestamp !== null && right.timestamp === null) return -1;
      return right.timestamp - left.timestamp || left.index - right.index;
    })
    .map(({ file }) => file);
}

export function sortFilesByName(files) {
  return (Array.isArray(files) ? files : [])
    .map((file, index) => ({ file, index }))
    .sort((left, right) => String(left.file.name || '').localeCompare(String(right.file.name || ''), 'pt-BR', { sensitivity: 'base' }) || left.index - right.index)
    .map(({ file }) => file);
}
