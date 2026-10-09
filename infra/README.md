# infra

The AWS CDK app of the API. It defines every AWS resource of the project. The design is in `docs/feature-backend.md` ("Infrastructure", "Secrets and config", "Deploy").

## Stacks

| Stack | Contents | Deployed by |
|---|---|---|
| `McpTacticusAccount` | Deployer role `mcptacticus-deployer`, GitHub OIDC provider, CI role `mcptacticus-github-deploy`, budget `mcptacticus-monthly` (1 USD) | The user, with the admin profile `fxdx_admin`. Only when `lib/account-stack.ts` changes |
| `McpTacticusApi` | Lambda `mcptacticus-api`, function URL with CORS, log group `/aws/lambda/mcptacticus-api` (1 week), SSM read permission, daily keep-alive rule. Output `ApiUrl` | The user, with the deployer profile `mcptacticus`. From step 4 of the plan, GitHub Actions |

Files:

- `bin/app.ts`: the CDK app. It reads `.env`, and it sets `APP_VERSION` to the git commit. It adds `-dirty` when the tree has uncommitted changes.
- `lib/account-stack.ts`, `lib/api-stack.ts`: the two stacks.
- `scripts/put-secrets.ts`: writes the secrets of `.env` to SSM.
- `cdk.json`, `context`:
  - `githubOidcProvider`: `"create"` when the account has no GitHub OIDC provider, `"import"` when it has one. An account can have only one.
  - `reservedConcurrency`: a number, or `null` for none. A number needs an account concurrency quota above the number plus 100.
- `.env.example`: the names of `.env`. Git ignores `.env`.

## Commands

| Command | What it does |
|---|---|
| `pnpm --filter infra synth` | Builds the CloudFormation templates and the Lambda bundle in `cdk.out`. It needs no AWS credentials |
| `pnpm --filter infra test` | Stack tests |
| `pnpm --filter infra typecheck` | Type check |
| `pnpm --filter infra cdk:deploy` | Deploys `McpTacticusApi` with the profile `mcptacticus` |
| `pnpm --filter infra cdk:deploy:account` | Deploys `McpTacticusAccount` with the profile `fxdx_admin` |
| `pnpm --filter infra put-secrets` | Writes the secrets of `.env` to SSM with the profile `mcptacticus` |

`bin/app.ts` adds `McpTacticusAccount` only when `BUDGET_EMAIL` is set. Without it, every `cdk` command prints `McpTacticusAccount skipped: BUDGET_EMAIL is not set in infra/.env`.

The AWS commands below use the region `eu-central-1`, the `DEPLOY_REGION` of `.env.example`. If `infra/.env` has another region, use it in the commands.

## New machine

The user runs these steps. Coding agents do not run them.

1. Tools:

   ```sh
   brew install awscli
   ```

   Install `mongodb-atlas-cli` too, but only for work on the Atlas database user or access list.

2. The profile `fxdx_admin` needs an access key of the IAM user `fxdx_admin`. Copy it from `~/.aws/credentials` of the old machine, or create a new key in the AWS console: IAM → Users → `fxdx_admin` → Security credentials → Create access key. Then:

   ```sh
   aws configure --profile fxdx_admin
   ```

3. `infra/.env`:

   ```sh
   cp infra/.env.example infra/.env
   ```

   Set `BUDGET_EMAIL` only to deploy `McpTacticusAccount`. Leave the secrets empty. They are in SSM already, and `put-secrets` skips each name that has no value.

4. The profile `mcptacticus`. This command adds it to `~/.aws/config`. It reads the role ARN and the MFA serial from AWS. If the file has a `[profile mcptacticus]` already, delete that block first.

   ```sh
   cat >> ~/.aws/config <<EOF

   [profile mcptacticus]
   role_arn = $(aws iam get-role --role-name mcptacticus-deployer --profile fxdx_admin --query Role.Arn --output text)
   source_profile = fxdx_admin
   mfa_serial = $(aws iam list-mfa-devices --profile fxdx_admin --query 'MFADevices[0].SerialNumber' --output text)
   region = eu-central-1
   EOF
   ```

5. Check:

   ```sh
   aws sts get-caller-identity --profile mcptacticus
   ```

   It asks for the MFA code. The ARN has `assumed-role/mcptacticus-deployer`.

