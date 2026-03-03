/**
 * did:verifiedcar DID Resolver
 * Hardcoded Logic — Sovereign Infrastructure
 * authority@hardcodedlogic.com
 *
 * Production Server — verifiedcar.com
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

/* ──────────────────────────────────────────────
   STATIC SPECIFICATION ROUTE
   Accessible at:
   https://verifiedcar.com/spec/
────────────────────────────────────────────── */
app.use('/spec', express.static(path.join(ROOT_DIR, 'spec')));


/* ──────────────────────────────────────────────
   ROOT CONSTANTS (ROM Lookup Table)
────────────────────────────────────────────── */
const ROM_LUT_0x4A2F = {
  root: {
    id: 'did:verifiedcar:root',
    controller: 'did:verifiedcar:root',
    domain: 'verifiedcar.com',
    enclaveVersion: '1.0.0',
    registeredBy: 'Tamer Maher Eldebes',
    authority: 'authority@hardcodedlogic.com',
    icannLock: '10-year',
    created: '2016-01-01T00:00:00Z'
  }
};

/* ──────────────────────────────────────────────
   DID DOCUMENT BUILDER
────────────────────────────────────────────── */
function buildDIDDocument(did) {
  const keyId = `${did}#auth-key-1`;
  const timestamp = new Date().toISOString();

  const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1'
  });

  const publicKey = keyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('hex');

  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://verifiedcar.com/ns/did/v1"
    ],
    "id": did,
    "controller": "did:verifiedcar:root",
    "verificationMethod": [
      {
        "id": keyId,
        "type": "EcdsaSecp256k1VerificationKey2019",
        "controller": did,
        "publicKeyHex": publicKey.substring(0, 64)
      }
    ],
    "authentication": [keyId],
    "assertionMethod": [keyId],
    "service": [
      {
        "id": `${did}#v2x-endpoint`,
        "type": "V2XAuthenticationService",
        "serviceEndpoint": "https://verifiedcar.com/resolve"
      }
    ],
    "hardcodedLogic": {
      "enclaveVersion": "1.0.0",
      "handshakeLatency": "<800μs",
      "lookupTable": "ROM_LUT_0x4A2F",
      "safetyMargin": "2.67cm @ 120km/h",
      "layerSeparation": "Auth ≠ Transport",
      "rootOfTrust": "verifiedcar.com"
    },
    "created": timestamp,
    "updated": timestamp
  };
}

/* ──────────────────────────────────────────────
   ROUTES
────────────────────────────────────────────── */

/* Home */

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'verifiedcar-landing.html'));
});

/* ───────── ROOT DID (MUST BE ABOVE GENERIC) ───────── */
app.get('/resolve/did:verifiedcar:root', (req, res) => {
  res.json({
    didDocument: {
      "@context": ["https://www.w3.org/ns/did/v1"],
      "id": "did:verifiedcar:root",
      "controller": "did:verifiedcar:root",
      "description": "Hardcoded Logic Sovereign Root — verifiedcar.com",
      "authority": "authority@hardcodedlogic.com",
      "hardcodedLogic": {
        "rootOfTrust": "verifiedcar.com",
        "icannRegistration": "10-year time-lock",
        "specification": "https://verifiedcar.com/spec/",
        "sovereignArchitect": "Tamer Maher Eldebes"
      }
    }
  });
});

/* ───────── GENERIC RESOLVER (MUST BE AFTER ROOT) ───────── */
app.get('/resolve/:did', (req, res) => {
  const did = decodeURIComponent(req.params.did);

  if (!did.startsWith('did:verifiedcar:')) {
    return res.status(400).json({
      error: 'Invalid DID method. This resolver only handles did:verifiedcar'
    });
  }

  const start = process.hrtime.bigint();
  const document = buildDIDDocument(did);
  const end = process.hrtime.bigint();
  const latencyMicroseconds = Number(end - start) / 1000;

  res.json({
    didDocument: document,
    didResolutionMetadata: {
      contentType: 'application/did+ld+json',
      resolvedAt: new Date().toISOString(),
      resolverLatency: `${latencyMicroseconds.toFixed(2)}μs`,
      resolver: 'did:verifiedcar:root',
      rootOfTrust: 'verifiedcar.com'
    },
    didDocumentMetadata: {
      created: document.created,
      updated: document.updated,
      versionId: '1'
    }
  });
});

/* ───────── WELL-KNOWN DID CONFIGURATION ───────── */
app.get('/.well-known/did.json', (req, res) => {
  res.json({
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    "id": "did:verifiedcar:verifiedcar.com",
    "controller": "did:verifiedcar:verifiedcar.com",
    "verificationMethod": [{
      "id": "did:verifiedcar:verifiedcar.com#key-1",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:verifiedcar:verifiedcar.com"
    }],
    "service": [{
      "id": "did:verifiedcar:verifiedcar.com#resolver",
      "type": "SovereignIdentityResolver",
      "serviceEndpoint": "https://verifiedcar.com/resolve"
    }]
  });
});

/* ───────── W3C DID DOMAIN LINKAGE ───────── */
app.get('/.well-known/did-configuration.json', (req, res) => {
  res.json({
    "@context": "https://identity.foundation/.well-known/did-configuration/v1",
    "linked_dids": [
      {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://identity.foundation/.well-known/did-configuration/v1"
        ],
        "type": ["VerifiableCredential", "DomainLinkageCredential"],
        "issuer": "did:verifiedcar:root",
        "issuanceDate": "2026-02-01T00:00:00Z",
        "credentialSubject": {
          "id": "did:verifiedcar:root",
          "origin": "https://verifiedcar.com"
        }
      }
    ]
  });
});

/* Health Check */
app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    method: 'did:verifiedcar',
    rootOfTrust: 'verifiedcar.com',
    resolver: 'https://verifiedcar.com/resolve',
    specification: 'https://verifiedcar.com/spec/',
    contact: 'authority@hardcodedlogic.com',
    uptime: process.uptime()
  });
});

/* ──────────────────────────────────────────────
   START SERVER
────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`did:verifiedcar Resolver running on port ${PORT}`);
  console.log(`Root of Trust: verifiedcar.com`);
  console.log(`Authority: authority@hardcodedlogic.com`);
});

module.exports = app;