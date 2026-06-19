package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
)

const (
	ansiReset  = "\033[0m"
	ansiRed    = "\033[31m"
	ansiGreen  = "\033[32m"
	ansiYellow = "\033[33m"
	ansiBlue   = "\033[34m"
	ansiCyan   = "\033[36m"
)

var colorLogsEnabled = detectColorSupport()

func detectColorSupport() bool {
	if os.Getenv("NO_COLOR") != "" {
		return false
	}

	term := strings.TrimSpace(strings.ToLower(os.Getenv("TERM")))
	if term == "" || term == "dumb" {
		return false
	}

	fi, err := os.Stdout.Stat()
	if err != nil {
		return false
	}

	return fi.Mode()&os.ModeCharDevice != 0
}

func colorize(input, color string) string {
	if !colorLogsEnabled {
		return input
	}
	return color + input + ansiReset
}

func logWithLevel(level, color, format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("%s %s", colorize("["+strings.ToUpper(level)+"]", color), msg)
}

func logInfo(format string, args ...interface{}) {
	logWithLevel("info", ansiGreen, format, args...)
}

func logWarn(format string, args ...interface{}) {
	logWithLevel("warn", ansiYellow, format, args...)
}

func logError(format string, args ...interface{}) {
	logWithLevel("error", ansiRed, format, args...)
}

func logSetup(format string, args ...interface{}) {
	logWithLevel("setup", ansiCyan, format, args...)
}

func statusWithColor(status int) string {
	statusText := fmt.Sprintf("%d", status)
	switch {
	case status >= http.StatusInternalServerError:
		return colorize(statusText, ansiRed)
	case status >= http.StatusBadRequest:
		return colorize(statusText, ansiYellow)
	default:
		return colorize(statusText, ansiGreen)
	}
}

func logHTTP(method, path string, status int, durationMS int64, remoteIP string, bytesOut int, userAgent string) {
	coloredMethod := colorize(method, ansiBlue)
	log.Printf(
		"%s method=%s path=%s status=%s duration_ms=%d remote_ip=%s bytes=%d ua=%q",
		colorize("[HTTP]", ansiCyan),
		coloredMethod,
		path,
		statusWithColor(status),
		durationMS,
		remoteIP,
		bytesOut,
		userAgent,
	)
}
