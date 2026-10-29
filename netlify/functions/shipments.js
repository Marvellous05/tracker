const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

function headers() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.ADMIN_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
  };
}

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers()
  });
}

function validToken(token, secret) {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return false;
    }

    return JSON.parse(
      Buffer.from(payload, "base64url").toString()
    ).exp > Date.now();
  } catch {
    return false;
  }
}

export default async (request) => {
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers() });
  }

  try {
    // Create the store inside the request handler.
    const store = getStore("globaltrack-shipments");
    const url = new URL(request.url);
    const trackingNumber = url.searchParams.get("trackingNumber");

    if (method === "GET") {
      // Public customers can look up a shipment by tracking number.
      if (trackingNumber) {
        const shipment = await store.get(
          trackingNumber.toUpperCase(),
          { type: "json" }
        );

        return shipment
          ? response(200, { shipment })
          : response(404, { error: "Shipment not found" });
      }

      // Listing all shipments requires admin authentication.
      const authorization = request.headers.get("authorization") || "";
      const token = authorization.replace(/^Bearer\s+/i, "");
      const secret = process.env.SESSION_SECRET;

      if (!secret || !validToken(token, secret)) {
        return response(401, { error: "Please sign in again." });
      }

      const { blobs } = await store.list();
      const shipments = [];

      for (const blob of blobs) {
        const shipment = await store.get(blob.key, { type: "json" });
        if (shipment) shipments.push(shipment);
      }

      shipments.sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt))
      );

      return response(200, { shipments });
    }

    // All write operations require admin authentication.
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const secret = process.env.SESSION_SECRET;

    if (!secret || !validToken(token, secret)) {
      return response(401, { error: "Admin access required." });
    }

    if (method === "POST") {
      const body = await request.json();
      const shipment = body.shipment;

      if (
        !shipment ||
        !shipment.trackingNumber ||
        !shipment.origin ||
        !shipment.destination ||
        !Array.isArray(shipment.legs) ||
        !shipment.legs.length
      ) {
        return response(400, {
          error: "Shipment details and at least one stage are required."
        });
      }

      shipment.trackingNumber = String(shipment.trackingNumber)
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "");

      await store.setJSON(shipment.trackingNumber, shipment);

      return response(200, { shipment });
    }

    if (method === "DELETE") {
      if (!trackingNumber) {
        return response(400, { error: "Tracking number required." });
      }

      await store.delete(trackingNumber.toUpperCase());
      return response(200, { ok: true });
    }

    return response(405, { error: "Method not allowed" });
  } catch (error) {
    console.error("GlobalTrack shipments error:", error);

    return response(500, {
      error: "Server error. Check Netlify function logs."
    });
  }
};
