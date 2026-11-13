# TypeScript example: S3 + DynamoDB

A minimal TypeScript program using the AWS SDK for JavaScript (v3) against the
local AWS Emulator on `https://127.0.0.1:9297`.

It creates a bucket, writes and reads back a JSON object, then creates a
DynamoDB table, writes and reads back an item, and deletes everything again.

## Prerequisites

- The emulator is running (`docker ps` shows `aws-emulator`).
- Node.js 24 (developed against v24.22.2). Node runs the `.ts` file directly
  through native type stripping, so there is no build step.
- The emulator environment is loaded in the current shell:

  ```bash
  source ../../.aws-emulator/env.sh
  ```

  That file sets `AWS_ENDPOINT_URL`, the emulator credentials and config, and
  `NODE_EXTRA_CA_CERTS` pointing at this run's `ca.pem`. Without the CA setting
  the SDK rejects the emulator's self-signed certificate; never work around that
  with `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Run

```bash
cd examples/nodejs
npm install
npm start          # node index.ts
npm run typecheck  # tsc --noEmit
```

Expected output (bucket/table names include a timestamp):

```
Using emulator at https://127.0.0.1:9297 (us-east-1)

S3 bucket: emulator-demo-1763...
S3 object read back: hello from the AWS Emulator
DynamoDB table: emulator-demo-1763...
DynamoDB item read back: Ada (engineer)

Done. ...
```

## Notes

- Node's type stripping only handles erasable TypeScript syntax. `tsconfig.json`
  sets `erasableSyntaxOnly` so `tsc` rejects enums, namespaces and parameter
  properties that Node cannot run directly.
- `forcePathStyle: true` is required for S3: the endpoint is an IP address, so
  virtual-hosted-style bucket URLs (`bucket.127.0.0.1`) would not resolve.
- After `CreateTable`, the example polls `DescribeTable` until the table is
  `ACTIVE`, as you would against AWS.
- The emulator keeps state in memory only and serves a single account
  (`000000000000`) and region; it is for local testing, not production.
- Credentials, `config` and `ca.pem` change on every emulator start. Do not
  commit them or copy the certificate elsewhere.
