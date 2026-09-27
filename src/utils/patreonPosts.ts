export interface PatreonPost {
  title: string;
  excerpt: string;
  url: string;
  date: string;
}

interface PatreonApiResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      title: string;
      content: string;
      published_at: string;
      url: string;
    };
  }>;
}

const FALLBACK_POST_URL = 'https://www.patreon.com/c/oppatchstudio/posts';
const MAX_RESPONSE_BYTES = 1_000_000;

function isPatreonPostUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname === 'patreon.com' || url.hostname.endsWith('.patreon.com'));
  } catch {
    return false;
  }
}

function htmlToExcerpt(content: unknown): string {
  if (typeof content !== 'string') return '';

  const withBoundaries = content
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|li|div|h[1-6])\s*>/gi, '\n');
  const document = new DOMParser().parseFromString(withBoundaries, 'text/html');
  document.querySelectorAll('script, style, template').forEach((element) => element.remove());
  const walker = document.createTreeWalker(document.body, 4);
  const fragments: string[] = [];
  while (walker.nextNode()) fragments.push(walker.currentNode.textContent ?? '');

  const words = fragments.join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return words.length > 80
    ? `${words.slice(0, 80).join(' ')}...`
    : words.join(' ');
}

function parsePatreonResponse(value: unknown): PatreonPost[] {
  if (!value || typeof value !== 'object' || !('data' in value) || !Array.isArray(value.data)) {
    return [];
  }

  return value.data.flatMap((candidate): PatreonPost[] => {
    if (!candidate || typeof candidate !== 'object' || !('id' in candidate) ||
      !('attributes' in candidate) || !candidate.attributes || typeof candidate.attributes !== 'object') {
      return [];
    }

    const id = typeof candidate.id === 'string' ? candidate.id : '';
    const attributes = candidate.attributes as Record<string, unknown>;
    const fallbackUrl = id
      ? `https://www.patreon.com/posts/${encodeURIComponent(id)}`
      : FALLBACK_POST_URL;
    const publishedAt = typeof attributes.published_at === 'string'
      ? attributes.published_at
      : '';
    const publishedDate = publishedAt ? new Date(publishedAt) : null;

    return [{
      title: typeof attributes.title === 'string' && attributes.title.trim()
        ? attributes.title
        : 'untitled post',
      excerpt: htmlToExcerpt(attributes.content),
      url: isPatreonPostUrl(attributes.url) ? attributes.url : fallbackUrl,
      date: publishedDate && !Number.isNaN(publishedDate.getTime())
        ? publishedDate.toLocaleDateString()
        : 'recent',
    }];
  });
}

async function fetchJson(url: string, headers: HeadersInit): Promise<PatreonApiResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`Patreon proxy returned ${response.status}`);
    let raw = '';
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let received = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          received += chunk.value.byteLength;
          if (received > MAX_RESPONSE_BYTES) {
            await reader.cancel('Patreon response is too large');
            throw new Error('Patreon response is too large');
          }
          raw += decoder.decode(chunk.value, {stream:true});
        }
        raw += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    } else {
      raw = await response.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) {
        throw new Error('Patreon response is too large');
      }
    }
    return JSON.parse(raw) as PatreonApiResponse;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function scrapePatreonPosts(): Promise<PatreonPost[]> {
  const apiUrl = 'https://www.patreon.com/api/posts';
  const campaignId = '14433645';
    
    const headers = {
      'Accept-Language': 'en-US,en;q=0.5'
    };

    // Try different CORS proxies if one fails
    const corsProxies = [
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/',
      'https://thingproxy.freeboard.io/fetch/'
    ];
    


    // Try different CORS proxies until one works
    let apiResponse: PatreonApiResponse | null = null;
    let lastError: unknown;
    
    for (const proxy of corsProxies) {
      try {
        const apiUrlWithParams = `${apiUrl}?filter[campaign_id]=${campaignId}&sort=-published_at&page[size]=5`;
        
        apiResponse = await fetchJson(proxy + encodeURIComponent(apiUrlWithParams), headers);

        // If we get a response with data, break out of the loop
        if (apiResponse.data.length > 0) {
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }
    
    if (!apiResponse || apiResponse.data.length === 0) {
      throw lastError instanceof Error ? lastError : new Error('Patreon posts are unavailable');
    }

    const posts = parsePatreonResponse(apiResponse);

    if (posts.length > 0) {
      return posts;
    }

  throw new Error('Patreon posts are unavailable');
}
