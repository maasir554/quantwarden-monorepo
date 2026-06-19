package main

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds | log.LUTC)
	logSetup("service=%s stage=boot", serviceName)

	if err := godotenv.Load(); err != nil {
		logWarn("env_file=not_loaded err=%v", err)
	} else {
		logSetup("env_file=loaded")
	}
	loadRuntimeConfig()
	logSetup("oneforall_enabled=%t oneforall_url=%q", oneForAllBaseURL != "", oneForAllBaseURL)
	logSetup(
		"timeouts subfinder=%s assetfinder=%s oneforall=%s combined=%s",
		subfinderTimeout,
		assetfinderTimeout,
		oneForAllTimeout,
		combinedTimeout,
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/", rootHandler)
	mux.HandleFunc("/subdomains", subdomainsHandler)
	mux.HandleFunc("/subfinder", subfinderHandler)
	mux.HandleFunc("/assetfinder", assetfinderHandler)
	handler := loggingMiddleware(mux)

	srv := &http.Server{
		Addr:              listenAddr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	logInfo("%s listening on %s", serviceName, listenAddr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logError("server failed: %v", err)
		log.Fatalf("server failed: %v", err)
	}
}
