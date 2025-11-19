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
  let apiPath = url.pathname + url.search

  // Normalizuj path - usuń podwójne slashe
  apiPath = apiPath.replace(/\/+/g, '/')

  // Upewnij się że zaczyna się od /
  if (!apiPath.startsWith('/')) {
    apiPath = '/' + apiPath
  }

  // Zbuduj URL do API CEPiK
  const cepikUrl = `https://api.cepik.gov.pl${apiPath}`

  console.log(`Proxy: ${url.pathname}${url.search} -> ${cepikUrl}`)

  try {
    // Stwórz nowy request do API CEPiK
    const apiRequest = new Request(cepikUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BRONA/4.0-Cloudflare',
        'Content-Type': 'application/json'
      }
    })

    // Wykonaj request do API CEPiK
    const response = await fetch(apiRequest)

    // Pobierz dane jako text (dla lepszego error handling)
    const responseText = await response.text()

    // Sprawdź czy to JSON error
    let responseData
    try {
      responseData = JSON.parse(responseText)

      // Jeśli API zwróciło błąd, loguj to
      if (responseData.errors && responseData.errors.length > 0) {
        console.error('API CEPiK Error:', responseData.errors[0])
      }
    } catch (e) {
      // Nie jest JSON - zwróć jako text
      responseData = { raw: responseText }
    }

    // Zwróć odpowiedź z nagłówkami CORS
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Cache-Control': 'public, max-age=60', // Cache na 1 minutę (nie 5 - dla świeższych danych)
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
      errors: [{
        'error-result': 'Proxy Error',
        'error-reason': error.message,
        'error-code': 'WORKER-ERROR',
        'error-solution': 'Sprawdź połączenie z API CEPiK'
      }]
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
