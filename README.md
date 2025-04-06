# Aliyun CDN SSL Certificate Auto-Renewal Worker

A Cloudflare Worker that automatically renews SSL certificates for Aliyun CDN using Let's Encrypt.

## Features

- Automatically renews SSL certificates for Aliyun CDN domains
- Uses Let's Encrypt for free SSL certificates
- Runs on a configurable schedule
- Supports both production and staging environments
- Secure storage of credentials using Cloudflare Workers secrets

## Prerequisites

- Cloudflare account
- Aliyun account with:
  - CDN service enabled
  - Access Key with appropriate permissions
  - Domain configured in CDN
- Domain DNS managed by Aliyun DNS

## Configuration

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your configuration:

```bash
# Aliyun Configuration
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_DOMAIN_NAME=your.domain.com
ALIYUN_REGION=cn-hangzhou
ALIYUN_ENDPOINT=https://cdn.console.aliyun.com/data/api.json
ALIYUN_CERT_NAME=auto-renewed-cert

# Let's Encrypt Configuration
LE_EMAIL=your-email@example.com
LE_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory  # Production
# LE_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory  # Staging
```

3. Set up environment variables in Cloudflare:

```bash
wrangler secret put ALIYUN_ACCESS_KEY_ID
wrangler secret put ALIYUN_ACCESS_KEY_SECRET
wrangler secret put LE_EMAIL
```

## Installation

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Deploy the worker:
```bash
wrangler deploy
```

## Usage

The worker will automatically run on the configured schedule (default: daily at midnight). You can also trigger it manually:

```bash
wrangler dev
```

## Testing

Before deploying to production, it's recommended to test with Let's Encrypt's staging environment:

1. Set `LE_DIRECTORY_URL` to the staging URL
2. Deploy and test
3. Once confirmed working, switch to production URL

## Security Considerations

- All sensitive credentials are stored as Cloudflare Workers secrets
- The worker uses Let's Encrypt's DNS-01 challenge for domain validation
- Certificates are automatically renewed before expiration
- Access Keys should have minimal required permissions

## Troubleshooting

- Check Cloudflare Workers logs for errors
- Verify DNS records are properly configured
- Ensure Aliyun Access Key has correct permissions
- Test with staging environment first

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 