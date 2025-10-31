/**
 * BRONA - Cloudflare Worker CORS Proxy
 *
 * Ten worker działa jako proxy między aplikacją frontendową a API CEPiK,
 * rozwiązując problem CORS (Cross-Origin Resource Sharing).
 *
 * Wdrożenie:
 * 1. Utwórz konto na https://dash.cloudflare.com/
 * 2. Przejdź do Workers & Pages
 * 3. Create Worker
 * 4. Skopiuj ten kod
 * 5. Deploy
 * 6. Skopiuj URL workera (np. https://brona-proxy.your-subdomain.workers.dev)
 * 7. Wklej URL do app.js (CONFIG.API_URL)
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Obsługa wszystkich requestów
 */
async function handleRequest(request) {
  // Obsługa preflight CORS
  if (request.method === 'OPTIONS') {
    return handleCORS()
  }

  // Pobierz URL z requesta
  const url = new URL(request.url)

  // Wyciągnij ścieżkę API (wszystko po hostname)
  const apiPath = url.pathname + url.search

  // Zbuduj URL do API CEPiK
  const cepikUrl = `https://api.cepik.gov.pl${apiPath}`

  console.log(`Proxy: ${apiPath} -> ${cepikUrl}`)

  try {
    // Stwórz nowy request do API CEPiK
    const apiRequest = new Request(cepikUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BRONA/3.0-Cloudflare',
        'Content-Type': 'application/json'
      }
    })

    // Wykonaj request do API CEPiK
    const response = await fetch(apiRequest)

    // Pobierz dane
    const data = await response.arrayBuffer()

    // Zwróć odpowiedź z nagłówkami CORS
    return new Response(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Cache-Control': 'public, max-age=300', // Cache na 5 minut
        // Przekaż rate limit headers jeśli są
        ...(response.headers.get('X-RateLimit-Limit') && {
          'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit'),
          'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining'),
          'X-RateLimit-Reset': response.headers.get('X-RateLimit-Reset')
        })
      }
    })

  } catch (error) {
    // Obsługa błędów
    console.error('Worker Error:', error)

    return new Response(JSON.stringify({
      error: 'Proxy Error',
      message: error.message,
      details: 'Nie można połączyć się z API CEPiK'
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

/**
 * Obsługa preflight CORS requests
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400' // 24 godziny
    }
  })
}
