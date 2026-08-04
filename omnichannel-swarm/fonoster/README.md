# Fonoster · WebRTC / Voice

Zero-cost voice defaults to **data/WebRTC/SIP** via Fonoster. PSTN is fallback only.

## Next

Ask Cursor to generate `docker-compose.yml` + `.env.example` joined to `omni_net`, with Traefik labels e.g.:

- `voice.praxios.dk`
- `voice.cirkel.dk`
- `voice.dpnnails.dk`

```bash
# from omnichannel-swarm/
make deploy-fonoster
```
