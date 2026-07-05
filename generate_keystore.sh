#!/bin/bash
set -e

echo "Generating keystore credentials..."
KEY_PASS=$(openssl rand -base64 16)
STORE_PASS=$(openssl rand -base64 16)
KEY_ALIAS="netpilot_alias"
KEYSTORE_FILE="netpilot.keystore"

echo "Generating Android Keystore..."
keytool -genkey -v -keystore $KEYSTORE_FILE -alias $KEY_ALIAS -keyalg RSA -keysize 2048 -validity 10000 -storepass "$STORE_PASS" -keypass "$KEY_PASS" -dname "CN=mdasifj625, OU=OpenSource, O=NetPilot, L=Internet, S=Web, C=US"

echo "Converting keystore to Base64..."
KEYSTORE_BASE64=$(base64 -w 0 $KEYSTORE_FILE)

echo "Uploading secrets to GitHub via gh CLI..."
gh secret set KEYSTORE_BASE64 --body "$KEYSTORE_BASE64"
gh secret set KEY_ALIAS --body "$KEY_ALIAS"
gh secret set KEY_PASSWORD --body "$KEY_PASS"
gh secret set KEYSTORE_PASSWORD --body "$STORE_PASS"

echo "Saving credentials to keystore-credentials.txt (ignored by git)..."
echo "KEYSTORE_BASE64=uploaded_to_github" > keystore-credentials.txt
echo "KEY_ALIAS=$KEY_ALIAS" >> keystore-credentials.txt
echo "KEY_PASSWORD=$KEY_PASS" >> keystore-credentials.txt
echo "KEYSTORE_PASSWORD=$STORE_PASS" >> keystore-credentials.txt

echo "keystore-credentials.txt" >> .gitignore
echo "*.keystore" >> .gitignore

echo "Done! Secrets are set."
