# fhish gateway packaged for Google Cloud Confidential Space.
# The image digest becomes the enclave "measurement" attested by the CS vTPM token.
FROM node:20-slim

# Confidential Space requires the launcher policy as image labels.
LABEL "tee.launch_policy.allow_cmd_override"="false"
LABEL "tee.launch_policy.log_redirect"="always"

WORKDIR /app

# Off-chain gateway (real Zama tfhe) + the in-enclave attestation module.
COPY offchain/gateway /app/gateway
COPY offchain/vendor  /app/vendor
COPY tee/enclave      /app/enclave

# Wasm dep resolution (mirrors the monorepo layout).
RUN mkdir -p /packages/fhish-wasm && ln -s /app/vendor/fhish-wasm/pkg-node /packages/fhish-wasm/pkg-node

WORKDIR /app/gateway
RUN npm ci --omit=dev || npm install --omit=dev
RUN cd /app/enclave && npm init -y >/dev/null 2>&1 && npm install ethers@6

ENV PORT=8080
EXPOSE 8080 9000

# Start the attestation identity server (generates the enclave signing key + fetches the CS token)
# and the gateway (which signs decryptions with that same in-enclave key).
CMD ["sh", "-c", "node --experimental-vm-modules /app/enclave/attest.mjs & node --import /app/gateway/src/polyfill.mjs /app/gateway/src/server.ts"]
