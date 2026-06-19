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
	oneForAllTimeout   = 60 * time.Second
	combinedTimeout    = 60 * time.Second
)

var listenAddr = defaultListenAddr
var oneForAllBaseURL string

func loadRuntimeConfig() {
	listenAddr = strings.TrimSpace(os.Getenv("SUBFINDER_API_ADDR"))
	if listenAddr == "" {
		listenAddr = defaultListenAddr
	}

	oneForAllBaseURL = strings.TrimRight(strings.TrimSpace(os.Getenv("ONEFORALL_API_URL")), "/")
}
