export function clientProfileSelectionKey(client) {
  if (!client || typeof client !== "object") return "client-profile:none";

  const identity = client.id ?? client.email ?? client.name;
  return `client-profile:${String(identity ?? "unknown")}`;
}
