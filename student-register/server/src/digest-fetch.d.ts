declare module "digest-fetch" {
  interface DigestFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }

  export default class DigestFetch {
    constructor(username: string, password: string, options?: { algorithm?: string });
    fetch(url: string, options?: DigestFetchOptions): Promise<Response>;
  }
}
