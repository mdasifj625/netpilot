#!/bin/bash

echo "Generating keystore credentials..."
KEY_PASS=$(openssl rand -base64 16)
STORE_PASS=$(openssl rand -base64 16)
KEY_ALIAS="netpilot_alias"
KEYSTORE_FILE="netpilot.keystore"

echo "Generating Android Keystore..."
rm -f $KEYSTORE_FILE
keytool -genkey -v -keystore $KEYSTORE_FILE -alias $KEY_ALIAS -keyalg RSA -keysize 2048 -validity 10000 -storepass "$STORE_PASS" -keypass "$KEY_PASS" -dname "CN=mdasifj625, OU=OpenSource, O=NetPilot, L=Internet, S=Web, C=US"

echo "Converting keystore to Base64..."
KEYSTORE_BASE64=$(base64 -w 0 $KEYSTORE_FILE)

echo "Saving credentials to keystore-credentials.txt (ignored by git)..."
echo "KEYSTORE_BASE64=$KEYSTORE_BASE64" > keystore-credentials.txt
echo "KEY_ALIAS=$KEY_ALIAS" >> keystore-credentials.txt
echo "KEY_PASSWORD=$KEY_PASS" >> keystore-credentials.txt
echo "KEYSTORE_PASSWORD=$STORE_PASS" >> keystore-credentials.txt

echo "Done! Credentials saved."
