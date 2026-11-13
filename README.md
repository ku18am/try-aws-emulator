# try-aws-emulator

A scratch project for trying the [AWS Emulator](https://github.com/aws/aws-emulator)
locally, plus a small TypeScript example that talks to it with the AWS SDK for
JavaScript v3.

The emulator serves AWS service APIs over HTTPS on `127.0.0.1:9297`. On macOS and
Windows it runs in Docker, built from the Linux package (no prebuilt image is
published).

## Layout

```
.aws-emulator/env.sh     # loads endpoint, credentials, config and CA for this project
examples/nodejs/         # TypeScript example: S3 + DynamoDB (Node 24, no build step)
```

## Prerequisites

- Docker is running.
- AWS CLI v2 (`aws --version`), used below to verify connectivity.
- Node.js 24 for the example.

## Start the emulator

Build the image once from the latest LTS package:

```bash
mkdir -p /tmp/aws-emulator-image && cd /tmp/aws-emulator-image
cat > Dockerfile <<'EOF'
FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal
ARG TARGETARCH
RUN case "$TARGETARCH" in arm64) a=aarch64 ;; amd64) a=x86_64 ;; *) exit 1 ;; esac \
    && curl -fsSLo /tmp/aws-emulator.rpm \
       "https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator-$a.rpm" \
    && rpm -i /tmp/aws-emulator.rpm && rm /tmp/aws-emulator.rpm \
    && mkdir -p /home/emulator && chown 1000 /home/emulator
USER 1000
ENV HOME=/home/emulator
ENV PATH=/opt/aws-emulator/bin:$PATH
EXPOSE 9297
ENTRYPOINT ["aws-emulator", "-b", "0.0.0.0"]
EOF
docker build -t aws-emulator .
```

Start it on loopback only, with telemetry off:

```bash
mkdir -p "$HOME/.aws/emulator"
docker network create aws-emulator 2>/dev/null || true

MSYS_NO_PATHCONV=1 docker run -d --rm --name aws-emulator \
  --network aws-emulator \
  --cap-drop ALL --security-opt no-new-privileges --read-only \
  -e EMULATOR_TELEMETRY=off \
  -p 127.0.0.1:9297:9297 \
  -v "$HOME/.aws/emulator:/home/emulator/.aws/emulator" \
  aws-emulator
```

Check it is ready:

```bash
curl --cacert "$HOME/.aws/emulator/9297/ca.pem" \
  https://127.0.0.1:9297/__admin/health   # prints "ok"
```

### Windows notes (Git Bash / MSYS)

- Prefix Docker commands with `MSYS_NO_PATHCONV=1` (and `MSYS2_ARG_CONV_EXCL='*'`),
  otherwise MSYS rewrites the container side of `-v` into a Windows path and the
  emulator starts without its config directory.
- Mount `$HOME/.aws/emulator`, **not** `$HOME/.aws/emulator/9297`. The emulator
  creates and chmods its own port folder; a pre-created mount point is root-owned
  and the start fails with `Operation not permitted`.

### Upgrade

Stop the container, rebuild without the cache (`docker build --pull --no-cache -t aws-emulator .`),
then start it again. State from the previous run is gone.

## Connect

```bash
source .aws-emulator/env.sh
aws sts get-caller-identity   # Account 000000000000, user/emulator
```

`.aws-emulator/env.sh` loads `~/.aws/emulator/9297.env`, which sets
`AWS_ENDPOINT_URL`, `AWS_SHARED_CREDENTIALS_FILE`, `AWS_CONFIG_FILE`,
`AWS_CA_BUNDLE` and the region, and unsets real AWS credentials. It also exports
`NODE_EXTRA_CA_CERTS` for the Node SDK.

Never disable TLS verification (`--no-verify-ssl`, `NODE_TLS_REJECT_UNAUTHORIZED=0`).
The CA is regenerated on every start; trust it by path.

## Run the example

```bash
source .aws-emulator/env.sh
cd examples/nodejs
npm install
npm start          # node index.ts
npm run typecheck  # tsc --noEmit
```

## Limits to keep in mind

- State is in memory only: stopping the emulator wipes everything.
- One account (`000000000000`) and effectively one region per emulator.
- It is not a security-test target and must not receive production data or traffic.
- Coverage depends on the installed build; a `NotImplemented` response means a gap
  in that build, not a configuration problem.
- Generated `config`, `emulator_credentials` and `ca.pem` change every start and
  live outside this repository — never commit or copy them.

## Stop

```bash
docker stop aws-emulator
```
