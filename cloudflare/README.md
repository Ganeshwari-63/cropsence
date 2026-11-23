# Publish CropSense on Cloudflare Workers Free

This setup serves the React site as global static assets and runs the existing API routes in a Cloudflare Worker. It does not use an application database. Gemini stays server-side as a Cloudflare secret.

## One-time setup

From the CropSense project folder:

```powershell
npm --prefix client ci
npm --prefix cloudflare ci
```

Then connect the Cloudflare account and add the Gemini key as a secret:

```powershell
cd cloudflare
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
```

Enter the key in the terminal prompt. Do not put it in a source file or share it in chat.

## Publish or update

From the `cloudflare` folder, run:

```powershell
npm run deploy
```

Wrangler prints the public `workers.dev` address after deployment. Keep the account on the Workers Free plan; Cloudflare will reject requests that exceed its free limits rather than silently upgrading the service.

The build splits only videos that exceed Cloudflare's 25 MiB individual asset limit. The Worker reassembles them at the original URLs and supports video byte-range requests. Smaller videos and regular site files are served directly as static assets.