The commands with the profile `mcptacticus` ask for the MFA code. AWS accepts each code only once. When two commands ask within the same 30 seconds, wait for the next code.

## Secrets

`put-secrets` writes four values from `infra/.env` to SSM: `mongodb-uri`, `session-secret`, `discord-client-id`, `discord-client-secret`. The Lambda needs all four. A missing one stops the cold start with `Missing SSM parameter` and the name. So run `put-secrets` before the first deploy that has the auth routes. It prints `Wrote:` and the four names.

The Discord values come from the Discord Developer Portal (application `mcptacticus3d`).

## Later deploys

- `pnpm --filter infra cdk:deploy` after a change in `apps/api` or `infra/lib/api-stack.ts`. From step 4 of the plan, GitHub Actions does it on a push to `main`.
- `pnpm --filter infra cdk:deploy:account` only when `lib/account-stack.ts` changes.
- `pnpm --filter infra put-secrets` when a secret in `infra/.env` changes. Then commit a change and run `pnpm --filter infra cdk:deploy`.
  - The Lambda reads the SSM parameters once, at cold start. Instances that run already keep the old values.
  - The new commit changes `APP_VERSION`, so AWS replaces every instance, and the new instances read the new values.
  - A deploy without a change does nothing, and the old instances keep the old values.
- When a deploy stops with an error that asks for a newer bootstrap version, run the bootstrap again. A newer CDK version can need one.

  ```sh
  ACCOUNT=$(aws sts get-caller-identity --profile fxdx_admin --query Account --output text)
  pnpm --filter infra exec cdk bootstrap aws://$ACCOUNT/eu-central-1 --profile fxdx_admin
  ```

## Checks after a deploy

```sh
API_URL=$(aws cloudformation describe-stacks --stack-name McpTacticusApi --profile fxdx_admin --region eu-central-1 --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
curl -sS ${API_URL}health
```

It returns `{"ok":true,"version":"<commit>","db":"ok"}`. A version that ends with `-dirty` means that the deploy had uncommitted changes.

```sh
aws logs tail /aws/lambda/mcptacticus-api --since 10m --profile fxdx_admin --region eu-central-1
```

It shows one line per request and a `REPORT` line for each call. The `REPORT` line of a cold start has `Init Duration`.

## If a check fails

- `/health` returns 503 with `"db":"error"`: the logs show the name and message of the Mongo error. Check the access list, the password in `MONGODB_URI`, and that the cluster is not paused.
- The logs show `Missing SSM parameter`: run `put-secrets` with the same `DEPLOY_REGION` as the deploy.
- After a fix with `put-secrets`, the Lambda still has the old values (see "Later deploys").

## Atlas

The Free cluster and its project were created in the Atlas UI. The Atlas CLI added the rest:

- The database user `mcptacticus-api`, with `readWrite@assist3d` only. Its password is hex, so the connection string needs no URL encoding. The connection string is `MONGODB_URI`, in SSM as `/mcptacticus/prod/mongodb-uri`.
- The IP access list `0.0.0.0/0`, because the Lambda has no fixed IP address. A fixed address needs a NAT gateway, and a NAT gateway costs money.

## Emergency stop

Reserved concurrency 0 stops every call of the Lambda. The function URL then returns 429, and the keep-alive fails too.

```sh
aws lambda put-function-concurrency --function-name mcptacticus-api --reserved-concurrent-executions 0 --profile fxdx_admin --region eu-central-1
```

This is a change outside CDK. Undo it by hand when the problem is fixed:

```sh
aws lambda delete-function-concurrency --function-name mcptacticus-api --profile fxdx_admin --region eu-central-1
```

This undo is for `reservedConcurrency: null` in `cdk.json`. With a number there, use `put-function-concurrency` with that number.

## Session secret

From step 6 of the plan, a new `session-secret` logs out every user, because the old session tokens do not match the new key.

## First deploy

The commands of the first deploy (2026-10-09) are in `docs/plans/implement-backend/03-infra.md`, section "First deploy commands". They cover the bootstrap, the first deploy of `McpTacticusAccount`, the Atlas CLI commands, the first secrets, all checks and Netlify. Use them again for a new AWS account or a new Atlas cluster.
