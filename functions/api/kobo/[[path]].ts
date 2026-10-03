/**
 * Cloudflare Pages Function — Proxy KoboToolbox API
 *
 * Route : /api/kobo/* → https://kf.kobotoolbox.org/api/v2/*
 */

interface Env {
  VITE_KOBO_TOKEN: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  // Chemin après /api/kobo/ — params.path est un tableau de segments
  const pathSegments = (params['path'] as string[] | undefined) ?? [];
  const koboPath = pathSegments.join('/');

  // Reconstruire l'URL vers KoboToolbox
  // Ex: /api/kobo/me/ → https://kf.kobotoolbox.org/api/v2/me/
  // Ex: /api/kobo/assets/UID/data/?format=json → https://kf.kobotoolbox.org/api/v2/assets/UID/data/?format=json
  const originalUrl = new URL(request.url);

  // Préserver le slash final si présent dans l'URL originale
  const originalPath = originalUrl.pathname; // ex: /api/kobo/me/
  const trailingSlash = originalPath.endsWith('/') ? '/' : '';
  const koboPathWithSlash = koboPath.endsWith('/') ? koboPath : koboPath + trailingSlash;

  const targetUrl = `https://kf.kobotoolbox.org/api/v2/${koboPathWithSlash}${originalUrl.search}`;

  // Token depuis les variables d'environnement Cloudflare
  const token = env.VITE_KOBO_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'VITE_KOBO_TOKEN non configuré dans Cloudflare Pages' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Relayer la requête vers KoboToolbox
  let koboResponse: Response;
  try {
    koboResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.text()
        : undefined,
      redirect: 'follow',
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erreur proxy: ${String(err)}`, targetUrl }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Récupérer le corps de la réponse
  const responseBody = await koboResponse.text();

  // En cas de 404, renvoyer l'URL ciblée pour faciliter le debug
  if (koboResponse.status === 404) {
    return new Response(
      JSON.stringify({
        error: 'KoboToolbox 404',
        targetUrl,
        koboResponse: responseBody.slice(0, 500),
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Retourner avec headers CORS
  return new Response(responseBody, {
    status: koboResponse.status,
    headers: {
      'Content-Type': koboResponse.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

// Gérer les requêtes OPTIONS (preflight CORS)
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
};
