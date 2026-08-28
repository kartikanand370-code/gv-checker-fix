export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const card = body.card;

    if (typeof card !== "string" || !/^\d{16}$/.test(card)) {
      return res.status(400).json({
        error: "invalid card"
      });
    }

    const upstream = await fetch(
      "https://api.croma.com/qwikcilver/v1/transactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://www.croma.com",
          "Referer": "https://www.croma.com/"
        },
        body: JSON.stringify({
          TransactionTypeId: 306,
          InputType: "1",
          Cards: [
            {
              CardNumber: card
            }
          ]
        })
      }
    );

    const raw = await upstream.text();

    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      data = {};
    }

    if (!upstream.ok) {
      const message =
        data.message ||
        data.error ||
        `HTTP ${upstream.status}`;

      const code =
        upstream.status === 429 || upstream.status >= 500
          ? upstream.status
          : 502;

      return res.status(code).json({
        error: "Croma API request failed",
        upstreamStatus: upstream.status,
        message
      });
    }

    const cardData =
      data?.Cards?.[0] ||
      data?.cards?.[0] ||
      data?.data?.Cards?.[0] ||
      data?.data?.cards?.[0];

    if (!cardData || typeof cardData !== "object") {
      return res.status(502).json({
        error: "Croma API returned no card details",
        upstreamStatus: upstream.status
      });
    }

    const balance =
      cardData.Balance ??
      cardData.balance ??
      cardData.AvailableBalance ??
      cardData.availableBalance;

    const status =
      cardData.CardStatus ??
      cardData.cardStatus ??
      cardData.Status ??
      cardData.status;

    const expiry =
      cardData.ExpiryDate ??
      cardData.expiryDate ??
      cardData.Expiry ??
      cardData.expiry;

    if (
      balance === undefined &&
      status === undefined &&
      expiry === undefined
    ) {
      return res.status(502).json({
        error: "Croma API field format changed",
        upstreamStatus: upstream.status
      });
    }

    return res.status(200).json({
      card,
      balance,
      status,
      expiry
    });
  } catch (_) {
    return res.status(502).json({
      error: "Unable to contact Croma API"
    });
  }
}
