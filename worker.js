
const UPSTREAM = "https://tv.mne-me.net";
const SITE_ORIGIN = "https://badalmer.github.io";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get("Origin") !== SITE_ORIGIN) {
      return new Response("Forbidden", { status: 403 });
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return new Response("Method not allowed", { status: 405 });
    }

    const isGuide = url.pathname === "/api/xmltv.xml";
    const isStream = url.pathname.startsWith("/stream/");

    if (!isGuide && !isStream) {
      return new Response("Not found", { status: 404 });
    }

    const cors = {
      "Access-Control-Allow-Origin": SITE_ORIGIN,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, If-Range",
      "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const headers = new Headers();
    for (const name of ["Range", "If-Range"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const upstreamURL = UPSTREAM + url.pathname + url.search;

    let response;
    try {
      response = await fetch(upstreamURL, {
        method: request.method,
        headers
      });
    } catch {
      return new Response("Tunarr connection failed", {
        status: 502,
        headers: cors
      });
    }

    const responseHeaders = new Headers(response.headers);
    for (const [name, value] of Object.entries(cors)) {
      responseHeaders.set(name, value);
    }

    const type = response.headers.get("Content-Type") || "";

    if (
      isStream &&
      request.method === "GET" &&
      response.ok &&
      url.pathname.endsWith(".m3u8") &&
      type.toLowerCase().includes("mpegurl")
    ) {
      let playlist = await response.text();

      playlist = playlist.replace(
        /https?:\/\/tv\.mne-me\.net\/stream\//g,
        url.origin + "/stream/"
      );

      responseHeaders.delete("Content-Length");
      responseHeaders.delete("Content-Encoding");

      return new Response(playlist, {
        status: response.status,
        headers: responseHeaders
      });
    }

    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      headers: responseHeaders
    });
  }
};
