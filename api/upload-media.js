export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Parse multipart form data
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const bodyStr = buffer.toString();

    // Extract boundary from content-type
    const contentType = req.headers["content-type"] || "";
    const boundary = contentType.split("boundary=")[1];
    if (!boundary) throw new Error("No boundary found");

    // Parse parts
    const parts = bodyStr.split("--" + boundary).slice(1, -1);
    let fileBuffer = null;
    let fileType = "image/jpeg";
    let accessToken = null;

    for (const part of parts) {
      const [headerSection, ...bodyParts] = part.split("\r\n\r\n");
      const body = bodyParts.join("\r\n\r\n").replace(/\r\n$/, "");
      if (headerSection.includes('name="access_token"')) {
        accessToken = body.trim();
      } else if (headerSection.includes('name="file"')) {
        const ctMatch = headerSection.match(/Content-Type: (.+)/);
        if (ctMatch) fileType = ctMatch[1].trim();
        fileBuffer = Buffer.from(body, "binary");
      }
    }

    if (!fileBuffer || !accessToken) throw new Error("Missing file or token");

    // Upload to Twitter v1.1 media upload
    const base64Media = fileBuffer.toString("base64");
    const uploadRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        media_data: base64Media,
        media_type: fileType,
      }).toString(),
    });

    const uploadData = await uploadRes.json();
    return res.status(200).json(uploadData);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
