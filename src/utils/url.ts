export function replaceHost(url: string, host: string): string {
  if (!host) return url;
  if (!host.startsWith("http")) host = "https://" + host;

  if (!host.endsWith("/")) host = host + "/";
  return url.replace(/https?:\/\/[^\/]*\//, host);
}
