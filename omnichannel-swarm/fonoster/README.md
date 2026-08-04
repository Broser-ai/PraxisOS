# Fonoster · WebRTC / Voice

Official Fonoster compose (v0.17.x), patched onto `omni_net` with Traefik Host rules:

- `voice.praxios.dk`
- `voice.cirkel.dk`
- `voice.dpnnails.dk`

## Setup

```bash
cd ..
make init-keys
# set HOST_PUBLIC_IP in fonoster/.env (public IP of this node)
make deploy-fonoster
```

## Notes

- Dashboard via Traefik TLS; SIP/RTP still publish host UDP ports (Routr/RTPEngine).
- Leave `APISERVER_TWILIO_*` empty for zero-cost WebRTC-first.
- Rotate all `changeme` secrets before production.
- RSA keys: `config/keys/*.pem` (gitignored; created by `make init-keys`).
