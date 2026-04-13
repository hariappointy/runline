import type { RunlinePluginAPI } from "runline";

export default function mailgun(rl: RunlinePluginAPI) {
  rl.setName("mailgun");
  rl.setVersion("0.1.0");

  rl.setConnectionSchema({
    apiKey: { type: "string", required: true, description: "Mailgun API key", env: "MAILGUN_API_KEY" },
    domain: { type: "string", required: true, description: "Sending domain (e.g. mg.example.com)", env: "MAILGUN_DOMAIN" },
    region: { type: "string", required: false, description: "us (default) or eu", default: "us" },
  });

  rl.registerAction("email.send", {
    description: "Send an email via Mailgun",
    inputSchema: {
      to: { type: "string", required: true, description: "Recipient email(s), comma-separated" },
      from: { type: "string", required: true, description: "Sender (e.g. 'Name <user@domain.com>')" },
      subject: { type: "string", required: true, description: "Subject" },
      text: { type: "string", required: false, description: "Plain text body" },
      html: { type: "string", required: false, description: "HTML body" },
      cc: { type: "string", required: false, description: "CC recipients" },
      bcc: { type: "string", required: false, description: "BCC recipients" },
      tags: { type: "array", required: false, description: "Tags for tracking" },
    },
    async execute(input, ctx) {
      const { to, from, subject, text, html, cc, bcc, tags } = input as Record<string, unknown>;
      const cfg = ctx.connection.config;
      const apiKey = cfg.apiKey as string;
      const domain = cfg.domain as string;
      const region = (cfg.region as string) ?? "us";
      const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";

      const form = new URLSearchParams();
      form.set("to", to as string);
      form.set("from", from as string);
      form.set("subject", subject as string);
      if (text) form.set("text", text as string);
      if (html) form.set("html", html as string);
      if (cc) form.set("cc", cc as string);
      if (bcc) form.set("bcc", bcc as string);
      if (tags && Array.isArray(tags)) {
        for (const tag of tags) form.append("o:tag", tag as string);
      }

      const res = await fetch(`${baseUrl}/v3/${domain}/messages`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`api:${apiKey}`)}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Mailgun error ${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}
