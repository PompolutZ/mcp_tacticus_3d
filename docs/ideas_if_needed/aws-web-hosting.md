# Web hosting on AWS

Status: idea. Not chosen, because Netlify costs $0 and AWS costs a few cents per month.

The goal is to host the web app in the same AWS account and CDK app as the API. Then all infra is in one place.

## Parts

| Part | Job | Needed |
|---|---|---|
| S3 bucket | Holds `apps/web/dist` (~332 MB). Private. | Yes |
| CloudFront | Serves the bucket. Only CloudFront can read the bucket (Origin Access Control). Address like `d123abc.cloudfront.net`. | Yes |
| CloudFront response headers policy | Does the job of `public/_headers`: `immutable` for `/assets/*`, `X-Robots-Tag: noindex, nofollow` on all files. | Yes |
| Route 53 + ACM certificate | Custom domain. The certificate must be in `us-east-1` for CloudFront. | Only for a custom domain |

The app uses `#room=` hash links. So CloudFront needs no fallback rule that sends every path to `index.html`.

## Deploy

- A GitHub Actions job builds the web app, runs `aws s3 sync`, then clears the CloudFront cache for `index.html`.
- CI gets AWS access through the GitHub OIDC provider in `AccountStack`. No AWS keys in GitHub.
- CDK `BucketDeployment` is not a good fit: it copies through a Lambda, which is slow for 332 MB.
- Netlify's `ignore` rule becomes a `paths:` filter in the workflow.
- `VITE_API_URL` and `VITE_DISCORD_CLIENT_ID` move from Netlify env vars to GitHub Actions variables.

## API on the same origin

CloudFront can also serve the API under `/api/*`, with the Lambda function URL as a second origin. Then the site and the API have one origin:

- No CORS. The CORS config on the function URL goes away.
- Production works like dev, where Vite forwards `/api`.
- `docs/features/auth.md` decided against a Netlify proxy, because `Set-Cookie` from a proxied API may get lost. CloudFront does not have this problem.
- The `/api/*` behavior must not cache and must forward the `Authorization` header.

## Other changes

- `SITE_ORIGIN` in `infra/lib/api-stack.ts` gets the new address (if the API stays on its own origin).
- Discord Developer Portal: new redirect URI and new privacy policy URL.
- `docs/features/backend.md` and `docs/features/auth.md`: hosting, origin, env vars.
- Netlify deploy previews go away. They cannot log in today, because Discord accepts only the registered redirect URIs.

## Cost

- CloudFront free tier: 1 TB out and 10M requests per month, every month (not only the first year).
- S3: storage of ~332 MB per copy and the PUT requests of each deploy. A few cents per month.
- Route 53: $0.50 per month per hosted zone, plus the domain.
