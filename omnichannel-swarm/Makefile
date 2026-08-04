.PHONY: help init init-keys start-gateway stop stop-all status logs \
	deploy-erxes deploy-fonoster deploy-dittofeed deploy-all deploy-demo \
	pull doctor

COMPOSE ?= docker compose
ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

help:
	@echo "Omnichannel Swarm — Praxios · Cirkel · DPN nails"
	@echo ""
	@echo "  make init             Create omni_net + ACME storage + .env skeletons"
	@echo "  make init-keys        Generate Fonoster RSA keys"
	@echo "  make start-gateway    Start Traefik"
	@echo "  make deploy-demo      HTTP demo (no DNS/SSL) — recommended first run"
	@echo "  make deploy-erxes     CRM / inbox"
	@echo "  make deploy-fonoster  WebRTC / voice"
	@echo "  make deploy-dittofeed Marketing automation"
	@echo "  make deploy-all       Gateway + Erxes + Fonoster + Dittofeed (prod TLS)"
	@echo "  make status | logs | stop | stop-all | doctor | pull"

init:
	@echo "=> omni_net + Let's Encrypt + env skeletons"
	docker network create omni_net || true
	mkdir -p $(ROOT)traefik/letsencrypt $(ROOT)fonoster/config/keys
	touch $(ROOT)traefik/letsencrypt/acme.json
	chmod 600 $(ROOT)traefik/letsencrypt/acme.json
	@if [ ! -f $(ROOT).env ]; then cp $(ROOT).env.example $(ROOT).env; echo "=> root .env created"; fi
	@if [ ! -f $(ROOT)erxes/.env ]; then cp $(ROOT)erxes/.env.example $(ROOT)erxes/.env; echo "=> erxes/.env created"; fi
	@if [ ! -f $(ROOT)fonoster/.env ]; then cp $(ROOT)fonoster/.env.example $(ROOT)fonoster/.env; echo "=> fonoster/.env created — set HOST_PUBLIC_IP"; fi
	@if [ ! -f $(ROOT)dittofeed/.env ]; then cp $(ROOT)dittofeed/.env.example $(ROOT)dittofeed/.env; echo "=> dittofeed/.env created"; fi
	@$(MAKE) init-keys
	@echo "=> Edit secrets in .env files before production. Then: make deploy-all"

init-keys:
	@mkdir -p $(ROOT)fonoster/config/keys
	@if [ ! -f $(ROOT)fonoster/config/keys/private.pem ]; then \
	  openssl genpkey -algorithm rsa -out $(ROOT)fonoster/config/keys/private.pem -pkeyopt rsa_keygen_bits:2048; \
	  openssl rsa -pubout -in $(ROOT)fonoster/config/keys/private.pem -out $(ROOT)fonoster/config/keys/public.pem; \
	  chmod 644 $(ROOT)fonoster/config/keys/*; \
	  echo "=> Fonoster RSA keys generated"; \
	else \
	  echo "=> Fonoster keys already present"; \
	fi

start-gateway:
	cd $(ROOT) && $(COMPOSE) --env-file .env up -d

stop:
	cd $(ROOT) && $(COMPOSE) down

stop-all: stop
	-cd $(ROOT)erxes && $(COMPOSE) down
	-cd $(ROOT)fonoster && $(COMPOSE) down
	-cd $(ROOT)dittofeed && $(COMPOSE) down

status:
	docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

logs:
	cd $(ROOT) && $(COMPOSE) logs -f traefik

pull:
	cd $(ROOT) && $(COMPOSE) pull
	cd $(ROOT)erxes && $(COMPOSE) pull
	cd $(ROOT)fonoster && $(COMPOSE) pull
	cd $(ROOT)dittofeed && $(COMPOSE) pull

deploy-erxes:
	@test -f $(ROOT)erxes/.env || cp $(ROOT)erxes/.env.example $(ROOT)erxes/.env
	cd $(ROOT)erxes && $(COMPOSE) --env-file .env up -d

deploy-fonoster: init-keys
	@test -f $(ROOT)fonoster/.env || cp $(ROOT)fonoster/.env.example $(ROOT)fonoster/.env
	@grep -q 'CHANGE_ME_PUBLIC_IP' $(ROOT)fonoster/.env && echo "WARN: set HOST_PUBLIC_IP in fonoster/.env" || true
	cd $(ROOT)fonoster && $(COMPOSE) --env-file .env up -d

deploy-dittofeed:
	@test -f $(ROOT)dittofeed/.env || cp $(ROOT)dittofeed/.env.example $(ROOT)dittofeed/.env
	cd $(ROOT)dittofeed && $(COMPOSE) --env-file .env up -d

deploy-all: init start-gateway deploy-erxes deploy-fonoster deploy-dittofeed
	@echo "=> Full matrix up. Run: make doctor"

deploy-demo: init
	@echo "=> Demo HTTP stack (Traefik :80/:8080, no Let's Encrypt)"
	cd $(ROOT) && $(COMPOSE) -f docker-compose.yml -f docker-compose.demo.yml --env-file .env up -d
	cd $(ROOT) && $(COMPOSE) -f erxes/docker-compose.yml -f erxes/docker-compose.demo.yml --env-file erxes/.env up -d
	@$(MAKE) init-keys
	-cd $(ROOT) && $(COMPOSE) -f dittofeed/docker-compose.yml -f dittofeed/docker-compose.demo.yml --env-file dittofeed/.env up -d
	-cd $(ROOT) && $(COMPOSE) -f fonoster/docker-compose.yml -f fonoster/docker-compose.demo.yml --env-file fonoster/.env up -d
	@echo "=> Demo up. Traefik: http://127.0.0.1:8080/dashboard/  ·  make doctor"

doctor:
	@echo "== network =="
	@docker network inspect omni_net --format '{{.Name}} {{len .Containers}} containers' 2>/dev/null || echo "omni_net MISSING — run make init"
	@echo "== expected hosts =="
	@echo "  traefik.praxios.dk"
	@echo "  crm.{praxios,cirkel,dpnnails}.dk      → Erxes"
	@echo "  voice.{praxios,cirkel,dpnnails}.dk    → Fonoster dashboard"
	@echo "  engage.{praxios,cirkel,dpnnails}.dk   → Dittofeed"
	@echo "== containers =="
	@docker ps --format '{{.Names}}' | sort
