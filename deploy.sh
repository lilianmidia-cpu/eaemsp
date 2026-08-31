#!/bin/zsh
printf "Token Cloudflare: "
read -s CFTOKEN
echo

CLOUDFLARE_ACCOUNT_ID=9b17348cf247859e8abb6c5d82120e2c CLOUDFLARE_API_TOKEN="$CFTOKEN" npx wrangler pages deploy "/Users/ica/Pasta LC Agencia ISA/imersao-sp-2026" --project-name imersao-escritores
