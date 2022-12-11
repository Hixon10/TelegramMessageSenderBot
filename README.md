# TelegramMessageSenderBot
Send a text, or images to your telegram account via Web UI or HTTP API.

## Web UI
You can send messages and images to your telegram account, using this UI [https://telegrammessagesenderbot-web.pages.dev/](https://telegrammessagesenderbot-web.pages.dev/).

## Send a text with cURL
You can send notifications from your CI/CD, or just Alerts about Incidents to your telegram, using the following API:
```
curl --request POST \
  --url https://telegram-sender.workers-platform.workers.dev/sendMessage \
  --header 'Content-Type: multipart/form-data' \
  --form text=TEXT_EXAMPLE \
  --form token=YOUR_TOKEN
```

## Send an image with cURL
```
curl --request POST \
  --url https://telegram-sender.workers-platform.workers.dev/sendMessage \
  --header 'Content-Type: multipart/form-data' \
  --form 'image=@file_example_PNG_500kB.png' \
  --form token=YOUR_TOKEN
```

## Deploy this bot to your Cloudflare account
1. Create `TELEGRAM_TOKEN_STORE` Cloudflare Workers KV in [dash.cloudflare.com/](dash.cloudflare.com/).
2. Change `TELEGRAM_TOKEN_STORE-ID` in `wrangler.toml` to ID of your storage.
3. Create your telegram bot via  [@BotFather](https://t.me/BotFather). On this step you will get `BOT_TOKEN`, which is needed on the next step.
4. Set `BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET_TOKEN` Cloudflare secrets for your worker in [dash.cloudflare.com/](dash.cloudflare.com/)). `TELEGRAM_WEBHOOK_SECRET_TOKEN` is a random secure string. You will use it at the next step.
5. Execute `wrangler publish` After that, you will get `Public API URL`, which you can use to access your bot. You need this URL to set Webhook.
6. Set a Webhook, using this command (be sure, that you replace all variables here):
```
curl --request POST \
  --url https://api.telegram.org/bot{BOT_TOKEN}/setwebhook \
  --header 'Content-Type: multipart/form-data' \
  --form url={Public API URL} \
  --form secret_token={TELEGRAM_WEBHOOK_SECRET_TOKEN}
```