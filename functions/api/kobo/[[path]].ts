/**
 * Cloudflare Pages Function — Proxy KoboToolbox API
 *
 * Route : /api/kobo/* → https://kf.kobotoolbox.org/api/v2/*
 *
 * Résout le problème CORS : kf.kobotoolbox.org bloque les requêtes
 * directes depuis le navigateur. Ce Worker relaie les appels côté serveur
 * où CORS ne s'applique pas.
 *
 * Variables d'environnement requises dans Cloudflare Pages :
 *   VITE_KOBO_TOKEN — Token Bearer KoboToolbox
 */

interface Env {
  VITE_KOBO_TOKEN: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  // Chemin après /api/kobo/
  const pathSegments = (params['path'] as string[] | undefined) ?? [];
  const koboPath = pathSegments.join('/');

  // Reconstruire l'URL vers KoboToolbox
  const originalUrl = new URL(request.url);
  const koboUrl = `https://kf.kobotoolbox.org/api/v2/${koboPath}${originalUrl.search}`;

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
  const koboResponse = await fetch(koboUrl, {
    method: request.method,
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined,
  });

  // Récupérer le corps de la réponse
  const responseBody = await koboResponse.text();

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
