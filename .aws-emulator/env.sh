# Point this project at the local AWS Emulator (Docker, 127.0.0.1:9297).
# Usage (Git Bash / WSL):  source .aws-emulator/env.sh
#
# The emulator rewrites config, emulator_credentials and ca.pem on every
# start, so never commit them and never copy the CA elsewhere.
. "$HOME/.aws/emulator/9297.env"

# Node.js SDKs ignore AWS_CA_BUNDLE; they trust this run's CA via this variable.
export NODE_EXTRA_CA_CERTS="$HOME/.aws/emulator/9297/ca.pem"
