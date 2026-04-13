import type { RunlinePluginAPI } from "runline";

export default function line(rl: RunlinePluginAPI) {
  rl.setName("line");
  rl.setVersion("0.1.0");
  rl.setConnectionSchema({ accessToken: { type: "string", required: true, description: "LINE Notify access token", env: "LINE_NOTIFY_TOKEN" } });

  rl.registerAction("notification.send", {
    description: "Send a LINE Notify notification",
    inputSchema: {
      message: { type: "string", required: true, description: "Notification message" },
      imageUrl: { type: "string", required: false, description: "Image thumbnail URL" },
      imageFullUrl: { type: "string", required: false, description: "Full-size image URL" },
      stickerPackageId: { type: "number", required: false, description: "Sticker package ID" },
      stickerId: { type: "number", required: false, description: "Sticker ID" },
    },
    async execute(input, ctx) {
      const { message, imageUrl, imageFullUrl, stickerPackageId, stickerId } = input as Record<string, unknown>;
      const params = new URLSearchParams({ message: message as string });
      if (imageUrl) params.set("imageThumbnail", imageUrl as string);
      if (imageFullUrl) params.set("imageFullsize", imageFullUrl as string);
      if (stickerPackageId) params.set("stickerPackageId", String(stickerPackageId));
      if (stickerId) params.set("stickerId", String(stickerId));
      const res = await fetch("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.connection.config.accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!res.ok) throw new Error(`LINE Notify error ${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}
