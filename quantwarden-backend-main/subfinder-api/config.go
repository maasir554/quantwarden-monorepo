package main

import (
	"os"
	"strings"
	"time"
)

const (
	serviceName        = "subfinder-api"
	defaultListenAddr  = ":8085"
	subfinderTimeout   = 1 * time.Minute
	assetfinderTimeout = 1 * time.Minute
	combinedTimeout    = 60 * time.Second
)

var listenAddr = defaultListenAddr

func loadRuntimeConfig() {
	listenAddr = strings.TrimSpace(os.Getenv("SUBFINDER_API_ADDR"))
	if listenAddr == "" {
		listenAddr = defaultListenAddr
	}

}
