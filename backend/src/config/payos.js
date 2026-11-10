import { PayOS } from "@payos/node";
import dotenv from "dotenv";

dotenv.config();

let client;

// Created on first use, so missing PayOS credentials only fail payment endpoints
// instead of crashing the whole API at import time.
function getClient() {
  client ??= new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY
  });
  return client;
}

export const payOS = new Proxy({}, {
  get(_target, property) {
    return getClient()[property];
  }
});
