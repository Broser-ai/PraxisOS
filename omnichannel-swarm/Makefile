.PHONY: init start-gateway stop status logs deploy-erxes deploy-fonoster deploy-dittofeed deploy-all help

COMPOSE ?= docker compose
ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

help:
	@echo "Omnichannel Swarm · targets"
	@echo "  make init            Create omni_net + Let's Encrypt volume perms"
	@echo "  make start-gateway   Start Traefik master gateway"
	@echo "  make stop            Stop root gateway stack"
	@echo "  make status          Show running containers"
	@echo "  make logs            Follow Traefik logs"
	@echo "  make deploy-erxes    Start Erxes stack on omni_net"
	@echo "  make deploy-fonoster Start Fonoster stack (when configured)"
	@echo "  make deploy-dittofeed Start Dittofeed stack (when configured)"
	@echo "  make deploy-all      Gateway + Erxes (+ stubs if present)"

init:
	@echo "=> Initialiserer Swarm Netværk (omni_net)..."
	docker network create omni_net || true
	mkdir -p $(ROOT)traefik/letsencrypt
	touch $(ROOT)traefik/letsencrypt/acme.json
	chmod 600 $(ROOT)traefik/letsencrypt/acme.json
	@if [ ! -f $(ROOT).env ]; then cp $(ROOT).env.example $(ROOT).env; echo "=> Created .env from .env.example — edit ACME_EMAIL / auth"; fi
	@echo "=> Gateway klar."

start-gateway:
	cd $(ROOT) && $(COMPOSE) up -d

stop:
	cd $(ROOT) && $(COMPOSE) down

status:
	docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

logs:
	cd $(ROOT) && $(COMPOSE) logs -f traefik

deploy-erxes:
	@test -f $(ROOT)erxes/docker-compose.yml || (echo "Missing erxes/docker-compose.yml" && exit 1)
	@test -f $(ROOT)erxes/.env || cp $(ROOT)erxes/.env.example $(ROOT)erxes/.env
	cd $(ROOT)erxes && $(COMPOSE) up -d

deploy-fonoster:
	@test -f $(ROOT)fonoster/docker-compose.yml || (echo "Fonoster compose not ready yet" && exit 1)
	cd $(ROOT)fonoster && $(COMPOSE) up -d

deploy-dittofeed:
	@test -f $(ROOT)dittofeed/docker-compose.yml || (echo "Dittofeed compose not ready yet" && exit 1)
	cd $(ROOT)dittofeed && $(COMPOSE) up -d

deploy-all: init start-gateway deploy-erxes
	@echo "=> Gateway + Erxes up. Fonoster/Dittofeed: configure then make deploy-*"
