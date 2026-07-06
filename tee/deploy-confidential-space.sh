#!/usr/bin/env bash
# Deploy the fhish gateway to a Google Cloud Confidential Space VM (AMD SEV-SNP + vTPM).
# Prereqs: a GCP project with billing (the free $300 trial covers this), gcloud CLI authed.
# This is the M3 "one real deploy" — the SIM path (contracts/scripts/deploy_coston2.ts) needs none of it.
set -euo pipefail

PROJECT="${GCP_PROJECT:?set GCP_PROJECT}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
REPO="fhish"
IMAGE="us-central1-docker.pkg.dev/${PROJECT}/${REPO}/fhish-gateway:latest"
VM="fhish-gateway-tee"

echo "== 1. Enable services =="
gcloud services enable confidentialcomputing.googleapis.com artifactregistry.googleapis.com compute.googleapis.com --project "$PROJECT"

echo "== 2. Build & push the enclave image (its digest = the attested measurement) =="
gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION" --project "$PROJECT" 2>/dev/null || true
gcloud builds submit --tag "$IMAGE" --project "$PROJECT" -f tee/Dockerfile .
DIGEST=$(gcloud artifacts docker images describe "$IMAGE" --format='value(image_summary.digest)' --project "$PROJECT")
echo "image digest (measurement): $DIGEST"

echo "== 3. Launch the Confidential Space VM =="
gcloud compute instances create "$VM" \
  --project "$PROJECT" --zone "$ZONE" \
  --machine-type=n2d-standard-4 \
  --confidential-compute-type=SEV_SNP \
  --shielded-secure-boot --maintenance-policy=TERMINATE \
  --image-project=confidential-space-images --image-family=confidential-space \
  --metadata="^~^tee-image-reference=${IMAGE}~tee-container-log-redirect=true" \
  --tags=fhish-gateway

echo "== 4. Allow the identity + gateway ports (lock down in production) =="
gcloud compute firewall-rules create fhish-gateway-ports --project "$PROJECT" \
  --allow=tcp:8080,tcp:9000 --target-tags=fhish-gateway 2>/dev/null || true

IP=$(gcloud compute instances describe "$VM" --zone "$ZONE" --project "$PROJECT" \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "== VM up at $IP =="
echo "Next: from the repo root, register the attested enclave key on Coston2:"
echo "  ENCLAVE_URL=http://$IP:9000 node tee/verifier/register-enclave.mjs"
